-- Keep only the latest row per student per Chicago day.
with ranked as (
  select
    id,
    row_number() over (
      partition by external_source, normalized_name, (observed_at at time zone 'America/Chicago')::date
      order by observed_at desc, created_at desc
    ) as rn
  from active_sessions
)
delete from active_sessions a
using ranked r
where a.id = r.id
  and r.rn > 1;

-- Optional hard guard: enforce one row per student/day.
-- If you enable this, keep idempotency keys day-scoped (already updated in extension).
create unique index if not exists uq_active_sessions_student_day
on active_sessions (external_source, normalized_name, ((observed_at at time zone 'America/Chicago')::date));
