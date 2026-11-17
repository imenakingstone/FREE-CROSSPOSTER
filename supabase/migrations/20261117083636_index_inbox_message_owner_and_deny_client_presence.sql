create index if not exists inbox_messages_user_id_idx on public.inbox_messages(user_id);
create policy user_presence_deny_client_access on public.user_presence
  for all to anon, authenticated
  using (false)
  with check (false);
