"""
This code runs the Pearson computations for each club and uses group OLS regression
in order to see which swing variables may predict shot quality.

Here is the quality score formula I used (0-100 scale):
    carry_z = (carry - target_carry) / carry_std
    side_z  = side_ft / side_std
    quality_distance = sqrt(carry_z^2 + side_z^2)
    quality_score    = 100 * exp(-quality_distance) #this puts the scores on a 0-100 scale

For pitch sub-ranges (no carry target), quality is side-only:
    quality_distance = abs(side_z)
    quality_score = 100 * exp(-quality_distance / k)  # k=1.5
"""

import numpy as np
import pandas as pd
import psycopg2
import json
from psycopg2.extras import RealDictCursor
from scipy.stats import pearsonr
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score
from sklearn.preprocessing import StandardScaler

DB_CONFIG = {
    "host":     "localhost",
    "port":     5432,
    "dbname":   "golf_swing",
    "user":     "golf_user",
    "password": "golf_pass",
}

PREDICTORS = [
    "club_path",
    "face_angle",
    "face_to_path",
    "club_speed",
    "attack_angle",
    "smash_factor",
]

#For regression only - face_to_path excluded because it equals face_angle - club_path which causes multicollinearity
REGRESSION_PREDICTORS = [
    "club_path",
    "face_angle",
    "club_speed",
    "attack_angle",
    "smash_factor",
]

CLUB_GROUPS = {
    "pitches":     ["LW_0-40", "LW_40-50", "LW_50-60", "LW_60-70", "SW_70-75"],
    "wedges":      ["SW_75-85", "GW", "PW"],
    "irons": ["9 IRON", "8 IRON", "7 IRON"],
    "driving":        ["5 WOOD", "DRIVER"],
}

PITCH_CLUBS = {"LW_0-40", "LW_40-50", "LW_50-60", "LW_60-70", "SW_70-75"}

#Controls how strictly shots are scored
#k=1.5 means acceptable shots (within thresholds) score above 50
QUALITY_SCORE_K = 1.5

def load_data(conn) -> pd.DataFrame:
    query = """
        SELECT
            s.shot_id,
            c.club_name,
            s.carry,
            s.side_ft,
            s.club_path,
            s.face_angle,
            s.face_to_path,
            s.club_speed,
            s.attack_angle,
            s.smash_factor,
            t.target_carry,
            t.acceptable_side_ft,
            t.great_side_ft
        FROM shots s
        JOIN clubs c ON s.club_id = c.club_id
        LEFT JOIN targets t ON s.club_id = t.club_id
        WHERE s.carry IS NOT NULL
          AND s.side_ft IS NOT NULL
          AND s.club_path IS NOT NULL
          AND s.face_angle IS NOT NULL
          AND s.smash_factor IS NOT NULL
    """
    cur = conn.cursor()
    cur.execute(query)
    rows = cur.fetchall()
    df = pd.DataFrame(rows)

    #need to convert all numeric columns from decimal to float
    numeric_cols = [
        "carry", "side_ft", "club_path", "face_angle", "face_to_path",
        "club_speed", "attack_angle", "smash_factor",
        "target_carry", "acceptable_side_ft", "great_side_ft"
    ]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    return df

