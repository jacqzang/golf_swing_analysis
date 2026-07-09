"""
These are the integration tests for the FastAPI backend. 
I made these tests to check the API endpoints against the local Postgres database. 
Make sure uvicorn is running before running these tests:
    export API_KEY="example-api-key"
    uvicorn src.api:app --reload
Run with: pytest tests/test_api.py -v
"""
import pytest
import requests
import os

BASE_URL = "http://localhost:8000"
import os
API_KEY = os.environ.get("API_KEY", "")
HEADERS = {"X-API-Key": API_KEY}

def test_sessions_returns_list():
    response = requests.get(f"{BASE_URL}/sessions")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0

def test_sessions_have_correct_fields():
    response = requests.get(f"{BASE_URL}/sessions")
    data = response.json()
    first = data[0]
    assert "session_id" in first
    assert "session_date" in first

def test_sessions_ordered_by_date_descending():
    response = requests.get(f"{BASE_URL}/sessions")
    data = response.json()
    dates = [s["session_date"] for s in data]
    assert dates == sorted(dates, reverse=True)

def test_club_metrics_valid_club():
    response = requests.get(f"{BASE_URL}/clubs/PW/metrics")
    assert response.status_code == 200
    data = response.json()
    assert data["club"] == "PW"
    assert "stats" in data
    assert "targets" in data

def test_club_metrics_stats_fields():
    response = requests.get(f"{BASE_URL}/clubs/PW/metrics")
    data = response.json()
    stats = data["stats"]
    assert "shot_count" in stats
    assert "avg_carry" in stats
    assert "std_carry" in stats
    assert "avg_side_ft" in stats
    assert "std_side_ft" in stats

def test_club_metrics_shot_count_positive():
    response = requests.get(f"{BASE_URL}/clubs/PW/metrics")
    data = response.json()
    assert int(data["stats"]["shot_count"]) > 0

def test_club_metrics_invalid_club_returns_404():
    response = requests.get(f"{BASE_URL}/clubs/FAKE_CLUB/metrics")
    assert response.status_code == 404

def test_club_shots_returns_list():
    response = requests.get(f"{BASE_URL}/clubs/PW/shots")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0

def test_club_shots_have_correct_fields():
    response = requests.get(f"{BASE_URL}/clubs/PW/shots")
    data = response.json()
    first = data[0]
    assert "carry" in first
    assert "side_ft" in first
    assert "club_path" in first
    assert "face_angle" in first
    assert "smash_factor" in first

def test_analysis_latest_returns_four_groups():
    response = requests.get(f"{BASE_URL}/analysis/latest")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 4

def test_analysis_latest_has_correct_groups():
    response = requests.get(f"{BASE_URL}/analysis/latest")
    data = response.json()
    groups = {g["group"] for g in data}
    assert groups == {"pitches", "wedges", "irons", "driving"}

def test_analysis_latest_has_correlations():
    response = requests.get(f"{BASE_URL}/analysis/latest")
    data = response.json()
    irons = next(g for g in data if g["group"] == "irons")
    assert "per_club_correlations" in irons
    assert "coefficients" in irons
    assert irons["r2_test"] is not None

def test_upload_requires_api_key():
    response = requests.post(f"{BASE_URL}/upload")
    assert response.status_code == 422

def test_upload_with_valid_api_key():
    response = requests.post(f"{BASE_URL}/upload", headers=HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert "message" in data