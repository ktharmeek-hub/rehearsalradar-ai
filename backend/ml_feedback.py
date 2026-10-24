"""Local-only manual ML dataset collection for RehearsalRadar AI.

This endpoint does NOT predict singing correctness. A human listens and selects
an independent training label. Only numeric features, local IDs and that label
are kept in the CSV; the submitted JSON is deleted after processing.

Do not expose this endpoint on a public unauthenticated server.
"""
from __future__ import annotations

import csv
import json
import re
import sys
import tempfile
import threading
from collections import Counter
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

PROJECT_ROOT = Path(__file__).resolve().parents[1]
ML_DIR = PROJECT_ROOT / "ml"
DATASET = ML_DIR / "data" / "practice_labels.csv"
MAX_JSON_BYTES = 10 * 1024 * 1024
ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
_lock = threading.Lock()

# The ML starter's features.py resides outside backend/ and imports no third-party packages.
if str(ML_DIR) not in sys.path:
    sys.path.insert(0, str(ML_DIR))
from features import FEATURE_NAMES, extract  # noqa: E402

COLUMNS = ["recording_id", "singer_id", "song_id", "needs_pitch_control_practice", *FEATURE_NAMES]
router = APIRouter(tags=["ML training feedback"])


def _read_rows() -> list[dict[str, str]]:
    if not DATASET.exists():
        return []
    with DATASET.open("r", encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        if reader.fieldnames != COLUMNS:
            raise HTTPException(status_code=500, detail="Existing training CSV has unexpected columns. Check ml/data/practice_labels.csv.")
        return list(reader)


@router.get("/ml-feedback/stats")
def stats():
    with _lock:
        rows = _read_rows()
    counts = Counter(row["needs_pitch_control_practice"] for row in rows)
    return {"total": len(rows), "label_0": counts.get("0", 0), "label_1": counts.get("1", 0), "target": 30}


@router.post("/ml-feedback", status_code=201)
async def save_feedback(
    file: UploadFile = File(...),
    label: int = Form(...),
    recording_id: str = Form(...),
    singer_id: str = Form(...),
    song_id: str = Form(...),
):
    if label not in (0, 1):
        raise HTTPException(status_code=422, detail="Label must be 0 or 1.")
    for name, value in (("recording_id", recording_id), ("singer_id", singer_id), ("song_id", song_id)):
        if not ID_PATTERN.fullmatch(value):
            raise HTTPException(status_code=422, detail=f"{name} must use 1-64 letters, digits, '-' or '_'.")

    raw = await file.read(MAX_JSON_BYTES + 1)
    await file.close()
    if len(raw) > MAX_JSON_BYTES:
        raise HTTPException(status_code=413, detail="Analysis JSON is too large (maximum 10 MB).")
    try:
        obj = json.loads(raw)
    except (ValueError, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail="Invalid JSON. Analyze a recording first.")
    if not isinstance(obj, dict):
        raise HTTPException(status_code=400, detail="Expected an analysis JSON object.")

    # Reuse the EXACT same feature extraction logic as ml/collect_sample.py.
    # Use a temporary file since the starter's extract() expects a path.
    with tempfile.TemporaryDirectory(prefix="rr-ml-") as temp_dir:
        path = Path(temp_dir) / "analysis.json"
        path.write_text(json.dumps(obj), encoding="utf-8")
        try:
            feature_values = extract(path)
        except (ValueError, TypeError, KeyError, ZeroDivisionError, OverflowError) as error:
            raise HTTPException(status_code=422, detail=f"Cannot extract usable vocal pitch features: {error}")

    with _lock:
        rows = _read_rows()
        if any(row["recording_id"] == recording_id for row in rows):
            raise HTTPException(status_code=409, detail="Recording ID already exists. Re-analyze a different recording.")
        # Detect exact same feature measurements previously saved, even under another ID.
        # This is not a foolproof duplicate-audio detector but avoids common double saves.
        def same_features(row):
            try:
                return all(float(row[name]) == float(feature_values[name]) for name in FEATURE_NAMES)
            except (KeyError, ValueError, TypeError):
                return False
        if any(same_features(row) for row in rows):
            raise HTTPException(status_code=409, detail="These pitch features already exist in the dataset. Use a different recording.")

        DATASET.parent.mkdir(parents=True, exist_ok=True)
        with DATASET.open("a", encoding="utf-8", newline="") as output:
            writer = csv.DictWriter(output, fieldnames=COLUMNS)
            if not rows:
                writer.writeheader()
            writer.writerow({
                "recording_id": recording_id,
                "singer_id": singer_id,
                "song_id": song_id,
                "needs_pitch_control_practice": label,
                **feature_values,
            })
        rows.append({"needs_pitch_control_practice": str(label)})
        counts = Counter(row["needs_pitch_control_practice"] for row in rows)
    return {
        "message": "Human-reviewed training sample saved locally.",
        "recording_id": recording_id,
        "total": len(rows),
        "label_0": counts.get("0", 0),
        "label_1": counts.get("1", 0),
    }
