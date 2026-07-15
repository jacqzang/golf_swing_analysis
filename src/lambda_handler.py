"""
This is the AWS Lambda handler for processing Trackman CSVs uploaded to S3.
It is triggered automatically whenever a new file lands in the raw/ folder of the
shotlab-jacqueline-zang S3 bucket.

It runs the same cleaning + insert + analysis pipeline as the /upload endpoint
in api.py, but triggered by an S3 event instead of an HTTP request so it doesn't have
to be ran locally. 
"""

import boto3
import io
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from src.cleaning import parse_raw_export, drop_missing_data, apply_club_filters, convert_metrics_to_numeric
from src.analysis import run_full_analysis

s3_client = boto3.client("s3")

DB_CONFIG = {
    "host":     os.environ.get("DB_HOST"),
    "port":     5432,
    "dbname":   os.environ.get("DB_NAME"),
    "user":     os.environ.get("DB_USER"),
    "password": os.environ.get("DB_PASSWORD"),
}

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


def get_club_lookup(conn) -> dict:
    cur = conn.cursor()
    cur.execute("SELECT club_id, club_name FROM clubs")
    rows = cur.fetchall()
    return {row["club_name"]: row["club_id"] for row in rows}

"""
AWS calls this function automatically when a new object appears in the
S3 bucket's raw/ folder. 'event' contains details about which file triggered it.
"""
def lambda_handler(event, context):
    record = event["Records"][0]
    bucket_name = record["s3"]["bucket"]["name"]
    object_key = record["s3"]["object"]["key"]
    print(f"Processing new file: s3://{bucket_name}/{object_key}")

    response = s3_client.get_object(Bucket=bucket_name, Key=object_key)
    contents = response["Body"].read()
    buffer = io.BytesIO(contents)

    df = parse_raw_export(buffer)
    df = drop_missing_data(df)
    df = apply_club_filters(df)
    df = convert_metrics_to_numeric(df)

    if df.empty:
        print("No valid shots found in uploaded file, skipping.")
        return {"statusCode": 400, "body": "No valid shots found"}

    conn = psycopg2.connect(**DB_CONFIG, cursor_factory=RealDictCursor)
    club_lookup = get_club_lookup(conn)
    cur = conn.cursor()
    rows_inserted = 0

    for _, row in df.iterrows():
        club_id = club_lookup.get(row["Club"])
        if club_id is None:
            print(f"Unknown club: {row['Club']}. Aborting upload, no rows committed.")
            conn.rollback()
            conn.close()
            return {"statusCode": 400, "body": f"Unknown club: {row['Club']}"}

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
    print(f"Inserted {rows_inserted} shots. Running analysis...")

    run_full_analysis(conn)
    conn.close()

    print("Lambda processing complete.")
    return {"statusCode": 200, "body": f"Processed {rows_inserted} shots"}