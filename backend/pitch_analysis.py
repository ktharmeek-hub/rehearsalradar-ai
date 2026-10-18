
import subprocess

import numpy as np
import torch
import torchcrepe


SAMPLE_RATE = 16000
HOP_LENGTH = 160


def analyze_pitch(file_path: str):
    # Convert any supported audio format to mono, 16 kHz
    result = subprocess.run(
        [
            "ffmpeg", "-v", "error",
            "-i", file_path,
            "-vn", "-ac", "1",
            "-ar", str(SAMPLE_RATE),
            "-f", "f32le", "pipe:1"
        ],
        capture_output=True,
        check=True,
        timeout=120
    )

    audio = np.frombuffer(
        result.stdout, dtype=np.float32
    ).copy()

    if len(audio) == 0:
        raise ValueError("Audio file is empty")

    # Prepare audio for the neural network
    waveform = torch.from_numpy(audio).unsqueeze(0)

    # Run pretrained CREPE pitch estimation on CPU
    with torch.inference_mode():
        pitch, periodicity = torchcrepe.predict(
            waveform,
            sample_rate=SAMPLE_RATE,
            hop_length=HOP_LENGTH,
            fmin=65,
            fmax=1000,
            model="tiny",
            batch_size=256,
            device="cpu",
            return_periodicity=True
        )

    pitch = pitch.squeeze().cpu().numpy()
    periodicity = periodicity.squeeze().cpu().numpy()

    # Keep only reasonably confident pitch estimates
    valid = (
        (periodicity >= 0.5)
        & np.isfinite(pitch)
        & (pitch > 0)
    )

    times = np.arange(len(pitch)) * HOP_LENGTH / SAMPLE_RATE

    contour = [
        {
            "time": round(float(t), 2),
            "pitch_hz": round(float(p), 2)
            if is_valid else None
        }
        for t, p, is_valid in zip(times, pitch, valid)
    ]

    valid_pitches = pitch[valid]

    if len(valid_pitches) == 0:
        return {
            "status": "no_pitch_detected",
            "pitch_contour": contour,
            "median_pitch_hz": None,
            "min_pitch_hz": None,
            "max_pitch_hz": None
        }

    return {
        "status": "success",
        "pitch_contour": contour,
        "median_pitch_hz": round(
            float(np.median(valid_pitches)), 2
        ),
        "min_pitch_hz": round(
            float(np.percentile(valid_pitches, 5)), 2
        ),
        "max_pitch_hz": round(
            float(np.percentile(valid_pitches, 95)), 2
        )
    }
