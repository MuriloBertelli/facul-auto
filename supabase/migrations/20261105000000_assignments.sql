-- Personal assignments are visible and writable only by their authenticated owner.
-- No service-role key is needed by the browser or the application API.
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  course_name text not null default '' check (length(course_name) <= 200),
  due_at timestamptz,
  status text not null default 'draft'
    check (status in ('draft', 'in_progress', 'ready', 'submitted')),
  project_url text not null default '' check (length(project_url) <= 2048),
  notes text not null default '' check (length(notes) <= 10000),
  canvas_course_id text check (canvas_course_id is null or canvas_course_id ~ '^[0-9]{1,30}$'),
  canvas_assignment_id text check (canvas_assignment_id is null or canvas_assignment_id ~ '^[0-9]{1,30}$'),
  canvas_html_url text check (canvas_html_url is null or length(canvas_html_url) <= 2048),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assignments_owner_due_idx
  on public.assignments (user_id, due_at);

create unique index if not exists assignments_owner_canvas_unique_idx
  on public.assignments (user_id, canvas_course_id, canvas_assignment_id)
  where canvas_course_id is not null and canvas_assignment_id is not null;

create or replace function public.set_assignment_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_assignment_updated_at() from public;

drop trigger if exists assignments_updated_at on public.assignments;
create trigger assignments_updated_at
  before update on public.assignments
  for each row execute function public.set_assignment_updated_at();

alter table public.assignments enable row level security;
alter table public.assignments force row level security;

-- Explicit grants avoid depending on a project's default public-schema grants.
revoke all on public.assignments from anon;
revoke all on public.assignments from authenticated;
grant select, insert, update, delete on public.assignments to authenticated;

drop policy if exists assignments_select_own on public.assignments;
create policy assignments_select_own on public.assignments
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists assignments_insert_own on public.assignments;
create policy assignments_insert_own on public.assignments
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists assignments_update_own on public.assignments;
create policy assignments_update_own on public.assignments
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists assignments_delete_own on public.assignments;
create policy assignments_delete_own on public.assignments
  for delete to authenticated
  using ((select auth.uid()) = user_id);
