
-- Ensure required extensions
create extension if not exists pg_net with schema extensions;

-- Trigger function: when a student is released to treasury (approved + released_to_treasury flips true),
-- asynchronously POST to the disbursement-auto edge function via pg_net.
create or replace function public.auto_trigger_disbursement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text := 'https://adhoebapzgtjrexhwame.supabase.co/functions/v1/disbursement-auto';
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkaG9lYmFwemd0anJleGh3YW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNjk5NDgsImV4cCI6MjA4NDc0NTk0OH0.g_sFtlgW3DM6KcKqCVf1YjTWR1vzPxfLjIzt1CsNxoo';
begin
  -- Fire only when the release flag transitions to true on an approved student with an amount
  if (tg_op = 'INSERT' and new.released_to_treasury = true and new.status = 'approved' and coalesce(new.allocated_amount,0) > 0)
     or (tg_op = 'UPDATE' and new.released_to_treasury = true and new.status = 'approved' and coalesce(new.allocated_amount,0) > 0
         and (old.released_to_treasury is distinct from new.released_to_treasury
              or old.status is distinct from new.status
              or old.allocated_amount is distinct from new.allocated_amount))
  then
    begin
      perform net.http_post(
        url := v_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', v_anon,
          'Authorization', 'Bearer ' || v_anon
        ),
        body := jsonb_build_object('student_id', new.id)
      );
    exception when others then
      -- Never block the release on async dispatch failure
      null;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_auto_trigger_disbursement on public.student_beneficiaries;
create trigger trg_auto_trigger_disbursement
after insert or update on public.student_beneficiaries
for each row
execute function public.auto_trigger_disbursement();
