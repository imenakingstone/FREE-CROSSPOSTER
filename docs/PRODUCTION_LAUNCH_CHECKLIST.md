# FREE CROSSPOSTER — Production Launch Checklist

This checklist is the source of truth for production-readiness work. A task is not complete until its real production flow has been tested.

Last reviewed: 2026-11-19

## P0 — Blockers before public launch

### Authentication and registration
- [ ] Configure a verified sending domain and transactional SMTP provider (Resend is the proposed first option).
- [ ] Configure Supabase Auth custom SMTP; keep email confirmation enabled.
- [ ] Configure email sender name/address and review confirmation, password reset, and email-change templates.
- [ ] Set a realistic Auth email rate limit based on the provider's approved throughput; do not assume SMTP alone supports one million users.
- [ ] Configure CAPTCHA/abuse protection and test duplicate signup, invalid password, unconfirmed email, resend confirmation, password reset, and email change.
- [ ] Set Supabase Site URL to https://free-crossposter-zcpn.vercel.app.
- [ ] Allow exact production redirect https://free-crossposter-zcpn.vercel.app/ and only the local development origins actually used.
- [ ] Verify Google OAuth client redirect URI remains https://apggccljgfodaxdpxptc.supabase.co/auth/v1/callback.
- [ ] Test Google login, email signup, email login, logout, and recovery with brand-new non-team accounts on the production domain.
- [ ] Ensure production frontend uses production redirect; localhost redirects are only for local development.

### Instagram Direct Messages
- [ ] Add META_WEBHOOK_VERIFY_TOKEN to Supabase Edge Function secrets and use the exact same value in Meta webhook verification.
- [ ] Confirm META_APP_SECRET is configured; webhook POST signature validation depends on it.
- [ ] Configure Instagram Webhooks in Meta Developer Dashboard: callback URL https://apggccljgfodaxdpxptc.supabase.co/functions/v1/meta-messaging-webhook, verify token, and subscribe to messages.
- [ ] Complete Meta App Review / Advanced Access for required Instagram messaging permissions.
- [ ] Confirm Instagram account is Professional (Business or Creator) and linked to an eligible Facebook Page / business asset as required by the selected Meta API login flow.
- [ ] Fix Meta OAuth callback: it currently hard-codes scopes in social_accounts instead of verifying actual granted permissions.
- [ ] Fix token model: current inbox sync uses the Instagram account ID with the stored user token; Meta's Page Conversations API requires a Page access token with the correct Page messaging task and permissions. Store the linked Page ID and encrypted Page access token separately, then use them for conversation reads/replies.
- [ ] Rework meta-inbox-sync to use the correct Page Conversations API token/endpoint, pagination where supported, and idempotent message imports.
- [ ] Test import of existing conversations and newest messages for the connected account; document Meta's history limitations (the Conversation endpoint exposes up to the 20 most recent messages).
- [ ] Test a new inbound DM arriving by webhook and a reply being delivered back to Instagram.
- [ ] Verify unread counts, attachments, message ordering, and multi-account isolation.
- [ ] Add sync diagnostics to the Inbox UI; never display a successful sync when Meta rejected the request.

### Public website and Google indexing
- [ ] Confirm production Vercel deployment is public (Deployment Protection must not protect the production domain).
- [ ] Confirm homepage, robots.txt, sitemap.xml, features, how-it-works, FAQ, terms, privacy, and data-deletion pages return public HTTP 200 responses.
- [ ] Confirm robots.txt permits public marketing pages and does not expose or index authenticated app routes.
- [ ] Confirm canonical URLs, metadata, social preview image, favicon, and sitemap URLs.
- [ ] Submit sitemap in Google Search Console and inspect/request indexing for public pages.
- [ ] Review Page Indexing exclusions and fix actual reported causes; indexing requests are not guarantees.

## P1 — Reliability, scale and security
- [ ] Run Supabase Security Advisor and Performance Advisor; resolve critical/high findings and document accepted exceptions.
- [ ] Review every public table's RLS policies and grants, including inbox, posts, accounts, storage and logs.
- [ ] Confirm encrypted tokens never leave Edge Functions and never appear in browser-readable queries/logs.
- [ ] Add structured error reporting for OAuth, publishing, webhooks, inbox sync and scheduled jobs.
- [ ] Add retry/backoff and dead-letter handling for webhook and publishing jobs; make all processing idempotent.
- [ ] Load-test signup, login, dashboard reads, uploads, scheduling and inbox sync at staged traffic levels.
- [ ] Plan Supabase compute, database connection pooling, storage, egress, Realtime, Edge Function and email-provider capacity/cost for projected growth.
- [ ] Add backups/PITR, incident recovery runbook, uptime monitoring and provider outage alerts.
- [ ] Review retention/deletion workflows and privacy disclosures.

## P2 — Platform feature verification
- [ ] Verify Instagram media transformations and publishing against actual Meta API behavior.
- [ ] Verify YouTube OAuth, upload, processing state and privacy settings end-to-end.
- [ ] Verify TikTok approval/audit requirements and publishing visibility behavior.
- [ ] Verify every Create Post setting is either applied by the media pipeline/API or clearly labelled as a saved preference.
- [ ] Test publishing success, partial failure, retry, duplicate prevention and activity history.

## Current known findings
- Supabase built-in Auth SMTP is currently the blocker for general public email registration: it is limited to 2 emails/hour and restricts recipients to project team addresses.
- Auth logs previously showed localhost:3000 requests. Those are local-development tests, not proof that production redirects to localhost. Production and local tests must be separated.
- Supabase database tables for inbox conversations/messages exist, but had zero rows at the last check.
- META_WEBHOOK_VERIFY_TOKEN was reported missing by the System Health scan.
- The current meta-inbox-sync implementation is not yet production-correct: it trusts hard-coded permission names and does not use the Page access token required by Meta's Page Conversations API.
- Do not mark Instagram Inbox complete until a real inbound DM is imported and a real reply is confirmed delivered.
- Do not mark authentication complete until a brand-new non-team user can register, receive confirmation email, confirm, log in, reset password and sign in with Google on the production domain.