"""
Add a quality_score column to each shot and then use
Euclidean distance in standardized carry + side space for clubs
with a carry target, and side-only for pitch sub-ranges.
"""
def compute_quality_scores(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    quality_scores = []

    for club_name, group in df.groupby("club_name"):
        carry_std = group["carry"].std()
        side_std = group["side_ft"].std()

        if side_std == 0:
            side_std = 1

        if club_name in PITCH_CLUBS or group["target_carry"].isna().all():
            #only side scores for pitches because no target carry since they are already grouped by distance
            side_z = group["side_ft"] / side_std
            quality_distance = side_z.abs()
        else:
            #full 2D quality score for clubs with carry target AND side distance
            if carry_std == 0:
                carry_std = 1
            target_carry = group["target_carry"].iloc[0]
            carry_z = (group["carry"] - target_carry) / carry_std
            side_z = group["side_ft"] / side_std
            quality_distance = np.sqrt(carry_z**2 + side_z**2)

        scores = 100 * np.exp(-quality_distance / QUALITY_SCORE_K)
        quality_scores.append(pd.Series(scores.values, index=group.index))

    df["quality_score"] = pd.concat(quality_scores).sort_index()
    return df

"""
This function computes Pearson r and p-value for each predictor vs quality_score
for each individual club.
{club_name: {predictor: {r: float, p: float, n: int}}}
"""
def run_per_club_correlations(df: pd.DataFrame) -> dict:
    results = {}

    for club_name, group in df.groupby("club_name"):
        group = group.dropna(subset=PREDICTORS + ["quality_score"])
        n = len(group)
        results[club_name] = {"n": n, "correlations": {}}

        if n < 10:
            results[club_name]["note"] = "Insufficient sample size for reliable correlation"
            continue

        for predictor in PREDICTORS:
            r, p = pearsonr(group[predictor], group["quality_score"])
            results[club_name]["correlations"][predictor] = {
                "r": round(float(r), 4),
                "p": round(float(p), 4),
                "significant": bool(p < 0.05),
            }

    return results

"""
This function runs OLS linear regression to predict quality_score from PREDICTORS
for a group of clubs and returns r2_train, r2_test, coefficients, n.
"""
def run_group_regression(df: pd.DataFrame, group_name: str, club_names: list) -> dict:
    group_df = df[df["club_name"].isin(club_names)].dropna(
        subset=REGRESSION_PREDICTORS + ["quality_score"]
    )
    n = len(group_df)

    if n < 30:
        return {
            "group": group_name,
            "n": n,
            "note": "Insufficient sample size for regression",
        }

    X = group_df[REGRESSION_PREDICTORS].values
    y = group_df["quality_score"].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_test = scaler.transform(X_test)

    model = LinearRegression()
    model.fit(X_train, y_train)

    r2_train = round(r2_score(y_train, model.predict(X_train)), 4)
    r2_test = round(r2_score(y_test, model.predict(X_test)), 4)

    coefficients = {
        predictor: round(float(coef), 4)
        for predictor, coef in zip(REGRESSION_PREDICTORS, model.coef_)
    }

    return {
        "group": group_name,
        "n": n,
        "n_train": len(X_train),
        "n_test": len(X_test),
        "r2_train": r2_train,
        "r2_test": r2_test,
        "intercept": round(float(model.intercept_), 4),
        "coefficients": coefficients,
        "features_used": ", ".join(REGRESSION_PREDICTORS),
    }

"""
Then finally insert analysis results into the model_runs table.
This function stores one row per group regression, with correlations as JSON in results_json.
"""
def save_results_to_db(conn, correlations: dict, regressions: list):

    cur = conn.cursor()

    for reg in regressions:
        if "note" in reg and "r2_test" not in reg:
            #Skip groups with insufficient data
            continue

        group_name = reg["group"]
        club_names = CLUB_GROUPS[group_name]

        cur.execute(
            "SELECT club_id FROM clubs WHERE club_name = %s",
            (club_names[0],)
        )
        row = cur.fetchone()
        club_id = row["club_id"] if row else None

        group_correlations = {
            club: data for club, data in correlations.items()
            if club in club_names
        }

        cur.execute("""
            INSERT INTO model_runs (club_id, features_used, r_squared, results_json)
            VALUES (%s, %s, %s, %s)
        """, (
            club_id,
            reg["features_used"],
            reg["r2_test"],
            json.dumps({
                "group": group_name,
                "n": reg["n"],
                "r2_train": reg["r2_train"],
                "r2_test": reg["r2_test"],
                "intercept": reg["intercept"],
                "coefficients": reg["coefficients"],
                "per_club_correlations": group_correlations,
            })
        ))

    conn.commit()
    print("Results saved to model_runs table.")

if __name__ == "__main__":
    conn = psycopg2.connect(**DB_CONFIG, cursor_factory=RealDictCursor)

    print("Loading data from Postgres...")
    df = load_data(conn)
    print(f"Loaded {len(df)} shots across {df['club_name'].nunique()} clubs")

    print("Computing quality scores...")
    df = compute_quality_scores(df)
    print(f"Quality score range: {df['quality_score'].min():.1f} - {df['quality_score'].max():.1f}")
    print(f"Quality score mean: {df['quality_score'].mean():.1f}")

    print("\nRunning per-club correlations...")
    correlations = run_per_club_correlations(df)
    for club, data in correlations.items():
        print(f"\n{club} (n={data['n']}):")
        if "note" in data:
            print(f"  {data['note']}")
        else:
            for pred, stats in data["correlations"].items():
                sig = "✓" if stats["significant"] else " "
                print(f"  {sig} {pred:20s} r={stats['r']:+.3f}  p={stats['p']:.3f}")

    print("\nRunning group regressions...")
    regressions = []
    for group_name, club_names in CLUB_GROUPS.items():
        result = run_group_regression(df, group_name, club_names)
        regressions.append(result)
        print(f"\n{group_name} (n={result['n']}):")
        if "note" in result and "r2_test" not in result:
            print(f"  {result['note']}")
        else:
            print(f"  R² train: {result['r2_train']}")
            print(f"  R² test:  {result['r2_test']}")
            print(f"  Coefficients:")
            for pred, coef in result["coefficients"].items():
                print(f"    {pred:20s} {coef:+.4f}")

    print("\nSaving results to database...")
    save_results_to_db(conn, correlations, regressions)

    conn.close()
    print("\nDone.")
