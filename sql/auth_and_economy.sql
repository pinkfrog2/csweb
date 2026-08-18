-- ============================================================
-- VAULT_09 — Auth, economy & chat schema
-- Run this AFTER sql/schema.sql, in Supabase → SQL Editor
-- ============================================================

-- ---------- PROFILES (one row per authenticated user) ----------
create table if not exists profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  username          text,
  avatar_url        text,
  balance           integer not null default 500,   -- starting balance for new players
  last_daily_claim  timestamptz,
  created_at        timestamptz default now()
);

alter table profiles enable row level security;

drop policy if exists "profiles are viewable by everyone" on profiles;
create policy "profiles are viewable by everyone" on profiles for select using (true);

drop policy if exists "users can update own profile" on profiles;
create policy "users can update own profile" on profiles for update using (auth.uid() = id);

drop policy if exists "users can insert own profile" on profiles;
create policy "users can insert own profile" on profiles for insert with check (auth.uid() = id);

-- Auto-create a profile row whenever someone signs in for the first time
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, avatar_url, balance)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    new.raw_user_meta_data->>'avatar_url',
    500
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------- INVENTORY (per-user, persisted server-side) ----------
create table if not exists inventory (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  skin_id      uuid not null references skins(id) on delete cascade,
  obtained_at  timestamptz default now()
);

alter table inventory enable row level security;

drop policy if exists "users manage own inventory" on inventory;
create policy "users manage own inventory" on inventory
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- CHAT MESSAGES ----------
create table if not exists messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles(id) on delete set null,
  username    text not null,
  content     text not null check (char_length(content) <= 300),
  created_at  timestamptz default now()
);

alter table messages enable row level security;

drop policy if exists "messages are viewable by everyone" on messages;
create policy "messages are viewable by everyone" on messages for select using (true);

drop policy if exists "authenticated users can send messages" on messages;
create policy "authenticated users can send messages" on messages
  for insert with check (auth.uid() = user_id);

-- Enable realtime on messages so the chat updates live
alter publication supabase_realtime add table messages;
