"""Safely insert the KaraokePractice component into the existing KaraokeMaker.

Only modifies frontend/src/components/KaraokeMaker.tsx if its expected
prior version is found; creates a timestamped backup first. No backend, app
history, training data, or Git state is modified.
"""
from datetime import datetime
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
TARGET = ROOT / "frontend" / "src" / "components" / "KaraokeMaker.tsx"
COMPONENT = ROOT / "frontend" / "src" / "components" / "KaraokePractice.tsx"
IMPORT = 'import KaraokePractice from "./KaraokePractice";'
CALL = '<KaraokePractice key={result.job_id} karaokeUrl={`${API_BASE}${result.karaoke_url}`} trackName={result.filename} durationSeconds={result.duration_seconds} />'
ANCHOR = '<p className="mt-5 text-xs leading-6 text-slate-400">Generated files are stored'


def main() -> None:
    if not TARGET.is_file():
        sys.exit("ERROR: Cannot find frontend/src/components/KaraokeMaker.tsx. Please verify the previous Karaoke Maker installation.")
    if not COMPONENT.is_file():
        sys.exit("ERROR: KaraokePractice.tsx missing. Extract the ZIP into the project root first.")
    content = TARGET.read_text(encoding="utf-8")
    if "<KaraokePractice" in content:
        print("ALREADY INSTALLED: Karaoke Practice found in KaraokeMaker.tsx; no changes.")
        return
    if content.count(ANCHOR) != 1 or content.count('result.karaoke_url') < 1:
        sys.exit("ERROR: Cannot identify the expected KaraokeMaker layout. No changes made. Please send your current KaraokeMaker.tsx instead of replacing it.")
    if 'from "./KaraokePractice"' in content:
        sys.exit("ERROR: Import exists but component was not rendered. No changes made. Inspect KaraokeMaker.tsx.")
    first_import = content.find("import ")
    if first_import < 0:
        sys.exit("ERROR: No valid React import found. No changes made.")
    content = content[:first_import] + IMPORT + "\n" + content[first_import:]
    anchor_at = content.index(ANCHOR)
    original_line_start = content.rfind("\n", 0, anchor_at) + 1
    indentation = content[original_line_start:anchor_at]
    if indentation.strip():
        sys.exit("ERROR: Unexpected JSX indentation. No changes made.")
    content = content[:original_line_start] + f"{indentation}{CALL}\n" + content[original_line_start:]

    backup_dir = ROOT / ".rr-backups"
    backup_dir.mkdir(exist_ok=True)
    backup = backup_dir / f"KaraokeMaker.before-practice-{datetime.now().strftime('%Y%m%d-%H%M%S-%f')}.tsx.bak"
    backup.write_text(TARGET.read_text(encoding="utf-8"), encoding="utf-8")
    git_exclude = ROOT / ".git" / "info" / "exclude"
    if git_exclude.is_file():
        existing = git_exclude.read_text(encoding="utf-8")
        if "/.rr-backups/" not in existing:
            with git_exclude.open("a", encoding="utf-8") as handle:
                handle.write("\n/.rr-backups/\n")
    TARGET.write_text(content, encoding="utf-8")
    print("SUCCESS: Karaoke Practice Mode added under separated audio tracks.")
    print(f"Backup: {backup.relative_to(ROOT)}")
    print("Next: cd frontend; npm run build")


if __name__ == "__main__":
    main()
