# RehearsalRadar AI — Own-ML Experiment

This is an OPTIONAL, isolated ML research module. It does not change the existing web app and does not claim to assess musical correctness. It trains a classifier to predict an **independent human listener's judgment**: does this recording need additional pitch-control practice? `1=yes`, `0=no`.

## What you need

- Existing RehearsalRadar AI analysis JSON exports (`pitch_contour` with `time`, `pitch_hz`).
- Distinct recordings; do not export the same recording more than once under different IDs.
- A real person listens to each recording and independently gives label 0/1, ideally without seeing the app's heuristic stability result.
- For a meaningful first experiment: 30+ unique recordings, >=10 for each label. Better: many more, across sessions/songs/singers. Assess inter-rater agreement if possible.

## Collect your first sample (Python stdlib only)

From project root in PowerShell:

```powershell
py -3.11 ml\collect_sample.py "$HOME\Downloads\analysis_result.json" --recording-id rec001 --song-id song001 --singer-id singer001 --label 1
```

Replace `analysis_result.json` with your actual downloaded JSON filename. The CSV is created at `ml/data/practice_labels.csv` automatically. Use `--label 0` for recordings a human listener judges do NOT need pitch-control practice. All seven numerical features are auto-extracted; do not invent values.

## Train when enough real labeled recordings exist

For isolation from TorchCrepe dependencies, set up a lightweight, separate venv:

```powershell
py -3.11 -m venv ml\.venv
.\ml\.venv\Scripts\python.exe -m pip install -r ml\requirements.txt
.\ml\.venv\Scripts\python.exe ml\train.py
```

This reports a held-out balanced accuracy and classification results, then writes `ml/models/pitch_practice_model.joblib`.

## Test on a different recording

```powershell
.\ml\.venv\Scripts\python.exe ml\predict.py "$HOME\Downloads\another_analysis_result.json"
```

Do **not** treat model output as a score of singing accuracy. It only predicts how likely the current recording is to be labeled 'needs pitch-control practice' by the people whose assessments formed the training dataset.

## Privacy / Git

`ml/.gitignore` excludes downloaded raw data, local labels and learned model. Review git status before committing. The dataset and model can contain information derived from private voice recordings and should not be uploaded publicly without informed consent.

## Model/measurement limitations

- Pitch stability is not singing accuracy. Musical melodies require pitch changes; vibrato is not necessarily a mistake.
- Audio-only estimates are sensitive to noise, singer, song and microphone. A pitch-contour model cannot assess pronunciation, breath support or expression.
- Random hold-out split tests recordings, not true generalization to new singers. If you have multiple singers, evaluate with singer-group separation; also try song-level hold-out.
- Don't train against labels generated from the same numerical features — that would just mimic a rule and would not validate a human coaching recommendation.
- Include a naive baseline and confusion matrix before integrating predictions into app UI.
