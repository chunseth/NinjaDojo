-- Cleanup: remove previously introduced table if it exists.
drop table if exists "Active Students";

-- Allow extension anon key to sync `/my-ninjas` into students table.
drop policy if exists "anon read students" on students;
create policy "anon read students"
on students
for select
to anon
using (true);

drop policy if exists "anon insert students" on students;
create policy "anon insert students"
on students
for insert
to anon
with check (status in ('active', 'inactive', 'completed'));

drop policy if exists "anon update students" on students;
create policy "anon update students"
on students
for update
to anon
using (true)
with check (status in ('active', 'inactive', 'completed'));
