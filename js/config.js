// ============================================================
// Paste your Supabase project credentials here.
// Find them in: Supabase Dashboard → Project Settings → API
//   - SUPABASE_URL  = "Project URL"
//   - SUPABASE_ANON_KEY = "anon public" key (safe to expose client-side)
// ============================================================

const SUPABASE_URL = "";       // e.g. "https://xxxxxxxx.supabase.co"
const SUPABASE_ANON_KEY = "";  // e.g. "eyJhbGciOi..."

// Note: starting balance for new players is now set in
// sql/auth_and_economy.sql (profiles.balance default + handle_new_user()),
// not here — it applies server-side the moment someone signs in.
