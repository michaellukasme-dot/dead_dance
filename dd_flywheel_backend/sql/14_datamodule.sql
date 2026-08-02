-- dd_datamodule — the DATA MODULE ("Whopper") lead-capture spine.
-- Checkout (Stripe) is parked on the EIN, so for now we capture INTENT: which tier a
-- buyer wants, for which festival/city, and how to reach them. Invoice when checkout opens.
-- Idempotent, guarded, security-definer (house pattern).

create table if not exists public.dd_data_lead (
  id         bigserial primary key,
  tier       text not null,               -- less | more | most | city
  festival   text,                        -- or city / district name
  email      text,
  note       text,
  status     text not null default 'new', -- new | invoiced | won | lost
  at         timestamptz not null default now()
);
alter table public.dd_data_lead enable row level security;
create index if not exists dd_data_lead_tier on public.dd_data_lead(tier, status);

-- Capture a MORE / MOST / CITY unlock request (the credit-card intent, pre-Stripe).
create or replace function public.sf_data_lead_capture(p_tier text, p_festival text, p_email text, p_note text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_id bigint;
begin
  if lower(coalesce(btrim(p_tier),'')) not in ('less','more','most','city') then
    return jsonb_build_object('ok', false, 'err', 'unknown tier');
  end if;
  insert into public.dd_data_lead(tier, festival, email, note)
    values (lower(btrim(p_tier)), nullif(btrim(p_festival),''), nullif(btrim(p_email),''), nullif(btrim(p_note),''))
    returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'tier', lower(btrim(p_tier)));
end $$;

grant execute on function public.sf_data_lead_capture(text,text,text,text) to anon, authenticated, service_role;
