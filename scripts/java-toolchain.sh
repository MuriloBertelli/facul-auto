#!/usr/bin/env bash
set -euo pipefail

campusflow_repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -z "${CAMPUSFLOW_TOOLS_DIR:-}" ]]; then
  if [[ "$campusflow_repo_root" == /workspace/* ]]; then
    CAMPUSFLOW_TOOLS_DIR=/workspace/.tools
  else
    # External exFAT volumes cannot store the symbolic links in a JDK archive.
    CAMPUSFLOW_TOOLS_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/campusflow-local/toolchains"
  fi
fi
export CAMPUSFLOW_TOOLS_DIR
mkdir -p "$CAMPUSFLOW_TOOLS_DIR/downloads"

campusflow_download_verified() {
  local url="$1" archive="$2" algorithm="$3" expected="$4" downloaded
  if [[ -f "$archive" ]]; then
    downloaded="$(${algorithm}sum "$archive" | cut -d ' ' -f 1)"
    if [[ "$downloaded" != "$expected" ]]; then
      printf 'Checksum inválido no cache de ferramentas: %s\n' "$archive" >&2
      return 1
    fi
    return
  fi
  curl --fail --location --silent --show-error --proto '=https' --tlsv1.2 \
    --retry 3 --output "$archive.part" "$url"
  downloaded="$(${algorithm}sum "$archive.part" | cut -d ' ' -f 1)"
  if [[ "$downloaded" != "$expected" ]]; then
    rm -f "$archive.part"
    printf 'Checksum oficial inválido; a ferramenta não será utilizada.\n' >&2
    return 1
  fi
  mv "$archive.part" "$archive"
}

campusflow_is_java21() {
  [[ -x "$1/bin/javac" ]] && [[ "$("$1/bin/javac" -version 2>&1)" == 'javac 21.'* ]]
}

if command -v flock >/dev/null 2>&1; then
  exec 9>"$CAMPUSFLOW_TOOLS_DIR/.install.lock"
  flock 9
fi

if [[ -n "${JAVA_HOME:-}" ]] && campusflow_is_java21 "$JAVA_HOME"; then
  : # Reuse a user-provided Java 21 JDK.
elif command -v javac >/dev/null 2>&1 && campusflow_is_java21 "$(dirname "$(dirname "$(readlink -f "$(command -v javac)")")")"; then
  JAVA_HOME="$(dirname "$(dirname "$(readlink -f "$(command -v javac)")")")"
else
  if [[ "$(uname -s)" != Linux || "$(uname -m)" != x86_64 ]]; then
    printf 'Instale um JDK 21 para esta plataforma e defina JAVA_HOME.\n' >&2
    exit 1
  fi
  JAVA_HOME="$CAMPUSFLOW_TOOLS_DIR/jdk-21.0.13+9"
  if ! campusflow_is_java21 "$JAVA_HOME"; then
    campusflow_jdk_archive="$CAMPUSFLOW_TOOLS_DIR/downloads/OpenJDK21U-jdk_x64_linux_hotspot_21.0.13_9.tar.gz"
    # SHA-256 published alongside this exact Eclipse Temurin release.
    campusflow_download_verified \
      'https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.13%2B9/OpenJDK21U-jdk_x64_linux_hotspot_21.0.13_9.tar.gz' \
      "$campusflow_jdk_archive" sha256 \
      d7f5d5cf865a2902b70ff549b97586a7d3f234e016f041ab447ea740c7d66d1c
    tar -xzf "$campusflow_jdk_archive" -C "$CAMPUSFLOW_TOOLS_DIR"
  fi
fi
export JAVA_HOME

campusflow_maven_version=3.9.11
if [[ -n "${MAVEN_HOME:-}" && -x "$MAVEN_HOME/bin/mvn" ]] && \
   "$MAVEN_HOME/bin/mvn" --version 2>/dev/null | sed -n '1p' | grep -F 'Apache Maven 3.9.11 ' >/dev/null; then
  : # Reuse an explicitly selected Maven with the exact pinned version.
elif command -v mvn >/dev/null 2>&1 && \
   mvn --version 2>/dev/null | sed -n '1p' | grep -F 'Apache Maven 3.9.11 ' >/dev/null; then
  MAVEN_HOME="$(dirname "$(dirname "$(readlink -f "$(command -v mvn)")")")"
else
  MAVEN_HOME="$CAMPUSFLOW_TOOLS_DIR/apache-maven-$campusflow_maven_version"
  if [[ ! -x "$MAVEN_HOME/bin/mvn" ]]; then
    campusflow_maven_archive="$CAMPUSFLOW_TOOLS_DIR/downloads/apache-maven-$campusflow_maven_version-bin.tar.gz"
    # SHA-512 published by Apache Maven Central for the pinned binary archive.
    campusflow_download_verified \
      "https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/$campusflow_maven_version/apache-maven-$campusflow_maven_version-bin.tar.gz" \
      "$campusflow_maven_archive" sha512 \
      bcfe4fe305c962ace56ac7b5fc7a08b87d5abd8b7e89027ab251069faebee516b0ded8961445d6d91ec1985dfe30f8153268843c89aa392733d1a3ec956c9978
    tar -xzf "$campusflow_maven_archive" -C "$CAMPUSFLOW_TOOLS_DIR"
  fi
fi
export MAVEN_HOME
export PATH="$JAVA_HOME/bin:$MAVEN_HOME/bin:$PATH"

if command -v flock >/dev/null 2>&1; then
  flock -u 9
  exec 9>&-
fi

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  "$JAVA_HOME/bin/javac" -version
  "$MAVEN_HOME/bin/mvn" --version
fi
