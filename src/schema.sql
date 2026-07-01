/*
This is the full database setup.
Run this once against the local Postgres container to create all tables.
Tables include sessions, clubs, shots, targets, and model_runs.
*/

DROP TABLE IF EXISTS model_runs;
DROP TABLE IF EXISTS shots;
DROP TABLE IF EXISTS targets;
DROP TABLE IF EXISTS clubs;
DROP TABLE IF EXISTS sessions;

-- A session is one Trackman session (one date)
CREATE TABLE sessions (
    session_id  SERIAL PRIMARY KEY,
    session_date DATE NOT NULL
);

-- Clubs table is a lookup table of every club/sub-group name
CREATE TABLE clubs (
    club_id     SERIAL PRIMARY KEY,
    club_name   VARCHAR(20) NOT NULL UNIQUE
);

-- Shots table has one row per actual shot and references sessions and clubs via foreign keys
CREATE TABLE shots (
    shot_id         SERIAL PRIMARY KEY,
    session_id      INT NOT NULL REFERENCES sessions(session_id),
    club_id         INT NOT NULL REFERENCES clubs(club_id),
    club_path       NUMERIC(5,2),
    face_angle      NUMERIC(5,2),
    face_to_path    NUMERIC(5,2),
    club_speed      NUMERIC(5,2),
    attack_angle    NUMERIC(5,2),
    ball_speed      NUMERIC(5,2),
    spin_rate       NUMERIC(7,2),
    carry           NUMERIC(6,2),
    side_ft         NUMERIC(6,2),
    smash_factor    NUMERIC(4,3)
);

-- Targets table has target carry and dispersion ovals for each club (GREAT, ACCEPTABLE, and the rest)
-- Side thresholds are in feet
-- Carry thresholds are in yards
-- NULL means "not applicable for this club" since some sub ranges do not have a carry target
CREATE TABLE targets (
    target_id               SERIAL PRIMARY KEY,
    club_id                 INT NOT NULL REFERENCES clubs(club_id) UNIQUE,
    target_carry            NUMERIC(6,2),       -- NULL for sub ranges (pitch shots)
    acceptable_side_ft      NUMERIC(5,2),       -- one-sided, so 7.5 means ±7.5 ft
    great_side_ft           NUMERIC(5,2),
    acceptable_carry_low    NUMERIC(6,2),       -- NULL for sub ranges (pitch shots)
    acceptable_carry_high   NUMERIC(6,2),
    great_carry_low         NUMERIC(6,2),
    great_carry_high        NUMERIC(6,2)        -- NULL for driver (no upper bound since far drives are wanted)
);

-- Model runs table logs each analysis run and the results
-- This stores the results so that the app can display the most recent analysis
CREATE TABLE model_runs (
    run_id          SERIAL PRIMARY KEY,
    run_date        TIMESTAMP DEFAULT NOW(),
    club_id         INT REFERENCES clubs(club_id),  -- NULL means analysis was ran across multiple clubs
    features_used   TEXT NOT NULL,  -- comma-separated list of predictor variables
    r_squared       NUMERIC(5,4)
);