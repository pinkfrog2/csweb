// ============================================================
// VAULT_09 — Roulette table (European wheel, red/black/green bets)
// ============================================================
(function () {
  "use strict";
  const V = window.Vault;
  if (!V.configured) return;

  // Standard European roulette wheel order
  const WHEEL_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
  const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

  const PAYOUTS = { red: 2, black: 2, green: 14 };

  function colorOf(n) {
    if (n === 0) return "green";
    return RED_NUMBERS.has(n) ? "red" : "black";
  }

  const state = { bet: null, amount: 100, spinning: false };
  const el = (id) => document.getElementById(id);

  function buildIdleWheel() {
    const strip = el("rouletteStrip");
    strip.innerHTML = "";
    strip.style.transition = "none";
    strip.style.transform = "translateX(0)";
    WHEEL_ORDER.slice(0, 12).forEach((n) => strip.appendChild(buildCell(n)));
  }

  function buildCell(n) {
    const c = colorOf(n);
    const div = document.createElement("div");
    div.className = "roulette-cell roulette-" + c;
    div.textContent = n;
    return div;
  }

  function setBetAmount(v) {
    state.amount = Math.max(10, Math.floor(v) || 10);
    el("rouletteAmount").value = state.amount;
  }

  function selectBet(color) {
    state.bet = color;
    document.querySelectorAll(".rb-choice").forEach((b) => b.classList.toggle("active", b.dataset.color === color));
  }

  async function spin() {
    if (state.spinning) return;
    if (!state.bet) { V.toast("Pick a color to bet on first."); return; }
    if (!V.profile || V.profile.balance < state.amount) { V.toast("Not enough funds for this bet."); return; }

    state.spinning = true;
    el("rouletteSpinBtn").disabled = true;
    el("rouletteResult").classList.add("hidden");
    await V.updateBalance(-state.amount);

    const winIndex = Math.floor(Math.random() * WHEEL_ORDER.length);
    const winNumber = WHEEL_ORDER[winIndex];
    const winColor = colorOf(winNumber);

    await spinStrip(winIndex);

    const won = winColor === state.bet;
    const rr = el("rouletteResult");
    rr.classList.remove("hidden");
    if (won) {
      const payout = state.amount * PAYOUTS[winColor];
      await V.updateBalance(payout);
      rr.className = "roulette-result win";
      rr.innerHTML = `<b>${winNumber} ${winColor.toUpperCase()}</b> — you won $${payout.toLocaleString()}!`;
    } else {
      rr.className = "roulette-result lose";
      rr.innerHTML = `<b>${winNumber} ${winColor.toUpperCase()}</b> — no match, better luck next spin.`;
    }

    state.spinning = false;
    el("rouletteSpinBtn").disabled = false;
  }

  function spinStrip(winIndex) {
    return new Promise((resolve) => {
      const strip = el("rouletteStrip");
      const CELL_W = 68;
      const LAPS = 4;
      const total = LAPS * WHEEL_ORDER.length + winIndex;

      strip.innerHTML = "";
      for (let i = 0; i <= total + 6; i++) {
        strip.appendChild(buildCell(WHEEL_ORDER[i % WHEEL_ORDER.length]));
      }

      const wrapWidth = strip.parentElement.offsetWidth;
      const targetOffset = total * CELL_W + CELL_W / 2 - wrapWidth / 2;

      strip.style.transition = "none";
      strip.style.transform = "translateX(0)";
      void strip.offsetWidth;

      strip.style.transition = "transform 3800ms cubic-bezier(0.1,0.85,0.15,1)";
      strip.style.transform = `translateX(${-targetOffset}px)`;

      setTimeout(resolve, 3880);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    buildIdleWheel();
    document.querySelectorAll(".rb-choice").forEach((btn) => {
      btn.onclick = () => selectBet(btn.dataset.color);
    });
    el("rouletteAmount").onchange = (e) => setBetAmount(Number(e.target.value));
    document.querySelectorAll(".rb-quick").forEach((btn) => {
      btn.onclick = () => setBetAmount(Number(btn.dataset.amt));
    });
    el("rouletteSpinBtn").onclick = spin;
  });
})();
