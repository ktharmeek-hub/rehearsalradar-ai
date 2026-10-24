"""Train a baseline from real human-reviewed samples. Not a singing-accuracy score."""
from __future__ import annotations

import csv
from collections import Counter
from pathlib import Path

from features import FEATURE_NAMES

ROOT = Path(__file__).resolve().parent
DATASET = ROOT / "data" / "practice_labels.csv"
MODEL_PATH = ROOT / "models" / "pitch_practice_model.joblib"


def main():
    import joblib
    import numpy as np
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.metrics import balanced_accuracy_score, classification_report
    from sklearn.model_selection import train_test_split

    if not DATASET.exists():
        raise SystemExit("No dataset yet. Run ml/collect_sample.py on real, human-reviewed recordings.")
    with DATASET.open(encoding="utf-8", newline="") as file:
        rows = list(csv.DictReader(file))
    if len({row["recording_id"] for row in rows}) != len(rows):
        raise SystemExit("Duplicate recording IDs found. Avoid train/test leakage.")
    y = [int(row["needs_pitch_control_practice"]) for row in rows]
    counts = Counter(y)
    if len(rows) < 30 or min(counts.values(), default=0) < 10 or set(counts) != {0, 1}:
        raise SystemExit(f"Dataset too small for initial training: {len(rows)} recordings; class counts {dict(counts)}. Collect >=30, with >=10 per class.")
    X = np.array([[float(row[name]) for name in FEATURE_NAMES] for row in rows], dtype=float)
    if not np.isfinite(X).all():
        raise SystemExit("Dataset includes non-finite values")
    X_train, X_test, y_train, y_test = train_test_split(
        X, np.array(y), test_size=0.25, random_state=42, stratify=y
    )
    model = RandomForestClassifier(n_estimators=200, min_samples_leaf=2, random_state=42, class_weight="balanced")
    model.fit(X_train, y_train)
    prediction = model.predict(X_test)
    print("Held-out balanced accuracy:", round(balanced_accuracy_score(y_test, prediction), 3))
    print(classification_report(y_test, prediction, zero_division=0))
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": model, "features": FEATURE_NAMES, "training_count": len(rows), "label": "needs_pitch_control_practice"}, MODEL_PATH)
    print("Saved model:", MODEL_PATH)
    print("Caution: Small held-out tests have high uncertainty. This is NOT a singing accuracy score.")


if __name__ == "__main__":
    main()
