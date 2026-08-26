-- Run this in Supabase → SQL Editor
-- Then enable Email auth in Authentication → Providers

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  taken_on date not null default current_date,
  platform text not null default 'other',
  exam text not null check (exam in ('cgl', 'chsl')),
  test_type text not null check (test_type in ('full', 'sectional', 'daily')),
  name text not null default '',
  score numeric not null default 0,
  total_marks numeric not null default 0,
  correct integer not null default 0,
  wrong integer not null default 0,
  unattempted integer not null default 0,
  time_taken_min numeric,
  total_time_min numeric,
  maths numeric,
  reasoning numeric,
  english numeric,
  gk numeric,
  subject text,
  topic text,
  sectional_kind text,
  percentile numeric,
  rank integer,
  notes text,
  score_pct numeric,
  accuracy_pct numeric,
  speed_pct numeric,
  created_at timestamptz not null default now()
);

create index if not exists attempts_user_type_exam_idx
  on public.attempts (user_id, exam, test_type, taken_on desc);

alter table public.attempts enable row level security;

create policy "own_select" on public.attempts
  for select using (auth.uid() = user_id);

create policy "own_insert" on public.attempts
  for insert with check (auth.uid() = user_id);

create policy "own_update" on public.attempts
  for update using (auth.uid() = user_id);

create policy "own_delete" on public.attempts
  for delete using (auth.uid() = user_id);
