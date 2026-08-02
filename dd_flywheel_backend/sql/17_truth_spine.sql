-- ============================================================================
-- 17_truth_spine.sql — the THREE missing write functions the CLAUDE-TO-TRUTH audit
-- found undefined in the repo, now that their client call sites actually FIRE.
--
--   1) dd_setlist_upsert_web   — a band schedules/saves its live setlist for the web
--                                (mf_band.html slSaveSet + ticket.html _persistSongs).
--   2) dd_setlist_fan_pending  — a fan submits a phone to subscribe to live setlist
--                                texts; PENDING until they confirm by SMS (mf_band.html slRegister).
--   3) dd_poi_verify           — an admin flips a festival POI pin to verified/draft;
--                                owner-token gated (festival_maker.html + festival_event_maker.html).
--
-- House style (matches 14_datamodule / 15_citymap / 16_gd_video):
--   • create-or-replace, idempotent, safe to re-run.
--   • RLS ON on every table; NO direct table grants — all access via SECURITY DEFINER RPCs.
--   • set search_path = public; on-conflict upserts; grant execute to anon, authenticated, service_role.
--   • no PII in logs (phone numbers live only in the table row, never RAISE'd).
-- Until this file is run, the clients work local-first (localStorage) and these calls
-- honestly report offline/local-only — they no longer claim a server save that never happened.
-- ============================================================================


-- =============================================================================
-- 1) dd_ts_setlist — a band's web-scheduled setlist (one row per band + show date).
--    The song list drives the ticket's live "texted as played" experience and is the
--    server copy that syncs across the band's devices and feeds the SMS dispatcher.
--    Params come straight from the client:  { p_band, p_token, p_date, p_start, p_end, p_songs }.
--    p_songs is the [{n, at}] array the maker builds.
--
--    WRITE GATE — per-band write token (the ?key=<band token> the band opens the page with).
--    Trust-on-first-use, same pattern as sf_city_save: the first write for a band records its
--    token; every later write must present the same token. This stops a stranger from
--    overwriting a band's setlist while staying self-contained (no external auth table needed).
-- =============================================================================
create table if not exists public.dd_ts_setlist (
  band_slug   text not null,
  show_date   text not null default '',            -- 'YYYY-MM-DD' or '' if the band didn't set one
  band_token  text,                                -- per-band write key (?key=); set on first write, required after
  set_start   text,                                -- 'H:MM' tease/start time (free-text, as the band typed it)
  set_end     text,
  songs       jsonb not null default '[]'::jsonb,  -- [{ "n": "Tweezer", "at": "21:30" }, ...]
  updated_at  timestamptz not null default now(),
  primary key (band_slug, show_date)
);
alter table public.dd_ts_setlist enable row level security;   -- no direct table access; only the RPC below

