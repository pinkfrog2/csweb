// ============================================================
// VAULT_09 — Live chat (Supabase table + Realtime subscription)
// ============================================================
(function () {
  "use strict";
  const V = window.Vault;
  if (!V.configured) return;
  const sb = V.supabase;

  const el = (id) => document.getElementById(id);
  let subscribed = false;

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  function appendMessage(msg) {
    const list = el("chatMessages");
    const isMine = V.profile && msg.user_id === V.profile.id;
    const row = document.createElement("div");
    row.className = "chat-msg" + (isMine ? " mine" : "");
    const time = new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    row.innerHTML = `
      <span class="chat-user">${escapeHtml(msg.username)}</span>
      <span class="chat-time">${time}</span>
      <div class="chat-text">${escapeHtml(msg.content)}</div>
    `;
    list.appendChild(row);
    list.scrollTop = list.scrollHeight;
  }

  async function loadRecent() {
    const { data, error } = await sb
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) { console.error(error); return; }
    el("chatMessages").innerHTML = "";
    (data || []).reverse().forEach(appendMessage);
  }

  function subscribeRealtime() {
    if (subscribed) return;
    subscribed = true;
    sb.channel("public:messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        appendMessage(payload.new);
      })
      .subscribe();
  }

  async function sendMessage() {
    const input = el("chatInput");
    const text = input.value.trim();
    if (!text || !V.profile) return;
    input.value = "";
    const { error } = await sb.from("messages").insert({
      user_id: V.profile.id,
      username: V.profile.username || "Agent",
      content: text.slice(0, 300),
    });
    if (error) { console.error(error); V.toast("Message failed to send."); }
  }

  document.addEventListener("vault:login", async () => {
    await loadRecent();
    subscribeRealtime();
  });

  document.addEventListener("DOMContentLoaded", () => {
    el("chatSendBtn").onclick = sendMessage;
    el("chatInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendMessage();
    });
    el("chatToggleBtn").onclick = () => {
      document.body.classList.toggle("chat-open");
    };
    el("chatCloseBtn").onclick = () => {
      document.body.classList.remove("chat-open");
    };
  });
})();
