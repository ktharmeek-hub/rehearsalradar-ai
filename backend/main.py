
import json
import os
import subprocess
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="RehearsalRadar AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_EXTENSIONS = {
    ".mp3", ".wav", ".m4a", ".aac",
    ".flac", ".ogg", ".webm"
}

MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB
MAX_DURATION = 360  # 6 minutes


@app.get("/")
def home():
    return {
        "message": "Welcome to RehearsalRadar AI"
    }


@app.get("/health")
def health():
    return {
        "status": "success",
        "message": "Backend is working successfully"
    }


@app.post("/upload")
async def upload_audio(file: UploadFile = File(...)):

    filename = Path(file.filename or "").name
    extension = Path(filename).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Unsupported audio format"
        )

    temp_path = None

    try:
        # Save uploaded audio temporarily
        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=extension
        ) as temp_file:

            temp_path = temp_file.name
            total_size = 0

            while True:
                chunk = await file.read(1024 * 1024)

                if not chunk:
                    break

                total_size += len(chunk)

                if total_size > MAX_FILE_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail="File exceeds 100 MB limit"
                    )

                temp_file.write(chunk)

        # Inspect actual audio using FFprobe
        try:
            result = subprocess.run(
                [
                    "ffprobe",
                    "-v", "error",
                    "-show_entries",
                    "format=duration:stream=codec_type",
                    "-of", "json",
                    temp_path
                ],
                capture_output=True,
                text=True,
                timeout=30
            )
        except (OSError, subprocess.TimeoutExpired):
            raise HTTPException(
                status_code=400,
                detail="Unable to inspect audio file"
            )

        if result.returncode != 0:
            raise HTTPException(
                status_code=400,
                detail="Invalid or unsupported audio file"
            )

        try:
            metadata = json.loads(result.stdout)

            stream_types = [
                stream.get("codec_type")
                for stream in metadata.get("streams", [])
            ]

            if "audio" not in stream_types or "video" in stream_types:
                raise ValueError("Expected audio-only file")

            duration = float(
                metadata["format"]["duration"]
            )

        except (ValueError, KeyError, TypeError):
            raise HTTPException(
                status_code=400,
                detail="Cannot determine valid audio duration"
            )

        if not (0 < duration <= MAX_DURATION):
            raise HTTPException(
                status_code=400,
                detail="Audio duration must be under 6 minutes"
            )

        return {
            "status": "success",
            "filename": filename,
            "duration_seconds": round(duration, 2),
            "file_size_mb": round(
                total_size / (1024 * 1024), 2
            ),
            "message": "Audio validated successfully"
        }

    finally:
        await file.close()

        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)
