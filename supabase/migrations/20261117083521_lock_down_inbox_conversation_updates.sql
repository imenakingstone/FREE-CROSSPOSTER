revoke update on table public.inbox_conversations from authenticated;
grant update (unread_count, status, updated_at) on table public.inbox_conversations to authenticated;
