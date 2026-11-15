# TikTok and YouTube setup

The Edge Functions are deployed to Supabase and their source is stored under `supabase/functions`.

## TikTok

1. Create/configure a TikTok developer app and add the Content Posting API product.
2. Enable Direct Post and request `user.info.basic` and `video.publish`.
3. Register this exact redirect URI:

   `https://apggccljgfodaxdpxptc.supabase.co/functions/v1/tiktok-oauth-callback`

4. Add the TikTok app credentials as Supabase Edge Function secrets:
   - `TIKTOK_CLIENT_KEY`
   - `TIKTOK_CLIENT_SECRET`

   Do not put these values in the React `.env` file or commit them to GitHub.
5. Authorize the TikTok test account from FREE CROSSPOSTER → Connected accounts.
6. TikTok Direct Post uploads use `SELF_ONLY` privacy during the initial integration test. TikTok requires an audit before an unaudited client can publish publicly.
7. Video publishing is implemented using TikTok's FILE_UPLOAD flow. TikTok photo publishing needs a media URL hosted on a domain verified in the TikTok developer app; that is not enabled yet.

## YouTube

YouTube is shown in the account settings as a planned integration, but OAuth and video publishing are not deployed yet. The next implementation requires a Google Cloud project with YouTube Data API v3 enabled, an OAuth consent screen, and a Web application OAuth client. The callback URL and required Google credentials will be provided after the YouTube Edge Functions are implemented. Do not put Google client secrets in the React `.env` file or commit them to GitHub.

## Important test notes

- A successful OAuth callback proves the account was saved, not that publishing works.
- Test one destination at a time with a harmless video/image.
- Facebook is not offered as an active crossposting destination in the current app interface. Its old backend functions remain deployed but are not used by the current composer.
- TikTok publishing currently supports video only.
- Calendar auto-publishing is currently Instagram-only.
- Never share platform passwords, client secrets, access tokens, or service-role keys in chat.
