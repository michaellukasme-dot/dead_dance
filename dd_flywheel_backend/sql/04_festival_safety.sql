-- dd_festalert — Festival Waze crowd-sourced safety: ALERTs, crowd confirm/clear, authority view, reports.
-- Client (dd_festguide.js) is local-first + guarded; this spine persists, powers the Police/First-Aid live
-- view, and produces the post-event Incident + Medical reports. Idempotent — safe to re-run.

create table if not exists public.dd_festalert (
  id          text primary key,
  fest        text not null default '',
  type        text not null,
  lat         double precision, lng double precision,
  status      text not null default 'active',   -- active | police_on_scene | cleared
  escalate    boolean not null default false,   -- fire/medical/fight/weapon/crush/missing → human/911
  by_fan      text,
  created_at  timestamptz not null default now(),
  cleared_at  timestamptz
);
create table if not exists public.dd_festalert_confirm (
  alert_id    text not null references public.dd_festalert(id) on delete cascade,
  fan_id      text not null,
  vote        text not null default 'stillGoing',   -- stillGoing | police | noLonger
  created_at  timestamptz not null default now(),
  unique (alert_id, fan_id)                          -- one fan, one vote per alert
);
alter table public.dd_festalert enable row level security;
alter table public.dd_festalert_confirm enable row level security;

create or replace function public._festalert_status(p_id text)
returns text language sql stable security definer set search_path=public as $$
  select case
    when (select count(*) from dd_festalert_confirm where alert_id=p_id and vote='noLonger') >= 2
     and (select count(*) from dd_festalert_confirm where alert_id=p_id and vote='noLonger')
       >= (select count(*) from dd_festalert_confirm where alert_id=p_id and vote='stillGoing') then 'cleared'
    when (select count(*) from dd_festalert_confirm where alert_id=p_id and vote='police') >= 1 then 'police_on_scene'
    else 'active' end;
$$;

create or replace function public.dd_festalert_raise(p_fest text, p_type text, p_lat double precision, p_lng double precision, p_fan text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_id text; v_esc boolean;
begin
  v_id := 'al-'||floor(extract(epoch from now())*1000)::bigint||'-'||substr(md5(random()::text),1,5);
  v_esc := lower(coalesce(p_type,'')) ~ '^(fire|medical|fight|weapon|crush|missing)';
  insert into dd_festalert(id,fest,type,lat,lng,status,escalate,by_fan)
    values (v_id, coalesce(p_fest,''), lower(btrim(p_type)), p_lat, p_lng, 'active', v_esc, p_fan);
  return jsonb_build_object('id',v_id,'status','active','escalate',v_esc);
end $$;

create or replace function public.dd_festalert_confirm(p_fest text, p_id text, p_vote text, p_fan text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_status text;
begin
  insert into dd_festalert_confirm(alert_id,fan_id,vote)
    values (p_id, coalesce(nullif(p_fan,''),'anon'), coalesce(p_vote,'stillGoing'))
    on conflict (alert_id,fan_id) do nothing;
  v_status := public._festalert_status(p_id);
  update dd_festalert set status=v_status, cleared_at=case when v_status='cleared' and cleared_at is null then now() else cleared_at end
    where id=p_id;
  return jsonb_build_object('id',p_id,'status',v_status);
end $$;

-- Authority live view: active (uncleared) alerts for a festival.
create or replace function public.dd_festalert_active(p_fest text)
returns table(id text, type text, lat double precision, lng double precision, status text, escalate boolean, reports bigint, created_at timestamptz)
language sql security definer set search_path=public as $$
  select a.id, a.type, a.lat, a.lng, a.status, a.escalate,
         1 + (select count(*) from dd_festalert_confirm c where c.alert_id=a.id) as reports, a.created_at
  from dd_festalert a
  where a.fest=coalesce(p_fest,'') and a.status <> 'cleared'
  order by a.created_at desc;
$$;

-- Post-event Incident / Medical report: every alert, typed, timed, response, time-to-clear.
create or replace function public.dd_festalert_report(p_fest text)
returns table(id text, type text, escalate boolean, status text, reports bigint,
              created_at timestamptz, cleared_at timestamptz, minutes_to_clear numeric)
language sql security definer set search_path=public as $$
  select a.id, a.type, a.escalate, a.status,
         1 + (select count(*) from dd_festalert_confirm c where c.alert_id=a.id) as reports,
         a.created_at, a.cleared_at,
         round(extract(epoch from (a.cleared_at - a.created_at))/60.0, 1) as minutes_to_clear
  from dd_festalert a
  where a.fest=coalesce(p_fest,'')
  order by a.created_at asc;
$$;

grant execute on function public.dd_festalert_raise(text,text,double precision,double precision,text) to anon, authenticated;
grant execute on function public.dd_festalert_confirm(text,text,text,text) to anon, authenticated;
grant execute on function public.dd_festalert_active(text) to anon, authenticated;
grant execute on function public.dd_festalert_report(text) to anon, authenticated;
