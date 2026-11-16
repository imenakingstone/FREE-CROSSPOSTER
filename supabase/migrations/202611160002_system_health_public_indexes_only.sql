create or replace function public.admin_system_health_snapshot()
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'checked_at', now(),
    'tables', coalesce((
      select jsonb_agg(jsonb_build_object('schema', n.nspname, 'name', c.relname, 'rls_enabled', c.relrowsecurity, 'force_rls', c.relforcerowsecurity, 'policy_count', (select count(*) from pg_policies p where p.schemaname=n.nspname and p.tablename=c.relname)) order by n.nspname, c.relname)
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where c.relkind='r' and n.nspname in ('public','private')
    ), '[]'::jsonb),
    'extensions_in_public', coalesce((
      select jsonb_agg(extname order by extname) from pg_extension e join pg_namespace n on n.oid=e.extnamespace where n.nspname='public'
    ), '[]'::jsonb),
    'unused_indexes', coalesce((
      select jsonb_agg(jsonb_build_object('schema', schemaname, 'table', relname, 'index', indexrelname, 'scans', idx_scan) order by schemaname, relname, indexrelname)
      from pg_stat_user_indexes where schemaname='public' and idx_scan=0 and indexrelname not like '%_pkey'
    ), '[]'::jsonb),
    'database_size_bytes', pg_database_size(current_database())
  );
$$;
revoke all on function public.admin_system_health_snapshot() from public, anon, authenticated;
grant execute on function public.admin_system_health_snapshot() to service_role;