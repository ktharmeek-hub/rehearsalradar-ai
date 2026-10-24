"""Reposition standalone JSX KaraokeMaker and AnalysisHistory near page end.

Run from the RehearsalRadar AI project ROOT directory. Only edits
frontend/src/App.tsx, and writes a one-time .bak backup alongside it.
"""
from pathlib import Path
import re
import shutil
import sys

app = Path('frontend/src/App.tsx')
if not app.is_file():
    sys.exit('ERROR: Run from your reheasalradar-ai project root (cannot find frontend/src/App.tsx).')
source = app.read_text(encoding='utf-8-sig')
if 'import KaraokeMaker from "./components/KaraokeMaker"' not in source and "import KaraokeMaker from './components/KaraokeMaker'" not in source:
    sys.exit('ERROR: KaraokeMaker import not found. Add it before running this script.')

karaoke_pattern = r'<KaraokeMaker\s*/>'
history_pattern = r'<AnalysisHistory\s+refreshKey=\{historyRevision\}\s*/>'

if len(re.findall(karaoke_pattern, source)) != 1:
    sys.exit('ERROR: Expected exactly one <KaraokeMaker /> in App.tsx. No files changed.')
if len(re.findall(history_pattern, source)) != 1:
    sys.exit('ERROR: Expected exactly one <AnalysisHistory refreshKey={historyRevision} />. No files changed.')

footer_marker = '{/* Footer */}' if '{/* Footer */}' in source else '<footer'
if footer_marker not in source:
    sys.exit('ERROR: Cannot find footer marker in App.tsx. No files changed.')

updated = re.sub(r'^\s*<KaraokeMaker\s*/>', '', source, count=1, flags=re.MULTILINE)
updated = re.sub(r'^\s*<AnalysisHistory\s+refreshKey=\{historyRevision\}\s*/>', '', updated, count=1, flags=re.MULTILINE)
updated = updated.replace(footer_marker, '      {/* Karaoke Studio */}\n      <KaraokeMaker />\n\n      {/* Analysis History — last main section */}\n      <AnalysisHistory refreshKey={historyRevision} />\n\n      ' + footer_marker, 1)
backup = app.with_name('App.tsx.before-karaoke.bak')
if not backup.exists():
    shutil.copyfile(app, backup)
app.write_text(updated, encoding='utf-8')
print('Success: Karaoke Studio now precedes Analysis History, which is immediately before the footer.')
print(f'Backup saved: {backup}')
