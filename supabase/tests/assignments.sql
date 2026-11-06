-- Run only against an isolated local database: psql -v ON_ERROR_STOP=1 -f this-file.
-- Every fixture and mutation is rolled back. No production connection is needed.
begin;

select set_config('test.owner_a', gen_random_uuid()::text, true);
select set_config('test.owner_b', gen_random_uuid()::text, true);
select set_config('test.assignment', gen_random_uuid()::text, true);

insert into auth.users (id, email) values
  (current_setting('test.owner_a')::uuid, 'facul-auto-a@example.invalid'),
  (current_setting('test.owner_b')::uuid, 'facul-auto-b@example.invalid');

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.owner_a'), true);

insert into public.assignments (id, title, canvas_course_id, canvas_assignment_id)
values (current_setting('test.assignment')::uuid, 'Trabalho de teste', '10', '20');

do $$
declare
  actual_owner uuid;
  initial_timestamp timestamptz;
begin
  select user_id, updated_at into actual_owner, initial_timestamp
    from public.assignments where id = current_setting('test.assignment')::uuid;
  if actual_owner is distinct from current_setting('test.owner_a')::uuid then
    raise exception 'FAIL: default ownership or own-row visibility';
  end if;
  update public.assignments set title = 'Trabalho revisado', updated_at = '2000-01-01'
    where id = current_setting('test.assignment')::uuid;
  if not exists (select 1 from public.assignments
      where id = current_setting('test.assignment')::uuid
        and title = 'Trabalho revisado' and updated_at >= initial_timestamp) then
    raise exception 'FAIL: own-row update or timestamp trigger';
  end if;
  begin
    update public.assignments set user_id = current_setting('test.owner_b')::uuid
      where id = current_setting('test.assignment')::uuid;
    raise exception 'FAIL: changing row ownership was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.assignments (title, canvas_course_id, canvas_assignment_id)
      values ('Importação duplicada', '10', '20');
    raise exception 'FAIL: duplicate Canvas import was allowed';
  exception when unique_violation then null;
  end;
  begin
    insert into public.assignments (title, status) values ('Estado inválido', 'invalid');
    raise exception 'FAIL: unknown status was allowed';
  exception when check_violation then null;
  end;
  begin
    insert into public.assignments (title) values ('   ');
    raise exception 'FAIL: whitespace-only title was allowed';
  exception when check_violation then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('test.owner_b'), true);

do $$
declare
  affected integer;
begin
  if exists (select 1 from public.assignments
      where id = current_setting('test.assignment')::uuid) then
    raise exception 'FAIL: another user could read the assignment';
  end if;
  update public.assignments set title = 'Alteração indevida'
    where id = current_setting('test.assignment')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: another user could update the assignment'; end if;
  delete from public.assignments where id = current_setting('test.assignment')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: another user could delete the assignment'; end if;
  begin
    insert into public.assignments (title, user_id)
      values ('Titular forjado', current_setting('test.owner_a')::uuid);
    raise exception 'FAIL: forged insert ownership was allowed';
  exception when insufficient_privilege then null;
  end;
  -- A different owner may import the same Canvas assignment independently.
  insert into public.assignments (title, canvas_course_id, canvas_assignment_id)
    values ('Outra pessoa', '10', '20');
end;
$$;

set local role anon;

do $$
begin
  begin
    perform id from public.assignments;
    raise exception 'FAIL: anonymous table access was allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.owner_a'), true);

do $$
declare
  affected integer;
begin
  delete from public.assignments where id = current_setting('test.assignment')::uuid;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'FAIL: owner could not delete their assignment'; end if;
end;
$$;

reset role;
rollback;
\echo 'PASS: owner CRUD, isolation, ownership changes, anonymous denial, Canvas deduplication, constraints and timestamp trigger.'
