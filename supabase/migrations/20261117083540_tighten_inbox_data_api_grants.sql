revoke all privileges on table public.inbox_conversations from anon, authenticated;
grant select on table public.inbox_conversations to authenticated;
grant update (unread_count, status, updated_at) on table public.inbox_conversations to authenticated;
revoke all privileges on table public.inbox_messages from anon, authenticated;
grant select on table public.inbox_messages to authenticated;
