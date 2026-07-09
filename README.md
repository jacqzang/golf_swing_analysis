# ShotLab — Personal Golf Swing Analytics Platform

**A full-stack data analytics application built on 1,184 Trackman launch monitor shots across 13 club groups, designed to answer "What swing variables actually predict shot quality?"**

Built by Jacqueline Zang · Carnegie Mellon University · Information Systems & AI Minor · NCAA Golfer

---

## Research Question

My dad told me one of his theories that specific club path and face angle ranges produce my best shots. This project tests that hypothesis as well as several other factors including smash factor, attack angle, and club speed consistency across my golf bag.

**The analysis provided partial support for the hypothesis while highlighting additional variables that play a significant role in my shot quality.**

---

## Key Findings

| Finding | Result |
|---|---|
| Face angle significance | Statistically significant in **9 of 13** club groups (p < 0.05) |
| Strongest correlation | LW 60–70 yards: r = +0.68 (p < 0.001) |
| Iron predictor | Club speed significant for all three irons tested (7i, 8i, 9i) |
| Best regression | Irons group: R² = 0.20 on held-out test set |
| Pitch shots | Near-zero R² (0.04) — not explained by measured swing mechanics |
| Dad's theory | **Partially supported** — face angle is the primary driver, not club path alone |

**Face angle outperforms club path as a predictor across nearly every club group. Club speed emerged as a consistent iron-specific predictor.**

---

## Architecture

```
Raw CSV (Trackman export)
        │
        ▼
src/cleaning.py       ← Parse stacked export, filter by club/carry range
        │
        ▼
PostgreSQL (Docker)   ← 5-table normalized schema
        │
        ▼
src/analysis.py       ← Pearson correlations + OLS regression → stored in model_runs
        │
        ▼
src/api.py (FastAPI)  ← 4 REST endpoints serving JSON
        │
        ▼
frontend/ (React)     ← 5-page SPA with Chart.js scatter plots
```

AWS migration in progress: S3 → RDS → Lambda → deployed frontend

---

## Tech Stack

| Layer | Technology |
|---|---|
| Data pipeline | Python, pandas |
| Statistical analysis | scipy, scikit-learn |
| Database | PostgreSQL via Docker |
| Backend API | FastAPI, psycopg2 |
| Frontend | React, Vite, Chart.js |
| Testing | pytest (unit + integration) |
| Deployment (WIP) | AWS S3, RDS, Lambda |

---

## Quality Score Formula

Each shot is scored using Euclidean distance from the target in normalized space:

```
carry_z = (carry − target_carry) / carry_std
side_z  = side_ft / side_std
d       = √(carry_z² + side_z²)
score   = 100 × e^(−d / 1.5)
```

This produces a club-independent 0–100 score, allowing a driver shot and a wedge to be compared on the same scale. For pitch sub-ranges with no carry target, quality is side-only: `d = |side_z|`.

---

## Database Schema

5-table normalized schema with foreign key relationships:

| Table | Description |
|---|---|
| sessions | One row per range session |
| clubs | Lookup table of club/sub-group names |
| shots | 1,184 rows, one per shot, FK to sessions + clubs |
| targets | Per-club GREAT/ACCEPTABLE dispersion thresholds |
| model_runs | Audit trail of each regression run, full results stored as JSON |

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/sessions` | All 32 range sessions ordered by date |
| GET | `/clubs/{club}/metrics` | Per-club stats: avg carry, std dev, avg side, targets |
| GET | `/clubs/{club}/shots` | All individual shots for scatter plot rendering |
| GET | `/analysis/latest` | Most recent correlation + regression results (4 groups) |
| POST | `/upload` | Upload new session CSV (API key auth, S3/Lambda pipeline WIP) |

---

## Data Pipeline

Raw data is Trackman exports in stacked block format, assembled manually across 32 range sessions from August 2025 to June 2026.

Cleaning steps:
1. Parse stacked blocks into tidy DataFrame (one row per shot)
2. Drop rows with missing data
3. Apply club-specific carry range filters
4. Split LW into 4 distance sub-ranges, SW into 2
5. Convert all metrics from string to numeric

Result: 1,402 raw → 1,376 after missing data → 1,184 after range filtering

---

## Testing

```bash
# Unit tests (no infrastructure required)
pytest tests/test_cleaning.py -v    # 11 tests

# Integration tests (requires uvicorn + Postgres running)
export API_KEY="your-api-key"
uvicorn src.api:app --reload
pytest tests/test_api.py -v         # 14 tests
```

---

## Running Locally

Prerequisites: Python 3.11+, Node.js 18+, Docker

```bash
# 1. Clone and set up Python environment
git clone https://github.com/jacqzang/golf_swing_analysis.git
cd golf_swing_analysis
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# 2. Start Postgres
docker run --name swing_analysis_db \
  -e POSTGRES_USER=golf_user \
  -e POSTGRES_PASSWORD=golf_pass \
  -e POSTGRES_DB=golf_swing \
  -p 5432:5432 -d postgres:15

# 3. Initialize schema and seed data
docker exec -i swing_analysis_db psql -U golf_user -d golf_swing < src/schema.sql
python src/seed.py

# 4. Run analysis pipeline
python src/analysis.py

# 5. Start API
export API_KEY="your-api-key"
uvicorn src.api:app --reload

# 6. Start frontend
cd frontend && npm install && npm run dev
```

Open `http://localhost:5173`

---

## Project Structure

```
golf_swing_analysis/
├── data/
│   ├── raw/                 ← Raw Trackman CSV exports
│   └── processed/           ← Cleaned shot data
├── src/
│   ├── cleaning.py          ← Data pipeline: parse, filter, normalize
│   ├── schema.sql           ← PostgreSQL schema (5 tables)
│   ├── seed.py              ← Load cleaned data into Postgres
│   ├── analysis.py          ← Correlations + regression
│   └── api.py               ← FastAPI backend
├── frontend/
│   └── src/
│       ├── App.jsx          ← 5-page React SPA
│       └── App.css          ← Dark gold aesthetic
├── tests/
│   ├── test_cleaning.py     ← 11 unit tests
│   └── test_api.py          ← 14 integration tests
└── requirements.txt
```

---

## Next Steps

- **Upload pipeline in progress:** The `POST /upload` endpoint and S3/Lambda cleaning pipeline are currently being deployed to AWS. Once live, any golfer with Trackman data can upload their own sessions and receive personalized analysis against their own swing profile.