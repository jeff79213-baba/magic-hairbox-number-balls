import {
  createState, todayStr, rollover, ballStatus,
  queuePositions, estimate, formatAccum, pruneDaily,
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
  localStorage.setItem("mhb-state", JSON.stringify(s));
}

function loadDaily() {
  try { return JSON.parse(localStorage.getItem(recordKey)) || {}; }
  catch (e) { return {}; }
}

function saveDaily(d) {
  localStorage.setItem(recordKey, JSON.stringify(d));
}

let state = loadState();
let daily = loadDaily();
pruneDaily(daily, todayStr());
saveDaily(daily);

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
  const seqSet = new Set(queuePositions(state));
  const seq = queuePositions(state);
  const idxMap = new Map(seq.map((n, i) => [n, i]));
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
    void idxMap;
  }
}

function updateClock() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  clockEl.textContent = `${hh}:${mm}:${ss}`;
}

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const BASE = 60_000;
setInterval(updateClock, 1000);
setInterval(renderAll, BASE);

(function init() {
  const r = rollover(state, todayStr());
  if (Object.keys(r.daily).length) {
    Object.assign(daily, r.daily);
    pruneDaily(daily, todayStr());
    saveDaily(daily);
  }
  state = r.state;
  saveState(state);
  updateClock();
  renderAll();
})();

export { renderAll, state, daily, nowHHMM };