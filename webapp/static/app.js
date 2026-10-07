const USAGE_LABEL = { "輕度": "輕度使用", "中度": "一般使用", "重度": "重度使用" };

/* ───── Seasonal theming ───── */
const THEMES = {
  sakura: { emojis: ["🌸", "🌸", "🌺"], hero: "🌸 櫻花季，一起找最適合你的 eSIM", art: "🌸✈️🗼" },
  ocean:  { emojis: ["🌊", "🐚", "⛵"], hero: "🏖️ 夏日出遊，別讓網路拖累你的旅程", art: "✈️🌊🏝️" },
  maple:  { emojis: ["🍁", "🍁", "🍂"], hero: "🍁 秋楓時節，用 eSIM 帶走最美的風景", art: "🍁✈️🗻" },
  xmas:   { emojis: ["❄️", "🎄", "⭐", "🎁"], hero: "🎄 聖誕出遊，一手搞定上網方案", art: "🎄✈️🎅" },
  winter: { emojis: ["❄️", "❄️", "⛄"], hero: "☃️ 冬日旅行，暖暖連線不失溫", art: "❄️✈️🏔️" },
};

function pickTheme(d = new Date()) {
  const m = d.getMonth() + 1, day = d.getDate();
  if (m === 3 || m === 4) return "sakura";
  if (m >= 5 && m <= 8) return "ocean";
  if (m >= 9 && m <= 11) return "maple";
  if (m === 12 && day <= 26) return "xmas";
  return "winter";
}

function applyTheme(name) {
  const t = THEMES[name];
  if (!t) return;
  document.body.dataset.theme = name;
  const heroH = document.querySelector(".hero-text h1");
  const heroArt = document.querySelector(".hero-art");
  if (heroH) heroH.innerHTML = t.hero;
  if (heroArt) heroArt.textContent = t.art;

  // 浮動裝飾層
  document.querySelector(".decor")?.remove();
  const decor = document.createElement("div");
  decor.className = "decor";
  const count = 18;
  for (let i = 0; i < count; i++) {
    const span = document.createElement("span");
    span.className = "flake";
    span.textContent = t.emojis[i % t.emojis.length];
    span.style.left = Math.random() * 100 + "vw";
    span.style.animationDuration = (10 + Math.random() * 12) + "s";
    span.style.animationDelay = (-Math.random() * 20) + "s";
    span.style.fontSize = (14 + Math.random() * 18) + "px";
    span.style.opacity = (0.5 + Math.random() * 0.4).toFixed(2);
    decor.appendChild(span);
  }
  document.body.appendChild(decor);
}
applyTheme(pickTheme());

const state = {
  destination: "韓國",
  days: 5,
  usage: "中度",
  budget: 500,
  unlimited: false,
  hotspot: false,
};

const el = (id) => document.getElementById(id);
const destSel = el("destination");
const daysPills = el("days-pills");
const daysOther = el("days-other");
const daysCustom = el("days-custom");
const usageCards = el("usage-cards");
const budgetInput = el("budget");
const prefPills = el("pref-pills");
const submitBtn = el("submit-btn");
const statusEl = el("status");
const noticeEl = el("notice");
const cardsEl = el("cards");
const recCount = el("rec-count");
const recSub = el("rec-sub");
const tipBody = el("tip-body");

const chatWindow = el("chat-window");
const msgInput = el("msg-input");
const msgForm = el("msg-form");
const sendBtn = el("send-btn");
const clearBtn = el("clear-btn");

let history = [];
let busy = false;

const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));

/* ───── State → UI sync ───── */
function updateSummary() {
  const destText = destSel.selectedOptions[0]?.text || state.destination;
  el("s-dest").textContent = destText;
  el("s-days").textContent = `${state.days} 天`;
  el("s-usage").textContent = USAGE_LABEL[state.usage] || state.usage;
  el("s-budget").textContent = state.budget === 0 ? "不限" : `NT$${state.budget.toLocaleString()}`;
  const prefs = [];
  if (state.unlimited) prefs.push("吃到飽");
  if (state.hotspot) prefs.push("熱點分享");
  el("s-pref").textContent = prefs.length ? prefs.join("、") : "—";

  tipBody.textContent = state.hotspot
    ? "你勾了熱點分享，我們會優先推薦鈦金吃到飽方案；若此目的地沒有鈦金方案，會退而求其次推一般吃到飽。"
    : "勾選「熱點分享」我們會優先推薦鈦金吃到飽方案。";
}

