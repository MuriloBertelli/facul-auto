#!/usr/bin/env bash
set -euo pipefail

# Validate the SQL and RLS in PostgreSQL without a Supabase account or any secret.
# This is a disposable database with no published ports and no container network.
# auth.uid() is emulated; full Supabase Auth/PostgREST integration remains separate.
test_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd -- "$test_dir/../.." && pwd)"
container_name="facul-auto-schema-test-$$"
postgres_image="postgres@sha256:266d3c257594e195b309ae9d1805e54c788f1d7b375f56bf6c367aac6c917e7b"

cleanup() {
  docker rm -f "$container_name" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker run --rm --detach --name "$container_name" --network none \
  --tmpfs /var/lib/postgresql/data \
  --env POSTGRES_HOST_AUTH_METHOD=trust --env POSTGRES_DB=facul_auto_test \
  "$postgres_image" >/dev/null

ready=false
for attempt in {1..30}; do
  # The image briefly starts a bootstrap server before exec'ing PostgreSQL as
  # PID 1. Waiting for both conditions avoids mistaking that server for readiness.
  if docker exec "$container_name" sh -c 'test "$(head -n 1 "$PGDATA/postmaster.pid" 2>/dev/null)" = 1' \
      >/dev/null 2>&1 \
      && docker exec "$container_name" psql -U postgres -d facul_auto_test -Atc 'select 1' \
      >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
if [[ "$ready" != true ]]; then
  echo "Disposable PostgreSQL did not become ready." >&2
  docker logs "$container_name" >&2
  exit 1
fi

docker exec -i "$container_name" psql -U postgres -d facul_auto_test -v ON_ERROR_STOP=1 <<'SQL'
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable set search_path = ''
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
SQL

# Reapply as well, proving this migration's supported repeatability.
for pass in 1 2; do
  for migration in "$repo_dir"/supabase/migrations/*.sql; do
    docker exec -i "$container_name" psql -U postgres -d facul_auto_test -v ON_ERROR_STOP=1 < "$migration"
  done
done
for sql_test in "$test_dir"/*.sql; do
  docker exec -i "$container_name" psql -U postgres -d facul_auto_test -v ON_ERROR_STOP=1 < "$sql_test"
done
