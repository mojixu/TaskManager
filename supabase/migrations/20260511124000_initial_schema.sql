create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'todo_status') then
    create type public.todo_status as enum ('todo', 'doing', 'done');
  end if;

  if not exists (select 1 from pg_type where typname = 'todo_priority') then
    create type public.todo_priority as enum ('low', 'medium', 'high');
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  details text,
  status public.todo_status not null default 'todo',
  priority public.todo_priority not null default 'medium',
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.birthdays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  month integer not null check (month between 1 and 12),
  day integer not null check (day between 1 and 31),
  birth_year integer check (birth_year is null or birth_year >= 1900),
  relationship text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint birthdays_valid_day check (
    day <= case
      when month in (1, 3, 5, 7, 8, 10, 12) then 31
      when month in (4, 6, 9, 11) then 30
      else 29
    end
  )
);

create table if not exists public.mentors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  helped_with text not null check (char_length(trim(helped_with)) > 0),
  report_cycle_days integer check (report_cycle_days is null or report_cycle_days > 0),
  last_reported_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reminder_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  fingerprint text not null,
  details jsonb not null default '{}'::jsonb,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, kind, fingerprint)
);

drop trigger if exists todos_set_updated_at on public.todos;
create trigger todos_set_updated_at
before update on public.todos
for each row execute function public.set_updated_at();

drop trigger if exists birthdays_set_updated_at on public.birthdays;
create trigger birthdays_set_updated_at
before update on public.birthdays
for each row execute function public.set_updated_at();

drop trigger if exists mentors_set_updated_at on public.mentors;
create trigger mentors_set_updated_at
before update on public.mentors
for each row execute function public.set_updated_at();

alter table public.todos enable row level security;
alter table public.birthdays enable row level security;
alter table public.mentors enable row level security;
alter table public.reminder_logs enable row level security;

drop policy if exists "Users can read own todos" on public.todos;
create policy "Users can read own todos"
on public.todos for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own todos" on public.todos;
create policy "Users can insert own todos"
on public.todos for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own todos" on public.todos;
create policy "Users can update own todos"
on public.todos for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own todos" on public.todos;
create policy "Users can delete own todos"
on public.todos for delete
using (auth.uid() = user_id);

drop policy if exists "Users can read own birthdays" on public.birthdays;
create policy "Users can read own birthdays"
on public.birthdays for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own birthdays" on public.birthdays;
create policy "Users can insert own birthdays"
on public.birthdays for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own birthdays" on public.birthdays;
create policy "Users can update own birthdays"
on public.birthdays for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own birthdays" on public.birthdays;
create policy "Users can delete own birthdays"
on public.birthdays for delete
using (auth.uid() = user_id);

drop policy if exists "Users can read own mentors" on public.mentors;
create policy "Users can read own mentors"
on public.mentors for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own mentors" on public.mentors;
create policy "Users can insert own mentors"
on public.mentors for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own mentors" on public.mentors;
create policy "Users can update own mentors"
on public.mentors for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own mentors" on public.mentors;
create policy "Users can delete own mentors"
on public.mentors for delete
using (auth.uid() = user_id);

drop policy if exists "Users can read own reminder logs" on public.reminder_logs;
create policy "Users can read own reminder logs"
on public.reminder_logs for select
using (auth.uid() = user_id);
