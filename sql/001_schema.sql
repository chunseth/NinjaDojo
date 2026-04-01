create extension if not exists pgcrypto;

create table if not exists curriculum_belts (
  id uuid primary key default gen_random_uuid(),
  belt_code text not null unique check (belt_code in ('white', 'yellow', 'orange', 'green', 'blue')),
  belt_order int not null unique,
  created_at timestamptz not null default now()
);

create table if not exists curriculum_levels (
  id uuid primary key default gen_random_uuid(),
  belt_id uuid not null references curriculum_belts(id) on delete cascade,
  level_number int not null,
  title text not null,
  created_at timestamptz not null default now(),
  unique (belt_id, level_number)
);

create table if not exists curriculum_lessons (
  id uuid primary key default gen_random_uuid(),
  level_id uuid not null references curriculum_levels(id) on delete cascade,
  lesson_number int not null,
  title text not null,
  points_value int not null check (points_value > 0),
  concept_tag text,
  created_at timestamptz not null default now(),
  unique (level_id, lesson_number)
);

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  normalized_name text not null,
  status text not null default 'active' check (status in ('active', 'inactive', 'completed')),
  current_lesson_id uuid references curriculum_lessons(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists lesson_completions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  lesson_id uuid not null references curriculum_lessons(id),
  independence_rating int not null check (independence_rating between 1 and 5),
  points_awarded int not null,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists active_sessions (
  id uuid primary key default gen_random_uuid(),
  external_source text not null default 'sensei',
  student_name text not null,
  normalized_name text not null,
  source_status text not null check (source_status in ('active', 'inactive')),
  source_page_id text not null,
  observed_at timestamptz not null,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists attendance_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  attendance_date date not null,
  source text not null default 'sensei',
  created_at timestamptz not null default now(),
  unique (student_id, attendance_date)
);

create table if not exists monthly_reports (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  month_year text not null,
  file_name text not null,
  generated_at timestamptz not null default now(),
  unique (student_id, month_year)
);

create index if not exists idx_students_normalized_name on students(normalized_name);
create index if not exists idx_active_sessions_observed_at on active_sessions(observed_at desc);
create index if not exists idx_active_sessions_normalized_name on active_sessions(normalized_name);
create index if not exists idx_lesson_completions_student_date on lesson_completions(student_id, completed_at desc);

create or replace function touch_students_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_students_updated_at on students;
create trigger trg_students_updated_at
before update on students
for each row
execute function touch_students_updated_at();

create or replace function get_next_lesson_id(current_lesson uuid)
returns uuid
language sql
stable
as $$
with current_loc as (
  select
    b.belt_order,
    l.level_number,
    ls.lesson_number
  from curriculum_lessons ls
  join curriculum_levels l on l.id = ls.level_id
  join curriculum_belts b on b.id = l.belt_id
  where ls.id = current_lesson
), ordered_lessons as (
  select
    ls.id,
    row_number() over (order by b.belt_order, l.level_number, ls.lesson_number) as seq
  from curriculum_lessons ls
  join curriculum_levels l on l.id = ls.level_id
  join curriculum_belts b on b.id = l.belt_id
), current_seq as (
  select ol.seq
  from ordered_lessons ol
  where ol.id = current_lesson
)
select coalesce(
  (select id from ordered_lessons where seq = (select seq + 1 from current_seq)),
  current_lesson
);
$$;

create or replace view student_daily_progress as
with todays as (
  select
    lc.student_id,
    count(*) as lessons_completed_today,
    coalesce(sum(lc.points_awarded), 0) as points_today
  from lesson_completions lc
  where (lc.completed_at at time zone 'America/Chicago')::date = (now() at time zone 'America/Chicago')::date
  group by lc.student_id
), prior as (
  select
    lc.student_id,
    lc.lesson_id,
    max(lc.completed_at) as completed_at
  from lesson_completions lc
  where (lc.completed_at at time zone 'America/Chicago')::date < (now() at time zone 'America/Chicago')::date
  group by lc.student_id, lc.lesson_id
), done_today as (
  select distinct lc.student_id, lc.lesson_id
  from lesson_completions lc
  where (lc.completed_at at time zone 'America/Chicago')::date = (now() at time zone 'America/Chicago')::date
)
select
  s.id as student_id,
  s.full_name,
  s.normalized_name,
  cb.belt_code,
  cl.level_number,
  lesson.lesson_number as current_lesson_number,
  lesson.title as current_lesson_title,
  coalesce(todays.lessons_completed_today, 0) as lessons_completed_today,
  coalesce(todays.points_today, 0) as points_today,
  (
    select count(*)
    from curriculum_lessons level_lessons
    where level_lessons.level_id = cl.id
  ) as level_lesson_total,
  (
    select count(*)
    from curriculum_lessons level_lessons
    join prior on prior.lesson_id = level_lessons.id and prior.student_id = s.id
    where level_lessons.level_id = cl.id
  ) as level_lessons_completed_before_today,
  (
    select count(*)
    from curriculum_lessons level_lessons
    join done_today on done_today.lesson_id = level_lessons.id and done_today.student_id = s.id
    where level_lessons.level_id = cl.id
  ) as level_lessons_completed_today
from students s
left join curriculum_lessons lesson on lesson.id = s.current_lesson_id
left join curriculum_levels cl on cl.id = lesson.level_id
left join curriculum_belts cb on cb.id = cl.belt_id
left join todays on todays.student_id = s.id;

create or replace view student_monthly_points as
select
  lc.student_id,
  to_char(lc.completed_at at time zone 'America/Chicago', 'MMYYYY') as month_year,
  sum(lc.points_awarded)::int as points_total
from lesson_completions lc
group by lc.student_id, to_char(lc.completed_at at time zone 'America/Chicago', 'MMYYYY');

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'active_sessions'
  ) then
    alter publication supabase_realtime add table active_sessions;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'lesson_completions'
  ) then
    alter publication supabase_realtime add table lesson_completions;
  end if;
