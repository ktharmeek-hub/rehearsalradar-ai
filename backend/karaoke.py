"""Local-only Karaoke Maker: upload authorized audio, separate stems, preview/download.

Requires the audio-separator CLI installed in backend/.venv-karaoke.
Avoid exposing these unauthenticated endpoints directly on the public Internet.
"""

import asyncio
import math
import re
import shutil
import subprocess
import time
import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse

router = APIRouter(prefix="/karaoke", tags=["karaoke"])
ROOT = Path(__file__).resolve().parent
JOBS_DIR = ROOT / "karaoke_jobs"
MODEL_DIR = ROOT / ".karaoke_models"
SEPARATOR = ROOT / ".venv-karaoke" / "Scripts" / "audio-separator.exe"
MODEL = "UVR-MDX-NET-Inst_HQ_3.onnx"
ALLOWED = {".mp3", ".wav", ".m4a", ".flac", ".ogg"}
MAX_BYTES = 50 * 1024 * 1024
MAX_DURATION_SECONDS = 8 * 60
# Avoid two large CPU inference jobs running concurrently on a laptop.
_separation_lock = asyncio.Lock()


def _cleanup_old_jobs() -> None:
    if not JOBS_DIR.exists():
        return
    cutoff = time.time() - 24 * 3600
    for folder in JOBS_DIR.iterdir():
        if folder.is_dir() and re.fullmatch(r"[0-9a-f]{32}", folder.name):
            try:
                if folder.stat().st_mtime < cutoff:
                    shutil.rmtree(folder, ignore_errors=True)
            except OSError:
                pass


def _duration_seconds(audio_path: Path) -> float:
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(audio_path)],
            capture_output=True, text=True, timeout=30, check=True,
        )
        duration = float(result.stdout.strip())
        if not math.isfinite(duration) or duration <= 0:
            raise ValueError("Invalid duration")
        return duration
    except (OSError, subprocess.SubprocessError, ValueError) as exc:
        raise HTTPException(400, "Cannot read audio. Check FFmpeg and file format.") from exc


def _separate(source: Path, output_dir: Path) -> None:
    command = [
        str(SEPARATOR), str(source),
        "--model_filename", MODEL,
        "--output_format", "MP3",
        "--output_dir", str(output_dir),
        "--model_file_dir", str(MODEL_DIR),
    ]
    try:
        result = subprocess.run(command, capture_output=True, text=True, timeout=1200)
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError("Separation timed out. Try a shorter song.") from exc
    except OSError as exc:
        raise RuntimeError("Could not start audio-separator. Check karaoke environment.") from exc
    if result.returncode:
        details = (result.stderr or result.stdout)[-700:]
        raise RuntimeError(f"Separator failed: {details}")

    # Choose only explicitly labelled model stems. Some models include
    # "No Vocals" in the instrumental filename, so testing for the word
    # "vocals" alone is insufficient and can mix up the outputs.
    outputs = list(output_dir.glob("*.mp3"))

    def is_instrumental(path: Path) -> bool:
        label = path.stem.casefold()
        return any(token in label for token in (
            "instrumental", "no vocals", "no_vocals", "accompaniment",
        ))

    def is_vocal(path: Path) -> bool:
        label = path.stem.casefold()
        return "vocal" in label and not is_instrumental(path)

    instrumental_matches = [p for p in outputs if is_instrumental(p)]
    vocal_matches = [p for p in outputs if is_vocal(p)]
    if len(instrumental_matches) != 1 or len(vocal_matches) != 1:
        filenames = ", ".join(sorted(p.name for p in outputs)) or "none"
        raise RuntimeError(
            "Unable to identify one instrumental and one vocal output. "
            f"Model produced: {filenames}"
        )

    instrumental = instrumental_matches[0]
    vocals = vocal_matches[0]
    if instrumental == vocals:
        raise RuntimeError("The separation model returned identical output paths.")

    instrumental.rename(output_dir / "karaoke.mp3")
    vocals.rename(output_dir / "vocals.mp3")
    # Delete extra outputs to avoid accumulating unused data.
    for extra in output_dir.glob("*.mp3"):
        if extra.name not in {"karaoke.mp3", "vocals.mp3"}:
            extra.unlink(missing_ok=True)


@router.post("/generate")
async def generate_karaoke(file: UploadFile = File(...)):
    if not SEPARATOR.is_file():
        raise HTTPException(503, "Karaoke AI isn't installed. Set up backend/.venv-karaoke.")
    name = Path(file.filename or "song").name
    suffix = Path(name).suffix.lower()
    if suffix not in ALLOWED:
        raise HTTPException(400, "Upload MP3, WAV, M4A, FLAC or OGG audio.")

    _cleanup_old_jobs()
    job_id = uuid.uuid4().hex
    job_dir = JOBS_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=False)
    source = job_dir / f"source{suffix}"

    try:
        written = 0
        with source.open("wb") as f:
            while chunk := await file.read(1024 * 1024):
                written += len(chunk)
                if written > MAX_BYTES:
                    raise HTTPException(413, "Audio exceeds 50 MB limit.")
                f.write(chunk)
        if written == 0:
            raise HTTPException(400, "The uploaded audio is empty.")
        duration = await asyncio.to_thread(_duration_seconds, source)
        if duration > MAX_DURATION_SECONDS:
            raise HTTPException(400, "Please upload audio no longer than 8 minutes.")

        async with _separation_lock:
            await asyncio.to_thread(_separate, source, job_dir)
        source.unlink(missing_ok=True)
        return {
            "job_id": job_id,
            "filename": name,
            "duration_seconds": round(duration, 2),
            "karaoke_url": f"/karaoke/files/{job_id}/karaoke",
            "vocals_url": f"/karaoke/files/{job_id}/vocals",
        }
    except HTTPException:
        shutil.rmtree(job_dir, ignore_errors=True)
        raise
    except Exception as exc:
        shutil.rmtree(job_dir, ignore_errors=True)
        raise HTTPException(500, str(exc)) from exc
    finally:
        await file.close()


@router.get("/files/{job_id}/{stem}")
def get_karaoke_file(job_id: str, stem: str, download: bool = Query(default=False)):
    if not re.fullmatch(r"[0-9a-f]{32}", job_id) or stem not in {"karaoke", "vocals"}:
        raise HTTPException(404, "File not found")
    audio_path = JOBS_DIR / job_id / f"{stem}.mp3"
    if not audio_path.is_file():
        raise HTTPException(404, "File not found (files are retained locally for 24 hours).")
    return FileResponse(
        audio_path, media_type="audio/mpeg",
        filename=f"rehearsalradar-{stem}.mp3" if download else None,
    )
