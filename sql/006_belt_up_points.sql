-- 006_belt_up_points.sql
-- Adds an explicit fixed points value for belt-up completion.

alter table curriculum_belts
add column if not exists belt_up_points int not null default 0 check (belt_up_points >= 0);

update curriculum_belts b
set belt_up_points = case b.belt_code
  when 'white' then 30
  when 'yellow' then 50
  when 'orange' then 70
  when 'green' then 90
  when 'blue' then 100
  else b.belt_up_points
end;
