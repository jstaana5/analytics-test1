-- CUNY Analytics: database setup
-- Paste this whole file into Supabase → SQL Editor → New query, then click "Run".
-- It is safe to run more than once: it deletes the tables and rebuilds them with fresh fake data.

drop table if exists listings;
drop table if exists students;

-- 1. TABLES --------------------------------------------------------------

create table students (
  id         bigint generated always as identity primary key,
  name       text not null,
  campus     text not null check (campus in ('Hunter', 'Baruch', 'Brooklyn', 'Queens', 'CSI')),
  created_at timestamptz not null default now()
);

create table listings (
  id         bigint generated always as identity primary key,
  title      text not null,
  category   text not null check (category in ('Textbooks', 'Electronics', 'Furniture', 'Clothing', 'Other')),
  campus     text not null check (campus in ('Hunter', 'Baruch', 'Brooklyn', 'Queens', 'CSI')),
  created_at timestamptz not null default now()
);

-- 2. SECURITY (Row Level Security) ----------------------------------------
-- RLS blocks all access unless a policy allows it.
-- These policies let anyone with your public (anon) key READ the data, but not change it.

alter table students enable row level security;
alter table listings enable row level security;

create policy "Anyone can read students" on students for select using (true);
create policy "Anyone can read listings" on listings for select using (true);

-- 3. FAKE DATA -------------------------------------------------------------
-- generate_series(1, N) makes N rows. random() picks a random campus/category/date for each one.

-- 2,000 students. Campuses are weighted so the chart isn't flat.
insert into students (name, campus, created_at)
select
  'Student ' || n,
  case
    when r < 0.28 then 'Hunter'
    when r < 0.50 then 'Baruch'
    when r < 0.70 then 'Brooklyn'
    when r < 0.88 then 'Queens'
    else 'CSI'
  end,
  now() - random() * interval '365 days'
from (select n, random() as r from generate_series(1, 2000) as n) as s;

-- 400 listings spread over the last 30 days (so the 14-day line chart has data).
insert into listings (title, category, campus, created_at)
select
  'Listing ' || n,
  (array['Textbooks', 'Textbooks', 'Textbooks', 'Electronics', 'Electronics',
         'Furniture', 'Clothing', 'Clothing', 'Other'])[1 + floor(random() * 9)::int],
  (array['Hunter', 'Hunter', 'Baruch', 'Baruch', 'Baruch',
         'Brooklyn', 'Brooklyn', 'Queens', 'CSI'])[1 + floor(random() * 9)::int],
  now() - random() * interval '30 days'
from generate_series(1, 400) as n;

-- Quick check: you should see 2000 and 400.
select
  (select count(*) from students) as students,
  (select count(*) from listings) as listings;
