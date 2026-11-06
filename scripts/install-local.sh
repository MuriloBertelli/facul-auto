#!/usr/bin/env bash
set -euo pipefail
campusflow_source="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
campusflow_destination="${1:-/run/media/kali/Extreme SSD/04-dev/auto-faculdade}"
python3 - "$campusflow_source" "$campusflow_destination" <<'PY'
from pathlib import Path
import os, shutil, subprocess, sys
source, destination = (Path(value).resolve() for value in sys.argv[1:])
if source != destination:
    if destination.exists() and (not destination.is_dir() or any(destination.iterdir())):
        raise SystemExit('O destino já contém arquivos. Nada foi substituído; use uma pasta vazia ou revise o conteúdo local primeiro.')
    if source.is_relative_to(destination) or destination.is_relative_to(source):
        raise SystemExit('Escolha um destino independente da pasta de origem.')
    destination.mkdir(parents=True, exist_ok=True)
    excluded = {'.git', 'node_modules', '.cache', '.tools', '.netlify', '.temp', '.branches', 'target', 'dist', 'test-results', 'playwright-report', '__pycache__'}
    for current, dirs, files in os.walk(source):
        dirs[:] = [name for name in dirs if name not in excluded]
        relative = Path(current).relative_to(source)
        for name in files:
            path = Path(current) / name
            if name.endswith('.log') or (name.startswith('.env') and name != '.env.example'):
                continue
            if path.is_symlink():
                raise SystemExit('A cópia foi interrompida porque encontrou um link simbólico não previsto.')
            target = destination / relative / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, target)
if not (destination / '.git').exists():
    subprocess.run(['git', 'init', '-b', 'main', str(destination)], check=True)
    subprocess.run(['git', '-C', str(destination), 'remote', 'add', 'origin', 'https://github.com/MuriloBertelli/facul-auto.git'], check=True)
print(f'Código preparado em: {destination}')
print('Credenciais e caches não foram copiados. Nenhum commit ou push foi executado.')
PY
