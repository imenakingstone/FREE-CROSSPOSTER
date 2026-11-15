# FREE CROSSPOSTER

A React + Vite social publishing workspace backed by Supabase.

## Current workspace

- Email/password sign-in and sign-up through Supabase Auth.
- Private media uploads to the `user-media` Storage bucket (50 MB per file).
- Post composer, draft editing and deletion.
- Multiple Instagram professional accounts through Meta Unified Login.
- Instagram image and Reel publishing endpoint.
- Per-account destinations for cross-post workflows.
- Calendar scheduling with a Supabase Cron worker that checks due Instagram posts every minute.
- Publishing history generated from destination status changes.
- In-app publishing notifications and user notification preferences.
- Profile, timezone and password-reset settings.
- Row-level security on user-owned content and server-only encrypted social tokens.

## Run locally

1. Install Node.js 20.19+ or 22.12+.
2. Copy `.env.example` to `.env`.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
4. Run `npm install`, then `npm run dev`.

On Windows PowerShell, use `npm.cmd install` and `npm.cmd run dev` if script execution blocks npm.ps1.

## Social platform readiness

### Instagram
Uses Meta Unified Login and Graph API publishing. A professional Business or Creator account must be selected and authorized. The OAuth account-discovery request and first real post still need a live user authorization test. The Meta app must have the necessary access and review approvals for non-test users.

### Facebook Pages
The UI intentionally keeps Facebook publishing disabled until the Meta app has the Page permissions and Page access token flow required by Meta, including `pages_manage_posts`, `pages_read_engagement` and `pages_show_list`. Page publishing uses the Page feed endpoint and a Page access token. See [Meta Page Feed API](https://developers.facebook.com/docs/graph-api/reference/page/feed/).

### TikTok
The UI intentionally keeps TikTok publishing disabled until a TikTok developer app has Content Posting API access, OAuth scopes and Direct Post audit approval. TikTok unaudited clients are restricted to private viewing. See [TikTok Content Posting API](https://developers.tiktok.com/docs/en/content-posting-api-get-started).

## Scheduler

The Supabase project has a Cron job named `free-crossposter-scheduler` that invokes the `scheduled-publisher` Edge Function every minute. The function authenticates the call with a high-entropy token stored in Supabase Vault and a database-side hash; it claims due jobs safely, retries transient failures up to three attempts and writes final destination status changes.

Only Instagram is currently enabled in the worker. Facebook and TikTok destinations are rejected until their OAuth and publishing integrations are approved and deployed.

## Notifications

Publishing success/failure status changes create publishing log rows and in-app notifications. Email notification preferences are stored, but email delivery is not enabled because no email provider has been configured.

## Security

- Only the Supabase publishable key belongs in browser environment variables.
- Never commit `.env`, passwords, Meta tokens, service-role keys or other secrets.
- Social access tokens are encrypted server-side.
- Authenticated users can read only safe social-account metadata; encrypted token columns are not selectable through the client Data API.
- User-owned tables use row-level security.

## Production release blockers

- Complete Meta app permissions and app review.
- Authorize and test a real Instagram professional account and publish a test post.
- Create/configure a TikTok developer app and pass its Direct Post audit.
- Complete Facebook Page permission review and test a Page post.
- Configure a production hosting provider and add its URL to Supabase Auth redirect allowlists.
- Configure an email provider if email notifications are required.
