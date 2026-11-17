create table if not exists public.user_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_presence enable row level security;
revoke all on table public.user_presence from anon, authenticated;
grant all on table public.user_presence to service_role;

create table if not exists public.inbox_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  social_account_id uuid not null references public.social_accounts(id) on delete cascade,
  platform text not null check (platform in ('instagram','facebook')),
  platform_conversation_id text not null,
  participant_id text not null,
  participant_name text,
  participant_username text,
  last_message_text text,
  last_message_at timestamptz,
  last_inbound_at timestamptz,
  unread_count integer not null default 0 check (unread_count >= 0),
  status text not null default 'open' check (status in ('open','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (social_account_id, platform_conversation_id)
);
create index if not exists inbox_conversations_user_latest_idx
  on public.inbox_conversations(user_id, last_message_at desc nulls last);
create index if not exists inbox_conversations_account_idx
  on public.inbox_conversations(social_account_id, last_message_at desc nulls last);
alter table public.inbox_conversations enable row level security;
create policy inbox_conversations_select_own on public.inbox_conversations
  for select to authenticated using ((select auth.uid()) = user_id);
create policy inbox_conversations_update_own on public.inbox_conversations
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select, update on public.inbox_conversations to authenticated;
grant all on public.inbox_conversations to service_role;

create table if not exists public.inbox_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.inbox_conversations(id) on delete cascade,
  platform_message_id text not null,
  direction text not null check (direction in ('inbound','outbound')),
  sender_id text,
  message_text text,
  attachments jsonb not null default '[]'::jsonb,
  delivery_status text not null default 'received' check (delivery_status in ('received','sent','failed')),
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (conversation_id, platform_message_id)
);
create index if not exists inbox_messages_conversation_time_idx
  on public.inbox_messages(conversation_id, sent_at asc);
alter table public.inbox_messages enable row level security;
create policy inbox_messages_select_own on public.inbox_messages
  for select to authenticated using ((select auth.uid()) = user_id);
grant select on public.inbox_messages to authenticated;
grant all on public.inbox_messages to service_role;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='inbox_conversations') then
    alter publication supabase_realtime add table public.inbox_conversations;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='inbox_messages') then
    alter publication supabase_realtime add table public.inbox_messages;
  end if;
end $$;

create or replace function public.admin_dashboard_snapshot()
returns jsonb
language sql
security definer
set search_path = pg_catalog, public, auth
as $$
  select jsonb_build_object(
    'checked_at', now(),
    'registered_users', (select count(*) from auth.users),
    'online_users', (select count(*) from public.user_presence where last_seen_at > now() - interval '2 minutes'),
    'connected_accounts', (select count(*) from public.social_accounts where account_status='connected' and environment='production'),
    'total_posts', (select count(*) from public.posts),
    'failed_destinations', (select count(*) from public.post_destinations where status='failed'),
    'publishing_failures_24h', (select count(*) from public.publishing_logs where status='failed' and created_at > now() - interval '24 hours'),
    'inbox_messages', (select count(*) from public.inbox_messages)
  );
$$;
revoke all on function public.admin_dashboard_snapshot() from public, anon, authenticated;
grant execute on function public.admin_dashboard_snapshot() to service_role;
