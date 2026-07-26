-- sf_band_merch.sql — band-logo T-shirt program (LESS/MORE/MOST 12-packs, fulfilled by Jay).
-- Run ONCE. Re-runnable. Captures orders now (server-authoritative pricing); Stripe checkout wires in
-- after the @deaddance account is live. The small per-shirt margin offsets the street-team giveaway.

create table if not exists public.sf_band_merch_order (
  id          uuid primary key default gen_random_uuid(),
  band        text,
  contact     text,
  tier        text,                       -- less | more | most
  dozens      int,
  shirts      int,
  unit_cents  int,                         -- price per shirt (server-set)
  total_cents int,
  logo        text,                        -- link to the band's logo art
  note        text,
  status      text not null default 'new', -- new | proofed | invoiced | paid | printing | shipped
  created_at  timestamptz not null default now()
);
alter table public.sf_band_merch_order enable row level security;   -- reads via admin RPC only (deny-by-default)

-- create an order. Price is decided SERVER-side per tier (client cannot tamper). 12 shirts per dozen.
create or replace function public.sf_band_merch_create(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_tier text; v_unit int; v_doz int; v_shirts int; v_id uuid;
begin
  v_tier := lower(coalesce(p->>'tier',''));
  v_unit := case v_tier when 'less' then 1500 when 'more' then 2000 when 'most' then 2500 else 0 end;
  if v_unit = 0 then return jsonb_build_object('error','bad_tier'); end if;
  v_doz := greatest(1, least(500, coalesce(nullif(p->>'dozens','')::int, 1)));
  v_shirts := v_doz * 12;
  if coalesce(trim(p->>'band'),'') = '' then return jsonb_build_object('error','need_band'); end if;
  insert into public.sf_band_merch_order(band, contact, tier, dozens, shirts, unit_cents, total_cents, logo, note)
    values (nullif(p->>'band',''), nullif(p->>'contact',''), v_tier, v_doz, v_shirts, v_unit, v_unit*v_shirts,
            nullif(p->>'logo',''), nullif(p->>'note',''))
    returning id into v_id;
  return jsonb_build_object('ok', true, 'order', v_id, 'tier', v_tier, 'shirts', v_shirts,
    'unit_cents', v_unit, 'total_cents', v_unit*v_shirts);
end $$;
grant execute on function public.sf_band_merch_create(jsonb) to anon, authenticated;

-- admin/Jay read queue (fail-closed: non-admins get nothing).
create or replace function public.sf_band_merch_queue()
returns setof public.sf_band_merch_order language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.sf_admin a where a.uid = nullif(auth.uid()::text,'')) then return; end if;
  return query select * from public.sf_band_merch_order order by created_at desc;
end $$;
grant execute on function public.sf_band_merch_queue() to anon, authenticated;
