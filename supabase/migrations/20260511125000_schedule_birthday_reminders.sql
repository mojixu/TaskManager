create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
declare
  existing_job integer;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'send-birthday-reminders'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
end $$;

select cron.schedule(
  'send-birthday-reminders',
  '0 12 * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-birthday-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret', true)
    ),
    body := jsonb_build_object('source', 'pg_cron')
  );
  $$
);