drop function if exists public.dd_setlist_upsert_web(text, text, text, text, text, jsonb);
create or replace function public.dd_setlist_upsert_web(
  p_band text, p_token text, p_date text, p_start text, p_end text, p_songs jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_band text; v_date text; v_existing text; v_n int;
begin
  v_band := lower(btrim(coalesce(p_band, '')));
  v_date := coalesce(p_date, '');
  if v_band = '' then return jsonb_build_object('ok', false, 'err', 'band required'); end if;

  -- per-band write token (TOFU): if this band already registered a token anywhere, it must match.
  select band_token into v_existing
    from public.dd_ts_setlist
   where band_slug = v_band and band_token is not null
   limit 1;
  if v_existing is not null and (p_token is null or p_token <> v_existing) then
    return jsonb_build_object('ok', false, 'err', 'setlist write token required — this band is already claimed');
  end if;

  insert into public.dd_ts_setlist(band_slug, show_date, band_token, set_start, set_end, songs, updated_at)
    values (v_band, v_date, nullif(btrim(coalesce(p_token,'')),''),
            nullif(btrim(coalesce(p_start,'')),''), nullif(btrim(coalesce(p_end,'')),''),
            coalesce(p_songs, '[]'::jsonb), now())
    on conflict (band_slug, show_date) do update
      set band_token = coalesce(dd_ts_setlist.band_token, excluded.band_token),  -- keep the first token
          set_start = excluded.set_start, set_end = excluded.set_end,
          songs = excluded.songs, updated_at = now();

  v_n := jsonb_array_length(coalesce(p_songs, '[]'::jsonb));
  return jsonb_build_object('ok', true, 'band', v_band, 'date', v_date, 'songs', v_n);
end $$;


-- =============================================================================
-- 2) dd_ts_setlist_fan — a fan's PENDING subscription to a band's live setlist texts.
--    Params from the client:  { p_band, p_phone (E.164), p_source }.
--    status='pending' until the fan confirms by SMS (the inbound webhook flips it to
--    'confirmed'); we NEVER text a pending number. Idempotent per (band, phone): re-submitting
--    the same number is a no-op, not a duplicate. Phone is PII — stored, never logged.
-- =============================================================================
create table if not exists public.dd_ts_setlist_fan (
  band_slug   text not null,
  phone       text not null,                       -- E.164, e.g. +14845551212
  status      text not null default 'pending',     -- pending | confirmed | stopped
  source      text,                                -- 'web' | 'sms' | ...
  created_at  timestamptz not null default now(),
  confirmed_at timestamptz,
  primary key (band_slug, phone)
);
alter table public.dd_ts_setlist_fan enable row level security;   -- no direct table access; only the RPC below
create index if not exists dd_ts_setlist_fan_band on public.dd_ts_setlist_fan(band_slug, status);

drop function if exists public.dd_setlist_fan_pending(text, text, text);
create or replace function public.dd_setlist_fan_pending(p_band text, p_phone text, p_source text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_band text; v_phone text;
begin
  v_band  := lower(btrim(coalesce(p_band, '')));
  v_phone := btrim(coalesce(p_phone, ''));
  if v_band = '' then return jsonb_build_object('ok', false, 'err', 'band required'); end if;
  -- minimal E.164 sanity: leading + and 8–15 digits. (No PII echoed in errors.)
  if v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    return jsonb_build_object('ok', false, 'err', 'valid phone required');
  end if;

  insert into public.dd_ts_setlist_fan(band_slug, phone, status, source)
    values (v_band, v_phone, 'pending', nullif(btrim(coalesce(p_source,'')),''))
    on conflict (band_slug, phone) do update
      set source = coalesce(excluded.source, dd_ts_setlist_fan.source);  -- idempotent; don't downgrade a confirmed fan
  return jsonb_build_object('ok', true, 'band', v_band, 'status', 'pending');
end $$;


-- =============================================================================
-- 3) dd_ts_poi_verify — an admin flips a POI pin's verified/draft status.
--    Params from the client:  { p_slug, p_token, p_item_key, p_status, p_by }.
--    Only VERIFIED pins are shown to fans, so this write is OWNER-TOKEN GATED.
--
--    OWNERSHIP: the festival's owner token is the ?key= the maker is opened with — the SAME token
--    dd_festival_save/publish use. If the live festivals table (public.dd_festival) is present we
--    validate against its owner_token (authoritative). If it isn't in this environment yet, we fall
--    back to trust-on-first-use on this table (first admin to verify records the token; later writes
--    must match) — self-contained and idempotent either way.
-- =============================================================================
create table if not exists public.dd_ts_poi (
  festival_slug text not null,
  item_key      text not null,                     -- the pin id from the maker
  status        text not null default 'draft',     -- draft | verified
  owner_token   text,                              -- TOFU fallback owner token for this festival
  verified_by   text,
  updated_at    timestamptz not null default now(),
  primary key (festival_slug, item_key)
);
alter table public.dd_ts_poi enable row level security;   -- no direct table access; only the RPCs below
create index if not exists dd_ts_poi_slug on public.dd_ts_poi(festival_slug, status);

