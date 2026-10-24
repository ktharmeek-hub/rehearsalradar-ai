"""Add a human-reviewed recording and its extracted features to the dataset."""
from __future__ import annotations

import argparse
import csv
from pathlib import Path
from features import FEATURE_NAMES, extract

ROOT = Path(__file__).resolve().parent
DATASET = ROOT / "data" / "practice_labels.csv"
FIELDS = ["recording_id", "singer_id", "song_id", "needs_pitch_control_practice"] + FEATURE_NAMES


def main():
    parser = argparse.ArgumentParser(description="Collect a reviewed AI analysis JSON export")
    parser.add_argument("json_file", type=Path, help="JSON downloaded from Singing Analysis")
    parser.add_argument("--label", required=True, type=int, choices=[0, 1], help="0 = no priority, 1 = needs pitch-control practice; determined by a human listener")
    parser.add_argument("--recording-id", required=True, help="Unique ID for this recording (e.g. rec001)")
    parser.add_argument("--singer-id", default="singer1", help="Anonymous local singer identifier")
    parser.add_argument("--song-id", default="song1", help="Identifier for sung passage")
    args = parser.parse_args()

    features = extract(args.json_file)
    DATASET.parent.mkdir(parents=True, exist_ok=True)
    if DATASET.exists():
        with DATASET.open(encoding="utf-8", newline="") as file:
            for entry in csv.DictReader(file):
                if entry["recording_id"] == args.recording_id:
                    parser.error("recording-id already exists. Choose a new one; don't duplicate recordings.")
    new_file = not DATASET.exists()
    with DATASET.open("a", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=FIELDS)
        if new_file:
            writer.writeheader()
        writer.writerow({
            "recording_id": args.recording_id,
            "singer_id": args.singer_id,
            "song_id": args.song_id,
            "needs_pitch_control_practice": args.label,
            **features,
        })
    print(f"Saved reviewed sample {args.recording_id} to {DATASET}")
    print("Features:", features)
    print("Note: label must be a human judgment, not copied from an existing heuristic.")


if __name__ == "__main__":
    main()
