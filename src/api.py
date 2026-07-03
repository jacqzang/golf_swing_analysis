"""
This is the fastAPI backend for the swing analysis project.
It reads from local Postgres and has four API routes to access data from:

    GET  /sessions              - list all range sessions
    GET  /clubs/{club}/metrics  - per club shot stats
    GET  /analysis/latest       - most recent model run results
    POST /upload                - upload new session data (auth protected so that only authorized people can add to database
"""
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from psycopg2.extras import RealDictCursor
import psycopg2
import os

app = FastAPI(title="Golf Swing Analysis API")

#This just allows React frontend to call this API from a different port
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_CONFIG = {
    "host":     "localhost",
    "port":     5432,
    "dbname":   "golf_swing",
    "user":     "golf_user",
    "password": "golf_pass",
}

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

#This function returns all range sessions ordered by date
@app.get("/sessions")
def get_sessions(conn=Depends(get_db)):
    cur = conn.cursor()
    cur.execute("SELECT session_id, session_date FROM sessions ORDER BY session_date DESC")
    return cur.fetchall()

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
    cur = conn.cursor()
    cur.execute("""
        SELECT run_id, run_date, club_id, features_used, r_squared, notes
        FROM model_runs
        ORDER BY run_date DESC
        LIMIT 1
    """)
    result = cur.fetchone()
    if not result:
        raise HTTPException(status_code=404, detail="No analysis runs found yet")
    return result

"""
This creates a placeholder for uploading new session data
It is auth protected and requires X-API-Key header
Currently a placeholder since the S3/Lambda pipeline not created yet
"""
@app.post("/upload", dependencies=[Depends(verify_api_key)])
def upload_session(conn=Depends(get_db)):
    return {"message": "Upload endpoint ready - S3/Lambda pipeline coming soon"}