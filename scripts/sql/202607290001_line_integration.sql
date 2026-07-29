create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'line_link_status') then
    create type public.line_link_status as enum ('active', 'blocked');
  end if;
end $$;

create table if not exists public.line_links (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  line_user_id text,
  status public.line_link_status not null default 'active',
  link_token_hash text,
  link_token_expires_at timestamptz,
  link_token_consumed_at timestamptz,
  linked_at timestamptz,
  last_followed_at timestamptz,
  blocked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists line_links_profile_id_key
  on public.line_links(profile_id);

create unique index if not exists line_links_line_user_id_key
  on public.line_links(line_user_id)
  where line_user_id is not null;

create unique index if not exists line_links_token_hash_key
  on public.line_links(link_token_hash)
  where link_token_hash is not null and link_token_consumed_at is null;

create table if not exists public.line_notification_settings (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  meeting boolean not null default true,
  message boolean not null default true,
  board boolean not null default true,
  event boolean not null default true,
  content boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.line_message_logs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  line_user_id text,
  notification_id uuid,
  notification_type text,
  webhook_event_id text,
  direction text not null default 'outbound' check (direction in ('inbound', 'outbound')),
  line_message_id text,
  request_body jsonb,
  response_body jsonb,
  status text not null check (status in ('sent', 'skipped', 'failed', 'received')),
  error_code text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists line_message_logs_notification_profile_key
  on public.line_message_logs(notification_id, profile_id)
  where direction = 'outbound' and status = 'sent' and notification_id is not null and profile_id is not null;

create unique index if not exists line_message_logs_webhook_event_id_key
  on public.line_message_logs(webhook_event_id)
  where webhook_event_id is not null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_line_links_updated_at on public.line_links;
create trigger set_line_links_updated_at
before update on public.line_links
for each row execute function public.set_updated_at();

drop trigger if exists set_line_notification_settings_updated_at on public.line_notification_settings;
create trigger set_line_notification_settings_updated_at
before update on public.line_notification_settings
for each row execute function public.set_updated_at();

alter table public.line_links enable row level security;
alter table public.line_notification_settings enable row level security;
alter table public.line_message_logs enable row level security;

drop policy if exists "Users can read own line link" on public.line_links;
create policy "Users can read own line link"
on public.line_links for select
using (
  profile_id in (
    select id from public.profiles
    where id = auth.uid()
  )
);

drop policy if exists "Users can read own line notification settings" on public.line_notification_settings;
create policy "Users can read own line notification settings"
on public.line_notification_settings for select
using (
  profile_id in (
    select id from public.profiles
    where id = auth.uid()
  )
);

drop policy if exists "Users can update own line notification settings" on public.line_notification_settings;
create policy "Users can update own line notification settings"
on public.line_notification_settings for update
using (
  profile_id in (
    select id from public.profiles
    where id = auth.uid()
  )
)
with check (
  profile_id in (
    select id from public.profiles
    where id = auth.uid()
  )
);
