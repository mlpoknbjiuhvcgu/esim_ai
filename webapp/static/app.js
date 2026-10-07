const FIELDS = ["name", "price", "data", "days", "reason"];
const DESTS = ["日本", "韓國", "泰國", "歐洲", "美國", "中國", "東南亞"];

const chatWindow = document.getElementById("chat-window");
const msgInput = document.getElementById("msg-input");
const sendBtn = document.getElementById("send-btn");
const clearBtn = document.getElementById("clear-btn");
const submitBtn = document.getElementById("submit-btn");
const statusEl = document.getElementById("status");
const cardsEl = document.getElementById("cards");
const tripForm = document.getElementById("trip-form");
const msgForm = document.getElementById("msg-form");

let history = [];
let busy = false;

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function renderCards(plans) {
  if (!plans || !plans.length) {
    cardsEl.innerHTML = `<div class="empty-card">填寫旅程需求，讓我們幫你找到適合的上網方式。</div>`;
    return;
  }
  cardsEl.innerHTML = plans.slice(0, 3).map((p, i) => {
    const v = Object.fromEntries(FIELDS.map(k => [k, escapeHtml(p[k] || "待確認")]));
    return `
      <article class="plan-card">
        <div class="plan-tag">方案 ${String(i + 1).padStart(2, "0")} · AI 建議</div>
        <h3>${v.name}</h3>
        <div class="plan-price">${v.price}</div>
        <div class="plan-meta">
          <div><small>流量</small>${v.data}</div>
          <div><small>有效天數</small>${v.days}</div>
        </div>
        <div class="plan-reason">${v.reason}</div>
        <div class="plan-note">價格與內容未經即時查證，購買前請向業者確認。</div>
      </article>`;
  }).join("");
}

function renderChat(assistantPartial = null) {
  const items = history.map(m => `<div class="msg ${m.role}">${escapeHtml(m.content)}</div>`);
  if (assistantPartial !== null) {
    items.push(`<div class="msg assistant">${escapeHtml(assistantPartial) || "<span class='empty'>…</span>"}</div>`);
  }
  chatWindow.innerHTML = items.join("");
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function setBusy(v) {
  busy = v;
  for (const el of [sendBtn, clearBtn, submitBtn, msgInput, ...tripForm.elements]) {
    if (el) el.disabled = v;
  }
}

function setStatus(text) { statusEl.textContent = text; }

async function streamReply(userText) {
  history.push({ role: "user", content: userText });
  renderChat("");
  setBusy(true);
  setStatus("正在連接顧問，首次載入模型可能需要一些時間…");

  let assistant = "";
  try {
    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
          setStatus("正在回覆…");
        }
        if (data.done) {
          if (data.reason === "length") assistant += "\n\n（本次回答已達長度上限，可輸入「請繼續」。）";
        }
      }
    }

    if (!assistant.trim()) throw new Error("模型沒有回覆。");
    history.push({ role: "assistant", content: assistant });
    renderChat();

    setStatus("回答完成，正在整理方案卡片…");
    try {
      const extractResp = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: assistant }),
      });
      if (!extractResp.ok) throw new Error();
      const { plans } = await extractResp.json();
      renderCards(plans);
      setStatus(plans.length ? "推薦已更新，可繼續追問。" : "回答完成，可繼續追問或補充條件。");
    } catch {
      cardsEl.innerHTML = `<div class="empty-card">卡片暫時無法整理，完整建議仍保留在上方對話中。</div>`;
      setStatus("回答已完成；卡片整理失敗。");
    }
  } catch (err) {
    history.push({ role: "assistant", content: `⚠️ ${err.message || "生成發生錯誤。"}` });
    renderChat();
    setStatus("本次推薦未完成，請重新送出。");
  } finally {
    setBusy(false);
  }
}

msgForm.addEventListener("submit", e => {
  e.preventDefault();
  const text = msgInput.value.trim();
  if (!text || busy) return;
  msgInput.value = "";
  streamReply(text);
});

msgInput.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    msgForm.requestSubmit();
  }
});

tripForm.addEventListener("submit", e => {
  e.preventDefault();
  if (busy) return;
  const data = new FormData(tripForm);
  const destination = data.get("destination");
  const days = Number(data.get("days"));
  const usage = data.get("usage");
  const budget = Number(data.get("budget"));
  const unlimited = data.get("unlimited") === "on";
  if (!DESTS.includes(destination) || !["輕度", "中度", "重度"].includes(usage)) {
    setStatus("請選擇目的地與每日用量。");
    return;
  }
  if (!(days >= 1 && days <= 30)) { setStatus("天數必須介於 1～30 天。"); return; }
  if (!(budget >= 0)) { setStatus("請填寫有效的預算；0 表示不限預算。"); return; }

  const budgetText = budget === 0 ? "不限預算" : `總預算新臺幣 NT$${budget.toLocaleString()}`;
  const preference = unlimited ? "需要吃到飽方案" : "不限定吃到飽，可比較總量或每日流量方案";
  const prompt = `我要去${destination} ${days} 天，每日${usage}使用，${budgetText}，${preference}，` +
    `請推薦適合的 eSIM，列出方案名稱、價格、流量、天數與推薦理由。`;
  streamReply(prompt);
});

clearBtn.addEventListener("click", () => {
  if (busy) return;
  history = [];
  renderChat();
  renderCards(null);
  setStatus("準備好了，從你的下一趟旅程開始。");
});

renderCards(null);
