# VAULT_09 — Case Opener

A browser-based case/skin opening simulator with Google sign-in, a roulette table, and live chat. All currency is virtual — no real money, no payment processing anywhere in this project.

Static site — plain HTML/CSS/JS, no build step. Deploys straight to GitHub Pages.

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New project.
2. Once it's ready, open **SQL Editor** → **New query**.
3. Run [`sql/schema.sql`](sql/schema.sql) first. This creates `cases`, `skins`, and `case_items`, with public read-only access, and seeds 3 example cases with 10 example skins.
4. Then run [`sql/auth_and_economy.sql`](sql/auth_and_economy.sql). This creates:
   - `profiles` — one row per signed-in user, holding their **balance** (new players start at **$500**) and `last_daily_claim` timestamp.
   - A trigger that auto-creates a profile the moment someone signs in for the first time.
   - `inventory` — persists each user's won skins server-side (replaces the old localStorage version).
   - `messages` — backs the live chat, with Realtime enabled so new messages push to everyone instantly.

## 2. Turn on Google sign-in

1. In Supabase: **Authentication → Providers → Google** → toggle it on.
2. You'll need a Google OAuth Client ID/Secret from the [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (OAuth consent screen + "Web application" credentials).
3. In the Google Cloud OAuth client, add this as an **Authorized redirect URI** (Supabase shows you the exact value on the provider setup page):
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
4. Paste the Google Client ID and Secret into the Supabase provider settings and save.
5. In **Authentication → URL Configuration**, add your site's URL (e.g. `https://<username>.github.io/<repo-name>/`) to **Redirect URLs** — otherwise Google will bounce users back to a blank page after login.

## 3. Connect the site to your project

1. In Supabase, go to **Project Settings → API**.
2. Copy the **Project URL** and the **anon public** key.
3. Open [`js/config.js`](js/config.js) and paste them in:

```js
const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOi...";
```

The anon key is safe to expose in client-side code — every table is locked down with Row Level Security policies from the schema files.

## 4. Run it locally

Just open `index.html` in a browser, or serve the folder with any static server, e.g.:

```bash
npx serve .
```

Google OAuth requires a real URL (not `file://`), so use a local server for testing, not double-clicking `index.html`.

## 5. Deploy to GitHub Pages

1. Push this folder to a GitHub repo.
2. Repo → **Settings → Pages** → Source: **Deploy from a branch** → Branch: `main`, folder `/ (root)`.
3. Your game will be live at `https://<username>.github.io/<repo-name>/`.
4. Double-check that exact URL is in Supabase's **Redirect URLs** (step 2 above) or login will silently fail to return to your site.

## Ways to earn money in-game

- **Open cases** and sell what you win (Inventory → Sell / Sell All).
- **Roulette table** — bet on Red/Black (2× payout) or Green/0 (14× payout).
- **Daily bonus** — click "Claim Daily" in the top bar once every 24 hours for $250.

## Live chat

The chat panel (toggle via the "Chat" button, top right) is a shared room — every signed-in visitor sees the same feed in real time, backed by Supabase Realtime on the `messages` table. Messages are public and capped at 300 characters.

## Customizing cases and skins

Everything is data-driven from Supabase — no code changes needed to add content:

- **Add a skin:** insert a row into `skins`.
- **Add a case:** insert a row into `cases`.
- **Control drop odds:** insert rows into `case_items` linking a `case_id` to a `skin_id` with a `weight`. Odds for an item = its weight ÷ the sum of all weights in that case. Higher weight = more common.

You can do this via the Supabase Table Editor UI, or with SQL like:

```sql
insert into skins (name, weapon, rarity, color_hex, value)
values ('My New Skin', 'RAVEN-9', 'restricted', '#4b69ff', 200);

insert into case_items (case_id, skin_id, weight)
select c.id, s.id, 15
from cases c, skins s
where c.name = 'Sector Alpha Case' and s.name = 'My New Skin';
```

Rarity must be one of: `consumer`, `industrial`, `restricted`, `classified`, `covert`, `rare` (this drives the color coding in the UI).

## How the economy works

- New players get a $500 starting balance the moment they first sign in with Google (set in `sql/auth_and_economy.sql`).
- Balance and inventory now live in Supabase (`profiles.balance` and the `inventory` table), tied to their Google account — so it follows them across devices/browsers.
- Every spend/earn path (case opens, sells, roulette, daily bonus) routes through one shared balance updater in `js/auth.js`, so the number on screen and the database never drift apart client-side.
- Heads-up: because this is a static site with no server-side game logic, a determined user could tamper with client-side requests to cheat their own balance. That's an acceptable tradeoff for a for-fun simulator like this — just don't wire this economy to anything backed by real money.

## Project structure

```
case-opener/
├── index.html                    # page markup — auth gate, tabs, chat panel
├── css/style.css                  # styling
├── js/
│   ├── config.js                   # your Supabase URL + anon key (edit this)
│   ├── client.js                    # shared Supabase client + Vault namespace
│   ├── auth.js                       # Google sign-in, profile load, balance helper, daily bonus
│   ├── app.js                         # case opening + inventory
│   ├── roulette.js                     # roulette table
│   └── chat.js                          # live chat (Realtime)
└── sql/
    ├── schema.sql                 # cases / skins / case_items + seed data
    └── auth_and_economy.sql        # profiles / inventory / messages + RLS + triggers
```