/* ───── Input handlers ───── */
destSel.addEventListener("change", () => {
  state.destination = destSel.value;
  updateSummary();
});

daysPills.addEventListener("click", (e) => {
  const btn = e.target.closest(".pill");
  if (!btn) return;
  daysPills.querySelectorAll(".pill").forEach(p => p.classList.remove("selected"));
  btn.classList.add("selected");
  const v = btn.dataset.value;
  if (v === "other") {
    daysOther.classList.remove("hidden");
    const custom = Number(daysCustom.value);
    if (custom >= 1) state.days = custom;
  } else {
    daysOther.classList.add("hidden");
    state.days = Number(v);
  }
  updateSummary();
});

daysCustom.addEventListener("input", () => {
  const v = Number(daysCustom.value);
  if (v >= 1 && v <= 60) {
    state.days = v;
    updateSummary();
  }
});

usageCards.addEventListener("click", (e) => {
  const card = e.target.closest(".usage-card");
  if (!card) return;
  usageCards.querySelectorAll(".usage-card").forEach(c => c.classList.remove("selected"));
  card.classList.add("selected");
  state.usage = card.dataset.value;
  updateSummary();
});

budgetInput.addEventListener("input", () => {
  const v = Number(budgetInput.value);
  if (v >= 0) {
    state.budget = v;
    updateSummary();
  }
});

prefPills.addEventListener("click", (e) => {
  const btn = e.target.closest(".pill");
  if (!btn) return;
  const key = btn.dataset.pref;
  state[key] = !state[key];
  btn.classList.toggle("selected", state[key]);
  updateSummary();
});

/* ───── Recommendation flow ───── */
function setBusy(v) {
  busy = v;
  submitBtn.disabled = v;
  if (sendBtn) sendBtn.disabled = v;
  if (clearBtn) clearBtn.disabled = v;
}
function setStatus(text) { statusEl.textContent = text; }

function badgeFor(idx, plan, hotspotOn) {
  const data = plan.data || "";
  if (hotspotOn && data.includes("鈦金")) return { cls: "badge-titanium", label: "📶 鈦金熱點" };
  if (idx === 0) return { cls: "badge-top", label: "👑 最推薦" };
  if (idx === 1) return { cls: "badge-cheap", label: "💰 最省錢" };
  if (data.includes("吃到飽")) return { cls: "badge-titanium", label: "⚡ 流量最多" };
  return { cls: "badge-default", label: `方案 0${idx + 1}` };
}

function renderCards(plans) {
  if (!plans || !plans.length) {
    cardsEl.innerHTML = `<div class="empty-card">目前條件下找不到合適的方案，試著放寬預算或切換吃到飽偏好。</div>`;
    recCount.textContent = "0";
    return;
  }
  recCount.textContent = String(plans.length);
  const hotspotOn = state.hotspot;
  cardsEl.innerHTML = plans.map((p, i) => {
    const b = badgeFor(i, p, hotspotOn);
    const v = {
      name: escapeHtml(p.name), price: escapeHtml(p.price),
      data: escapeHtml(p.data), days: escapeHtml(p.days),
      reason: escapeHtml(p.reason),
    };
    return `
      <article class="plan-card">
        <span class="plan-badge ${b.cls}">${b.label}</span>
        <h3>${v.name}</h3>
        <div class="plan-meta-top">
          <span class="plan-chip">${v.data}</span>
          <span class="plan-chip">${v.days}</span>
        </div>
        <div class="plan-price">${v.price} <small>起</small></div>
        <div class="plan-reason">
          <div class="plan-reason-label">💬 為什麼推薦？</div>
          ${v.reason}
        </div>
        <button class="plan-choose" type="button">選擇這個方案 →</button>
      </article>`;
  }).join("");
}

