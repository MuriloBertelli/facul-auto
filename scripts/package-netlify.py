#!/usr/bin/env python3
"""Prepare a manual upload with the same routing/headers as netlify.toml."""
from pathlib import Path
import hashlib
import tomllib
import zipfile

root = Path(__file__).resolve().parent.parent
config = tomllib.loads((root / 'netlify.toml').read_text())
publish = root / config['build']['publish']
if not (publish / 'index.html').is_file():
    raise SystemExit('Build the frontend before packaging it.')

redirects = []
for rule in config.get('redirects', []):
    if set(rule) - {'from', 'to', 'status', 'force'}:
        raise SystemExit('Review the manual packager for these redirect options.')
    status = str(rule.get('status', 301)) + ('!' if rule.get('force') else '')
    redirects.append(f"{rule['from']} {rule['to']} {status}")
(publish / '_redirects').write_text('\n'.join(redirects) + '\n')

headers = []
for rule in config.get('headers', []):
    if set(rule) - {'for', 'values'}:
        raise SystemExit('Review the manual packager for these header options.')
    headers.append(rule['for'])
    headers.extend(f'  {name}: {value}' for name, value in rule['values'].items())
(publish / '_headers').write_text('\n'.join(headers) + '\n')

destination = root / '.cache' / 'deploy' / 'campusflow-netlify.zip'
destination.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(publish.rglob('*')):
        if file.is_symlink():
            raise SystemExit('Unexpected symbolic link in the static output.')
        if file.is_file():
            archive.write(file, file.relative_to(publish))
print(destination)
print('SHA-256:', hashlib.sha256(destination.read_bytes()).hexdigest())
print('Static frontend only. No source files, environment files or backend included.')
