"""Generate an experimental practice-priority prediction from analysis JSON."""
from __future__ import annotations

import argparse
from pathlib import Path
import joblib
from features import FEATURE_NAMES, extract

ROOT = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("json_file", type=Path)
    args = parser.parse_args()
    package = joblib.load(ROOT / "models" / "pitch_practice_model.joblib")
    if package["features"] != FEATURE_NAMES:
        raise SystemExit("Model features incompatible with current extractor")
    features = extract(args.json_file)
    X = [[features[name] for name in FEATURE_NAMES]]
    positive_idx = list(package["model"].classes_).index(1)
    probability = float(package["model"].predict_proba(X)[0][positive_idx])
    print(f"Estimated probability of human label 'needs pitch-control practice': {probability:.1%}")
    print("Experimental output based on limited labeled examples; not objective pitch accuracy.")


if __name__ == "__main__":
    main()
