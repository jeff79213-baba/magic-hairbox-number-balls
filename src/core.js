export const TOTAL = 150;

export function todayStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function createState() {
  return {
    maxOrdered: 0,
    current: null,
    overdue: [],
    cut: [],
    minutes: 15,
    t0: "09:00",
    date: todayStr(),
    history: [],
  };
}

const clone = (o) => JSON.parse(JSON.stringify(o));

export function apply(state, mutator) {
  const s = clone(state);
  const history = Array.from(state.history);
  delete s.history;
  const before = clone(s); // 存入 mutation 前的快照，undo 才能還原
  mutator(s);
  history.push(before);
  if (history.length > 100) history.shift();
  return { ...s, history };
}

export function undo(state) {
  if (!state.history.length) return state;
  const history = Array.from(state.history);
  const prev = history.pop(); // 取上一筆
  if (!prev) return state;
  return { ...clone(state), ...prev, history };
}

function cutPush(s, n) {
  if (!s.cut.includes(n)) s.cut.push(n);
  s.cut.sort((a, b) => a - b);
}

export function ballStatus(state, n) {
  if (state.cut.includes(n)) return "cut";
  if (state.current === n) return "orange";
  if (state.overdue.includes(n)) return "overdue";
  if (n <= state.maxOrdered) return "blue";
  return "gray";
}

export function orderUpTo(state, n) {
  if (n < 1 || n > TOTAL) return state;
  return apply(state, (s) => {
    if (n > s.maxOrdered) s.maxOrdered = n;
  });
}

export function setCurrent(state, n, nowHHMM = null) {
  const st = ballStatus(state, n);
  if (st === "gray" || st === "cut") return state;
  return apply(state, (s) => {
    if (s.current !== null && s.current !== n) cutPush(s, s.current);
    s.current = n;
    const oi = s.overdue.indexOf(n);
    if (oi >= 0) s.overdue.splice(oi, 1);
    if (n > s.maxOrdered) s.maxOrdered = n;
    if (nowHHMM) s.t0 = nowHHMM;
  });
}

export function batchCut(state, n) {
  if (n < 1 || n > TOTAL) return state;
  return apply(state, (s) => {
    for (let i = 1; i < n; i++) {
      if (i === s.current) continue;
      if (s.overdue.includes(i)) continue;
      if (i > s.maxOrdered) continue;
      cutPush(s, i);
    }
  });
}

export function toggleOverdue(state, n) {
  const st = ballStatus(state, n);
  if (st === "gray" || st === "cut" || st === "orange") return state;
  return apply(state, (s) => {
    const i = s.overdue.indexOf(n);
    if (i >= 0) s.overdue.splice(i, 1);
    else {
      s.overdue.push(n);
      s.overdue.sort((a, b) => a - b);
    }
  });
}

export function cutOverdue(state, n) {
  if (!state.overdue.includes(n)) return state;
  return apply(state, (s) => {
    s.overdue = s.overdue.filter((x) => x !== n);
    cutPush(s, n);
  });
}

export function setMinutes(state, m) {
  const v = Math.max(1, Math.min(240, Math.round(m) || 15));
  return apply(state, (s) => {
    s.minutes = v;
  });
}