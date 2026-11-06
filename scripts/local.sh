#!/usr/bin/env bash
set -euo pipefail

campusflow_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
campusflow_cache="${CAMPUSFLOW_LOCAL_CACHE:-${XDG_CACHE_HOME:-$HOME/.cache}/campusflow-local}"
campusflow_node_version=24.22.1
campusflow_npm_version=11.9.0
campusflow_node="$campusflow_cache/toolchains/node-v$campusflow_node_version-linux-x64"
mkdir -p "$campusflow_cache/toolchains"

if [[ ! -x "$campusflow_node/bin/node" ]]; then
  if [[ "$(uname -s)" != Linux || "$(uname -m)" != x86_64 ]]; then
    printf 'Este launcher local requer Linux x86_64. Use Node %s/npm %s nesta plataforma.\n' "$campusflow_node_version" "$campusflow_npm_version" >&2
    exit 1
  fi
  campusflow_archive="node-v$campusflow_node_version-linux-x64.tar.xz"
  campusflow_download="$campusflow_cache/toolchains/$campusflow_archive"
  curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 \
    "https://nodejs.org/dist/v$campusflow_node_version/SHASUMS256.txt" \
    -o "$campusflow_cache/toolchains/node-shasums.txt"
  curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 \
    "https://nodejs.org/dist/v$campusflow_node_version/$campusflow_archive" -o "$campusflow_download.part"
  campusflow_expected="$(awk -v name="$campusflow_archive" '$2 == name {print $1}' "$campusflow_cache/toolchains/node-shasums.txt")"
  [[ -n "$campusflow_expected" ]]
  printf '%s  %s\n' "$campusflow_expected" "$campusflow_download.part" | sha256sum --check --status
  mv "$campusflow_download.part" "$campusflow_download"
  tar -xJf "$campusflow_download" -C "$campusflow_cache/toolchains"
fi

export PATH="$campusflow_node/bin:$PATH"
export npm_config_cache="$campusflow_cache/npm"
campusflow_npm="$campusflow_cache/toolchains/npm-$campusflow_npm_version"
if [[ ! -f "$campusflow_npm/node_modules/npm/bin/npm-cli.js" ]]; then
  npm install --prefix "$campusflow_npm" --cache "$npm_config_cache" \
    --ignore-scripts --no-audit --no-fund --save-exact "npm@$campusflow_npm_version"
fi
export PATH="$campusflow_npm/node_modules/.bin:$PATH"
export CAMPUSFLOW_TOOLS_DIR="${CAMPUSFLOW_TOOLS_DIR:-$campusflow_cache/toolchains}"
export NETLIFY_TELEMETRY_DISABLED=1
campusflow_id="$(printf '%s' "$campusflow_root" | sha256sum | cut -c1-16)"
campusflow_project_cache="$campusflow_cache/projects/$campusflow_id"
if [[ -z "${CAMPUSFLOW_ENV_FILE:-}" && -f "$campusflow_project_cache/private.env" ]]; then
  export CAMPUSFLOW_ENV_FILE="$campusflow_project_cache/private.env"
fi
cd "$campusflow_root"
if [[ $# == 0 ]]; then set -- npm run dev; fi

# Bind only dependencies into this process's private mount namespace. Sources
# stay on the SSD; no sudo, persistent system mounts, clone or worktree is used.
case "$(stat -f -c %T "$campusflow_root")" in
  exfat|vfat|msdos)
    campusflow_dependencies="$campusflow_project_cache/node_modules"
    mkdir -p "$campusflow_dependencies" "$campusflow_root/node_modules"
    chmod 700 "$campusflow_project_cache"
    if ! unshare --user --map-root-user true 2>/dev/null; then
      printf 'O SSD não aceita links simbólicos e os namespaces de usuário estão indisponíveis. É necessário um volume Linux para node_modules.\n' >&2
      exit 1
    fi
    campusflow_uid="$(id -u)"
    campusflow_gid="$(id -g)"
    exec unshare --user --map-root-user --mount --propagation private \
      bash -c 'mount --bind "$1" "$2"; shift 2; uid="$1"; gid="$2"; shift 2; exec unshare --user --map-user "$uid" --map-group "$gid" "$@"' \
      campusflow-local "$campusflow_dependencies" "$campusflow_root/node_modules" \
      "$campusflow_uid" "$campusflow_gid" "$@"
    ;;
  *) exec "$@" ;;
esac