drop function if exists public.dd_poi_verify(text, text, text, text, text);
create or replace function public.dd_poi_verify(
  p_slug text, p_token text, p_item_key text, p_status text, p_by text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_slug text; v_key text; v_status text; v_owner text;
begin
  v_slug   := lower(btrim(coalesce(p_slug, '')));
  v_key    := btrim(coalesce(p_item_key, ''));
  v_status := lower(btrim(coalesce(p_status, 'draft')));
  if v_slug = '' or v_key = '' then return jsonb_build_object('ok', false, 'err', 'festival slug + item key required'); end if;
  if v_status not in ('draft','verified') then v_status := 'draft'; end if;
  if coalesce(btrim(p_token),'') = '' then return jsonb_build_object('ok', false, 'err', 'owner token required'); end if;

  -- 1) authoritative check against the live festivals table, if it exists here
  begin
    select owner_token into v_owner from public.dd_festival where slug = v_slug;
  exception when undefined_table or undefined_column then
    v_owner := null;   -- festivals table not present in this environment → fall through to TOFU
  end;

  -- 2) TOFU fallback: an owner token already recorded for this festival's pins
  if v_owner is null then
    select owner_token into v_owner
      from public.dd_ts_poi
     where festival_slug = v_slug and owner_token is not null
     limit 1;
  end if;

  if v_owner is not null and p_token <> v_owner then
    return jsonb_build_object('ok', false, 'err', 'owner token mismatch — not authorized to verify this festival');
  end if;

  insert into public.dd_ts_poi(festival_slug, item_key, status, owner_token, verified_by, updated_at)
    values (v_slug, v_key, v_status, p_token, nullif(btrim(coalesce(p_by,'')),''), now())
    on conflict (festival_slug, item_key) do update
      set status = excluded.status,
          owner_token = coalesce(dd_ts_poi.owner_token, excluded.owner_token),  -- keep first token
          verified_by = excluded.verified_by, updated_at = now();

  return jsonb_build_object('ok', true, 'festival', v_slug, 'item', v_key, 'status', v_status);
end $$;

-- Public read of the verified pins for a festival (fans need this to know which pins are live).
drop function if exists public.dd_poi_verified_get(text);
create or replace function public.dd_poi_verified_get(p_slug text)
returns table(item_key text, status text) language sql stable security definer set search_path = public as $$
  select item_key, status from public.dd_ts_poi
   where festival_slug = lower(btrim(p_slug)) and status = 'verified'
   order by updated_at;
$$;


-- ---- grants (anon + authenticated clients call these; service_role for tooling/edge) ----------
grant execute on function public.dd_setlist_upsert_web(text, text, text, text, text, jsonb) to anon, authenticated, service_role;
grant execute on function public.dd_setlist_fan_pending(text, text, text)                    to anon, authenticated, service_role;
grant execute on function public.dd_poi_verify(text, text, text, text, text)                 to anon, authenticated, service_role;
grant execute on function public.dd_poi_verified_get(text)                                   to anon, authenticated, service_role;

-- smoke test (uncomment to run):
-- select public.dd_setlist_upsert_web('rift','tok-abc','2026-07-30','21:00','22:30',
--        '[{"n":"Tweezer","at":"21:30"},{"n":"Bathtub Gin","at":"21:55"}]'::jsonb);   -- ok, songs=2
-- select public.dd_setlist_upsert_web('rift','WRONG','2026-07-30',null,null,'[]'::jsonb);  -- ok=false, token required
-- select public.dd_setlist_fan_pending('rift','+14845551212','web');                  -- ok, status=pending
-- select public.dd_setlist_fan_pending('rift','not-a-phone','web');                   -- ok=false, valid phone required
-- select public.dd_poi_verify('musikfest-2026','own-tok','pin-42','verified','admin'); -- ok (TOFU records token)
-- select public.dd_poi_verify('musikfest-2026','other','pin-42','draft','admin');      -- ok=false, token mismatch
-- select * from public.dd_poi_verified_get('musikfest-2026');
