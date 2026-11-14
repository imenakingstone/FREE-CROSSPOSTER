# FREE CROSSPOSTER

React + Vite frontend connected to the Supabase project.

## Setup
1. Install Node.js 20.19+ or 22.12+.
2. Copy `.env.example` to `.env`.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
4. Run `npm install`, then `npm run dev`.

On Windows PowerShell, use `npm.cmd install` and `npm.cmd run dev` if script execution blocks npm.ps1.

## Included
- Supabase email/password authentication.
- Private media uploads to the `user-media` bucket.
- Post draft creation and recent draft listing.
- Instagram & Shop setup guide linking to official Meta tools.

## Instagram / Shop setup
The Instagram setup page explains the professional-account, Facebook Page, Meta business portfolio, catalog, shopping eligibility and app authorization steps. It does not falsely mark accounts as connected. Actual Instagram publishing requires a Meta developer app, OAuth, approved permissions and server-side publishing endpoints. Instagram Shop availability and approval are controlled by Meta.

## Security
Only the Supabase publishable key belongs in browser environment variables. Never commit `.env`, passwords, Meta tokens, service-role keys or other secrets. Social tokens must be stored server-side and encrypted.
