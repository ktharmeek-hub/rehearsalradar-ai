"""Safely inject optional ML-feedback component and router; back up modified files."""
from __future__ import annotations

from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "frontend" / "src" / "App.tsx"
BACKEND_MAIN = ROOT / "backend" / "main.py"


def update(path: Path, original: str, updated: str) -> None:
    if original == updated:
        print(f"Already connected: {path.relative_to(ROOT)}")
        return
    backup = path.with_name(path.name + ".backup-" + datetime.now().strftime("%Y%m%d-%H%M%S"))
    backup.write_text(original, encoding="utf-8")
    path.write_text(updated, encoding="utf-8")
    print(f"Updated: {path.relative_to(ROOT)}")
    print(f"Backup:  {backup.relative_to(ROOT)}")


def main() -> None:
    for path in (APP, BACKEND_MAIN):
        if not path.is_file():
            raise SystemExit(f"Missing required file: {path}")
    if not (ROOT / "ml" / "features.py").exists():
        raise SystemExit("Missing ml/features.py. Extract OwnML Starter first; existing training CSV is not changed.")

    text = APP.read_text(encoding="utf-8")
    patched = text
    if 'from "./components/MLTrainingFeedback"' not in patched:
        target = 'import PitchResults from "./components/PitchResults";'
        # Fall back to importing alongside any first import without assuming a specific import order.
        import_line = 'import MLTrainingFeedback from "./components/MLTrainingFeedback";\n'
        if target in patched:
            patched = patched.replace(target, target + "\n" + import_line.rstrip(), 1)
        else:
            lines = patched.splitlines(keepends=True)
            last_import = max((i for i, line in enumerate(lines) if line.startswith("import ")), default=-1)
            if last_import < 0:
                raise SystemExit("Cannot find App.tsx imports; update manually using INSTALL.md.")
            lines.insert(last_import + 1, import_line)
            patched = "".join(lines)
    if '<MLTrainingFeedback ' not in patched:
        target = '<PitchResults result={analysisResult} />'
        if patched.count(target) != 1:
            raise SystemExit("Cannot find exactly one <PitchResults result={analysisResult} />; App.tsx not changed. See INSTALL.md.")
        patched = patched.replace(target,
            '<>\n                  <PitchResults result={analysisResult} />\n                  <MLTrainingFeedback analysisResult={analysisResult} singingFilename={singingFile?.name} />\n                </>', 1)

    main_source = BACKEND_MAIN.read_text(encoding="utf-8")
    main_patched = main_source
    if "app.include_router(ml_feedback_router)" not in main_patched:
        if "app = FastAPI(" not in main_patched and "app=FastAPI(" not in main_patched:
            raise SystemExit("Cannot confirm FastAPI app variable in backend/main.py. No changes saved; see INSTALL.md.")
        main_patched = main_patched.rstrip() + "\n\n# Local-only human-reviewed ML dataset collection. Never expose unauthenticated online.\nfrom ml_feedback import router as ml_feedback_router\napp.include_router(ml_feedback_router)\n"
    # Preflight both before saving either to reduce chances of partial changes.
    update(APP, text, patched)
    update(BACKEND_MAIN, main_source, main_patched)
    print("Done. Existing ml/data/practice_labels.csv was NOT modified.")


if __name__ == "__main__":
    main()
