#!/usr/bin/env bash
set -euo pipefail

campusflow_script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$campusflow_script_dir/java-toolchain.sh"

campusflow_settings="$CAMPUSFLOW_TOOLS_DIR/maven-settings.xml"
python3 - "$campusflow_settings" <<'PY'
import os, pathlib, sys, tempfile, urllib.parse, xml.etree.ElementTree as ET

settings = ET.Element('settings', xmlns='http://maven.apache.org/SETTINGS/1.2.0')
proxies = ET.SubElement(settings, 'proxies')
for protocol in ('http', 'https'):
    value = os.environ.get(protocol.upper() + '_PROXY') or os.environ.get(protocol + '_proxy')
    if not value:
        continue
    parsed = urllib.parse.urlsplit(value)
    if parsed.username or parsed.password:
        raise SystemExit('Use configuração Maven segura para proxy autenticado; nenhuma credencial será copiada.')
    if parsed.scheme not in ('http', 'https') or not parsed.hostname:
        raise SystemExit('URL de proxy inválida; confira a configuração do ambiente.')
    proxy = ET.SubElement(proxies, 'proxy')
    fields = {
        'id': 'campusflow-' + protocol,
        'active': 'true',
        'protocol': protocol,
        'host': parsed.hostname,
        'port': str(parsed.port or (443 if parsed.scheme == 'https' else 80)),
        'nonProxyHosts': 'localhost|127.0.0.1|[::1]',
    }
    for key, value in fields.items():
        ET.SubElement(proxy, key).text = value
path = pathlib.Path(sys.argv[1])
with tempfile.NamedTemporaryFile(dir=path.parent, prefix='.maven-settings-', delete=False) as stream:
    temporary = pathlib.Path(stream.name)
    stream.write(ET.tostring(settings, encoding='utf-8', xml_declaration=True))
temporary.chmod(0o600)
temporary.replace(path)
PY

# The cloud machine's system trust store includes its supported HTTPS proxy CA.
# Trust is preserved; no certificate or TLS verification is disabled.
campusflow_tls_options=()
if [[ -r /etc/ssl/certs/java/cacerts ]]; then
  campusflow_tls_options+=('-Djavax.net.ssl.trustStore=/etc/ssl/certs/java/cacerts')
fi

exec "$MAVEN_HOME/bin/mvn" --strict-checksums \
  --settings "$campusflow_settings" \
  "-Dmaven.repo.local=$CAMPUSFLOW_TOOLS_DIR/maven-repository" \
  "${campusflow_tls_options[@]}" "$@"
