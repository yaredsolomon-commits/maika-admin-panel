# Maika admin panel

The Maika team's admin panel: plain HTML, CSS and JavaScript (no build step), served by Cloudflare Pages like `maika-website`, whose warm-white theme it uses.

For now it covers **push notifications**: announce a new app version to devices on an older build, manage message templates, and see everything that was sent.

## Who can sign in

Admins sign in with their Maika account (email and password, the same Supabase project as the app). Signing in isn't enough: the backend decides who is an admin (`users.is_admin`). After sign-in the panel calls an admin-only route; a 403 signs the account straight back out with "That account doesn't have admin access". Every page and every request is checked again by the backend, so the panel never trusts its own copy of the flag.

To make someone an admin, set the flag on their row in the backend database (there's no API for it, on purpose):

```sql
update users set is_admin = true where email = 'someone@maika-ai.com';
```

The account must exist in the backend first, which happens when they sign in to the app once.

## How it's put together

```
public/                    static site (Cloudflare Pages output)
  index.html               welcome
  login/                   sign in
  dashboard/               notifications: send app update, templates, history
  js/auth.js               Supabase sign-in and the admin check
  js/api.js                calls the backend through /api/backend
  js/notifications/        one module per tab
  _headers                 CSP and other security headers, noindex
functions/                 Cloudflare Pages Functions
  api/config.js            GET /api/config: public Supabase URL and anon key
  api/backend/[[path]].js  /api/backend/* → MAIKA_BACKEND_URL/api/v1/*
  _lib/backend_proxy.js    the proxy itself
tests/                     node --test
```

**Why a proxy:** every backend route needs the `X-API-Key`. The proxy adds it on the server, so it never reaches the browser. It forwards only the admin notification routes (and their methods), and passes the admin's own Supabase token through unchanged, so the backend still decides what the caller may do. Since the panel and the proxy share an origin, the backend needs no CORS change.

supabase-js loads from esm.sh, pinned to the exact version `maika-website` uses.

## Run it locally

```bash
npm install
cp .dev.vars.example .dev.vars   # then fill in the four values
npm run dev                      # http://localhost:8788
```

| Variable | What |
|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | The Supabase project admins sign in with (the app's). Public by design. |
| `MAIKA_BACKEND_URL` | The backend, e.g. the dev Cloud Run service. |
| `MAIKA_BACKEND_API_KEY` | The backend's `API_KEY`. Server-side only. |

Tests (the proxy's allowlist and header handling):

```bash
npm test
```

## Deploy

Create a Cloudflare Pages project (for example `maika-admin-panel`), set the four variables above on it (the API key as an encrypted secret), then:

```bash
npm run deploy
```

Use one Pages project per environment (dev backend vs prod backend), or Pages' preview/production environments with different variables.

## Sending an app-update notification

1. Wait until the new build is **live in the store**.
2. *Send app update*: pick the platform, enter the new build number (the `+N` of the version), choose a template or write the message, and send.
3. Every device of that platform registered on an older build is notified. A build can be announced only once; the backend refuses a repeat with 409.
4. *History* shows what went out: devices targeted, accepted by Firebase, failed, and dead tokens removed. "Interrupted" means the send stopped partway.

iPhones only receive pushes once the APNs key is uploaded to Firebase.
