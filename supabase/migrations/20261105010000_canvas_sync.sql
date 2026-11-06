-- Store Canvas state separately from a student's own notes and project URL.
alter table public.assignments
  add column if not exists canvas_sync jsonb not null default '{}'::jsonb
  check (jsonb_typeof(canvas_sync) = 'object');

-- RLS still applies. Only the current user's rows can be inserted/updated.
-- The conflict key makes automatic/repeated/concurrent syncs idempotent.
create or replace function public.sync_canvas_assignments(p_items jsonb)
returns setof public.assignments
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Expected a list of Canvas assignments' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 200 then
    raise exception 'Canvas sync batch too large' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_items) as x
      where jsonb_typeof(x) is distinct from 'object'
        or jsonb_typeof(x->'canvas_sync') is distinct from 'object'
        or coalesce(x->'canvas_sync'->>'state', '') not in ('pending', 'submitted', 'graded', 'excused')
        or coalesce(x->>'canvas_course_id', '') !~ '^[0-9]{1,30}$'
        or coalesce(x->>'canvas_assignment_id', '') !~ '^[0-9]{1,30}$') then
    raise exception 'Invalid Canvas assignment' using errcode = '22023';
  end if;
  return query
  insert into public.assignments as saved
    (user_id, title, course_name, due_at, status,
     canvas_course_id, canvas_assignment_id, canvas_html_url, canvas_sync)
  select auth.uid(), x.title, x.course_name, x.due_at,
    case when x.canvas_sync->>'state' = 'pending' then 'draft' else 'submitted' end,
    x.canvas_course_id, x.canvas_assignment_id, x.canvas_html_url, x.canvas_sync
  from jsonb_to_recordset(p_items) as x(
    title text, course_name text, due_at timestamptz,
    canvas_course_id text, canvas_assignment_id text, canvas_html_url text, canvas_sync jsonb)
  on conflict (user_id, canvas_course_id, canvas_assignment_id)
    where canvas_course_id is not null and canvas_assignment_id is not null
  do update set
    title = excluded.title,
    course_name = excluded.course_name,
    due_at = excluded.due_at,
    status = case when excluded.status = 'submitted' then 'submitted'
      when saved.status = 'submitted' then 'draft' else saved.status end,
    canvas_html_url = excluded.canvas_html_url,
    canvas_sync = excluded.canvas_sync
  returning saved.*;
end;
$$;

revoke all on function public.sync_canvas_assignments(jsonb) from public, anon;
grant execute on function public.sync_canvas_assignments(jsonb) to authenticated;
