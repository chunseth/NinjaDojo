-- Preserve same-day active history while still deduping repeated writes per status.
drop index if exists uq_active_sessions_student_day;

create unique index if not exists uq_active_sessions_student_day_status
on active_sessions (external_source, normalized_name, ((observed_at at time zone 'America/Chicago')::date), source_status);
