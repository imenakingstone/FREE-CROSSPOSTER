-- Additive metadata for Meta Unified Login connections.
-- Existing social account records and encrypted tokens are preserved.
alter table public.social_accounts
  add column if not exists auth_method text,
  add column if not exists token_type text,
  add column if not exists provider_business_id text,
  add column if not exists provider_metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'social_accounts_auth_method_check'
      and conrelid = 'public.social_accounts'::regclass
  ) then
    alter table public.social_accounts
      add constraint social_accounts_auth_method_check
      check (auth_method is null or auth_method in ('meta_unified_login','instagram_login','facebook_login','tiktok_login'))
      not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'social_accounts_token_type_check'
      and conrelid = 'public.social_accounts'::regclass
  ) then
    alter table public.social_accounts
      add constraint social_accounts_token_type_check
      check (token_type is null or token_type in ('USER','SYSTEM_USER','PAGE','INSTAGRAM_USER','UNKNOWN'))
      not valid;
  end if;
end $$;
