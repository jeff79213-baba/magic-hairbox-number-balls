import {
  createState, todayStr, rollover, ballStatus,
  queuePositions, estimate, formatAccum, pruneDaily,
  orderUpTo, setCurrent, batchCut, toggleOverdue, cutOverdue,
  setMinutes, setBaseTime, undo, resetAll,
} from "./core.js";

const TOTAL = 150;
const $ = (id) => document.getElementById(id);

const grid = $("grid");
const clockEl = $("clock");
const recordKey = "mhb-daily";

function loadState() {
  try {
    const raw = localStorage.getItem("mhb-state");
    if (!raw) return createState();
    const s = JSON.parse(raw);
    const base = createState();
    s.history = Array.isArray(s.history) ? s.history : [];
    return Object.assign(base, s);
  } catch (e) {
    return createState();
  }
}

function saveState(s) {
  try { localStorage.setItem("mhb-state", JSON.stringify(s)); } catch (e) { /* storage 寫入失敗：忽略 */ }
}

function loadDaily() {
  try { return JSON.parse(localStorage.getItem(recordKey)) || {}; }
  catch (e) { return {}; }
}

function saveDaily(d) {
  try { localStorage.setItem(recordKey, JSON.stringify(d)); } catch (e) { /* storage 寫入失敗：忽略 */ }
}

let state = loadState();
let daily = loadDaily();
pruneDaily(daily, todayStr());
saveDaily(daily);

function performRollover() {
  const today = todayStr();
  if (state.date === today) return;
  const r = rollover(state, today);
  Object.assign(daily, r.daily);
  pruneDaily(daily, today);
  saveDaily(daily);
  state = r.state;
  saveState(state);
  renderAll();
}

function makeBallEl(n) {
  const el = document.createElement("div");
  el.className = "ball";
  el.dataset.n = n;
  const num = document.createElement("div");
  num.className = "num";
  num.textContent = n;
  const accum = document.createElement("div");
  accum.className = "accum";
  const when = document.createElement("div");
  when.className = "when";
  el.append(num, accum, when);
  return el;
}

const balls = [];
for (let i = 1; i <= TOTAL; i++) {
  const el = makeBallEl(i);
  balls.push(el);
  grid.appendChild(el);
}

function renderAll() {
  const seq = queuePositions(state);
  const seqSet = new Set(seq);
  for (let i = 0; i < TOTAL; i++) {
    const n = i + 1;
    const el = balls[i];
    const st = ballStatus(state, n);
    el.dataset.st = st;
    const accumEl = el.querySelector(".accum");
    const whenEl = el.querySelector(".when");
    if (seqSet.has(n)) {
      const e = estimate(state, n);
      accumEl.textContent = "+" + formatAccum(e.accumMin);
      whenEl.textContent = e.time;
    } else {
      accumEl.textContent = "";
      whenEl.textContent = "";
    }
  }
}

const overdueModeBtn = $("overdueMode");
const minutesInput = $("minutesInput");
const quickBtns = $("quickBtns");
const btnRecords = $("btnRecords");
const btnReset = $("btnReset");
const btnUndo = $("btnUndo");
const btnFullscreen = $("btnFullscreen");
const dlgTime = $("dlgTime");
const dlgRecords = $("dlgRecords");
const dlgConfirm = $("dlgConfirm");
const baseTimeInput = $("baseTimeInput");
const recordList = $("recordList");

let overdueMode = false;
let gestureStart = null;

function refreshTop() {
  overdueModeBtn.classList.toggle("active", overdueMode);
  minutesInput.value = state.minutes;
}

function commit(next) {
  if (next) state = next;
  saveState(state);
  renderAll();
  refreshTop();
}

// --- 球上手勢 ---
function handleBallAction(n, dir) {
  if (dir === "down") { openTimeDialog(); return; }
  const st = ballStatus(state, n);
  if (overdueMode) {
    if (dir === "tap") { commit(toggleOverdue(state, n)); }
    else if (dir === "up") { commit(setCurrent(state, n, nowHHMM())); }
    else commit(dir === "left" ? batchCut(state, n) : orderUpTo(state, n));
    return;
  }
  if (dir === "up") commit(setCurrent(state, n, nowHHMM()));
  else if (dir === "left") commit(batchCut(state, n));
  else {
    if (st === "overdue") commit(cutOverdue(state, n));
    else commit(orderUpTo(state, n));
  }
}

