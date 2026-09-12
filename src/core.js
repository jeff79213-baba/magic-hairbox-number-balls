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
    scheduled: [],
    grayOut: [],
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
  if (JSON.stringify(before) === JSON.stringify(s)) return state; // mutation 無實際變更（no-op），不推入 history
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
  if (state.grayOut.includes(n)) return "gray";
  if (n <= state.maxOrdered) return "blue";
  return "gray";
}

export function orderUpTo(state, n) {
  if (n < 1 || n > TOTAL) return state;
  if (state.cut.includes(n)) return state;
  return apply(state, (s) => {
    if (n > s.maxOrdered) s.maxOrdered = n;
    const gi = s.grayOut.indexOf(n);
    if (gi >= 0) s.grayOut.splice(gi, 1);
  });
}

export function setCurrent(state, n, nowHHMM = null) {
  const st = ballStatus(state, n);
  if (st === "gray" || st === "cut") return state;
  if (state.current === n) return state; // 已叫號的目前球：no-op，不重錨 t0、不推 history
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
      if (s.scheduled.some((o) => o.n === i)) continue;
      if (s.grayOut.includes(i)) continue;
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

export function resetAll(state) {
  return apply(state, (s) => {
    s.maxOrdered = 0;
    s.current = null;
    s.overdue = [];
    s.cut = [];
    s.scheduled = [];
    s.grayOut = [];
  });
}

export function queuePositions(state) {
  const seq = [];
  for (let i = 1; i <= state.maxOrdered; i++) {
    if (i === state.current) continue;
    if (state.cut.includes(i)) continue;
    if (state.overdue.includes(i)) continue;
    if (state.grayOut.includes(i)) continue;
    seq.push(i);
  }
  const overdue = state.overdue
    .filter((o) => o <= state.maxOrdered && !state.cut.includes(o) && !state.grayOut.includes(o))
    .sort((a, b) => a - b);
  return state.current !== null ? [state.current, ...seq, ...overdue] : [...seq, ...overdue];
}

function minOfDay(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function fmtTime(min) {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatAccum(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 1) return `${m}分`;
  if (m === 0) return `${h}小時`;
  return `${h}小時${m}分`;
}

export function estimate(state, n) {
  const pos = queuePositions(state).indexOf(n);
  if (pos === -1) return null;
  const accumMin = (pos + 1) * state.minutes;
  const sched = state.scheduled.find((o) => o.n === n);
  return { accumMin, time: sched ? sched.time : fmtTime(minOfDay(state.t0) + accumMin) };
}

export function recordDaily(daily, date, maxOrdered) {
  if (maxOrdered > 0) daily[date] = Math.max(daily[date] || 0, maxOrdered);
  return daily;
}

export function pruneDaily(daily, today) {
  const d = new Date(today + "T00:00:00");
  d.setDate(d.getDate() - 90);
  const cutoff = todayStr(d);
  for (const k of Object.keys(daily)) {
    if (k <= cutoff) delete daily[k];
  }
}

export function rollover(state, today) {
  const daily = {};
  if (state.date !== today) {
    recordDaily(daily, state.date, state.maxOrdered);
    const base = clone(state);
    delete base.history;
    return {
      daily,
      state: {
        ...base,
        maxOrdered: 0,
        current: null,
        overdue: [],
        cut: [],
        scheduled: [],
        grayOut: [],
        date: today,
        history: [],
      },
    };
  }
  return { daily, state };
}

export function resetDay(state) {
  return apply(state, (s) => {
    s.maxOrdered = 0;
    s.current = null;
    s.overdue = [];
    s.cut = [];
    s.scheduled = [];
    s.grayOut = [];
    s.date = todayStr();
  });
}

export function setScheduled(state, n, hhmm) {
  if (n < 1 || n > TOTAL || !/^\d{2}:\d{2}$/.test(hhmm)) return state;
  const st = ballStatus(state, n);
  if (st === "gray" || st === "cut" || st === "orange") return state;
  return apply(state, (s) => {
    s.scheduled = s.scheduled.filter((o) => o.n !== n);
    s.scheduled.push({ n, time: hhmm });
    s.scheduled.sort((a, b) => a.n - b.n);
  });
}

export function cutBall(state, n) {
  if (n < 1 || n > TOTAL) return state;
  return apply(state, (s) => {
    if (s.current === n) s.current = null;
    s.overdue = s.overdue.filter((x) => x !== n);
    s.scheduled = s.scheduled.filter((o) => o.n !== n);
    const gi = s.grayOut.indexOf(n);
    if (gi >= 0) s.grayOut.splice(gi, 1);
    cutPush(s, n);
  });
}

export function revertToGray(state, n) {
  if (n < 1 || n > TOTAL) return state;
  const st = ballStatus(state, n);
  if (st === "gray" || st === "orange") return state;
  return apply(state, (s) => {
    s.overdue = s.overdue.filter((x) => x !== n);
    s.scheduled = s.scheduled.filter((o) => o.n !== n);
    const ci = s.cut.indexOf(n);
    if (ci >= 0) s.cut.splice(ci, 1);
    if (!s.grayOut.includes(n)) s.grayOut.push(n);
    s.grayOut.sort((a, b) => a - b);
  });
}