"""Install a user-facing Practice Coach in RehearsalRadar AI without overwriting App.tsx.

Run from repository root: py -3.11 scripts/install_practice_coach.py
This only updates frontend/src/App.tsx after making a local backup.
The user ML CSV and backend are never modified.
"""
from __future__ import annotations

from datetime import datetime
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "frontend" / "src" / "App.tsx"
COACH = ROOT / "frontend" / "src" / "components" / "PracticeCoach.tsx"


def main() -> None:
    if not APP.is_file() or not COACH.is_file():
        sys.exit("ERROR: Expected frontend/src/App.tsx and PracticeCoach.tsx. Extract ZIP into your project ROOT first.")
    original = APP.read_text(encoding="utf-8-sig")
    updated = original

    if re.search(r'<PracticeCoach(?:\s|/|>)', updated):
        print("Already installed. App.tsx not modified.")
        return

    anchor = re.compile(r'(?m)^([ \t]*)\{analysisResult && \(mode === "free" \|\| referenceAnalysis\) && \(\s*\n[ \t]*<div className="mt-5 flex flex-wrap justify-end">')
    matches = list(anchor.finditer(updated))
    if len(matches) != 1:
        sys.exit("ERROR: Could not find expected Download JSON result section. App.tsx unchanged. Open INSTALL.md for manual placement.")
    if "import { analyzeAudio" not in updated or "analysisResult" not in updated:
        sys.exit("ERROR: Existing audio analysis state not found. App.tsx unchanged.")

    # Preserve any data collection code, but hide the ML-training form from ordinary users.
    # The dataset stays untouched. The router can remain in place for local maintenance.
    form_pattern = re.compile(r'(?m)^[ \t]*<MLTrainingFeedback\s+analysisResult=\{analysisResult\}\s+singingFilename=\{singingFile\?\.name\}\s*/>\s*\n?')
    updated, removed = form_pattern.subn("", updated)
    if removed > 1:
        sys.exit("ERROR: Multiple MLTrainingFeedback forms found; App.tsx unchanged.")
    if removed:
        updated = re.sub(r'(?m)^import MLTrainingFeedback from ["\']\./components/MLTrainingFeedback["\'];?\s*\n', "", updated, count=1)
        # Undo the fragment wrapper that the old ML feedback installer added.
        updated = re.sub(
            r'(?m)^([ \t]*)<>\s*\n[ \t]*<PitchResults result=\{analysisResult\} />\s*\n[ \t]*</>\s*$',
            r'\1<PitchResults result={analysisResult} />',
            updated,
            count=1,
        )

    import_line = 'import PracticeCoach from "./components/PracticeCoach";\n'
    if 'from "./components/PracticeCoach"' not in updated and "from './components/PracticeCoach'" not in updated:
        lines = updated.splitlines(keepends=True)
        indices = [index for index, line in enumerate(lines) if line.startswith("import ")]
        if not indices:
            sys.exit("ERROR: Could not locate imports. App.tsx unchanged.")
        lines.insert(indices[-1] + 1, import_line)
        updated = "".join(lines)

    matches = list(anchor.finditer(updated))
    if len(matches) != 1:
        sys.exit("ERROR: App changed unexpectedly during patch. No files changed.")
    location = matches[0]
    indent = location.group(1)
    insert = (
        f'{indent}{{analysisResult && (mode === "free" || referenceAnalysis) && (\n'
        f'{indent}  <PracticeCoach\n'
        f'{indent}    key={{mode + "-" + analysisResult.filename + "-" + (referenceAnalysis?.filename ?? "")}}\n'
        f'{indent}    analysis={{analysisResult}}\n'
        f'{indent}    reference={{mode === "compare" ? referenceAnalysis : null}}\n'
        f'{indent}  />\n'
        f'{indent})}}\n\n'
    )
    updated = updated[:location.start()] + insert + updated[location.start():]

    backups = ROOT / ".rr-backups"
    backups.mkdir(exist_ok=True)
    backup = backups / f'App.before-practice-coach-{datetime.now().strftime("%Y%m%d-%H%M%S")}.tsx.bak'
    backup.write_text(original, encoding="utf-8")
    git_exclude = ROOT / ".git" / "info" / "exclude"
    if git_exclude.is_file():
        exclude = git_exclude.read_text(encoding="utf-8")
        if "/.rr-backups/" not in exclude:
            with git_exclude.open("a", encoding="utf-8") as handle:
                handle.write("\n/.rr-backups/\n")

    APP.write_text(updated, encoding="utf-8")
    print("SUCCESS: Practice Coach displayed after singing or reference analysis.")
    if removed:
        print("ML label form hidden from ordinary users; existing dataset and API not modified.")
    else:
        print("ML label form not found; no change needed.")
    print(f"App.tsx backed up to {backup.relative_to(ROOT)}")
    print("Next: cd frontend && npm run build")


if __name__ == "__main__":
    main()
