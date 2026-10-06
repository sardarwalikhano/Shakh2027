-- SHAKH 2027: WhatsApp Cloud API authentication challenges
-- This migration stores only hashed one-time secrets and is callable only by service_role.
-- The browser talks to the Edge Function, never directly to these RPCs.

create schema if not exists private;

create table if not exists private.whatsapp_auth_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  purpose text not null check (purpose in ('phone_enrollment','password_recovery')),
  phone_e164 text not null check (phone_e164 ~ '^\\+9647[0-9]{9}$'),
  otp_hash text not null,
  otp_expires_at timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 10),
  verified_at timestamptz,
  reset_token_hash text,
  reset_token_expires_at timestamptz,
  used_at timestamptz,
  last_sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_whatsapp_auth_challenges_phone_purpose
  on private.whatsapp_auth_challenges(phone_e164, purpose, created_at desc);

create index if not exists idx_whatsapp_auth_challenges_user
  on private.whatsapp_auth_challenges(user_id, purpose, created_at desc);

create index if not exists idx_whatsapp_auth_challenges_active
  on private.whatsapp_auth_challenges(phone_e164, purpose, used_at, expires_at);

create or replace function public.create_whatsapp_challenge(
  p_purpose text,
  p_user_id uuid,
  p_phone_e164 text,
  p_otp_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_user_id uuid;
  v_id uuid;
  v_existing_created_at timestamptz;
begin
  if p_purpose not in ('phone_enrollment','password_recovery')
     or p_phone_e164 !~ '^\\+9647[0-9]{9}$'
     or length(trim(coalesce(p_otp_hash,''))) <> 64 then
    raise exception 'invalid_whatsapp_challenge_input' using errcode='P0001';
  end if;

  if exists (
    select 1
    from private.whatsapp_auth_challenges c
    where c.phone_e164 = p_phone_e164
      and c.purpose = p_purpose
      and c.used_at is null
      and c.created_at > now() - interval '60 seconds'
  ) then
    raise exception 'whatsapp_otp_rate_limited' using errcode='P0001';
  end if;

  if p_purpose = 'password_recovery' then
    select u.id
      into v_user_id
    from auth.users u
    where u.phone = p_phone_e164
      and u.phone_confirmed_at is not null
    limit 1;

    if v_user_id is null then
      return jsonb_build_object(
        'accepted', false,
        'challenge_id', gen_random_uuid()
      );
    end if;
  else
    v_user_id := p_user_id;

    if v_user_id is null then
      raise exception 'not_authenticated' using errcode='P0001';
    end if;

    if not exists (
      select 1 from auth.users u where u.id = v_user_id
    ) then
      raise exception 'user_not_found' using errcode='P0001';
    end if;

    if exists (
      select 1
      from auth.users u
      where u.phone = p_phone_e164
        and u.phone_confirmed_at is not null
        and u.id <> v_user_id
    ) then
      raise exception 'phone_already_in_use' using errcode='P0001';
    end if;
  end if;

  update private.whatsapp_auth_challenges
  set used_at = coalesce(used_at, now())
  where phone_e164 = p_phone_e164
    and purpose = p_purpose
    and used_at is null;

  insert into private.whatsapp_auth_challenges(
    user_id,
    purpose,
    phone_e164,
    otp_hash,
    otp_expires_at,
    attempts,
    max_attempts,
    last_sent_at
  )
  values(
    v_user_id,
    p_purpose,
    p_phone_e164,
    p_otp_hash,
    now() + interval '10 minutes',
    0,
    5,
    now()
  )
  returning id into v_id;

  return jsonb_build_object(
    'accepted', true,
    'challenge_id', v_id,
    'user_id', v_user_id,
    'purpose', p_purpose
  );
end;
$function$;

create or replace function public.verify_whatsapp_challenge(
  p_challenge_id uuid,
  p_otp_hash text,
  p_reset_token_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v private.whatsapp_auth_challenges%rowtype;
begin
  if p_challenge_id is null
     or length(trim(coalesce(p_otp_hash,''))) <> 64 then
    return jsonb_build_object('ok', false, 'error', 'invalid_otp');
  end if;

  select *
    into v
  from private.whatsapp_auth_challenges
  where id = p_challenge_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_otp');
  end if;

  if v.used_at is not null
     or v.otp_expires_at <= now()
     or v.attempts >= v.max_attempts
     or v.verified_at is not null then
    return jsonb_build_object('ok', false, 'error', 'invalid_otp');
  end if;

  if v.otp_hash <> p_otp_hash then
    update private.whatsapp_auth_challenges
    set attempts = attempts + 1
    where id = v.id;

    return jsonb_build_object('ok', false, 'error', 'invalid_otp');
  end if;

  if v.purpose = 'password_recovery' then
    if length(trim(coalesce(p_reset_token_hash,''))) <> 64 then
      return jsonb_build_object('ok', false, 'error', 'invalid_reset_token');
    end if;

    update private.whatsapp_auth_challenges
    set
      verified_at = now(),
      reset_token_hash = p_reset_token_hash,
      reset_token_expires_at = now() + interval '10 minutes'
    where id = v.id;
  else
    update private.whatsapp_auth_challenges
    set verified_at = now()
    where id = v.id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'user_id', v.user_id,
    'purpose', v.purpose,
    'phone_e164', v.phone_e164
  );
end;
$function$;

create or replace function public.finalize_whatsapp_password_recovery(
  p_challenge_id uuid,
  p_reset_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v private.whatsapp_auth_challenges%rowtype;
begin
  if p_challenge_id is null
     or length(trim(coalesce(p_reset_token_hash,''))) <> 64 then
    return jsonb_build_object('ok', false, 'error', 'invalid_reset_token');
  end if;

  select *
    into v
  from private.whatsapp_auth_challenges
  where id = p_challenge_id
  for update;

  if not found
     or v.purpose <> 'password_recovery'
     or v.user_id is null
     or v.verified_at is null
     or v.used_at is not null
     or v.reset_token_expires_at is null
     or v.reset_token_expires_at <= now()
     or v.reset_token_hash <> p_reset_token_hash then
    return jsonb_build_object('ok', false, 'error', 'invalid_reset_token');
  end if;

  update private.whatsapp_auth_challenges
  set used_at = now()
  where id = v.id;

  return jsonb_build_object(
    'ok', true,
    'user_id', v.user_id,
    'purpose', v.purpose
  );
end;
$function$;

revoke all on function public.create_whatsapp_challenge(text,uuid,text,text) from public, anon, authenticated;
revoke all on function public.verify_whatsapp_challenge(uuid,text,text) from public, anon, authenticated;
revoke all on function public.finalize_whatsapp_password_recovery(uuid,text) from public, anon, authenticated;

grant execute on function public.create_whatsapp_challenge(text,uuid,text,text) to service_role;
grant execute on function public.verify_whatsapp_challenge(uuid,text,text) to service_role;
grant execute on function public.finalize_whatsapp_password_recovery(uuid,text) to service_role;
