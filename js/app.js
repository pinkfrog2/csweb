// ============================================================
// VAULT_09 — Case Opener game logic
// All currency here is virtual/local only. Nothing is real money.
// ============================================================
(function () {
  "use strict";

  const RARITY_LABEL = {
    consumer: "Consumer", industrial: "Industrial", restricted: "Restricted",
    classified: "Classified", covert: "Covert", rare: "Rare",
  };

  const state = {
    supabase: null,
    cases: [],
    caseItemsByCase: {}, // caseId -> [{skin, weight}]
    activeCase: null,
    balance: 0,
    inventory: [], // [{id, skin, obtainedAt}]
    spinning: false,
  };

  const el = (id) => document.getElementById(id);

  /* ---------------- Storage ---------------- */
  function loadLocal() {
    const bal = localStorage.getItem("vault09_balance");
    state.balance = bal === null ? STARTING_BALANCE : Number(bal);
    const inv = localStorage.getItem("vault09_inventory");
    state.inventory = inv ? JSON.parse(inv) : [];
  }
  function saveLocal() {
    localStorage.setItem("vault09_balance", String(state.balance));
    localStorage.setItem("vault09_inventory", JSON.stringify(state.inventory));
  }
  function setBalance(v) {
    state.balance = Math.max(0, v);
    el("balanceVal").textContent = state.balance.toLocaleString();
    saveLocal();
  }

  /* ---------------- Toast ---------------- */
  let toastTimer = null;
  function toast(msg) {
    const t = el("toast");
    t.textContent = msg;
    t.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add("hidden"), 2400);
  }

  /* ---------------- Supabase ---------------- */
  async function initSupabase() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      el("configNotice").classList.remove("hidden");
      return false;
    }
    state.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return true;
  }

  async function fetchCases() {
    const { data: cases, error: caseErr } = await state.supabase
      .from("cases")
      .select("*")
      .order("sort_order", { ascending: true });
    if (caseErr) { toast("Error loading cases — check console"); console.error(caseErr); return; }

    const { data: items, error: itemErr } = await state.supabase
      .from("case_items")
      .select("case_id, weight, skins(*)");
    if (itemErr) { toast("Error loading case items — check console"); console.error(itemErr); return; }

    state.cases = cases || [];
    state.caseItemsByCase = {};
    (items || []).forEach((row) => {
      if (!state.caseItemsByCase[row.case_id]) state.caseItemsByCase[row.case_id] = [];
      state.caseItemsByCase[row.case_id].push({ skin: row.skins, weight: Number(row.weight) });
    });
  }

  /* ---------------- Rendering: case grid ---------------- */
  function renderCaseGrid() {
    const grid = el("caseGrid");
    grid.innerHTML = "";
    if (!state.cases.length) {
      grid.innerHTML = `<p class="empty-note">No cases found. Did you run sql/schema.sql in your Supabase project?</p>`;
      return;
    }
    state.cases.forEach((c) => {
      const card = document.createElement("div");
      card.className = "case-card";
      card.style.setProperty("--accent", c.accent_hex || "#8a9a5b");
      card.innerHTML = `
        <div class="cc-icon">${c.name.toUpperCase()}</div>
        <div class="cc-name">${c.name}</div>
        <div class="cc-desc">${c.description || ""}</div>
        <div class="cc-price">$${c.price.toLocaleString()}</div>
      `;
      card.onclick = () => openCaseView(c);
      grid.appendChild(card);
    });
  }

  /* ---------------- Case detail / opening ---------------- */
  function openCaseView(c) {
    state.activeCase = c;
    el("activeCaseName").textContent = c.name;
    el("activeCasePrice").textContent = "$" + c.price.toLocaleString();
    el("openSection").classList.remove("hidden");
    el("resultBanner").classList.add("hidden");
    buildIdleReel(c);
    el("openSection").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function getPool(caseId) {
    return state.caseItemsByCase[caseId] || [];
  }

  function buildIdleReel(c) {
    const reel = el("reel");
    reel.style.transition = "none";
    reel.style.transform = "translateX(0)";
    reel.innerHTML = "";
    const pool = getPool(c.id);
    if (!pool.length) {
      reel.innerHTML = `<p class="empty-note" style="padding:0 16px;">This case has no items configured yet.</p>`;
      return;
    }
    // show a static preview strip of possible drops
    const preview = shuffle([...pool]).slice(0, 10);
    preview.forEach((p) => reel.appendChild(buildReelItem(p.skin)));
  }

  function buildReelItem(skin) {
    const item = document.createElement("div");
    item.className = "reel-item";
    item.innerHTML = `
      <div class="ri-swatch" style="background:radial-gradient(circle at 35% 30%, ${skin.color_hex}, #10131600)"></div>
      <div class="ri-name rarity-${skin.rarity}">${skin.name}</div>
      <div class="ri-weapon">${skin.weapon}</div>
    `;
    return item;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function weightedPick(pool) {
    const total = pool.reduce((s, p) => s + p.weight, 0);
    let roll = Math.random() * total;
    for (const p of pool) {
      if (roll < p.weight) return p.skin;
      roll -= p.weight;
    }
    return pool[pool.length - 1].skin;
  }

  async function handleOpen() {
    const c = state.activeCase;
    if (!c || state.spinning) return;
    const pool = getPool(c.id);
    if (!pool.length) { toast("This case has no items configured."); return; }
    if (state.balance < c.price) { toast("Not enough funds for this case."); return; }

    setBalance(state.balance - c.price);
    state.spinning = true;
    el("openBtn").disabled = true;
    el("resultBanner").classList.add("hidden");

    const won = weightedPick(pool);
    const fast = el("fastToggle").checked;
    await spinReel(pool, won, fast);

    // add to inventory
    const entry = { id: crypto.randomUUID(), skin: won, obtainedAt: Date.now() };
    state.inventory.unshift(entry);
    saveLocal();
    renderInventory();
    showResult(won);

    state.spinning = false;
    el("openBtn").disabled = false;
  }

  function spinReel(pool, winningSkin, fast) {
    return new Promise((resolve) => {
      const reel = el("reel");
      const ITEM_W = 130; // width + gap
      const REEL_LEN = fast ? 24 : 60;
      const WIN_INDEX = fast ? 18 : 50;

      reel.innerHTML = "";
      const sequence = [];
      for (let i = 0; i < REEL_LEN; i++) {
        if (i === WIN_INDEX) sequence.push(winningSkin);
        else sequence.push(weightedPick(pool));
      }
      sequence.forEach((skin) => reel.appendChild(buildReelItem(skin)));

      const wrapWidth = reel.parentElement.offsetWidth;
      const targetOffset = WIN_INDEX * ITEM_W + ITEM_W / 2 - wrapWidth / 2;
      // slight random jitter within the item so it doesn't always land dead-center
      const jitter = (Math.random() - 0.5) * (ITEM_W * 0.4);

      reel.style.transition = "none";
      reel.style.transform = "translateX(0)";
      // force reflow
      void reel.offsetWidth;

      const duration = fast ? 1400 : 4200;
      reel.style.transition = `transform ${duration}ms cubic-bezier(0.12,0.85,0.15,1)`;
      reel.style.transform = `translateX(${-(targetOffset + jitter)}px)`;

      setTimeout(resolve, duration + 80);
    });
  }

  function showResult(skin) {
    const rb = el("resultBanner");
    rb.style.background = `linear-gradient(90deg, color-mix(in srgb, ${skin.color_hex} 18%, #14181d), #14181d)`;
    rb.style.border = `1px solid ${skin.color_hex}`;
    rb.innerHTML = `
      <div class="rb-swatch" style="background:radial-gradient(circle at 35% 30%, ${skin.color_hex}, #10131600)"></div>
      <div class="rb-text">
        <div class="rb-rarity rarity-${skin.rarity}">${RARITY_LABEL[skin.rarity] || skin.rarity}</div>
        <div class="rb-name">${skin.weapon} — ${skin.name}</div>
      </div>
      <div class="rb-value">+$${skin.value.toLocaleString()} value</div>
    `;
    rb.classList.remove("hidden");
  }

  /* ---------------- Inventory ---------------- */
  function renderInventory() {
    const grid = el("inventoryGrid");
    grid.innerHTML = "";
    if (!state.inventory.length) {
      grid.innerHTML = `<p class="empty-note">No items yet — open a case to get started.</p>`;
      return;
    }
    state.inventory.forEach((entry) => {
      const skin = entry.skin;
      const card = document.createElement("div");
      card.className = "inv-card";
      card.innerHTML = `
        <div class="ic-swatch" style="background:radial-gradient(circle at 35% 30%, ${skin.color_hex}, #10131600)"></div>
        <div class="ic-name rarity-${skin.rarity}">${skin.name}</div>
        <div class="ic-weapon">${skin.weapon}</div>
        <div class="ic-footer">
          <span class="ic-value">$${skin.value.toLocaleString()}</span>
          <span class="ic-sell" data-id="${entry.id}">Sell</span>
        </div>
      `;
      card.querySelector(".ic-sell").onclick = (e) => {
        e.stopPropagation();
        sellItem(entry.id);
      };
      grid.appendChild(card);
    });
  }

  function sellItem(entryId) {
    const idx = state.inventory.findIndex((e) => e.id === entryId);
    if (idx === -1) return;
    const [removed] = state.inventory.splice(idx, 1);
    setBalance(state.balance + removed.skin.value);
    saveLocal();
    renderInventory();
    toast(`Sold ${removed.skin.name} for $${removed.skin.value.toLocaleString()}`);
  }

  function sellAll() {
    if (!state.inventory.length) return;
    const total = state.inventory.reduce((s, e) => s + e.skin.value, 0);
    state.inventory = [];
    setBalance(state.balance + total);
    saveLocal();
    renderInventory();
    toast(`Sold all items for $${total.toLocaleString()}`);
  }

  /* ---------------- Init ---------------- */
  async function init() {
    loadLocal();
    setBalance(state.balance);
    renderInventory();

    const ok = await initSupabase();
    if (!ok) return;

    el("app").classList.remove("hidden");
    await fetchCases();
    renderCaseGrid();

    el("backBtn").onclick = () => {
      el("openSection").classList.add("hidden");
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    el("openBtn").onclick = handleOpen;
    el("sellAllBtn").onclick = sellAll;
  }

  document.addEventListener("DOMContentLoaded", init);
})();
