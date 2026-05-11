create table if not exists public.profile_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users(id) on delete cascade,
  copy jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mentor_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  mentor_id uuid not null references public.mentors(id) on delete cascade,
  report_date date not null default current_date,
  content text not null check (char_length(trim(content)) > 0),
  feedback text,
  next_steps text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mentor_reports_user_mentor_date_idx
on public.mentor_reports (user_id, mentor_id, report_date desc);

drop trigger if exists profile_settings_set_updated_at on public.profile_settings;
create trigger profile_settings_set_updated_at
before update on public.profile_settings
for each row execute function public.set_updated_at();

drop trigger if exists mentor_reports_set_updated_at on public.mentor_reports;
create trigger mentor_reports_set_updated_at
before update on public.mentor_reports
for each row execute function public.set_updated_at();

alter table public.profile_settings enable row level security;
alter table public.mentor_reports enable row level security;

drop policy if exists "Users can read own profile settings" on public.profile_settings;
create policy "Users can read own profile settings"
on public.profile_settings for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own profile settings" on public.profile_settings;
create policy "Users can insert own profile settings"
on public.profile_settings for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own profile settings" on public.profile_settings;
create policy "Users can update own profile settings"
on public.profile_settings for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can read own mentor reports" on public.mentor_reports;
create policy "Users can read own mentor reports"
on public.mentor_reports for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own mentor reports" on public.mentor_reports;
create policy "Users can insert own mentor reports"
on public.mentor_reports for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.mentors
    where mentors.id = mentor_reports.mentor_id
      and mentors.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own mentor reports" on public.mentor_reports;
create policy "Users can update own mentor reports"
on public.mentor_reports for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.mentors
    where mentors.id = mentor_reports.mentor_id
      and mentors.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own mentor reports" on public.mentor_reports;
create policy "Users can delete own mentor reports"
on public.mentor_reports for delete
using (auth.uid() = user_id);
