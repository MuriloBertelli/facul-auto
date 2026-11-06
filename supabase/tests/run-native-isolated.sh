#!/usr/bin/env bash
set -euo pipefail

# Optional SQL/RLS verification when a native PostgreSQL installation is present.
# This creates a disposable cluster, with a private Unix socket and TCP disabled.
campusflow_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
campusflow_pg_bin="${CAMPUSFLOW_PG_BIN:-$(pg_config --bindir)}"
campusflow_pg_temp="$(mktemp -d /tmp/campusflow-sql.XXXXXXXX)"
chmod 700 "$campusflow_pg_temp"
cleanup() {
  "$campusflow_pg_bin/pg_ctl" -D "$campusflow_pg_temp/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf -- "$campusflow_pg_temp"
}
trap cleanup EXIT
"$campusflow_pg_bin/initdb" -D "$campusflow_pg_temp/data" --no-locale --encoding=UTF8 \
  --auth-local=trust --auth-host=reject > "$campusflow_pg_temp/initdb.log"
"$campusflow_pg_bin/pg_ctl" -D "$campusflow_pg_temp/data" -l "$campusflow_pg_temp/postgres.log" \
  -o "-c listen_addresses='' -c unix_socket_directories='$campusflow_pg_temp' -p 15432" -w start
campusflow_psql=("$campusflow_pg_bin/psql" -X -h "$campusflow_pg_temp" -p 15432 -d postgres -v ON_ERROR_STOP=1)
"${campusflow_psql[@]}" <<'SQL'
select version();
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable set search_path = ''
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
SQL
for campusflow_pass in 1 2; do
  for campusflow_migration in "$campusflow_root"/supabase/migrations/*.sql; do
    "${campusflow_psql[@]}" -f "$campusflow_migration"
  done
done
for campusflow_test in "$campusflow_root"/supabase/tests/*.sql; do
  "${campusflow_psql[@]}" -f "$campusflow_test"
done
