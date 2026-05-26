-- Private config storage for internal shared secrets
create schema if not exists _internal;
revoke all on schema _internal from public;
revoke all on schema _internal from anon;
revoke all on schema _internal from authenticated;

create table if not exists _internal.config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table _internal.config enable row level security;
revoke all on _internal.config from public, anon, authenticated;

-- Auto-generate a random IPN internal secret on first migration
insert into _internal.config(key, value)
values ('ipn_internal_secret', encode(gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;

-- Reader available only to service_role (used by edge functions)
create or replace function public.get_internal_config(_key text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select value from _internal.config where key = _key
$$;
revoke all on function public.get_internal_config(text) from public, anon, authenticated;
grant execute on function public.get_internal_config(text) to service_role;

-- Update the auto_trigger_disbursement trigger function to include the internal secret header
create or replace function public.auto_trigger_disbursement()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_url text := 'https://adhoebapzgtjrexhwame.supabase.co/functions/v1/disbursement-auto';
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkaG9lYmFwemd0anJleGh3YW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNjk5NDgsImV4cCI6MjA4NDc0NTk0OH0.g_sFtlgW3DM6KcKqCVf1YjTWR1vzPxfLjIzt1CsNxoo';
  v_secret text;
begin
  if (tg_op = 'INSERT' and new.released_to_treasury = true and new.status = 'approved' and coalesce(new.allocated_amount,0) > 0)
     or (tg_op = 'UPDATE' and new.released_to_treasury = true and new.status = 'approved' and coalesce(new.allocated_amount,0) > 0
         and (old.released_to_treasury is distinct from new.released_to_treasury
              or old.status is distinct from new.status
              or old.allocated_amount is distinct from new.allocated_amount))
  then
    begin
      select value into v_secret from _internal.config where key = 'ipn_internal_secret';
      perform net.http_post(
        url := v_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', v_anon,
          'Authorization', 'Bearer ' || v_anon,
          'x-internal-secret', coalesce(v_secret, '')
        ),
        body := jsonb_build_object('student_id', new.id)
      );
    exception when others then
      null;
    end;
  end if;
  return new;
end;
$function$;