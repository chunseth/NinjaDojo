-- 005_curriculum_cohesive.sql
-- Returns the full curriculum as a cohesive nested structure:
-- belt -> levels -> lessons

create or replace view curriculum_cohesive as
select
  b.id as belt_id,
  b.belt_code,
  b.belt_order,
  coalesce(levels.levels, '[]'::jsonb) as levels
from curriculum_belts b
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'level_id', l.id,
      'level_number', l.level_number,
      'title', l.title,
      'lessons', coalesce(lessons.lessons, '[]'::jsonb)
    )
    order by l.level_number
  ) as levels
  from curriculum_levels l
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'lesson_id', ls.id,
        'lesson_number', ls.lesson_number,
        'title', ls.title,
        'points_value', ls.points_value,
        'concept_tag', ls.concept_tag
      )
      order by ls.lesson_number
    ) as lessons
    from curriculum_lessons ls
    where ls.level_id = l.id
  ) lessons on true
  where l.belt_id = b.id
) levels on true
order by b.belt_order;

-- Example usage:
-- select * from curriculum_cohesive;
