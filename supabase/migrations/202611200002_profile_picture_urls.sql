alter table public.social_accounts
  add column if not exists profile_picture_url text;

alter table public.inbox_conversations
  add column if not exists participant_profile_picture_url text;

grant select (profile_picture_url)
  on public.social_accounts to authenticated;

grant select (participant_profile_picture_url)
  on public.inbox_conversations to authenticated;
