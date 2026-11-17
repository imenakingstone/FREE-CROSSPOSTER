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
    'inbox_messages', (select count(*) from public.inbox_messages),
    'recent_failures', coalesce((
      select jsonb_agg(jsonb_build_object(
        'platform', recent.platform,
        'message', left(coalesce(recent.message, 'Publishing failed'), 240),
        'created_at', recent.created_at
      ) order by recent.created_at desc)
      from (
        select platform, message, created_at
        from public.publishing_logs
        where status='failed'
        order by created_at desc
        limit 8
      ) recent
    ), '[]'::jsonb)
  );
$$;
revoke all on function public.admin_dashboard_snapshot() from public, anon, authenticated;
grant execute on function public.admin_dashboard_snapshot() to service_role;
