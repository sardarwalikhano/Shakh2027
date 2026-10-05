-- SHAKH 2027 — Phase 15
-- Notifications + Support + Event Center
-- Live database was applied through direct SQL; this file is the consolidated source migration.

insert into public.permissions(code,name_ckb,name_ar,name_en,description)
values
 ('notifications.read','خوێندنەوەی ئاگادارکردنەوە','قراءة الإشعارات','Read Notifications','View personal and operational notifications'),
 ('notifications.manage','بەڕێوەبردنی ئاگادارکردنەوە','إدارة الإشعارات','Manage Notifications','Manage notification operations'),
 ('events.read','خوێندنەوەی event','قراءة الأحداث','Read Events','View platform event center'),
 ('events.manage','بەڕێوەبردنی event','إدارة الأحداث','Manage Events','Manage platform events'),
 ('support.read','بینینی پشتیوانی','قراءة الدعم','Read Support','View support queues and tickets'),
 ('support.manage','بەڕێوەبردنی پشتیوانی','إدارة الدعم','Manage Support','Manage support tickets and messages')
on conflict(code) do update set
 name_ckb=excluded.name_ckb,name_ar=excluded.name_ar,name_en=excluded.name_en,description=excluded.description;

insert into public.role_permissions(role_code,permission_code)
select r,p from (values
 ('customer','notifications.read'),('captain','notifications.read'),
 ('restaurant_vendor','notifications.read'),('supermarket_vendor','notifications.read'),
 ('fashion_vendor','notifications.read'),('car_dealer','notifications.read'),
 ('umrah_agency','notifications.read'),('beauty_vendor','notifications.read'),
 ('support','notifications.read'),('support','events.read'),('support','support.read'),('support','support.manage'),
 ('captain_manager','notifications.read'),('captain_manager','events.read'),('captain_manager','support.read'),('captain_manager','support.manage'),
 ('admin','notifications.read'),('admin','notifications.manage'),('admin','events.read'),('admin','events.manage'),('admin','support.read'),('admin','support.manage'),
 ('super_admin','notifications.read'),('super_admin','notifications.manage'),('super_admin','events.read'),('super_admin','events.manage'),('super_admin','support.read'),('super_admin','support.manage')
) x(r,p) on conflict do nothing;

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  order_updates boolean not null default true,
  payment_updates boolean not null default true,
  delivery_updates boolean not null default true,
  support_updates boolean not null default true,
  security_alerts boolean not null default true,
  marketing_updates boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  entity_type text,
  entity_id uuid,
  actor_user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  severity text not null default 'info' check (severity in ('info','success','warning','error')),
  title_ckb text not null,
  body_ckb text,
  title_ar text,
  body_ar text,
  title_en text,
  body_en text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_platform_events_created_at on public.platform_events(created_at desc);
