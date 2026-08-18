# VAULT_09 — Case Opener

A browser-based case/skin opening simulator. Cases, skins, and drop odds are stored in Supabase; balance and inventory are tracked locally in the browser (virtual currency only — no real money, no login required).

Static site — plain HTML/CSS/JS, no build step. Deploys straight to GitHub Pages.

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New project.
2. Once it's ready, open **SQL Editor** → **New query**.
3. Paste the contents of [`sql/schema.sql`](sql/schema.sql) and run it. This creates the `cases`, `skins`, and `case_items` tables, sets up public read-only access, and seeds 3 example cases with 10 example skins.

## 2. Connect the site to your project

1. In Supabase, go to **Project Settings → API**.
2. Copy the **Project URL** and the **anon public** key.
3. Open [`js/config.js`](js/config.js) and paste them in:

```js
const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOi...";
```

The anon key is safe to expose in client-side code — it only has the read permissions you granted via Row Level Security in the schema.

## 3. Run it locally

Just open `index.html` in a browser, or serve the folder with any static server, e.g.:

```bash
npx serve .
```

## 4. Deploy to GitHub Pages

1. Push this folder to a GitHub repo.
2. Repo → **Settings → Pages** → Source: **Deploy from a branch** → Branch: `main`, folder `/ (root)`.
3. Your game will be live at `https://<username>.github.io/<repo-name>/`.

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

- New visitors start with a virtual balance (`STARTING_BALANCE` in `config.js`, default 2000).
- Opening a case deducts its price from your balance.
- Winning items go to your inventory; sell them individually or all at once for their `value`.
- Balance and inventory persist in `localStorage` on that browser/device only — there's no server-side account system. If you want persistent accounts across devices, you'd extend this with Supabase Auth and a `profiles` table (not included here, but the schema is a clean starting point for that).

## Project structure

```
case-opener/
├── index.html          # page markup
├── css/style.css        # styling
├── js/
│   ├── config.js         # your Supabase URL + anon key (edit this)
│   └── app.js             # game logic
└── sql/schema.sql        # Supabase table setup + seed data
```
