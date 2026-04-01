-- 008_set_fixed_belt_up_points.sql
-- Ensures fixed belt-up points are set to the agreed values.

update curriculum_belts b
set belt_up_points = case b.belt_code
  when 'white' then 30
  when 'yellow' then 50
  when 'orange' then 70
  when 'green' then 90
  when 'blue' then 100
  else b.belt_up_points
end;
