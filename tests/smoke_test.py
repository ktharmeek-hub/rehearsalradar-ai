r"""RehearsalRadar AI local backend smoke test.

Run from project root:
  .\backend\.venv\Scripts\python.exe tests\smoke_test.py --audio "$HOME\Desktop\singing_test.wav"

Uses only Python standard library. A temporary history record is created and deleted.
The user's existing history records are not modified.
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path


def request(base_url: str, route: str, method: str = "GET", *, data: bytes | None = None,
            content_type: str | None = None, timeout: int = 180) -> tuple[int, object | None]:
    headers = {}
    if content_type:
        headers["Content-Type"] = content_type
    req = urllib.request.Request(base_url.rstrip("/") + route, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            raw = response.read()
            code = response.status
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        code = exc.code
    try:
        parsed = json.loads(raw) if raw else None
    except (UnicodeDecodeError, json.JSONDecodeError):
        parsed = raw[:250].decode("utf-8", errors="replace")
    return code, parsed


def multipart_audio(audio_path: Path) -> tuple[bytes, str]:
    boundary = "----RehearsalRadarTest" + uuid.uuid4().hex
    filename = audio_path.name.replace('"', "_").replace("\r", "_").replace("\n", "_")
    mime = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    prefix = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        f"Content-Type: {mime}\r\n\r\n"
    ).encode("utf-8")
    body = prefix + audio_path.read_bytes() + f"\r\n--{boundary}--\r\n".encode("utf-8")
    return body, f"multipart/form-data; boundary={boundary}"


def check(label: str, condition: bool, detail: str = "") -> None:
    marker = "PASS" if condition else "FAIL"
    print(f"[{marker}] {label}" + (f" — {detail}" if detail else ""), flush=True)
    if not condition:
        raise RuntimeError(f"{label} failed: {detail}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Test local RehearsalRadar backend")
    parser.add_argument("--url", default="http://127.0.0.1:8000", help="Local FastAPI URL")
    parser.add_argument("--audio", type=Path, help="Optional 10–30 second WAV/MP3 sample for AI endpoint")
    args = parser.parse_args()
    base_url = args.url.rstrip("/")
    history_id = None

    print("RehearsalRadar AI — backend smoke test")
    print("Backend:", base_url)
    try:
        code, payload = request(base_url, "/health", timeout=10)
        check("Backend health", code == 200 and isinstance(payload, dict), str(payload))

        # This intentionally does not save uploaded audio.
        boundary = "----RehearsalRadarInvalidFile"
        bad_body = (
            f"--{boundary}\r\n"
            'Content-Disposition: form-data; name="file"; filename="not_audio.txt"\r\n'
            "Content-Type: text/plain\r\n\r\nhello\r\n"
            f"--{boundary}--\r\n"
        ).encode("utf-8")
        code, payload = request(base_url, "/upload", method="POST", data=bad_body,
                                content_type=f"multipart/form-data; boundary={boundary}", timeout=15)
        check("Invalid audio extension rejected", code == 400, f"HTTP {code}")

        code, payload = request(base_url, "/history?limit=2", timeout=15)
        check("History listing", code == 200 and isinstance(payload, list), f"HTTP {code}")

        if args.audio is None:
            print("[SKIP] Real audio upload, AI pitch analysis, and history create/read/delete")
            print("       Supply --audio path to run these tests.")
        else:
            audio_path: Path = args.audio.expanduser()
            check("Audio file exists", audio_path.is_file(), str(audio_path))
            check("Audio file extension supported", audio_path.suffix.lower() in {
                ".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg", ".webm"})
            check("Short sample recommended", audio_path.stat().st_size < 100 * 1024 * 1024)
            body, content_type = multipart_audio(audio_path)

            code, payload = request(base_url, "/upload", "POST", data=body,
                                    content_type=content_type, timeout=45)
            check("Audio upload validation", code == 200 and isinstance(payload, dict)
                  and payload.get("status") == "success", f"HTTP {code}; {str(payload)[:180]}")

            print("Running TorchCrepe AI (CPU may take some time)...", flush=True)
            code, payload = request(base_url, "/analyze", "POST", data=body,
                                    content_type=content_type, timeout=240)
            check("AI analysis HTTP response", code == 200 and isinstance(payload, dict),
                  f"HTTP {code}; {str(payload)[:180]}")
            assert isinstance(payload, dict)
            check("AI result shape", payload.get("status") in ("success", "no_pitch_detected")
                  and isinstance(payload.get("pitch_contour"), list), str(payload.get("status")))
            print("    Median pitch:", payload.get("median_pitch_hz"), "Hz")
            print("    Contour points:", len(payload["pitch_contour"]))

            post_data = json.dumps({"mode": "free", "singing": payload, "reference": None}).encode("utf-8")
            code, saved = request(base_url, "/history", "POST", data=post_data,
                                  content_type="application/json", timeout=30)
            check("History save", code == 201 and isinstance(saved, dict)
                  and isinstance(saved.get("id"), int), f"HTTP {code}; {str(saved)[:180]}")
            assert isinstance(saved, dict)
            history_id = saved["id"]

            code, detail = request(base_url, f"/history/{history_id}", timeout=15)
            check("History reopen", code == 200 and isinstance(detail, dict)
                  and detail.get("id") == history_id, f"HTTP {code}")

        print("\nAll selected checks passed. Next: browser mobile/UX tests in docs/TESTING.md")
        return 0
    except (OSError, RuntimeError, urllib.error.URLError, TimeoutError, ValueError) as exc:
        print("\nTest stopped:", exc, file=sys.stderr)
        return 1
    finally:
        if history_id is not None:
            try:
                code, _ = request(base_url, f"/history/{history_id}", "DELETE", timeout=15)
                print(f"[{'PASS' if code == 204 else 'WARN'}] Remove temporary test history entry (HTTP {code})")
            except Exception as exc:
                print(f"[WARN] Could not remove temporary test history entry ID {history_id}: {exc}")


if __name__ == "__main__":
    sys.exit(main())
