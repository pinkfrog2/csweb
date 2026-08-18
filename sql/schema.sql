-- ============================================================
-- VAULT_09 Case Opener — Supabase schema
-- Run this in Supabase: Project → SQL Editor → New query → Run
-- ============================================================

-- Clean slate (safe to re-run while you're building)
drop table if exists case_items cascade;
drop table if exists skins cascade;
drop table if exists cases cascade;

-- ---------- CASES ----------
create table cases (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  price       integer not null default 100,
  image_url   text,
  accent_hex  text default '#8a9a5b',   -- used for the case's UI accent color
  sort_order  integer default 0,
  created_at  timestamptz default now()
);

-- ---------- SKINS ----------
create table skins (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,           -- e.g. "Ember Line"
  weapon      text not null,           -- e.g. "BRIAR-762"
  rarity      text not null check (rarity in ('consumer','industrial','restricted','classified','covert','rare')),
  color_hex   text not null default '#8a9a5b',
  value       integer not null default 50,   -- virtual-currency sell value
  image_url   text,
  created_at  timestamptz default now()
);

-- ---------- CASE_ITEMS (which skins can drop from which case, and how often) ----------
create table case_items (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references cases(id) on delete cascade,
  skin_id     uuid not null references skins(id) on delete cascade,
  weight      numeric not null default 1,  -- higher weight = more common. Odds = weight / sum(weights in case)
  unique(case_id, skin_id)
);

-- ---------- Row Level Security ----------
-- Public read-only access (this is a front-end-only static site, no auth backend)
alter table cases enable row level security;
alter table skins enable row level security;
alter table case_items enable row level security;

create policy "public read cases" on cases for select using (true);
create policy "public read skins" on skins for select using (true);
create policy "public read case_items" on case_items for select using (true);

-- ============================================================
-- SEED DATA — replace/expand with your own cases & skins later
-- ============================================================

-- Rarity color reference (used for image_url placeholder swatches too):
--   consumer   #b0c3d9   industrial #5e98d9   restricted #4b69ff
--   classified #8847ff   covert     #d32ce6   rare (gold) #ffd700

insert into skins (name, weapon, rarity, color_hex, value) values
  ('Factory New Grey', 'RAVEN-9',   'consumer',   '#b0c3d9', 20),
  ('Steel Cut',        'RAVEN-9',   'industrial', '#5e98d9', 45),
  ('Slate Fade',       'FANG SMG',  'industrial', '#5e98d9', 60),
  ('Viper Weave',      'FANG SMG',  'restricted', '#4b69ff', 150),
  ('Ember Line',       'BRIAR-762', 'restricted', '#4b69ff', 220),
  ('Nightshade',       'BRIAR-762', 'classified', '#8847ff', 480),
  ('Ghostwire',        'TALON DMR', 'classified', '#8847ff', 620),
  ('Aurum Cache',      'TALON DMR', 'covert',     '#d32ce6', 1400),
  ('Crimson Reactor',  'BRIAR-762', 'covert',     '#d32ce6', 1850),
  ('Dragon''s Hoard',  'KARAMBIT-X','rare',       '#ffd700', 9000);

insert into cases (name, description, price, accent_hex, sort_order) values
  ('Sector Alpha Case',  'Standard-issue drop. Common and industrial grade skins.', 100, '#5e98d9', 1),
  ('Blackout Case',      'Higher-tier drop with a shot at classified skins.',       350, '#8847ff', 2),
  ('Vault Breach Case',  'Rare drop odds — chase the gold.',                        900, '#ffd700', 3);

-- Wire skins into cases with weights (higher weight = more common)
insert into case_items (case_id, skin_id, weight)
select c.id, s.id, w.weight from
(values
  ('Sector Alpha Case', 'Factory New Grey', 40),
  ('Sector Alpha Case', 'Steel Cut',        30),
  ('Sector Alpha Case', 'Slate Fade',       20),
  ('Sector Alpha Case', 'Viper Weave',      8),
  ('Sector Alpha Case', 'Ember Line',       2),

  ('Blackout Case',     'Steel Cut',        25),
  ('Blackout Case',     'Slate Fade',       25),
  ('Blackout Case',     'Viper Weave',      22),
  ('Blackout Case',     'Ember Line',       18),
  ('Blackout Case',     'Nightshade',       8),
  ('Blackout Case',     'Ghostwire',        2),

  ('Vault Breach Case', 'Viper Weave',      20),
  ('Vault Breach Case', 'Ember Line',       20),
  ('Vault Breach Case', 'Nightshade',       25),
  ('Vault Breach Case', 'Ghostwire',        20),
  ('Vault Breach Case', 'Aurum Cache',      8),
  ('Vault Breach Case', 'Crimson Reactor',  6),
  ('Vault Breach Case', 'Dragon''s Hoard',  1)
) as w(case_name, skin_name, weight)
join cases c on c.name = w.case_name
join skins s on s.name = w.skin_name;
