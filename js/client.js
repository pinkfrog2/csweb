// ============================================================
// Shared Supabase client + tiny global namespace other modules hang off.
// Load order matters: config.js -> client.js -> auth.js -> app.js -> roulette.js -> chat.js
// ============================================================
window.Vault = window.Vault || {};

(function () {
  const V = window.Vault;
  V.configured = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
  V.supabase = V.configured
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;
  V.profile = null; // filled in by auth.js once signed in

  V.toast = function (msg) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.remove("hidden");
    clearTimeout(V._toastTimer);
    V._toastTimer = setTimeout(() => t.classList.add("hidden"), 2400);
  };

  document.addEventListener("DOMContentLoaded", () => {
    if (!V.configured) {
      document.getElementById("configNotice").classList.remove("hidden");
    }
  });
})();