async function recommend() {
  setBusy(true);
  setStatus("正在從去趣方案庫篩選並生成推薦…");
  noticeEl.classList.add("hidden");
  try {
    const resp = await fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        destination: state.destination,
        days: state.days,
        usage: state.usage,
        budget: state.budget,
        unlimited: state.unlimited,
        hotspot: state.hotspot,
      }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${resp.status}`);
    }
    const data = await resp.json();
    if (data.notice) {
      noticeEl.textContent = `💡 ${data.notice}`;
      noticeEl.classList.remove("hidden");
    }
    renderCards(data.plans);
    const msg = data.plans.length
      ? `從 ${data.candidates_count} 個候選中為你挑了 ${data.plans.length} 個推薦。有疑問可以在下方繼續聊聊。`
      : (data.candidates_count === 0
          ? "找不到符合條件的方案，試著放寬預算或切換吃到飽偏好。"
          : "有候選方案但 AI 沒選出推薦，可調整條件再試。");
    setStatus(msg);

    const prefs = [state.unlimited && "吃到飽", state.hotspot && "熱點分享"].filter(Boolean).join("、") || "無特殊偏好";
    const userMsg = `我要去${state.destination} ${state.days} 天，${USAGE_LABEL[state.usage]}，預算 ${state.budget === 0 ? "不限" : "NT$" + state.budget}，${prefs}。`;
    const asMsg = data.plans.length
      ? "依你的條件，我為你挑了這些方案：\n" + data.plans.map((p, i) => `${i + 1}. ${p.name}｜${p.price}｜${p.data}｜${p.reason}`).join("\n")
      : "這些條件目前沒有合適方案。";
    history = [{ role: "user", content: userMsg }, { role: "assistant", content: asMsg }];
  } catch (err) {
    cardsEl.innerHTML = `<div class="empty-card">⚠️ ${escapeHtml(err.message || "推薦生成失敗。")}</div>`;
    setStatus("推薦失敗，請確認 Ollama 服務與資料檔。");
  } finally {
    setBusy(false);
  }
}

el("trip-form").addEventListener("submit", (e) => {
  e.preventDefault();
  if (busy) return;
  if (!(state.days >= 1 && state.days <= 60)) { setStatus("天數必須介於 1~60 天。"); return; }
  if (state.budget < 0) { setStatus("請填寫有效的預算；0 表示不限。"); return; }
  recommend();
});

/* ───── Chat (follow-up) ───── */
function renderChat(partial = null) {
  const items = history.map(m => `<div class="msg ${m.role}">${escapeHtml(m.content)}</div>`);
  if (partial !== null) {
    items.push(`<div class="msg assistant">${escapeHtml(partial) || "…"}</div>`);
  }
  chatWindow.innerHTML = items.join("");
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

async function streamReply(text) {
  history.push({ role: "user", content: text });
  renderChat("");
  setBusy(true);
  let assistant = "";
  try {
    const resp = await fetch("/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
    });
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop();
      for (const chunk of parts) {
        const line = chunk.split("\n").find(l => l.startsWith("data: "));
        if (!line) continue;
        const data = JSON.parse(line.slice(6));
        if (data.error) throw new Error(data.error);
        if (data.token) {
          assistant += data.token;
          renderChat(assistant);
        }
      }
    }
    if (!assistant.trim()) throw new Error("模型沒有回覆。");
    history.push({ role: "assistant", content: assistant });
    renderChat();
  } catch (err) {
    history.push({ role: "assistant", content: `⚠️ ${err.message || "回覆失敗。"}` });
    renderChat();
  } finally {
    setBusy(false);
  }
}

msgForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = msgInput.value.trim();
  if (!text || busy) return;
  msgInput.value = "";
  streamReply(text);
});
msgInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); msgForm.requestSubmit(); }
});
clearBtn.addEventListener("click", () => {
  if (busy) return;
  history = [];
  renderChat();
});

cardsEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".plan-choose");
  if (!btn) return;
  const card = btn.closest(".plan-card");
  const name = card.querySelector("h3")?.textContent || "";
  alert(`已選擇：${name}\n（示範動作；之後可以接去趣購買流程）`);
});

updateSummary();