grid.addEventListener("pointerdown", (e) => {
  const ball = e.target.closest(".ball");
  if (!ball) return;
  gestureStart = { x: e.clientX, y: e.clientY, n: +ball.dataset.n, id: e.pointerId };
  e.currentTarget.setPointerCapture?.(e.pointerId);
});
grid.addEventListener("pointermove", (e) => {
  if (!gestureStart || e.pointerId !== gestureStart.id) return;
  const dx = e.clientX - gestureStart.x;
  const dy = e.clientY - gestureStart.y;
  if (Math.abs(dx) > 30 || Math.abs(dy) > 30) {
    gestureStart.done = true;
    if (Math.abs(dy) > Math.abs(dx)) {
      handleBallAction(gestureStart.n, dy < 0 ? "up" : "down");
    } else {
      handleBallAction(gestureStart.n, dx > 0 ? "right" : "left");
    }
  }
});
grid.addEventListener("pointerup", (e) => {
  if (!gestureStart || e.pointerId !== gestureStart.id) return;
  const g = gestureStart;
  gestureStart = null;
  if (g.done) return;
  const dx = e.clientX - g.x;
  const dy = e.clientY - g.y;
  if (Math.hypot(dx, dy) < 30) handleBallAction(g.n, "tap");
});
grid.addEventListener("pointercancel", () => { gestureStart = null; });
grid.addEventListener("dblclick", (e) => e.preventDefault());
document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("touchmove", (e) => {
  if (e.target.closest && e.target.closest(".ball")) e.preventDefault();
}, { passive: false });

// --- 控制列 ---
minutesInput.addEventListener("change", () => {
  const m = parseInt(minutesInput.value, 10);
  commit(setMinutes(state, m));
});
overdueModeBtn.addEventListener("click", () => {
  overdueMode = !overdueMode;
  refreshTop();
});
btnUndo.addEventListener("click", () => { commit(undo(state)); });

quickBtns.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-n]");
  if (!btn) return;
  const n = +btn.dataset.n;
  scrollToBall(n);
});

function scrollToBall(n) {
  const idx = n - 1;
  const el = balls[idx];
  if (!el) return;
  const area = $("gridArea");
  const top = Math.max(0, el.getBoundingClientRect().top - area.getBoundingClientRect().top + area.scrollTop - 8);
  area.scrollTo({ top, behavior: "smooth" });
}

// --- 基準時間彈窗 ---
function openTimeDialog() {
  baseTimeInput.value = nowHHMM();
  dlgTime.classList.remove("hidden");
}
$("btnTimeCancel").addEventListener("click", () => dlgTime.classList.add("hidden"));
$("btnTimeOk").addEventListener("click", () => {
  const val = baseTimeInput.value || state.t0;
  if (!/^\d{2}:\d{2}$/.test(val)) return;
  commit(setBaseTime(state, val));
  dlgTime.classList.add("hidden");
});

// --- 每日紀錄 ---
btnRecords.addEventListener("click", () => {
  recordList.replaceChildren();
  const keys = Object.keys(daily).sort().reverse();
  if (!keys.length) {
    const li = document.createElement("li");
    li.textContent = "尚無紀錄";
    recordList.appendChild(li);
  } else {
    for (const k of keys) {
      const li = document.createElement("li");
      const d = document.createElement("span");
      d.textContent = k;
      const c = document.createElement("span");
      c.textContent = `${daily[k]} 顆`;
      li.append(d, c);
      recordList.appendChild(li);
    }
  }
  dlgRecords.classList.remove("hidden");
});
$("btnRecordsClose").addEventListener("click", () => dlgRecords.classList.add("hidden"));

// --- 每日重置（寫入當日紀錄後歸零）---
btnReset.addEventListener("click", () => dlgConfirm.classList.remove("hidden"));
$("btnConfirmNo").addEventListener("click", () => dlgConfirm.classList.add("hidden"));
$("btnConfirmYes").addEventListener("click", () => {
  if (state.maxOrdered > 0 && state.date === todayStr()) {
    daily[state.date] = Math.max(daily[state.date] || 0, state.maxOrdered);
  }
  pruneDaily(daily, todayStr());
  saveDaily(daily);
  commit(resetAll(state));
  dlgConfirm.classList.add("hidden");
});

// --- 全螢幕 ---
if (document.documentElement.requestFullscreen && document.fullscreenEnabled !== false) {
  btnFullscreen.addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch (err) { /* 忽略 */ }
  });
} else {
  btnFullscreen.classList.add("hidden");
}

refreshTop();

function updateClock() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  clockEl.textContent = `${hh}:${mm}:${ss}`;
  performRollover();
}

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const BASE = 60_000;
setInterval(updateClock, 1000);
setInterval(renderAll, BASE);

(function init() {
  performRollover();
  updateClock();
  renderAll();
})();

export { renderAll, state, daily, nowHHMM };