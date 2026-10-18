# RehearsalRadar AI — Final Local Testing Checklist

**Do not Git-push until tests pass.** Do not overwrite current app source files with this testing pack.

## 1. Build, dependencies and services

From the VS Code terminal at the project root (PowerShell):

```powershell
cd "$HOME\Desktop\rehearsalradar-ai\frontend"
npm run build
cd ..
.\backend\.venv\Scripts\python.exe -m pip check
ffmpeg -version
ffprobe -version
```

A Vite bundle-size warning is not a failure; an error exit code is.

With the backend running on `http://127.0.0.1:8000`, check:

```powershell
.\backend\.venv\Scripts\python.exe tests\smoke_test.py
```

Optional full test using a **short valid audio-only** file (10–30 s) at `Desktop\singing_test.wav`:

```powershell
.\backend\.venv\Scripts\python.exe tests\smoke_test.py --audio "$HOME\Desktop\singing_test.wav"
```

This test creates one temporary SQLite history record and deletes only that newly created record. It does not modify other history entries. It does not persist uploaded audio. With a real sample it may take some time for the CPU model to finish.

## 2. Browser test checklist

- [ ] Free Singing: select a short WAV; preview audio; analyze; see pitch cards, contour and stability/coverage insights.
- [ ] Free Singing: download JSON results; inspect the result file opens; original audio bytes are not present.
- [ ] Reference Comparison: same sample in both fields yields closely overlapping contours and near-zero median difference.
- [ ] Reference Comparison: a 1-second delayed reference produces about **+1 second** estimated offset.
- [ ] Reference Comparison: genuinely different clean vocal takes show reasonable contour comparison; do not label it an accuracy score.
- [ ] Analysis History: save, refresh, open a result after page refresh, and delete only a test record.
- [ ] Audio preview: selecting a different file updates preview; clear selection resets file inputs and results.
- [ ] Unsupported `.txt` file rejected with readable message.
- [ ] Over-100-MB file rejected without processing (only if a safe test file is available).
- [ ] Invalid/corrupt WAV rejected by backend; server stays running.
- [ ] Backend off: UI shows a clear connection error and can recover when backend restarts.
- [ ] Narrow mobile viewport (Chrome F12 > Toggle Device Toolbar): no horizontal overflow or clipped controls.
- [ ] 30-second recording: rough processing time measured on laptop CPU; test longer audio separately before making performance claims.

## 3. Known boundaries

- The interface advertises a 6-minute limit, but this is **not** a promise of acceptable CPU inference latency for 6 minutes.
- TorchCrepe confidence filtering introduces gaps; `null` pitch values are expected for silent/unreliable segments.
- Starting-offset alignment handles limited shifts, not independent tempo variations or different phrases.
- Stability metrics are descriptive signal measurements, not clinical information or singing-quality grades.
- History is unauthenticated and is safe only for local single-user operation. **Do not publicly host current backend.**

## 4. Git safety — only at final publishing stage

```powershell
cd "$HOME\Desktop\rehearsalradar-ai"
git status
# Review staged file list before every commit
# Keep backend/data/*.sqlite3, recordings, virtualenvs, node_modules out of Git
```

After successful final tests, request the last GitHub publish batch (commit/push/PR/merge/pull).
