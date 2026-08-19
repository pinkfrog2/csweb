// ============================================================
// Auth: GitHub & Discord sign-in via Supabase, profile load, 
// shared balance updater, and the daily-bonus economy hook.
// ============================================================
(function () {
  const V = window.Vault;
  if (!V.configured) return;
  const sb = V.supabase;

  const DAILY_BONUS = 250;
  const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

  function el(id) { return document.getElementById(id); }

  V.setBalanceUI = function (bal) {
    const balEl = el("balanceVal");
    if (balEl) balEl.textContent = bal.toLocaleString();
  };

  V.updateBalance = async function (delta) {
    if (!V.profile) return null;
    const newBal = Math.max(0, V.profile.balance + delta);
    V.profile.balance = newBal;
    V.setBalanceUI(newBal);
    const { error } = await sb.from("profiles").update({ balance: newBal }).eq("id", V.profile.id);
    if (error) console.error("balance update failed", error);
    document.dispatchEvent(new CustomEvent("vault:balanceChanged", { detail: { balance: newBal } }));
    return newBal;
  };

  async function loadOrCreateProfile(userId) {
    let { data, error } = await sb.from("profiles").select("*").eq("id", userId).single();
    if (!error && data) return data;

    const { data: userData } = await sb.auth.getUser();
    const u = userData.user;
    const insertRes = await sb.from("profiles").insert({
      id: userId,
      username: u.user_metadata?.full_name || u.user_metadata?.name || (u.email ? u.email.split("@")[0] : "Agent"),
      avatar_url: u.user_metadata?.avatar_url || null,
      balance: 500,
    }).select().single();
    return insertRes.data;
  }

  function updateDailyBonusButton() {
    const btn = el("dailyBonusBtn");
    if (!btn || !V.profile) return;
    const last = V.profile.last_daily_claim ? new Date(V.profile.last_daily_claim) : null;
    const ready = !last || (Date.now() - last.getTime()) >= DAILY_COOLDOWN_MS;
    btn.disabled = !ready;
    if (ready) {
      btn.textContent = `Claim Daily $${DAILY_BONUS}`;
    } else {
      const msLeft = DAILY_COOLDOWN_MS - (Date.now() - last.getTime());
      const hrs = Math.ceil(msLeft / (60 * 60 * 1000));
      btn.textContent = `Next bonus in ~${hrs}h`;
    }
  }

  async function claimDaily() {
    if (!V.profile) return;
    const last = V.profile.last_daily_claim ? new Date(V.profile.last_daily_claim) : null;
    if (last && (Date.now() - last.getTime()) < DAILY_COOLDOWN_MS) {
      V.toast("Daily bonus isn't ready yet.");
      return;
    }
    const nowIso = new Date().toISOString();
    V.profile.last_daily_claim = nowIso;
    await sb.from("profiles").update({ last_daily_claim: nowIso }).eq("id", V.profile.id);
    await V.updateBalance(DAILY_BONUS);
    updateDailyBonusButton();
    V.toast(`Claimed $${DAILY_BONUS} daily bonus!`);
  }

  async function onLoggedIn(session) {
    const profile = await loadOrCreateProfile(session.user.id);
    V.profile = profile;
    V.setBalanceUI(profile.balance);

    el("authGate").classList.add("hidden");
    el("app").classList.remove("hidden");
    el("userBox").classList.remove("hidden");
    el("loginBtnWrap").classList.add("hidden");

    el("userAvatar").src = profile.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${profile.id}`;
    el("userName").textContent = profile.username || "Agent";

    updateDailyBonusButton();
    document.dispatchEvent(new CustomEvent("vault:login", { detail: { profile } }));
  }

  function onLoggedOut() {
    V.profile = null;
    el("authGate").classList.remove("hidden");
    el("app").classList.add("hidden");
    el("userBox").classList.add("hidden");
    el("loginBtnWrap").classList.remove("hidden");
  }

  document.addEventListener("DOMContentLoaded", () => {
    el("githubLoginBtn").onclick = () => {
      sb.auth.signInWithOAuth({
        provider: "github",
        options: { redirectTo: window.location.origin + window.location.pathname },
      });
    };
    el("discordLoginBtn").onclick = () => {
      sb.auth.signInWithOAuth({
        provider: "discord",
        options: { redirectTo: window.location.origin + window.location.pathname },
      });
    };
    el("logoutBtn").onclick = async () => {
      await sb.auth.signOut();
      window.location.reload();
    };
    el("dailyBonusBtn").onclick = claimDaily;

    sb.auth.onAuthStateChange((_event, session) => {
      if (session) onLoggedIn(session); else onLoggedOut();
    });
    sb.auth.getSession().then(({ data }) => {
      if (data.session) onLoggedIn(data.session); else onLoggedOut();
    });
  });
})();
