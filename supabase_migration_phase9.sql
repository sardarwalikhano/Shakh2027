-- Applied remotely as: auth_profile_role_bootstrap_v1
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  display_name text;
begin
  display_name := nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), '');
  insert into public.profiles (id, full_name, phone, preferred_language, city)
  values (
    new.id,
    display_name,
    nullif(trim(coalesce(new.phone, new.raw_user_meta_data->>'phone', '')), ''),
    case
      when lower(trim(coalesce(new.raw_user_meta_data->>'preferred_language', 'ckb'))) in ('ckb', 'ar', 'en')
        then lower(trim(new.raw_user_meta_data->>'preferred_language'))
      else 'ckb'
    end,
    coalesce(nullif(trim(new.raw_user_meta_data->>'city'), ''), 'هەولێر')
  ) on conflict (id) do nothing;

  insert into public.user_roles (user_id, role_code)
  values (new.id, 'customer')
  on conflict (user_id, role_code) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;
revoke all on function private.handle_new_user() from anon;
revoke all on function private.handle_new_user() from authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create index if not exists idx_user_roles_user_id on public.user_roles(user_id);
create index if not exists idx_profiles_phone on public.profiles(phone);
