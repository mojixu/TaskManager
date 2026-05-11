alter table public.profile_settings
add column if not exists appearance jsonb not null default '{"style":"paper"}'::jsonb;
