"""
Tests for src/cleaning.py
This was made to run with pytest tests/test_cleaning.py

These tests check each cleaning function in smaller parts. It uses small inputs
so that the output can be verified easily. 
"""

import pandas as pd
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.cleaning import is_number, extract_date, drop_missing_data

#Tests for is_number
def test_is_number_with_integer():
    assert is_number("1") == True

def test_is_number_with_float():
    assert is_number("6.3") == True

def test_is_number_with_negative():
    assert is_number("-1.5") == True

def test_is_number_with_club_name():
    assert is_number("PW") == False

def test_is_number_with_iron():
    assert is_number("7 IRON") == False

def test_is_number_with_none():
    assert is_number(None) == False

#Tests for extract_date
def test_extract_date_normal():
    assert extract_date("Date: June 15, 2026") == "June 15, 2026"

def test_extract_date_different_month():
    assert extract_date("Date: August 21, 2025") == "August 21, 2025"

def test_extract_date_none():
    assert extract_date(None) == None

#Tests for drop_missing_data
def test_drop_missing_data_removes_dash_rows():
    test_df = pd.DataFrame([
        {"Club": "PW", "Date": "June 15, 2026", "Club Path": "6", "Face Angle": "-1.1",
         "Face To Path": "-7.1", "Club Speed": "68.1", "Attack Angle": "-1",
         "Ball Speed": "84.3", "Spin Rate": "7637", "Carry": "103",
         "Side": "14.1L", "Smash Factor": "1.24"},
        {"Club": "PW", "Date": "June 15, 2026", "Club Path": "-", "Face Angle": "-1.1",
         "Face To Path": "-7.1", "Club Speed": "68.1", "Attack Angle": "-1",
         "Ball Speed": "84.3", "Spin Rate": "7637", "Carry": "103",
         "Side": "14.1L", "Smash Factor": "1.24"},
    ])
    result = drop_missing_data(test_df)
    assert len(result) == 1

def test_keeps_all_clean_rows():
    df = pd.DataFrame([
        {"Club": "PW", "Date": "June 15, 2026", "Club Path": "6", "Face Angle": "-1.1",
         "Face To Path": "-7.1", "Club Speed": "68.1", "Attack Angle": "-1",
         "Ball Speed": "84.3", "Spin Rate": "7637", "Carry": "103",
         "Side": "14.1L", "Smash Factor": "1.24"},
        {"Club": "SW", "Date": "August 21, 2025", "Club Path": "4.6", "Face Angle": "-4.5",
         "Face To Path": "-9.1", "Club Speed": "67", "Attack Angle": "-4.2",
         "Ball Speed": "67.9", "Spin Rate": "9685", "Carry": "74.6",
         "Side": "14.4L", "Smash Factor": "1.01"},
    ])
    result = drop_missing_data(df)
    assert len(result) == 2