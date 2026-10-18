# RehearsalRadar AI

A local-first singing practice application that estimates vocal pitch and visualizes pitch contours. It provides **free singing analysis** and an exploratory **reference vocal comparison**.

## Features

- Upload WAV, MP3, M4A, AAC, FLAC, OGG, or WebM recordings (up to 100 MB / 6 minutes by API validation).
- Free singing mode: estimated median pitch, 5th–95th percentile pitch range, and a pitch-over-time graph.
- Reference mode: compare two clean, roughly matching solo-vocal excerpts, visualize contours, and estimate a small starting-time offset (up to about 3 seconds).
- Audio preview, pitch stability/coverage insights, and JSON results export.
- Local SQLite analysis history with view/delete features (when the history backend has been installed).

**Important limits:** These are algorithmic *estimates*, not a singing accuracy grade or vocal diagnosis. Results can be unreliable with instrumental backing, strong noise, different excerpts, or tempo changes. Processing time depends on CPU; a 6-minute file may be impractically slow. Start with 10–30-second clean solo vocal samples. Pitch similarity is not proof of correct singing.

## Technology

Frontend: React, TypeScript, Vite, Tailwind CSS, Recharts. Backend: Python 3.11, FastAPI, FFmpeg/FFprobe, NumPy, Librosa, PyTorch CPU, TorchCrepe. Storage: local SQLite for derived pitch results.

## Local setup — Windows PowerShell

Prerequisites: Git, Node.js/npm compatible with the installed Vite version, Python 3.11, and FFmpeg/FFprobe available on `PATH`.

```powershell
# In the project root
py -3.11 -m venv backend\.venv

# Install CPU PyTorch from its CPU wheel index first
.\backend\.venv\Scripts\python.exe -m pip install torch==2.14.1+cpu --index-url https://download.pytorch.org/whl/cpu --timeout 300 --retries 10

# Install remaining project dependencies
.\backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt --timeout 300 --retries 10

# Frontend packages
cd frontend
npm ci --legacy-peer-deps
```

If the explicitly pinned PyTorch version is unavailable on your platform, use a CPU PyTorch build compatible with your Python version and TorchCrepe, then update/test the dependency pins before publishing changes.

### Start the backend (terminal 1)

```powershell
cd "$HOME\Desktop\rehearsalradar-ai\backend"
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Swagger API documentation: http://127.0.0.1:8000/docs

### Start the frontend (terminal 2)

```powershell
cd "$HOME\Desktop\rehearsalradar-ai\frontend"
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Open http://127.0.0.1:5173/. The backend CORS configuration permits port **5173**; if Vite chooses another port, restart it on 5173 or explicitly adjust your local CORS configuration.

## Usage

1. Choose **Free Singing Analysis** or **Reference Comparison**.
2. Select a clean solo vocal recording; for comparison select the same excerpt as a second recording.
3. Use audio preview to confirm the selection and start the analysis.
4. Review pitch contour, range, and related metrics. Download pitch results JSON or view local history if enabled.
5. Remember that large files take longer on CPU and that automated pitch metrics do not assess vocal health or artistic quality.

## API

- `GET /health` — backend status
- `POST /upload` — format/size/duration validation
- `POST /analyze` — TorchCrepe pitch estimates
- `GET /history`, `POST /history`, `GET /history/{id}`, `DELETE /history/{id}` — optional local-only history

## Privacy and security

Uploaded audio is processed using temporary files and deleted after each API request. When enabled, SQLite history stores derived analysis results and filenames **without raw audio**. The history API currently has **no login or per-user access control**: run this application on your own machine, bound to `127.0.0.1`. **Do not deploy the current backend or history API publicly.** Before public deployment, implement authentication, per-user authorization, resource limits/rate limiting, upload safeguards, and a production-ready serving design.

Do not commit `.venv`, `node_modules`, `.env`, keys, audio recordings, generated `dist`, or SQLite databases. Check `.gitignore` before the final push.

## Testing

See [docs/TESTING.md](docs/TESTING.md). The included `tests/smoke_test.py` checks the local backend and optionally analyzes a short test recording.

## Project status

A portfolio-oriented local MVP. Advanced note segmentation, tempo-warping alignment, singer scoring, and production-grade multi-user hosting are not yet implemented or validated.
