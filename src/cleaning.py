"""
Step 1: Take the raw Trackman exported data and turn it into a clean DataFrame.
The raw file is a series of stacked shot "blocks" with the format: 
    [club name row, with data names and date in last column]
    [units row - "Yds/Ft, Mph", "Deg", etc.]
    [shot 1 data row]
    [shot 2 data row]
    ...
    [blank row]
    [next club's block starts]

The following function was created to keep track of what club and date you're currently on, and then outputting
one clean row per shot. It does this by going through the file row by row.
"""

import pandas as pd

#Raw column positions for the important metrics.
#Columns 1-3 in the raw file are empty attributes of the export and are skipped because they are unimportant.
metric_columns = {
    4: "Club Path",
    5: "Face Angle",
    6: "Face To Path",
    7: "Club Speed",
    8: "Attack Angle",
    9: "Ball Speed",
    10: "Spin Rate",
    11: "Carry",
    12: "Side",
    13: "Smash Factor",
}

date_column_index = 14

"""
This function cleans the raw stacked Trackman export and return a tidy DataFrame with 
one row per shot that includes: Club, Date, and the 10 metric columns.
"""
def parse_raw_export(raw_csv_source) -> pd.DataFrame:
    raw = pd.read_csv(raw_csv_source, header = None)
    tidy_rows = []
    current_club = None
    current_date = None

    for _, row in raw.iterrows():
        first_cell = row[0]

        if pd.isna(first_cell):
            continue
        if first_cell == "Yds/Ft, Mph":
            continue
        #Get to cell with the club name, so in a new block and need to set club and date
        if is_number(first_cell) == False:
            current_club = first_cell
            current_date = extract_date(row[date_column_index])
            continue
        #Get to shot data rows 
        shot = {"Club": current_club, "Date": current_date}
        for col_index, col_name in metric_columns.items():
            shot[col_name] = row[col_index]
        
        tidy_rows.append(shot)

    return pd.DataFrame(tidy_rows)

def is_number(value) -> bool:
    #Returns True if value can be used as a number (used to detect which rows are the actual shots)
    try:
        float(value)
        return True
    except (ValueError, TypeError):
        return False

def extract_date(date_cell) -> str:
    #Changes raw data cells (ie "Date: June 15, 2026") to a string of just the date
    if pd.isna(date_cell):
        return None
    return str(date_cell).replace("Date: ", "").strip()

"""
Step 2: Drop shot rows where there is missing data. This includes
any shots where the one of the metric columns includes "-", since
that is Trackman's marker for failing to record data for the shot.
"""

def drop_missing_data(df: pd.DataFrame) -> pd.DataFrame:
    metric_col_names = list(metric_columns.values())
    has_dash = (df[metric_col_names] == "-").any(axis=1)
    cleaned = df[~has_dash].copy()

    dropped_count = has_dash.sum()
    print(f"Dropped {dropped_count} rows with missing data")

    return cleaned

'''
Step 3: Filter clubs to specific my targert carry ranges. Since LW and SW clubs are used for pitches, 
filter them further into sub-ranges. 
Here is what is done for each club:
  LW: split into sub-ranges: LW_0-40, LW_40-50, LW_50-60, LW_60-70
  SW: split into sub-ranges: SW_70-75, SW_75-85, SW_OTHER
  GW: keep only 85-100
  PW: keep only 95-110
  9 IRON: keep only 105-125
  8 IRON: keep only 120-140
  7 IRON: keep only 130-155
  6 IRON: keep only 140-160
  6 HYBRID: keep only 150+
  5 WOOD: keep only 170+
  3 WOOD: keep only 180+
  DRIVER: keep only 190-220
  4 IRON: drop because club is rarely used
'''

def apply_club_filters(df: pd.DataFrame) -> pd.DataFrame:
    #Convert Carry to integers instead of strings for checking if they are in the target range
    df = df.copy()
    df["Carry"] = pd.to_numeric(df["Carry"], errors="coerce")

    df = df[df["Club"] != "4 IRON"].copy()

    #Split LW into sub-ranges by reassigning the Club column value for each shot
    def split_lw(carry):
        if carry < 40:
            return "LW_0-40"
        elif carry < 50:
            return "LW_40-50"
        elif carry < 60:
            return "LW_50-60"
        elif carry < 70:
            return "LW_60-70"
        else:
            return None

    is_lw = df["Club"] == "LW"
    df.loc[is_lw, "Club"] = df.loc[is_lw, "Carry"].apply(split_lw)

    #Split SW into sub-ranges
    def split_sw(carry):
        if 70 <= carry < 75:
            return "SW_70-75"
        elif 75 <= carry <= 85:
            return "SW_75-85"
        else:
            return None

    is_sw = df["Club"] == "SW"
    df.loc[is_sw, "Club"] = df.loc[is_sw, "Carry"].apply(split_sw)

    carry_ranges = {
        "GW":     (85, 100),
        "PW":     (95, 110),
        "9 IRON": (105, 125),
        "8 IRON": (120, 140),
        "7 IRON": (130, 155),
        "6 IRON": (140, 160),
        "6 HYBRID": (150, 170),
        "5 WOOD": (165, 185),
        "3 WOOD": (180, 200),
        "DRIVER": (190, 220),
    }

    filtered_rows = []
    already_filtered_clubs = {"LW_0-40", "LW_40-50", "LW_50-60", "LW_60-70",
                       "SW_70-75", "SW_75-85"}

    for club, group in df.groupby("Club"):
        if club in already_filtered_clubs:
            filtered_rows.append(group)
        elif club in carry_ranges:
            low, high = carry_ranges[club]
            filtered_rows.append(group[(group["Carry"] >= low) & (group["Carry"] <= high)])

    result = pd.concat(filtered_rows).reset_index(drop=True)

    print(f"Rows after club filtering: {len(result)}")
    return result

#Step 4: Convert all metric columns to ints and floats so they can be used for analysis
def convert_metrics_to_numeric(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    numeric_cols = ["Club Path", "Face Angle", "Face To Path", "Club Speed",
                    "Attack Angle", "Ball Speed", "Spin Rate", "Smash Factor"]
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df["Side"] = df["Side"].apply(parse_side)
    return df

"""
This helper function converts Trackman side distance (a string) to float in feet.
"14.1L" -> -14.1 (left is negative)
"0.5R"  ->  0.5  (right is positive)
"0"     ->  0.0
"""
def parse_side(side_str):
    side_str = str(side_str).strip()
    if side_str.endswith("L"):
        return -float(side_str[:-1])
    elif side_str.endswith("R"):
        return float(side_str[:-1])
    else:
        return float(side_str)

#Guard for when the file is imported; only runs when you run the file yourself
if __name__ == "__main__":
    df = parse_raw_export("data/raw/Shot_Data_V1 - Sheet1.csv")
    print(df.shape)

    df = drop_missing_data(df)
    print(df.shape)

    df = apply_club_filters(df)
    print(df.shape)

    df = convert_metrics_to_numeric(df)

    df.to_csv("data/processed/cleaned_shots.csv", index=False)
    print("Saved to data/processed/cleaned_shots.csv")
    print(df["Club"].value_counts())