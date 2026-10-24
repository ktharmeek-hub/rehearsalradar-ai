"""Extract recording-level pitch features from RehearsalRadar AI JSON exports.

These features describe pitch patterns, not singing accuracy or musical quality.
"""
from __future__ import annotations

import json
import math
import statistics
from pathlib import Path

FEATURE_NAMES = [
    "duration_seconds",
    "voiced_fraction",
    "median_pitch_hz",
    "pitch_span_semitones",
    "pitch_step_median_cents",
    "pitch_step_p90_cents",
    "voiced_segments_per_minute",
]


def percentile(values: list[float], p: float) -> float:
    sorted_values = sorted(values)
    if not sorted_values:
        return 0.0
    idx = (len(sorted_values) - 1) * p
    lo, hi = math.floor(idx), math.ceil(idx)
    if lo == hi:
        return float(sorted_values[lo])
    return float(sorted_values[lo] * (hi - idx) + sorted_values[hi] * (idx - lo))


def _find_contour(obj):
    if isinstance(obj, dict):
        if "pitch_contour" in obj and isinstance(obj["pitch_contour"], list):
            return obj["pitch_contour"]
        for child in obj.values():
            result = _find_contour(child)
            if result is not None:
                return result
    elif isinstance(obj, list):
        for child in obj:
            result = _find_contour(child)
            if result is not None:
                return result
    return None


def extract(path: str | Path) -> dict[str, float]:
    with open(path, encoding="utf-8") as file:
        obj = json.load(file)
    contour = _find_contour(obj)
    if contour is None or len(contour) < 10:
        raise ValueError("Cannot find 10+ pitch_contour points. Export AI analysis JSON first.")
    records = []
    for row in contour:
        if not isinstance(row, dict):
            continue
        try:
            t = float(row.get("time"))
            hz = float(row.get("pitch_hz")) if row.get("pitch_hz") is not None else None
        except (ValueError, TypeError):
            continue
        if not math.isfinite(t) or t < 0:
            continue
        if hz is not None and (not math.isfinite(hz) or hz <= 0):
            hz = None
        records.append((t, hz))
    records.sort(key=lambda item: item[0])
    if len(records) < 10:
        raise ValueError("Not enough valid pitch/time points")
    pitch_values = [hz for _, hz in records if hz is not None]
    if len(pitch_values) < 10:
        raise ValueError("Fewer than 10 voiced pitch points. Try a clearer vocal recording.")
    duration = max(records[-1][0] - records[0][0], 0.01)
    pitch_span = 12 * math.log2(percentile(pitch_values, 0.95) / percentile(pitch_values, 0.05))
    delta = []
    segments = 0
    previous = None
    for t, hz in records:
        if hz is not None:
            if previous is None or t - previous[0] > 0.08:
                segments += 1
            else:
                delta.append(abs(1200 * math.log2(hz / previous[1])))
            previous = (t, hz)
        else:
            previous = None
    return {
        "duration_seconds": round(duration, 4),
        "voiced_fraction": round(len(pitch_values) / len(records), 6),
        "median_pitch_hz": round(statistics.median(pitch_values), 4),
        "pitch_span_semitones": round(pitch_span, 4),
        "pitch_step_median_cents": round(statistics.median(delta) if delta else 0, 4),
        "pitch_step_p90_cents": round(percentile(delta, 0.9), 4),
        "voiced_segments_per_minute": round(60 * segments / duration, 4),
    }
