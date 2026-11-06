#!/usr/bin/env python3
"""Review an approved, private certificate plan; never writes unless explicitly enabled.

Plans, approvals and receipts belong outside the checkout on a private filesystem.
See docs/ACESSO_E_ENTREGAS.md. Uses only the Python standard library.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import secrets
import stat
import sys
from datetime import datetime, timezone
from urllib.parse import urlencode, urljoin, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
from urllib.error import HTTPError, URLError


class Stop(Exception):
    pass


def now():
    return datetime.now(timezone.utc).isoformat()


def private_path(path, exists=True):
    path = Path(path).absolute()
    if path.is_symlink() or (exists and not path.is_file()):
        raise Stop('Arquivo privado ausente ou link simbólico recusado.')
    target = path if exists else path.parent
    info = target.stat()
    if info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) & 0o077:
        raise Stop('Use arquivo 0600/diretório 0700 do proprietário, fora do SSD exFAT.')
    root = Path(__file__).resolve().parent.parent
    if path.is_relative_to(root):
        raise Stop('Planos, aprovações e recibos devem ficar fora do projeto.')
    return path


def read_private(path):
    return json.loads(private_path(path).read_text())


def write_private(path, data):
    path = private_path(path, exists=Path(path).exists())
    temporary = path.with_name(path.name + '.' + secrets.token_hex(8) + '.tmp')
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as stream:
        json.dump(data, stream, ensure_ascii=False, indent=2)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary, path)


def digest(plan):
    payload = {key: value for key, value in plan.items() if key != 'plan_sha256'}
    return hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False,
                                     separators=(',', ':')).encode()).hexdigest()


def validate_plan(plan, expected):
    if digest(plan) != expected or plan.get('plan_sha256') != expected:
        raise Stop('O plano mudou: revise os destinos/arquivos e obtenha nova validação.')
    origin = plan.get('canvas_origin', '')
    if origin != 'https://pucpr.instructure.com':
        raise Stop('A origem não corresponde ao Canvas PUCPR confirmado.')
    if not plan.get('expected_owner_name') or not plan.get('items'):
        raise Stop('Plano incompleto.')
    contents, seen = {}, set()
    for item in plan['items']:
        key = (str(item['course_id']), str(item['assignment_id']))
        if not all(part.isdecimal() for part in key) or key in seen or not item.get('files'):
            raise Stop('Destino duplicado ou inválido no plano.')
        seen.add(key)
        expected_url = origin + f'/courses/{key[0]}/assignments/{key[1]}'
        if item.get('url') != expected_url:
            raise Stop('URL de destino inconsistente com a atividade.')
        for file in item['files']:
            path = Path(file['path'])
            data = path.read_bytes()
            if (path.name != file['name'] or path.suffix.lower() != '.pdf'
                    or len(data) != file['size'] or len(data) > 25_000_000
                    or not data[:1024].lstrip(b'\r\n\t ').startswith(b'%PDF-')
                    or hashlib.sha256(data).hexdigest() != file['sha256']):
                raise Stop('O PDF mudou ou não corresponde ao arquivo validado.')
            contents[file['sha256']] = data
    return contents


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


class Canvas:
    def __init__(self, origin, token):
        self.origin, self.token = origin, token
        self.opener = build_opener(NoRedirect())

    def request(self, method, url, data=None, headers=None, authenticated=True):
        parts = urlsplit(url)
        if parts.scheme != 'https' or parts.username or parts.password or parts.fragment:
            raise Stop('URL de upload/retorno inválida.')
        headers = dict(headers or {})
        if authenticated:
            if f'{parts.scheme}://{parts.netloc}' != self.origin or not parts.path.startswith('/api/v1/'):
                raise Stop('Token restrito à API Canvas confirmada.')
            headers['Authorization'] = 'Bearer ' + self.token
        headers['Accept'] = 'application/json'
        request = Request(url, data=data, headers=headers, method=method)
        try:
            response = self.opener.open(request, timeout=60)
        except HTTPError as error:
            response = error
        except (OSError, URLError, TimeoutError):
            raise Stop('Resposta de rede desconhecida. Confira o recibo; nenhum POST será repetido.') from None
        with response:
            body = response.read(10_000_001)
            if len(body) > 10_000_000:
                raise Stop('Resposta excedeu o limite esperado.')
            try:
                result = json.loads(body) if body else {}
            except (ValueError, UnicodeError):
                result = None
            return response.status, response.headers, result

    def api(self, method, path, payload=None):
        body = None if payload is None else json.dumps(payload).encode()
        status, _, result = self.request(method, self.origin + path, body,
                                        {'Content-Type': 'application/json'})
        if status < 200 or status >= 300 or not isinstance(result, dict):
            raise Stop(f'Canvas respondeu HTTP {status}; operação interrompida sem repetição.')
        return result

    def submission(self, item):
        return self.api('GET', base(item) + '/submissions/self')

    def upload(self, item, file, data, on_pending=None):
        pending = self.api('POST', base(item) + '/submissions/self/files', {
            'name': file['name'], 'size': len(data), 'content_type': 'application/pdf', 'on_duplicate': 'rename',
        })
        if on_pending:
            on_pending(pending)
        url, params = pending.get('upload_url', ''), pending.get('upload_params')
        host = urlsplit(url).hostname or ''
        if not (host == urlsplit(self.origin).hostname or host.endswith('.instructure.com')
                or host.endswith('.amazonaws.com') or host.endswith('.inscloudgate.net')) or not isinstance(params, dict):
            raise Stop('Destino de upload inesperado. Verifique o registro antes de continuar.')
        boundary = 'CampusFlow' + secrets.token_hex(24)
        parts = []
        for key, value in params.items():
            if not isinstance(key, str) or any(char in key for char in '\r\n"') or not isinstance(value, (str, int, float)):
                raise Stop('Parâmetro de upload não suportado; nenhuma adaptação foi presumida.')
            parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode())
        if any(char in file['name'] for char in '\r\n"'):
            raise Stop('Nome do arquivo inválido.')
        parts.append((f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{file["name"]}"'
                      '\r\nContent-Type: application/pdf\r\n\r\n').encode() + data + f'\r\n--{boundary}--\r\n'.encode())
        status, headers, result = self.request('POST', url, b''.join(parts),
            {'Content-Type': f'multipart/form-data; boundary={boundary}'}, authenticated=False)
        location = headers.get('Location')
        if status in (201, 301, 302, 303) and location:
            final = urljoin(url, location)
            if not urlsplit(final).path.startswith('/api/v1/files/'):
                raise Stop('Retorno de upload inesperado; consulte o Canvas antes de repetir.')
            status, _, result = self.request('GET', final)
        if status not in (200, 201) or not isinstance(result, dict) or not result.get('id') or result.get('size') != len(data):
            raise Stop('Upload sem confirmação. Nenhum arquivo será reenviado automaticamente.')
        return int(result['id'])


def base(item):
    return f'/api/v1/courses/{item["course_id"]}/assignments/{item["assignment_id"]}'


def matches(receipt, item, ids):
    return (str(receipt.get('assignment_id')) == str(item['assignment_id'])
            and receipt.get('submitted_at') and receipt.get('workflow_state') in ('submitted', 'graded', 'pending_review')
            and receipt.get('submission_type') == 'online_upload'
            and {int(file['id']) for file in receipt.get('attachments', [])} == set(ids))


def preflight(canvas, plan, journal):
    if canvas.api('GET', '/api/v1/users/self/profile').get('name') != plan['expected_owner_name']:
        raise Stop('A identidade Canvas não corresponde ao participante validado.')
    states = []
    for item in plan['items']:
        assignment = canvas.api('GET', base(item) + '?include[]=submission&include[]=can_submit')
        receipt = canvas.submission(item)
        record = journal.get('items', {}).get(str(item['assignment_id']), {})
        if record.get('state') in ('submitting', 'confirmed'):
            if not matches(receipt, item, record.get('file_ids', [])):
                raise Stop('Envio anterior sem recibo correspondente. Confira manualmente; não repetir.')
            states.append((item, record, receipt))
            continue
        if record:
            raise Stop('Há um upload anterior incompleto. Confira o Canvas antes de retomar.')
        if (str(assignment.get('id')) != str(item['assignment_id']) or assignment.get('name') != item['title']
                or assignment.get('due_at') != item.get('due_at') or assignment.get('can_submit') is not True
                or assignment.get('locked_for_user') or 'online_upload' not in assignment.get('submission_types', [])
                or receipt.get('submitted_at') or receipt.get('workflow_state') != 'unsubmitted'
                or receipt.get('attempt') != item.get('existing_attempt') or receipt.get('excused')):
            raise Stop('Atividade ou entrega mudou desde a revisão. Obtenha nova validação específica.')
        extensions = assignment.get('allowed_extensions')
        if extensions and 'pdf' not in [extension.lower() for extension in extensions]:
            raise Stop('A atividade não aceita PDF.')
        states.append((item, record, None))
    return states


def execute(canvas, plan, contents, journal, journal_path):
    # Check ALL destinations before creating any pending file or submission.
    states = preflight(canvas, plan, journal)
    for item, record, existing in states:
        key = str(item['assignment_id'])
        if existing:
            record.update(state='confirmed', receipt=existing, verified_at=now())
            journal.setdefault('items', {})[key] = record
            write_private(journal_path, journal)
            continue
        record = {'state': 'uploading', 'started_at': now(), 'file_ids': []}
        journal.setdefault('items', {})[key] = record
        write_private(journal_path, journal)
        for file in item['files']:
            def checkpoint(pending):
                record['pending_upload'] = {'sha256': file['sha256'], 'response': pending}
                write_private(journal_path, journal)
            file_id = canvas.upload(item, file, contents[file['sha256']], on_pending=checkpoint)
            record['file_ids'].append(file_id)
            record.pop('pending_upload', None)
            write_private(journal_path, journal)
        # Recheck before submitting; a parallel user submission must not be replaced.
        current = canvas.submission(item)
        if current.get('submitted_at') or current.get('workflow_state') != 'unsubmitted':
            raise Stop('Uma entrega apareceu durante o upload. Preservada, sem substituir.')
        record['state'] = 'submitting'
        write_private(journal_path, journal)
        # One dispatch only; a failure is deliberately not caught and retried.
        canvas.api('POST', base(item) + '/submissions', {
            'submission': {'submission_type': 'online_upload', 'file_ids': record['file_ids']},
        })
        receipt = canvas.submission(item)
        if not matches(receipt, item, record['file_ids']):
            raise Stop('Recibo não confirmado. Consulte a atividade antes de qualquer novo envio.')
        record.update(state='confirmed', receipt=receipt, verified_at=now())
        write_private(journal_path, journal)
    return len(states)


def authorization(plan, expected, approval_path, enabled):
    if enabled != 'true' or not approval_path:
        raise Stop('Envio exige habilitação no processo e validação explícita do plano.')
    approval = read_private(approval_path)
    if (approval.get('approved') is not True or approval.get('plan_sha256') != expected
            or not approval.get('user_response') or not approval.get('approved_at')):
        raise Stop('A validação não corresponde ao plano exato.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--plan', required=True)
    parser.add_argument('--sha256', required=True)
    parser.add_argument('--env-file', required=True)
    parser.add_argument('--approval')
    parser.add_argument('--journal')
    parser.add_argument('--execute', action='store_true')
    args = parser.parse_args()
    plan = read_private(args.plan)
    contents = validate_plan(plan, args.sha256)
    if args.execute:
        authorization(plan, args.sha256, args.approval, os.environ.get('CANVAS_SUBMISSIONS_ENABLED'))
        if not args.journal:
            raise Stop('O envio exige um registro privado de recibos.')
        private_path(args.journal, exists=Path(args.journal).exists())
    values = {}
    for line in private_path(args.env_file).read_text().splitlines():
        if line.strip() and not line.lstrip().startswith('#') and '=' in line:
            name, value = line.split('=', 1)
            values[name.strip()] = value.strip().strip('\"\'')
    if values.get('CANVAS_BASE_URL', '').rstrip('/') != plan['canvas_origin'] or not values.get('CANVAS_API_TOKEN'):
        raise Stop('Configuração Canvas privada ausente ou divergente.')
    canvas = Canvas(plan['canvas_origin'], values['CANVAS_API_TOKEN'])
    journal = read_private(args.journal) if args.journal and Path(args.journal).exists() else {'plan_sha256': args.sha256, 'items': {}}
    if journal.get('plan_sha256') != args.sha256:
        raise Stop('Registro pertence a outro plano.')
    if args.execute:
        count = execute(canvas, plan, contents, journal, args.journal)
        print(f'{count} recibos confirmados. Registro privado: {args.journal}')
    else:
        states = preflight(canvas, plan, journal)
        print(f'Revisão de leitura concluída: {len(states)} atividades, {sum(len(item[0]["files"]) for item in states)} anexos. Nenhum POST executado.')


if __name__ == '__main__':
    try:
        main()
    except (Stop, OSError, ValueError, KeyError, TypeError) as error:
        # Avoid response bodies, signed upload URLs and credentials in terminal logs.
        print(str(error) if isinstance(error, Stop) else 'Dados ou arquivos inválidos; operação interrompida.', file=sys.stderr)
        sys.exit(1)
