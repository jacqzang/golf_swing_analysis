"""
This is the fastAPI backend for the swing analysis project.
It reads from local Postgres and has four API routes to access data from:

    GET  /sessions              - list all range sessions
    GET  /clubs/{club}/metrics  - per club shot stats
    GET  /analysis/latest       - most recent model run results
    POST /upload                - upload new session data (auth protected so that only authorized people can add to database
"""
from fastapi import FastAPI, HTTPException, UploadFile, File, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from psycopg2.extras import RealDictCursor
from src.cleaning import parse_raw_export, drop_missing_data, apply_club_filters, convert_metrics_to_numeric
from src.analysis import run_full_analysis
from datetime import datetime
import boto3
import psycopg2
import os
import json
import io

app = FastAPI(title="Golf Swing Analysis API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "https://shotlab-frontend.onrender.com"
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_CONFIG = {
    "host":     os.environ.get("DB_HOST"),
    "port":     5432,
    "dbname":   os.environ.get("DB_NAME"),
    "user":     os.environ.get("DB_USER"),
    "password": os.environ.get("DB_PASSWORD"),
}

s3_client = boto3.client("s3")
S3_BUCKET_NAME = "shotlab-jacqueline-zang"

API_KEY = os.environ.get("API_KEY")
if not API_KEY:
    raise RuntimeError("API_KEY environment variable not set")

#This function opens a database connection to use it, and then close it when done
def get_db():
    conn = psycopg2.connect(**DB_CONFIG, cursor_factory=RealDictCursor)
    try:
        yield conn
    finally:
        conn.close()

"""
This function checks whether the correct API key was sent 
FastAPI automatically does this check for any route that uses this function
"""
def verify_api_key(x_api_key: str = Header(...)):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return x_api_key

"""
This function looks up a session by date. If it doesn't exist yet, it creates it.
Returns the session_id either way.
"""
def get_or_create_session(conn, session_date: str) -> int:
    cur = conn.cursor()
    cur.execute(
        "SELECT session_id FROM sessions WHERE session_date = %s",
        (session_date,)
    )
    existing = cur.fetchone()

    if existing:
        return existing["session_id"]

    cur.execute(
        "INSERT INTO sessions (session_date) VALUES (%s) RETURNING session_id",
        (session_date,)
    )
    new_row = cur.fetchone()
    return new_row["session_id"]

"""
The following function gets all clubs and returns a dict mapping club_name to club_id.
Clubs are a fixed lookup table (seeded once) so uploads should never create new ones.
"""
def get_club_lookup(conn) -> dict:
    cur = conn.cursor()
    cur.execute("SELECT club_id, club_name FROM clubs")
    rows = cur.fetchall()
    return {row["club_name"]: row["club_id"] for row in rows}

#This function returns all range sessions ordered by date
@app.get("/sessions")
def get_sessions(conn=Depends(get_db)):
    cur = conn.cursor()
    cur.execute("SELECT session_id, session_date FROM sessions ORDER BY session_date DESC")
    return cur.fetchall()

#This function returns the total number of shots in the database
@app.get("/shots/count")
def get_shot_count(conn=Depends(get_db)):
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) AS total FROM shots")
    result = cur.fetchone()
    return {"total_shots": result["total"]}

"""
This function returns per club shot stats: count, avg carry, std carry,
avg side (in feet), and percent of shots classified as GREAT/ACCEPTABLE/BAD.
"""
@app.get("/clubs/{club}/metrics")
def get_club_metrics(club: str, conn=Depends(get_db)):
    cur = conn.cursor()

    cur.execute("SELECT club_id FROM clubs WHERE club_name = %s", (club,))
    club_row = cur.fetchone()
    if not club_row:
        raise HTTPException(status_code=404, detail=f"Club '{club}' not found")

    club_id = club_row["club_id"]

    cur.execute("""
        SELECT
            COUNT(*)            AS shot_count,
            ROUND(AVG(carry)::numeric, 2)     AS avg_carry,
            ROUND(STDDEV(carry)::numeric, 2)  AS std_carry,
            ROUND(AVG(side_ft)::numeric, 2)   AS avg_side_ft,
            ROUND(STDDEV(side_ft)::numeric, 2) AS std_side_ft
        FROM shots
        WHERE club_id = %s
    """, (club_id,))
    stats = cur.fetchone()

    cur.execute("SELECT * FROM targets WHERE club_id = %s", (club_id,))
    target = cur.fetchone()

    return {
        "club": club,
        "stats": stats,
        "targets": target,
    }

