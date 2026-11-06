-- Disposable local database only. All fixtures are rolled back.
begin;
select set_config('test.sync_owner', gen_random_uuid()::text, true);
select set_config('test.sync_other', gen_random_uuid()::text, true);
insert into auth.users(id, email) values
  (current_setting('test.sync_owner')::uuid, 'sync-owner@example.invalid'),
  (current_setting('test.sync_other')::uuid, 'sync-other@example.invalid');
select set_config('test.sync_payload', '[{"title":"Projeto em grupo","course_name":"Disciplina local","due_at":null,"canvas_course_id":"101","canvas_assignment_id":"202","canvas_html_url":null,"canvas_sync":{"state":"pending","groupAssignment":true}}]', true);

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.sync_owner'), true);
select id from public.sync_canvas_assignments(current_setting('test.sync_payload')::jsonb);
select set_config('test.sync_id', (select id::text from public.assignments where canvas_course_id='101'), true);
update public.assignments set notes='Anotação pessoal preservada', project_url='https://example.test/meu-projeto', status='ready'
  where id=current_setting('test.sync_id')::uuid;
select id from public.sync_canvas_assignments(current_setting('test.sync_payload')::jsonb);

do $$ begin
  if (select count(*) from public.assignments where canvas_course_id='101') <> 1 then
    raise exception 'FAIL: repeated automatic sync duplicated an assignment';
  end if;
  if not exists (select 1 from public.assignments where id=current_setting('test.sync_id')::uuid
      and notes='Anotação pessoal preservada' and project_url='https://example.test/meu-projeto' and status='ready') then
    raise exception 'FAIL: automatic sync overwrote personal work';
  end if;
end $$;

select id from public.sync_canvas_assignments(
  jsonb_set(current_setting('test.sync_payload')::jsonb, '{0,canvas_sync,state}', '"submitted"'));
do $$ begin
  if not exists (select 1 from public.assignments where id=current_setting('test.sync_id')::uuid
      and status='submitted' and canvas_sync->>'state'='submitted'
      and canvas_sync->>'groupAssignment'='true' and notes='Anotação pessoal preservada') then
    raise exception 'FAIL: group completion did not synchronize safely';
  end if;
end $$;
select id from public.sync_canvas_assignments(current_setting('test.sync_payload')::jsonb);
do $$ begin
  if not exists (select 1 from public.assignments where id=current_setting('test.sync_id')::uuid and status='draft') then
    raise exception 'FAIL: a reopened Canvas assignment remained completed';
  end if;
  begin
    perform public.sync_canvas_assignments('{}');
    raise exception 'FAIL: invalid sync payload accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.sync_canvas_assignments('[{"canvas_sync":{"state":"invented"}}]');
    raise exception 'FAIL: invalid Canvas completion accepted';
  exception when invalid_parameter_value then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', current_setting('test.sync_other'), true);
select id from public.sync_canvas_assignments(
  jsonb_set(current_setting('test.sync_payload')::jsonb, '{0,user_id}', to_jsonb(current_setting('test.sync_owner'))));
do $$ begin
  if exists (select 1 from public.assignments where id=current_setting('test.sync_id')::uuid) then
    raise exception 'FAIL: sync exposed another owner';
  end if;
  if not exists (select 1 from public.assignments where canvas_course_id='101' and user_id=auth.uid()) then
    raise exception 'FAIL: owner must come from authentication, not payload';
  end if;
end $$;
set local role anon;
do $$ begin
  begin
    perform public.sync_canvas_assignments('[]');
    raise exception 'FAIL: anonymous sync accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
rollback;
\echo 'PASS: automatic sync deduplication, preserved notes/URL/progress, group completion, reopening, validation and owner/anonymous isolation.'
