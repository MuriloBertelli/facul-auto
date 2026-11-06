#!/usr/bin/env python3
"""Stage the existing Vite build for Sites without credentials or another checkout."""
from pathlib import Path
import json
import shutil

root = Path(__file__).resolve().parent.parent
manifest = json.loads((root / '.openai/hosting.json').read_text())
if manifest.get('static', {}).get('directory') != 'dist':
    raise SystemExit('Review the declared Sites output directory before packaging.')
source, destination = root / 'frontend/dist', root / 'dist'
if not (source / 'index.html').is_file():
    raise SystemExit('Build the frontend first.')
if destination.is_symlink():
    raise SystemExit('Unexpected symbolic link in the output directory.')
destination.mkdir(exist_ok=True)
for file in destination.iterdir():
    if file.is_dir() and not file.is_symlink():
        shutil.rmtree(file)
    else:
        file.unlink()
for file in source.rglob('*'):
    if file.is_symlink():
        raise SystemExit('Unexpected symbolic link in the Vite output.')
    if file.is_file() and file.name not in ('_headers', '_redirects'):
        target = destination / file.relative_to(source)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(file, target)
print('Sites static output prepared at', destination)
print('The Java API remains separate. No Canvas credential is included.')
