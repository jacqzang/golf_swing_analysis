"""
This is a one time script that loads the cleaned shot data into the Postgres database. 
It reads the data in cleaned_shots.csv and inserts rows into sessions, clubs, shots, and targets. 
"""

import pandas as pd
import psycopg2
import os
from psycopg2.extras import execute_values
from src.cleaning import parse_side

DB_CONFIG = {
    "host":     os.environ.get("DB_HOST"),
    "port":     5432,
    "dbname":   os.environ.get("DB_NAME"),
    "user":     os.environ.get("DB_USER"),
    "password": os.environ.get("DB_PASSWORD"),
}

#Targets per club which are matching with schema.sql
#Side thresholds in feet and one-sided, carry thresholds in yards
#None means not applicable for that club
TARGETS = [
    #club_name,       target_carry, acc_side, great_side, acc_low, acc_high, great_low, great_high
    ("LW_0-40",       None,         7.5,      4.5,        None,    None,     None,      None),
    ("LW_40-50",      None,         15.0,     7.5,        None,    None,     None,      None),
    ("LW_50-60",      None,         15.0,     7.5,        None,    None,     None,      None),
    ("LW_60-70",      None,         15.0,     7.5,        None,    None,     None,      None),
    ("SW_70-75",      None,         15.0,     9.0,        None,    None,     None,      None),
    ("SW_75-85",      78.0,         15.0,     9.0,        73.0,    83.0,     75.0,      81.0),
    ("GW",            92.0,         15.0,     9.0,        87.0,    97.0,     89.0,      95.0),
    ("PW",            103.0,        21.0,     9.0,        96.0,    110.0,    100.0,     106.0),
    ("9 IRON",        116.0,        21.0,     9.0,        109.0,   123.0,    113.0,     119.0),
    ("8 IRON",        130.0,        30.0,     15.0,       120.0,   140.0,    125.0,     135.0),
    ("7 IRON",        143.0,        30.0,     15.0,       133.0,   153.0,    138.0,     148.0),
    ("5 WOOD",        180.0,        45.0,     24.0,       168.0,   192.0,    173.0,     187.0),
    ("DRIVER",        205.0,        60.0,     37.5,       190.0,   None,     198.0,     None),
]

def get_connection():
    return psycopg2.connect(**DB_CONFIG)

"""
Following function inserts unique sessions (dates) and clubs into their tables
Returns two dicts mapping date to session_id and club_name to club_id
"""
def seed_sessions_and_clubs(cur, df):
    unique_dates = df["Date"].unique()
    date_to_id = {}
    for date in unique_dates:
        cur.execute(
            "INSERT INTO sessions (session_date) VALUES (%s) RETURNING session_id",
            (date,)
        )
        session_id = cur.fetchone()[0]
        date_to_id[date] = session_id

    unique_clubs = df["Club"].unique()
    club_to_id = {}
    for club in unique_clubs:
        cur.execute(
            "INSERT INTO clubs (club_name) VALUES (%s) RETURNING club_id",
            (club,)
        )
        club_id = cur.fetchone()[0]
        club_to_id[club] = club_id

    return date_to_id, club_to_id

"""
The following function inserts all shot rows into the shots table.
Converts Side from "14.1L" / "0.5R" format to a float in feet where 
negative floats mean left and positive floats mean right
"""
def seed_shots(cur, df, date_to_id, club_to_id):
    shot_rows = []
    for _, row in df.iterrows():
        side_ft = row["Side"]
        shot_rows.append((
            date_to_id[row["Date"]],
            club_to_id[row["Club"]],
            row["Club Path"],
            row["Face Angle"],
            row["Face To Path"],
            row["Club Speed"],
            row["Attack Angle"],
            row["Ball Speed"],
            row["Spin Rate"],
            row["Carry"],
            side_ft,
            row["Smash Factor"],
        ))

    execute_values(cur, """
        INSERT INTO shots (
            session_id, club_id, club_path, face_angle, face_to_path,
            club_speed, attack_angle, ball_speed, spin_rate,
            carry, side_ft, smash_factor
        ) VALUES %s
    """, shot_rows)

#This function inserts the target definitions for each club
def seed_targets(cur, club_to_id):
    for row in TARGETS:
        club_name = row[0]
        if club_name not in club_to_id:
            print(f"Error: {club_name} not found in clubs table, skipping target")
            continue
        cur.execute("""
            INSERT INTO targets (
                club_id, target_carry,
                acceptable_side_ft, great_side_ft,
                acceptable_carry_low, acceptable_carry_high,
                great_carry_low, great_carry_high
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (club_to_id[club_name], *row[1:]))

if __name__ == "__main__":
    df = pd.read_csv("data/processed/cleaned_shots.csv")
    conn = get_connection()
    cur = conn.cursor()

    try:
        print("Seeding sessions and clubs...")
        date_to_id, club_to_id = seed_sessions_and_clubs(cur, df)
        print(f"  {len(date_to_id)} sessions inserted")
        print(f"  {len(club_to_id)} clubs inserted")

        print("Seeding shots...")
        seed_shots(cur, df, date_to_id, club_to_id)
        print(f"  {len(df)} shots inserted")

        print("Seeding targets...")
        seed_targets(cur, club_to_id)
        print(f"  {len(TARGETS)} targets inserted")

        conn.commit()
        print("Done.")

    except Exception as e:
        conn.rollback()
        print(f"Error: {e}")
        raise

    finally:
        cur.close()
        conn.close()