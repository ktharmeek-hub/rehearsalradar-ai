"""Local-only analysis history. Stores pitch results, never uploaded audio bytes.

WARNING: This unauthenticated API is intended for a single user running on
127.0.0.1. Add authentication and per-user authorization before public hosting.
"""

import json
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

router = APIRouter(prefix="/history", tags=["Analysis History"])
DB_PATH = Path(__file__).resolve().parent / "data" / "history.sqlite3"


class PitchPoint(BaseModel):
    time: float = Field(ge=0, le=361)
    pitch_hz: float | None = Field(default=None, gt=0, le=5000)


class AnalysisSnapshot(BaseModel):
    filename: str = Field(min_length=1, max_length=260)
    duration_seconds: float = Field(ge=0, le=360)
    file_size_mb: float = Field(ge=0, le=100)
    status: Literal["success", "no_pitch_detected"]
    pitch_contour: list[PitchPoint] = Field(max_length=37000)
    median_pitch_hz: float | None = Field(default=None, gt=0, le=5000)
    min_pitch_hz: float | None = Field(default=None, gt=0, le=5000)
    max_pitch_hz: float | None = Field(default=None, gt=0, le=5000)


class HistoryCreate(BaseModel):
    mode: Literal["free", "compare"]
    singing: AnalysisSnapshot
    reference: AnalysisSnapshot | None = None


def connect_db() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS analyses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT NOT NULL,
            mode TEXT NOT NULL,
            singing_filename TEXT NOT NULL,
            reference_filename TEXT,
            duration_seconds REAL NOT NULL,
            median_pitch_hz REAL,
            payload_json TEXT NOT NULL
        )
        """
    )
    connection.commit()
    return connection


@router.post("", status_code=201)
def save_history(entry: HistoryCreate):
    if entry.mode == "compare" and entry.reference is None:
        raise HTTPException(status_code=422, detail="Comparison requires a reference recording")
    if entry.mode == "free" and entry.reference is not None:
        raise HTTPException(status_code=422, detail="Free analysis cannot contain a reference")

    created_at = datetime.now(timezone.utc).isoformat()
    payload_json = entry.model_dump_json()

    with closing(connect_db()) as connection:
        with connection:
            cursor = connection.execute(
                """
                INSERT INTO analyses
                  (created_at, mode, singing_filename, reference_filename,
                   duration_seconds, median_pitch_hz, payload_json)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    created_at,
                    entry.mode,
                    entry.singing.filename,
                    entry.reference.filename if entry.reference else None,
                    entry.singing.duration_seconds,
                    entry.singing.median_pitch_hz,
                    payload_json,
                ),
            )
            entry_id = cursor.lastrowid
    return {"id": entry_id, "created_at": created_at}


@router.get("")
def list_history(limit: int = Query(default=30, ge=1, le=100)):
    with closing(connect_db()) as connection:
        rows = connection.execute(
            """
            SELECT id, created_at, mode, singing_filename, reference_filename,
                   duration_seconds, median_pitch_hz
            FROM analyses
            ORDER BY id DESC LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return [dict(row) for row in rows]


@router.get("/{entry_id}")
def get_history(entry_id: int):
    with closing(connect_db()) as connection:
        row = connection.execute(
            "SELECT id, created_at, payload_json FROM analyses WHERE id = ?",
            (entry_id,),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="History entry not found")
    return {"id": row["id"], "created_at": row["created_at"], **json.loads(row["payload_json"])}


@router.delete("/{entry_id}", status_code=204)
def delete_history(entry_id: int):
    with closing(connect_db()) as connection:
        with connection:
            result = connection.execute("DELETE FROM analyses WHERE id = ?", (entry_id,))
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="History entry not found")