create index if not exists idx_platform_events_target_user on public.platform_events(target_user_id,created_at desc);
create index if not exists idx_platform_events_entity on public.platform_events(entity_type,entity_id,created_at desc);
create index if not exists idx_platform_events_actor on public.platform_events(actor_user_id,created_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid references public.platform_events(id) on delete set null,
  notification_type text not null,
  category text not null check (category in ('order','payment','delivery','support','security','marketing','system')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  title_ckb text not null,
  body_ckb text,
  title_ar text,
  body_ar text,
  title_en text,
  body_en text,
  action_hash text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_notifications_recipient_event_type on public.notifications(recipient_user_id,event_id,notification_type) where event_id is not null;
create index if not exists idx_notifications_recipient_read on public.notifications(recipient_user_id,read_at,created_at desc);
create index if not exists idx_notifications_created on public.notifications(created_at desc);
create index if not exists idx_notifications_event_id on public.notifications(event_id);

create sequence if not exists private.support_ticket_number_seq start 100001;
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique,
  requester_user_id uuid not null references auth.users(id) on delete restrict,
  assignee_user_id uuid references auth.users(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  category text not null check (category in ('order','payment','delivery','account','vendor','technical','other')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'open' check (status in ('open','pending_customer','pending_support','resolved','closed')),
  subject text not null,
  last_message_at timestamptz not null default now(),
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_support_tickets_requester_status on public.support_tickets(requester_user_id,status,last_message_at desc);
create index if not exists idx_support_tickets_assignee_status on public.support_tickets(assignee_user_id,status,last_message_at desc);
create index if not exists idx_support_tickets_status_priority on public.support_tickets(status,priority,last_message_at desc);
create index if not exists idx_support_tickets_order_id on public.support_tickets(order_id);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete restrict,
  body text not null check (length(trim(body)) between 1 and 10000),
  internal_note boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_support_messages_ticket_created on public.support_messages(ticket_id,created_at asc);
create index if not exists idx_support_messages_sender on public.support_messages(sender_user_id,created_at desc);

alter table public.notification_preferences enable row level security;
alter table public.platform_events enable row level security;
alter table public.notifications enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

create policy "own notification preferences" on public.notification_preferences for select to authenticated using (user_id=(select auth.uid()));
create policy "own notification preferences update" on public.notification_preferences for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy "event center access" on public.platform_events for select to authenticated using (target_user_id=(select auth.uid()) or (select private.has_permission('events.read')));
create policy "own notifications" on public.notifications for select to authenticated using (recipient_user_id=(select auth.uid()));
create policy "mark own notifications" on public.notifications for update to authenticated using (recipient_user_id=(select auth.uid())) with check (recipient_user_id=(select auth.uid()));
create policy "support tickets visible" on public.support_tickets for select to authenticated using (requester_user_id=(select auth.uid()) or assignee_user_id=(select auth.uid()) or private.has_permission('support.read'));
create policy "support messages visible" on public.support_messages for select to authenticated using (exists (select 1 from public.support_tickets st where st.id=ticket_id and (st.requester_user_id=(select auth.uid()) or st.assignee_user_id=(select auth.uid()) or private.has_permission('support.read'))) and (internal_note=false or private.has_permission('support.read')));

revoke all on public.notification_preferences from anon,authenticated; grant select,update on public.notification_preferences to authenticated;
revoke all on public.platform_events from anon,authenticated; grant select on public.platform_events to authenticated;
revoke all on public.notifications from anon,authenticated; grant select,update(read_at) on public.notifications to authenticated;
revoke all on public.support_tickets from anon,authenticated; grant select on public.support_tickets to authenticated;
revoke all on public.support_messages from anon,authenticated; grant select on public.support_messages to authenticated;

create or replace function private.set_notification_pref_updated_at() returns trigger language plpgsql set search_path=pg_catalog,public,private as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists notification_preferences_updated_at on public.notification_preferences;
create trigger notification_preferences_updated_at before update on public.notification_preferences for each row execute function private.set_notification_pref_updated_at();

create or replace function private.ensure_notification_preferences() returns trigger language plpgsql set search_path=pg_catalog,public,private as $$ begin insert into public.notification_preferences(user_id) values(new.id) on conflict(user_id) do nothing; return new; end; $$;
drop trigger if exists profile_notification_preferences_bootstrap on public.profiles;
create trigger profile_notification_preferences_bootstrap after insert on public.profiles for each row execute function private.ensure_notification_preferences();
insert into public.notification_preferences(user_id) select id from public.profiles on conflict(user_id) do nothing;

create or replace function private.emit_platform_event(
 p_event_type text,p_entity_type text,p_entity_id uuid,p_actor_user_id uuid,p_target_user_id uuid,p_severity text,
 p_title_ckb text,p_body_ckb text,p_title_ar text,p_body_ar text,p_title_en text,p_body_en text,p_metadata jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_event_id uuid; begin
 insert into public.platform_events(event_type,entity_type,entity_id,actor_user_id,target_user_id,severity,title_ckb,body_ckb,title_ar,body_ar,title_en,body_en,metadata)
 values(p_event_type,p_entity_type,p_entity_id,p_actor_user_id,p_target_user_id,p_severity,p_title_ckb,p_body_ckb,p_title_ar,p_body_ar,p_title_en,p_body_en,p_metadata)
 returning id into v_event_id; return v_event_id; end; $$;
revoke all on function private.emit_platform_event(text,text,uuid,uuid,uuid,text,text,text,text,text,text,text,jsonb) from public,anon,authenticated;

create or replace function private.create_notification_for_user(
 p_recipient_user_id uuid,p_event_id uuid,p_notification_type text,p_category text,p_priority text,
 p_title_ckb text,p_body_ckb text,p_title_ar text,p_body_ar text,p_title_en text,p_body_en text,p_action_hash text default null
) returns void language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_enabled boolean:=true; begin
 if p_recipient_user_id is null then return; end if;
 if p_category='order' then select order_updates into v_enabled from public.notification_preferences where user_id=p_recipient_user_id;
 elsif p_category='payment' then select payment_updates into v_enabled from public.notification_preferences where user_id=p_recipient_user_id;
 elsif p_category='delivery' then select delivery_updates into v_enabled from public.notification_preferences where user_id=p_recipient_user_id;
 elsif p_category='support' then select support_updates into v_enabled from public.notification_preferences where user_id=p_recipient_user_id;
 elsif p_category='security' then select security_alerts into v_enabled from public.notification_preferences where user_id=p_recipient_user_id;
 elsif p_category='marketing' then select marketing_updates into v_enabled from public.notification_preferences where user_id=p_recipient_user_id;
 end if;
 v_enabled:=coalesce(v_enabled,true); if not v_enabled then return; end if;
 insert into public.notifications(recipient_user_id,event_id,notification_type,category,priority,title_ckb,body_ckb,title_ar,body_ar,title_en,body_en,action_hash)
 values(p_recipient_user_id,p_event_id,p_notification_type,p_category,p_priority,p_title_ckb,p_body_ckb,p_title_ar,p_body_ar,p_title_en,p_body_en,p_action_hash)
 on conflict(recipient_user_id,event_id,notification_type) do nothing;
end; $$;
revoke all on function private.create_notification_for_user(uuid,uuid,text,text,text,text,text,text,text,text,text,text) from public,anon,authenticated;

create or replace function private.next_support_ticket_number() returns text language sql volatile set search_path=pg_catalog,public,private as $$ select 'SK-SUP-'||to_char(now(),'YYYYMMDD')||'-'||lpad(nextval('private.support_ticket_number_seq')::text,6,'0') $$;

create or replace function private.mark_notification_read(p_notification_id uuid) returns void language plpgsql security invoker set search_path=pg_catalog,public,private as $$ begin update public.notifications set read_at=coalesce(read_at,now()) where id=p_notification_id and recipient_user_id=(select auth.uid()); end; $$;
create or replace function public.mark_notification_read(p_notification_id uuid) returns void language plpgsql security invoker set search_path=pg_catalog,public,private as $$ begin perform private.mark_notification_read(p_notification_id); end; $$;
revoke all on function public.mark_notification_read(uuid) from public,anon; grant execute on function public.mark_notification_read(uuid) to authenticated;

create or replace function public.mark_all_notifications_read() returns integer language plpgsql security invoker set search_path=pg_catalog,public,private as $$ declare v_count integer; begin update public.notifications set read_at=coalesce(read_at,now()) where recipient_user_id=(select auth.uid()) and read_at is null; get diagnostics v_count=row_count; return v_count; end; $$;
revoke all on function public.mark_all_notifications_read() from public,anon; grant execute on function public.mark_all_notifications_read() to authenticated;

-- The live deployment contains order/payment/delivery trigger functions described in docs/PHASE_15_NOTIFICATIONS_SUPPORT.md.
-- Keep this source migration in sync with live functions when the project is promoted to file-based migration management.

do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then alter publication supabase_realtime add table public.notifications; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='platform_events') then alter publication supabase_realtime add table public.platform_events; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='support_tickets') then alter publication supabase_realtime add table public.support_tickets; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='support_messages') then alter publication supabase_realtime add table public.support_messages; end if;
 end if;
end $$;
