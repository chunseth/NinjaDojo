insert into curriculum_belts (belt_code, belt_order)
values
  ('white', 1),
  ('yellow', 2),
  ('orange', 3),
  ('green', 4),
  ('blue', 5)
on conflict (belt_code) do update
set belt_order = excluded.belt_order;