#This returns all individual shots for a club which will be used for scatter plot
@app.get("/clubs/{club}/shots")
def get_club_shots(club: str, conn=Depends(get_db)):
    cur = conn.cursor()
    cur.execute("SELECT club_id FROM clubs WHERE club_name = %s", (club,))
    club_row = cur.fetchone()
    if not club_row:
        raise HTTPException(status_code=404, detail=f"Club '{club}' not found")
    cur.execute("""
        SELECT carry, side_ft, club_path, face_angle, face_to_path,
               club_speed, attack_angle, smash_factor
        FROM shots WHERE club_id = %s
    """, (club_row["club_id"],))
    return cur.fetchall()

#This function returns the most recent model run from model_runs
@app.get("/analysis/latest")
def get_latest_analysis(conn=Depends(get_db)):
    """Return all four group regression results from the most recent run."""
    cur = conn.cursor()
    cur.execute("""
        SELECT run_id, run_date, r_squared, results_json
        FROM model_runs
        ORDER BY run_date DESC
        LIMIT 4
    """)
    results = cur.fetchall()
    if not results:
        raise HTTPException(status_code=404, detail="No analysis runs found yet")

    parsed = []
    for row in results:
        data = json.loads(row["results_json"])
        parsed.append({
            "run_id": row["run_id"],
            "run_date": str(row["run_date"]),
            "r_squared": float(row["r_squared"]) if row["r_squared"] else None,
            "group": data.get("group"),
            "n": data.get("n"),
            "r2_train": data.get("r2_train"),
            "r2_test": data.get("r2_test"),
            "coefficients": data.get("coefficients"),
            "features_used": data.get("features_used"),
            "per_club_correlations": data.get("per_club_correlations"),
        })
    return parsed

"""
This handles uploading my new session data
It is auth protected and requires X-API-Key header so that only I can upload my data since the
analysis is cattered to my swing stats.
Accepts a raw Trackman CSV export, runs it through the cleaning pipeline,
and inserts the resulting shots into the database.
"""
@app.post("/upload", dependencies=[Depends(verify_api_key)])
async def upload_session(file: UploadFile = File(...), conn=Depends(get_db)):
    contents = await file.read()
    # Save the raw file to S3 for durable, permanent storage before any processing
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    s3_key = f"raw/{timestamp}_{file.filename}"
    s3_client.put_object(Bucket=S3_BUCKET_NAME, Key=s3_key, Body=contents)
    buffer = io.BytesIO(contents)

    df = parse_raw_export(buffer)
    df = drop_missing_data(df)
    df = apply_club_filters(df)
    df = convert_metrics_to_numeric(df)

    if df.empty:
        raise HTTPException(status_code=400, detail="No valid shots found in uploaded file")

    club_lookup = get_club_lookup(conn)
    cur = conn.cursor()
    rows_inserted = 0

    for _, row in df.iterrows():
        club_id = club_lookup.get(row["Club"])
        if club_id is None:
            raise HTTPException(status_code=400, detail=f"Unknown club: {row['Club']}")

        session_id = get_or_create_session(conn, row["Date"])

        cur.execute("""
            INSERT INTO shots (
                session_id, club_id, club_path, face_angle, face_to_path,
                club_speed, attack_angle, ball_speed, spin_rate,
                carry, side_ft, smash_factor
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            session_id, club_id,
            row["Club Path"], row["Face Angle"], row["Face To Path"],
            row["Club Speed"], row["Attack Angle"], row["Ball Speed"], row["Spin Rate"],
            row["Carry"], row["Side"], row["Smash Factor"]
        ))
        rows_inserted += 1

    conn.commit()
    run_full_analysis(conn)
    return {"message": "Upload successful", "rows_added": rows_inserted}