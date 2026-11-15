# Facebook and TikTok setup

The Edge Functions are deployed to Supabase and their source is stored under `supabase/functions`.

## Facebook Pages

1. In the Meta developer dashboard, add/configure the Facebook Login product for the existing FREE CROSSPOSTER app.
2. Add this exact OAuth redirect URI to the Facebook Login Valid OAuth Redirect URIs list:

   `https://apggccljgfodaxdpxptc.supabase.co/functions/v1/facebook-oauth-callback`

3. Request these permissions: `pages_show_list`, `pages_read_engagement`, and `pages_manage_posts`.
4. For testing in Development mode, add the Facebook profile that manages the Page as an app tester/developer and grant it the relevant Page task (Create content).
5. For users outside app roles, complete Meta App Review / Advanced Access for the required permissions.
6. Connect from FREE CROSSPOSTER → Connected accounts. Each Page returned by Meta is stored as its own selectable destination.

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

## Important test notes

- A successful OAuth callback proves the account was saved, not that publishing works.
- Test one destination at a time with a harmless video/image.
- Facebook publishing supports text, images, and videos on Pages.
- TikTok publishing currently supports video only.
- Calendar auto-publishing is currently Instagram-only.
- Never share platform passwords, client secrets, access tokens, or service-role keys in chat.