end $$;

-- RLS for extension inserts and app writes.
alter table curriculum_belts enable row level security;
alter table curriculum_levels enable row level security;
alter table curriculum_lessons enable row level security;
alter table students enable row level security;
alter table lesson_completions enable row level security;
alter table active_sessions enable row level security;
alter table attendance_events enable row level security;
alter table monthly_reports enable row level security;

drop policy if exists "anon read curriculum belts" on curriculum_belts;
create policy "anon read curriculum belts" on curriculum_belts for select to anon using (true);

drop policy if exists "anon read curriculum levels" on curriculum_levels;
create policy "anon read curriculum levels" on curriculum_levels for select to anon using (true);

drop policy if exists "anon read curriculum lessons" on curriculum_lessons;
create policy "anon read curriculum lessons" on curriculum_lessons for select to anon using (true);

drop policy if exists "anon read active sessions" on active_sessions;
create policy "anon read active sessions" on active_sessions for select to anon using (true);

drop policy if exists "anon insert active sessions" on active_sessions;
create policy "anon insert active sessions" on active_sessions for insert to anon with check (external_source = 'sensei');

drop policy if exists "anon update active sessions" on active_sessions;
create policy "anon update active sessions"
on active_sessions
for update
to anon
using (external_source = 'sensei')
with check (external_source = 'sensei');

drop policy if exists "service all students" on students;
create policy "service all students" on students for all to service_role using (true) with check (true);

drop policy if exists "service all lesson completions" on lesson_completions;
create policy "service all lesson completions" on lesson_completions for all to service_role using (true) with check (true);

drop policy if exists "service all attendance" on attendance_events;
create policy "service all attendance" on attendance_events for all to service_role using (true) with check (true);

drop policy if exists "service all reports" on monthly_reports;
create policy "service all reports" on monthly_reports for all to service_role using (true) with check (true);

drop policy if exists "service all curriculum belts" on curriculum_belts;
create policy "service all curriculum belts" on curriculum_belts for all to service_role using (true) with check (true);

drop policy if exists "service all curriculum levels" on curriculum_levels;
create policy "service all curriculum levels" on curriculum_levels for all to service_role using (true) with check (true);

drop policy if exists "service all curriculum lessons" on curriculum_lessons;
create policy "service all curriculum lessons" on curriculum_lessons for all to service_role using (true) with check (true);

drop policy if exists "service all active sessions" on active_sessions;
create policy "service all active sessions" on active_sessions for all to service_role using (true) with check (true);
