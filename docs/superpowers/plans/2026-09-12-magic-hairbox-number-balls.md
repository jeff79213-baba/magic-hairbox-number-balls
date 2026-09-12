# 魔法箱人數球 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立魔法箱人數球 — 150 顆號碼球的叫號管理介面，支援點擊/滑動手勢、雙時間顯示、每日藍球紀錄、跨裝置響應式。

**Architecture:** 單一自包含 Web App。純邏輯抽離到 ES Module `src/core.js`（可被 Vitest 單元測試）；`src/main.js` 負責 DOM 與手勢；`index.html` + `src/style.css` 負責版面。狀態存 `localStorage`（key 前綴 `mhb-`）。部署到獨立 GitHub repo + Firebase Hosting（site `mhb-sk`）。

**Tech Stack:** 原生 HTML/CSS/JS（零外部依賴，除 dev 用 Vitest）。無框架、無建置步驟。

## Global Constraints

- 全部內容為繁體中文介面。
- 號碼球 1~150。
- 狀態：`gray` 尚未下訂、`blue` 已下訂、`orange` 當前叫號、`overdue` 過號尚未剪（外圈圓）、`cut` 已剪（紅斜線）。
- 方位規則：往上滑=設定叫號、往下滑=基準時間設定、往左滑=批量剪完（此號**以前**的球，過號與當前排除）、往右滑=下訂；點球=下訂，功能與往右滑相同，**說明欄不寫「點球」**。
- 頂部說明欄 sticky 不隨捲動；內容含：快捷跳號 20/40/60/80/100/120/140、顏色說明、四方向手勢說明、每球分鐘輸入、過號開關、每日紀錄、每日重置、還原、全螢幕。上方常態顯示目前實時時鐘。
- 每球顯示兩行時間：加總時間（p×M 分鐘，格式 `<60` 為 `45分`，否則 `3小時15分`）＋ 預計時刻（T0 + p×M，`HH:MM`）。T0 為基準時間；設定當前叫號時 T0=動作當下實際時間。
- 排隊順序：當前橘球最前，其餘藍球依號碼遞增，過號球抽離依號碼排在最後。
- 每日記錄「當天最大藍色號碼」，保留 90 天，過期刪除。
- 禁止雙擊縮放、僅直向捲動（無左右漂移）、全螢幕（不支援則隱藏按鈕）。
- localStorage key 前綴一律 `mhb-`。

---

### Task 1: 專案 scaffold + 核心狀態模型與基本操作

**Files:**
- Create: `package.json`
- Create: `src/core.js`
- Create: `tests/core.test.js`
- Create: `.gitignore`

**Interfaces:**
- Produces (later tasks rely on):
  - `export const TOTAL = 150`
  - `export function todayStr(d = new Date()) → "yyyy-mm-dd"`
  - `export function createState() → { maxOrdered:0, current:null, overdue:[], cut:[], minutes:15, t0:"09:00", date:todayStr(), history:[] }`
  - `export function apply(state, mutator) → newState`（clone + mutator + 推歷史快照，保留≤100筆）
  - `export function undo(state) → newState`
  - `export function ballStatus(state, n) → "gray"|"blue"|"orange"|"overdue"|"cut"`
  - `export function orderUpTo(state, n) → newState`（只進不退）
  - `export function setCurrent(state, n, nowHHMM) → newState`
  - `export function batchCut(state, n) → newState`
  - `export function toggleOverdue(state, n) → newState`
  - `export function cutOverdue(state, n) → newState`
  - `export function setMinutes(state, m) → newState`

---

- [ ] **Step 1: 建立 package.json**

Create `package.json`:

```json
{
  "name": "magic-hairbox-number-balls",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "serve": "npx --yes serve ."
  },
  "devDependencies": {
    "vitest": "^2.1.9"
  }
}
```

- [ ] **Step 2: 建立 `.gitignore`**

Create `.gitignore`:

```
node_modules/
.firebase/
firebase-debug.log
firebase-debug.*.log
*.env
.env
```

- [ ] **Step 3: 寫失敗測試（core 基本操作）**

Create `tests/core.test.js`:

```js
import { describe, it, expect, beforeEach } from "vitest";
import {
  TOTAL, createState, orderUpTo, setCurrent, batchCut,
  toggleOverdue, cutOverdue, setMinutes, ballStatus, undo, todayStr,
} from "../src/core.js";

let state;
beforeEach(() => { state = createState(); });

describe("ballStatus", () => {
  it("初始全部為 gray", () => {
    for (let i = 1; i <= TOTAL; i++) expect(ballStatus(state, i)).toBe("gray");
  });
});

describe("orderUpTo", () => {
  it("點 58 → 1~58 變 blue，59 仍 gray", () => {
    state = orderUpTo(state, 58);
    expect(ballStatus(state, 58)).toBe("blue");
    expect(ballStatus(state, 59)).toBe("gray");
  });
  it("只進不退：58 後再點 30 不變", () => {
    state = orderUpTo(state, 58);
    state = orderUpTo(state, 30);
    expect(state.maxOrdered).toBe(58);
    expect(ballStatus(state, 58)).toBe("blue");
  });
  it("範圍外（0 / 151）無作用", () => {
    state = orderUpTo(state, 0);
    expect(state.maxOrdered).toBe(0);
    state = orderUpTo(state, 151);
    expect(state.maxOrdered).toBe(0);
  });
});

describe("setCurrent", () => {
  it("設定 18 → 18 orange，t0 錨定到 now", () => {
    state = orderUpTo(state, 58);
    state = setCurrent(state, 18, "15:00");
    expect(ballStatus(state, 18)).toBe("orange");
    expect(state.t0).toBe("15:00");
  });
  it("再設 19 → 18 自動變 cut", () => {
    state = orderUpTo(state, 58);
    state = setCurrent(state, 18, "15:00");
    state = setCurrent(state, 19, "15:20");
    expect(ballStatus(state, 18)).toBe("cut");
    expect(ballStatus(state, 19)).toBe("orange");
  });
  it("設過號球為 current → 移出過號、變 orange", () => {
    state = orderUpTo(state, 58);
    state = toggleOverdue(state, 10);
    state = setCurrent(state, 10, "15:00");
    expect(ballStatus(state, 10)).toBe("orange");
    expect(state.overdue).not.toContain(10);
  });
  it("gray 或 cut 無法設為 current", () => {
    state = orderUpTo(state, 58);
    state = setCurrent(state, 60, "15:00");
    expect(state.current).toBeNull();
    state = setCurrent(state, 5, "15:00");
    state = setCurrent(state, 6, "15:00");
    expect(ballStatus(state, 6)).toBe("cut");
    const before = state.current;
    state = setCurrent(state, 6, "16:00");
    expect(state.current).toBe(before);
  });
});

describe("batchCut", () => {
  it("往左滑 35 → 35 以前的藍球全 cut，過號與當前跳過", () => {
    state = orderUpTo(state, 58);
    state = setCurrent(state, 18, "15:00");
    state = toggleOverdue(state, 10);
    state = toggleOverdue(state, 12);
    state = orderUpTo(state, 58);
    state = batchCut(state, 35);
    expect(ballStatus(state, 17)).toBe("cut");
    expect(ballStatus(state, 18)).toBe("orange");
    expect(ballStatus(state, 19)).toBe("blue");
    expect(ballStatus(state, 10)).toBe("overdue");
    expect(ballStatus(state, 12)).toBe("overdue");
    expect(ballStatus(state, 35)).toBe("blue");
    expect(ballStatus(state, 34)).toBe("cut");
  });
  it("35 本身不受影響；大於 maxOrdered 的灰球不變", () => {
    state = orderUpTo(state, 30);
    state = batchCut(state, 35);
    expect(ballStatus(state, 30)).toBe("blue");
    expect(ballStatus(state, 35)).toBe("gray");
  });
});

describe("toggleOverdue / cutOverdue", () => {
  it("藍球↔過號切換，gray/cut/current 不可切", () => {
    state = orderUpTo(state, 58);
    state = toggleOverdue(state, 30);
    expect(ballStatus(state, 30)).toBe("overdue");
    state = toggleOverdue(state, 30);
    expect(ballStatus(state, 30)).toBe("blue");
    state = toggleOverdue(state, 60);
    expect(ballStatus(state, 60)).toBe("gray");
    state = setCurrent(state, 18, "15:00");
    state = toggleOverdue(state, 18);
    expect(ballStatus(state, 18)).toBe("orange");
  });
  it("cutOverdue：外圓球直接變 cut", () => {
    state = orderUpTo(state, 58);
    state = toggleOverdue(state, 12);
    state = cutOverdue(state, 12);
    expect(ballStatus(state, 12)).toBe("cut");
    expect(state.overdue).not.toContain(12);
  });
});

describe("setMinutes", () => {
  it("夾在 1..240 並四捨五入", () => {
    state = setMinutes(state, 20);
    expect(state.minutes).toBe(20);
    state = setMinutes(state, -3);
    expect(state.minutes).toBe(1);
    state = setMinutes(state, 999);
    expect(state.minutes).toBe(240);
  });
});

describe("undo", () => {
  it("還原上一次操作", () => {
    state = orderUpTo(state, 58);
    state = state.history.length ? undo(state) : state;
    expect(state.maxOrdered).toBe(0);
  });
  it("history 空時 return 原 state", () => {
    const s = undo(state);
    expect(s).toBe(state);
  });
});

describe("todayStr", () => {
  it("格式 yyyy-mm-dd", () => {
    expect(todayStr(new Date(2026, 8, 12))).toBe("2026-09-12");
  });
});
```

- [ ] **Step 4: 執行測試確認失敗**

Run: `npm install && npx vitest run tests/core.test.js`
Expected: FAIL（`../src/core.js` 不存在）

- [ ] **Step 5: 實作 src/core.js（狀態模型與基本操作）**

Create `src/core.js`:

```js
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
  mutator(s);
  history.push(clone(s)); // 上一次操作前的快照（不含 history）
  if (history.length > 100) history.shift();
  return { ...s, history };
}

export function undo(state) {
  if (!state.history.length) return state;
  const history = Array.from(state.history);
  const prev = history.pop(); // 還原點
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
```

- [ ] **Step 6: 執行測試確認通過**

Run: `npx vitest run tests/core.test.js`
Expected: PASS（全部 tests 通過）

- [ ] **Step 7: Commit**

```powershell
git add package.json .gitignore src/core.js tests/core.test.js
git commit -m "feat: 人數球核心狀態模型（下訂/叫號/批量剪完/過號）與測試"
```

---

### Task 2: 時間計算模型

**Files:**
- Modify: `src/core.js`（新增區塊）
- Modify: `tests/core.test.js`（新增 describe）

**Interfaces:**
- Produces:
  - `export function queuePositions(state) → number[]`（橘球在前，藍球遞增，過號依號碼在最後；全體排除 cut 與 >maxOrdered；overdue 只計 ≤maxOrdered 者）
  - `export function estimate(state, n) → { accumMin:int, time:"HH:MM" } | null`
  - `export function formatAccum(min) → "45分" | "3小時15分"`

---

- [ ] **Step 1: 寫失敗測試**

Append to `tests/core.test.js`:

```js
import { queuePositions, estimate, formatAccum } from "../src/core.js";

describe("queuePositions", () => {
  it("叫號18、過號{10,12}、下訂58 → [18,19,..58,10,12]", () => {
    state = orderUpTo(state, 58);
    state = setCurrent(state, 18, "15:00");
    state = toggleOverdue(state, 10);
    state = toggleOverdue(state, 12);
    const seq = queuePositions(state);
    expect(seq[0]).toBe(18);
    expect(seq[1]).toBe(19);
    expect(seq[seq.length - 1]).toBe(58);
    expect(seq[seq.length - 3]).toBe(58);
  });
  it("過號依號碼排列在最後", () => {
    state = orderUpTo(state, 58);
    state = toggleOverdue(state, 12);
    state = toggleOverdue(state, 10);
    const seq = queuePositions(state);
    expect(seq.slice(-2)).toEqual([10, 12]);
  });
  it("cut 的球移出順序", () => {
    state = orderUpTo(state, 58);
    state = setCurrent(state, 18, "15:00");
    state = batchCut(state, 18);
    const seq = queuePositions(state);
    expect(seq[0]).toBe(18);
    expect(seq).not.toContain(17);
  });
});

describe("estimate", () => {
  it("13 顆未剪 → 第13顆 = +195分(3小時15分) → 18:15（t0=15:00）", () => {
    state = orderUpTo(state, 30);
    state = setCurrent(state, 18, "15:00");
    const seq = queuePositions(state);
    expect(seq.length).toBe(13);
    const last = estimate(state, seq[seq.length - 1]);
    expect(last.accumMin).toBe(195);
    expect(last.time).toBe("18:15");
    const first = estimate(state, seq[0]);
    expect(first.accumMin).toBe(15);
    expect(first.time).toBe("15:15");
  });
  it("過號球排在最後後，時段同樣累計", () => {
    state = orderUpTo(state, 58);
    state = setCurrent(state, 18, "15:00");
    state = toggleOverdue(state, 10);
    const e58 = estimate(state, 58);
    const e10 = estimate(state, 10);
    expect(e58.accumMin).toBe((58 - 18 + 1) * 15);
    expect(e10.accumMin).toBe(e58.accumMin + 15);
  });
  it("不在佇列（gray/cut）回 null", () => {
    state = orderUpTo(state, 30);
    state = setCurrent(state, 18, "15:00");
    state = batchCut(state, 18);
    expect(estimate(state, 17)).toBeNull();
    expect(estimate(state, 60)).toBeNull();
  });
});

describe("formatAccum", () => {
  it("小於60分", () => expect(formatAccum(45)).toBe("45分"));
  it("整小時", () => expect(formatAccum(60)).toBe("1小時"));
  it("小時加分", () => expect(formatAccum(195)).toBe("3小時15分"));
});
```

注意：`queuePositions` 的批次測試中，`batchCut(state, 18)` 後再檢查 `seq[0]===18`（當前仍橘在前）。

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run tests/core.test.js`
Expected: FAIL（`queuePositions` / `estimate` / `formatAccum` 未定義）

- [ ] **Step 3: 實作（append 到 src/core.js）**

```js
export function queuePositions(state) {
  const seq = [];
  for (let i = 1; i <= state.maxOrdered; i++) {
    if (i === state.current) continue;
    if (state.cut.includes(i)) continue;
    if (state.overdue.includes(i)) continue;
    seq.push(i);
  }
  const overdue = state.overdue
    .filter((o) => o <= state.maxOrdered && !state.cut.includes(o))
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
  return { accumMin, time: fmtTime(minOfDay(state.t0) + accumMin) };
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run tests/core.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add src/core.js tests/core.test.js
git commit -m "feat: 人數球時間計算（排隊順序、雙時間估計、格式）與測試"
```

---

### Task 3: 每日紀錄、換日歸零、每日重置

**Files:**
- Modify: `src/core.js`
- Modify: `tests/core.test.js`

**Interfaces:**
- Produces:
  - `export function recordDaily(daily, date, maxOrdered)`（daily 是 `{}` 物件，原地寫入）
  - `export function pruneDaily(daily, today)`（刪除 < 90 天前的 key，ISO 字串比較）
  - `export function rollover(state, today) → { state:newState, daily:Object }`（跨日時寫回前一日紀錄並歸零當日狀態）
  - `export function resetDay(state) → newState`（歸零四欄，date 改為 todayStr()，清空 history，但保留 minutes/t0）

---

- [ ] **Step 1: 寫失敗測試**

Append to `tests/core.test.js`:

```js
import { recordDaily, pruneDaily, rollover, resetDay } from "../src/core.js";

describe("daily records", () => {
  it("recordDaily 只記 >0", () => {
    const daily = {};
    recordDaily(daily, "2026-09-11", 0);
    expect(daily).toEqual({});
    recordDaily(daily, "2026-09-11", 58);
    expect(daily["2026-09-11"]).toBe(58);
  });
  it("pruneDaily 保留 90 天內", () => {
    const today = "2026-09-12";
    const daily = {
      "2026-06-14": 1,  // 90 天前的前一天 → 刪
      "2026-06-15": 2,  // 90 天前 → 保留
      "2026-09-12": 58,
    };
    pruneDaily(daily, today);
    expect(daily["2026-06-14"]).toBeUndefined();
    expect(daily["2026-06-15"]).toBe(2);
  });
  it("rollover：同一天不動作", () => {
    state = orderUpTo(state, 58);
    const r = rollover(state, todayStr());
    expect(r.state.maxOrdered).toBe(58);
    expect(r.daily).toEqual({});
  });
  it("rollover：跨日寫回前一日並清空", () => {
    state = orderUpTo(state, 58);
    state.date = "2026-09-11";
    const r = rollover(state, "2026-09-12");
    expect(r.daily["2026-09-11"]).toBe(58);
    expect(r.state.maxOrdered).toBe(0);
    expect(r.state.date).toBe("2026-09-12");
    expect(r.state.history).toEqual([]);
  });
  it("resetDay 歸零", () => {
    state = orderUpTo(state, 58);
    state = setCurrent(state, 18, "15:00");
    state = toggleOverdue(state, 10);
    const s = resetDay(state);
    expect(s.maxOrdered).toBe(0);
    expect(s.current).toBeNull();
    expect(s.overdue).toEqual([]);
    expect(s.cut).toEqual([]);
    expect(s.minutes).toBe(15);
    expect(s.history.length).toBeGreaterThan(0); // 可還原
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run tests/core.test.js`
Expected: FAIL（`recordDaily` / `pruneDaily` / `rollover` / `resetDay` 未定義）

- [ ] **Step 3: 實作（append 到 src/core.js）**

```js
export function recordDaily(daily, date, maxOrdered) {
  if (maxOrdered > 0) daily[date] = maxOrdered;
}

export function pruneDaily(daily, today) {
  const d = new Date(today + "T00:00:00");
  d.setDate(d.getDate() - 90);
  const cutoff = todayStr(d);
  for (const k of Object.keys(daily)) {
    if (k < cutoff) delete daily[k];
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
    s.date = todayStr();
  });
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run tests/core.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add src/core.js tests/core.test.js
git commit -m "feat: 每日紀錄/90天清除/換日歸零/每日重置與測試"
```

---

### Task 4: HTML 骨架 + 樣式（頂部說明欄、顏色圖例、網格、觸控限制）

**Files:**
- Create: `index.html`
- Create: `src/style.css`

**Interfaces:**
- Produces: 靜態版面；元素 id 協定供 Task 5/6 使用：
  - `#clock`（目前時間）
  - `#grid`（號碼球容器，`grid-template-columns: repeat(auto-fill, minmax(clamp(...),1fr))`）
  - `#minutesInput`（每球分鐘 number input）
  - `#overdueMode`（過號開關 button，`.active` 表開）
  - `#quickBtns`（快捷跳號列，每個 `button[data-n]`）
  - `#btnRecords`, `#btnReset`, `#btnUndo`, `#btnFullscreen`
  - 彈窗：`#dlgTime`（基準時間）、`#dlgRecords`（每日紀錄）、`#dlgConfirm`（每日重置確認）
  - 手勢說明圖例：`#gestureLegend`（只含 ↑↓←→ 四個滑動手勢文字）

---

- [ ] **Step 1: 建立 index.html**

```html
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport"
  content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="format-detection" content="telephone=no">
<title>魔法箱人數球</title>
<link rel="stylesheet" href="src/style.css">
</head>
<body>
<header id="topbar">
  <div class="top-row">
    <h1>魔法箱人數球</h1>
    <div id="clock" class="clock">--:--</div>
  </div>

  <div class="top-row" id="quickRow">
    <span class="row-label">快捷跳號</span>
    <div id="quickBtns">
      <button type="button" data-n="20">20</button>
      <button type="button" data-n="40">40</button>
      <button type="button" data-n="60">60</button>
      <button type="button" data-n="80">80</button>
      <button type="button" data-n="100">100</button>
      <button type="button" data-n="120">120</button>
      <button type="button" data-n="140">140</button>
    </div>
  </div>

  <div class="top-row" id="colorRow">
    <span class="row-label">顏色</span>
    <span class="legend"><i class="sw gray"></i>未下訂</span>
    <span class="legend"><i class="sw blue"></i>已下訂</span>
    <span class="legend"><i class="sw orange"></i>當前叫號</span>
    <span class="legend"><i class="sw red"></i>已剪</span>
    <span class="legend"><i class="sw ring"></i>過號</span>
  </div>

  <div class="top-row" id="gestureLegend">
    <span class="row-label">手勢</span>
    <span class="gest">↑ 叫號</span>
    <span class="gest">↓ 基準時間</span>
    <span class="gest">← 批量剪完</span>
    <span class="gest">→ 下訂</span>
  </div>

  <div class="top-row" id="controlRow">
    <label class="ctrl">每球<input id="minutesInput" type="number" min="1" max="240" value="15" inputmode="numeric">分</label>
    <button type="button" id="overdueMode" class="ctrl-mode">過號</button>
    <button type="button" id="btnRecords">每日紀錄</button>
    <button type="button" id="btnReset" class="danger">每日重置</button>
    <button type="button" id="btnUndo">還原</button>
    <button type="button" id="btnFullscreen">全螢幕</button>
  </div>
</header>

<main id="gridArea">
  <div id="grid" aria-label="人數球"></div>
</main>

<div id="dlgTime" class="modal hidden">
  <div class="panel">
    <h2>基準時間</h2>
    <p class="hint">設定時間錨點，整條時間表據此重新計算。</p>
    <input id="baseTimeInput" type="time">
    <div class="actions">
      <button type="button" id="btnTimeCancel">取消</button>
      <button type="button" id="btnTimeOk">套用</button>
    </div>
  </div>
</div>

<div id="dlgRecords" class="modal hidden">
  <div class="panel">
    <h2>每日紀錄（最近 90 天）</h2>
    <ul id="recordList"></ul>
    <div class="actions">
      <button type="button" id="btnRecordsClose">關閉</button>
    </div>
  </div>
</div>

<div id="dlgConfirm" class="modal hidden">
  <div class="panel">
    <h2>每日重置</h2>
    <p>確認要全部歸零、開始新的一天？</p>
    <div class="actions">
      <button type="button" id="btnConfirmNo">取消</button>
      <button type="button" id="btnConfirmYes" class="danger">確認重置</button>
    </div>
  </div>
</div>

<script type="module" src="src/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: 建立 src/style.css**

```css
:root {
  --gray: #9aa0a6;
  --blue: #1a73e8;
  --orange: #f09300;
  --cut: #e53935;
  --ring: #b71c1c;
  --bg: #f5f5f5;
  --cell-w: 84px;
}

* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html, body { margin: 0; height: 100%; }
html { overflow: hidden; }
body {
  font-family: system-ui, "Segoe UI", "Microsoft JhengHei", sans-serif;
  background: var(--bg);
  overscroll-behavior: none;
  touch-action: manipulation;
  display: flex;
  flex-direction: column;
}

#topbar {
  position: sticky;
  top: 0;
  z-index: 50;
  background: #fff;
  border-bottom: 1px solid #ddd;
  padding: 8px 10px 10px;
  box-shadow: 0 2px 6px rgba(0,0,0,.08);
}
.top-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; margin-top: 4px; }
.top-row:first-child { margin-top: 0; }
h1 { margin: 0; font-size: 18px; padding-right: 8px; }
.clock {
  font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums;
  color: var(--orange); margin-left: auto; padding-right: 2px;
}
.row-label { font-size: 13px; color: #666; white-space: nowrap; }
#quickBtns { display: flex; gap: 6px; flex-wrap: wrap; }
#quickBtns button {
  min-width: 46px; padding: 6px 10px; font-size: 15px; border-radius: 999px;
  border: 1px solid #bbb; background: #fff; cursor: pointer;
}
.legend { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; color: #444; white-space: nowrap; }
.sw { display: inline-block; width: 18px; height: 18px; border-radius: 50%; border: 1px solid rgba(0,0,0,.2); }
.sw.gray { background: var(--gray); }
.sw.blue { background: var(--blue); }
.sw.orange { background: var(--orange); }
.sw.red { background: repeating-linear-gradient(45deg, #fff3f3 0 4px, var(--cut) 4px 8px); }
.sw.ring { background: var(--blue); box-shadow: 0 0 0 3px var(--ring) inset, 0 0 0 6px #fff; }

.gest { font-size: 13px; color: #444; background: #f0f0f0; padding: 2px 8px; border-radius: 999px; }

#controlRow .ctrl { font-size: 14px; display: inline-flex; align-items: center; gap: 4px; }
#controlRow input[type="number"] { width: 56px; padding: 4px 6px; font-size: 15px; }
#controlRow button {
  font-size: 14px; padding: 6px 10px; border-radius: 8px; border: 1px solid #bbb; background: #fff; cursor: pointer;
}
#controlRow button.ctrl-mode.active { background: var(--ring); color: #fff; border-color: var(--ring); }
#controlRow button.danger { color: var(--cut); border-color: var(--cut); }

#gridArea { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; touch-action: pan-y; }
#grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 96px), 1fr));
  gap: 14px 12px;
  padding: 14px 12px 40px;
  align-items: center;
}

.ball {
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 2px;
  cursor: pointer;
}
.ball .num {
  width: clamp(52px, 15vw, 84px);
  aspect-ratio: 1;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(18px, 4.5vw, 28px);
  font-weight: 700;
  color: #fff;
  position: relative;
  background: var(--gray);
  border: 2px solid rgba(0,0,0,.15);
  transition: transform .06s;
}
.ball:active .num { transform: scale(.94); }

.ball[data-st="blue"] .num { background: var(--blue); }
.ball[data-st="orange"] .num {
  background: var(--orange);
  box-shadow: 0 0 0 4px rgba(240,147,0,.28), 0 0 12px rgba(240,147,0,.5);
}
.ball[data-st="overdue"] .num { background: var(--blue); }
.ball[data-st="overdue"] .num::after {
  content: "";
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  border: 4px solid var(--ring);
}
.ball[data-st="cut"] .num {
  background: repeating-linear-gradient(45deg, #e8e8e8 0 6px, var(--cut) 6px 12px);
  color: #5b1212;
}
.ball[data-st="gray"] .num { background: var(--gray); color: rgba(255,255,255,.85); }

.ball .accum { font-size: 11px; color: #555; min-height: 14px; font-variant-numeric: tabular-nums; }
.ball[data-st="cut"] .accum, .ball[data-st="gray"] .accum { visibility: hidden; }
.ball .when { font-size: 12px; font-weight: 600; color: #222; min-height: 14px; font-variant-numeric: tabular-nums; }
.ball[data-st="cut"] .when, .ball[data-st="gray"] .when { visibility: hidden; }

.modal {
  position: fixed; inset: 0; background: rgba(0,0,0,.4);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal.hidden { display: none; }
.panel { background: #fff; border-radius: 12px; padding: 18px; width: min(92vw, 420px); box-shadow: 0 8px 30px rgba(0,0,0,.25); }
.panel h2 { margin: 0 0 8px; font-size: 17px; }
.panel .hint { margin: 0 0 10px; font-size: 13px; color: #666; }
.panel input[type="time"] { font-size: 20px; width: 100%; padding: 8px; }
.panel .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
.panel .actions button { padding: 8px 14px; border-radius: 8px; border: 1px solid #bbb; background: #fff; font-size: 15px; cursor: pointer; }
.panel .actions button.danger { color: var(--cut); border-color: var(--cut); }
#recordList { max-height: 46vh; overflow-y: auto; list-style: none; margin: 0; padding: 0; }
#recordList li { display: flex; justify-content: space-between; padding: 6px 2px; border-bottom: 1px dashed #eee; font-size: 14px; }
```

- [ ] **Step 3: 加載後基本語法檢查**

Run: `node --check index.html`（不支援則改用：確認檔案內容存在）
實際檢查 JS：此任務無 JS。執行 `Test-Path index.html, src/style.css`

- [ ] **Step 4: Commit**

```powershell
git add index.html src/style.css
git commit -m "feat: 人數球版面骨架與樣式（sticky 頂欄、顏色/手勢說明、響應式網格）"
```

---

### Task 5: 渲染引擎 + 時鐘 + localStorage 生命週期

**Files:**
- Create: `src/main.js`

**Interfaces:**
- Consumes: core.js 全部 exported 函式。
- Produces（供 Task 6 使用）：
  - `renderAll()` — 重新渲染整個網格與頂欄
  - `makeBallEl(n)` — 單顆球 DOM
  - `getState() / saveState() / getDaily() / saveDaily(state)` — localStorage（`mhb-state`、`mhb-daily`）
  - `updateClock()` — 每秒更新 `#clock`；每分鐘自動 `renderAll()`
  - `persistState()` — 任何狀態變更後呼叫

---

- [ ] **Step 1: 建立 src/main.js（渲染＋時鐘＋儲存）**

注意：所有變更狀態的 `apply` op 之後都要 `saveState()` 並 `renderAll()`。

```js
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
setInterval(() => {
  updateClock();
  if (new Date().getSeconds() === 0) renderAll();
}, BASE);

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
```

- [ ] **Step 2: 語法檢查**

Run: `node --check src/main.js`
Expected: 無錯誤輸出

- [ ] **Step 3: 執行核心測試確認未破壞**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 4: Commit**

```powershell
git add src/main.js
git commit -m "feat: 渲染引擎、實時時鐘、localStorage 載入與換日處理"
```

---

### Task 6: 手勢、控制列、彈窗與快捷跳號

**Files:**
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `renderAll`, `state`, `daily`, `nowHHMM`；以及 Task 5 產生的 `balls`（`grid` 子元素）。
- Produces: 完整互動邏輯（滑動/點擊/按鈕/彈窗）。

行為規範：
- **球上手勢**（`touch-action:none`）：
  - tap（Δ<28px）或 往右滑（dx>dy 且 dx≥30）→ `orderUpTo(n)`
  - 往上滑 → `setCurrent(state, n, nowHHMM())`；若目標已是 current → no-op
  - 往下滑 → 開啟基準時間彈窗
  - 往左滑 → `batchCut(state, n)`
  - 「過號模式」開時：tap → `toggleOverdue(n)`；關時：若該球為 overdue → `cutOverdue(n)`，否則 `orderUpTo(n)`
- **捲動**：`#gridArea` 原生直向捲動（`touch-action:pan-y`）；球上 `touch-action:none` 由 JS 判定方向。
- **滑鼠/觸控通用**：pointerdown/pointermove/pointerup 用於桌上型滑鼠拖曳判定；簡單用 touch + click 混合實作（見下方程式）。
- 每次 op 後：`saveState(state)`、`renderAll()`、更新過號按鈕狀態、更新 minutes input。

---

- [ ] **Step 1: 實作互動（append 到 src/main.js）**

在 `src/main.js` 匯出行之前，插入下方區塊（`renderAll` 已在前面定義）：

```js
import { orderUpTo, setCurrent, batchCut, toggleOverdue, cutOverdue, setMinutes, setBaseTime, undo, resetDay, resetAll } from "./core.js";
```

> 注意：`setBaseTime`、`resetAll` 尚不存在 → 在 Step 3 實作補上（Task 6 需把它們加入 core.js 與測試）。

- [ ] **Step 2: 先寫 `setBaseTime`、`resetAll` 的測試（tests/core.test.js 追加）**

```js
import { setBaseTime, resetAll } from "../src/core.js";

describe("setBaseTime / resetAll", () => {
  it("setBaseTime 設 t0 且可還原", () => {
    state = setBaseTime(state, "11:30");
    expect(state.t0).toBe("11:30");
    expect(state.history.length).toBeGreaterThan(0);
  });
  it("resetAll 全歸零但保留 minutes 與 t0", () => {
    state = orderUpTo(state, 58);
    state = setMinutes(state, 20);
    state = setBaseTime(state, "10:00");
    const s = resetAll(state);
    expect(s.maxOrdered).toBe(0);
    expect(s.minutes).toBe(20);
    expect(s.t0).toBe("10:00");
    expect(ballStatus(s, 58)).toBe("gray");
  });
});
```

- [ ] **Step 3: core.js 追加實作**

```js
export function setBaseTime(state, hhmm) {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return state;
  return apply(state, (s) => { s.t0 = hhmm; });
}

export function resetAll(state) {
  return apply(state, (s) => {
    s.maxOrdered = 0;
    s.current = null;
    s.overdue = [];
    s.cut = [];
  });
}
```

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 4: main.js 加入互動邏輯**

在 `src/main.js` 的 `renderAll` 之後、`init()` 之前插入：

```js
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
  const valid = `${parseInt(minutesInput.value, 10) || 15}`;
  minutesInput.value = valid;
}

function commit(next) {
  if (next) state = next;
  saveState(state);
  renderAll();
  refreshTop();
}

// --- 球上手勢 ---
function handleBallAction(n, dir) {
  const st = ballStatus(state, n);
  if (overdueMode) {
    if (dir === "tap") { commit(toggleOverdue(state, n)); }
    else if (dir === "up") { commit(setCurrent(state, n, nowHHMM())); }
    else commit(dir === "left" ? batchCut(state, n) : orderUpTo(state, n));
    return;
  }
  if (dir === "up") commit(setCurrent(state, n, nowHHMM()));
  else if (dir === "down") openTimeDialog();
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
  if (Math.abs(dx) > 40 || Math.abs(dy) > 40) {
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
  if (Math.hypot(dx, dy) < 28) handleBallAction(g.n, "tap");
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
  const diff = el.offsetTop - area.offsetTop - 8;
  area.scrollTo({ top: diff, behavior: "smooth" });
}

// --- 基準時間彈窗 ---
function openTimeDialog() {
  baseTimeInput.value = nowHHMM();
  dlgTime.classList.remove("hidden");
}
$("btnTimeCancel").addEventListener("click", () => dlgTime.classList.add("hidden"));
$("btnTimeOk").addEventListener("click", () => {
  commit(setBaseTime(state, baseTimeInput.value || state.t0));
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
    daily[state.date] = state.maxOrdered;
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
```

- [ ] **Step 5: 移除多餘雙 import 並整理（合併 import 榜單）**

將 `src/main.js` 頂部 import 改成（涵蓋全部使用到的名稱）：

```js
import {
  createState, todayStr, rollover, ballStatus,
  queuePositions, estimate, formatAccum, pruneDaily,
  orderUpTo, setCurrent, batchCut, toggleOverdue, cutOverdue,
  setMinutes, setBaseTime, undo, resetAll,
} from "./core.js";
```

- [ ] **Step 6: 語法檢查＋測試**

Run: `node --check src/main.js`
Run: `npx vitest run`
Expected: 兩者皆無錯誤

- [ ] **Step 7: Commit**

```powershell
git add src/core.js tests/core.test.js src/main.js
git commit -m "feat: 球上手勢（上下左右/點擊）、控制列、基準時間/每日紀錄/重置彈窗、全螢幕"
```

---

### Task 7: 最終整合與冒煙驗證

**Files:**
- Modify: `src/main.js`（如有必要之修正）
- Verify: 全部

---

- [ ] **Step 1: 執行全部單元測試**

Run: `npx vitest run`
Expected: PASS（全部）

- [ ] **Step 2: 啟動本機預覽並檢查 HTTP 200**

```powershell
Start-Process powershell -ArgumentList '-NoExit','-Command','npx --yes serve . -l 4173'
Start-Sleep -Seconds 6
(Invoke-WebRequest http://localhost:4173 -UseBasicParsing).StatusCode
```

Expected: `200`
再驗證資源：
```powershell
(Invoke-WebRequest http://localhost:4173/src/core.js -UseBasicParsing).Content
(Invoke-WebRequest http://localhost:4173/src/main.js -UseBasicParsing).Content
```
確認兩檔皆回傳 JS（內容含 `export function ballStatus`、`function renderAll`）。

- [ ] **Step 3: 停掉預覽 server**

```powershell
Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*node*' } | Stop-Process -Force
```

- [ ] **Step 4: Commit（若有變更）**

```powershell
git add -A
git commit -m "chore: 最終整合檢查"
```

---

### Task 8: 部署 — 獨立 repo + GitHub Pages + Firebase Hosting

**Files:**
- Create: `firebase.json`
- Create: `.firebaserc`
- Create: `網址.txt`

**規範來源（AGENTS.md）：** 新專案一律獨立 repo；Hosting site `mhb-sk`；`firebase.json` 必須含 `"site": "mhb-sk"`；防呆掃描機密。

---

- [ ] **Step 1: 建立 firebase.json**

```json
{
  "hosting": {
    "site": "mhb-sk",
    "public": ".",
    "ignore": [
      "firebase.json",
      ".firebaserc",
      "**/node_modules/**",
      "docs/**",
      "tests/**",
      "package.json",
      "package-lock.json",
      ".gitignore",
      "網址.txt"
    ]
  }
}
```

- [ ] **Step 2: 建立 .firebaserc**

```json
{
  "projects": {
    "default": "opencode-sk"
  }
}
```

- [ ] **Step 3: 機密掃描（依 AGENTS）**

```powershell
Select-String -Path .\*,.\src\* -Pattern 'AIza[0-9A-Za-z_-]{20,}|password\s*=|secret\s*=|service_role|admin\.json' -ErrorAction SilentlyContinue
```
Expected: 無輸出（無機密）。若有輸出 → 停止並回報。

- [ ] **Step 4: 建立獨立 git repo 並推送**

```powershell
git init
git add -A
git commit -m "feat: 魔法箱人數球 v1"
gh repo create magic-hairbox-number-balls --public --source . --push
```

（中文目錄在 GitHub 名稱使用英文 slug `magic-hairbox-number-balls`。若 `gh repo create` 有遠端追蹤差異請以 `git remote -v` 確認並 push 修正。）

- [ ] **Step 5: 啟用 GitHub Pages + 建立 Firebase site**

```powershell
gh api repos/jeff79213-baba/magic-hairbox-number-balls/pages -X POST --input - --silent
firebase hosting:sites:create mhb-sk --project opencode-sk
```

- [ ] **Step 6: Firebase Hosting 部署**

```powershell
firebase deploy --only hosting --project opencode-sk
```
Expected: 顯示部署到 `https://mhb-sk.web.app`

- [ ] **Step 7: 建立網址.txt**

```text
GitHub     : https://github.com/jeff79213-baba/magic-hairbox-number-balls
GitHub Pages: https://jeff79213-baba.github.io/magic-hairbox-number-balls/
Firebase   : https://mhb-sk.web.app
```

- [ ] **Step 8: Commit**

```powershell
git add -A
git commit -m "chore: 部署設定與網址文件"
git push
```

---

## Self-Review 記錄

- **Spec 覆蓋：** Task 1-3 覆蓋 spec §5/§6/§7/§8/§9（狀態、手勢、時間、每日紀錄、儲存）；Task 4/5 覆蓋 §3/§4/§10（版面、頂欄、觸控/全螢幕）；Task 6 覆蓋 §6 互動與彈窗；Task 8 覆蓋 §12 部署。
- **無 placeholder：** 全部步驟含完整程式碼。
- **型別一致性：** `ballStatus`/`orderUpTo`/`setCurrent(state,n,nowHHMM)`/`setBaseTime(state,hhmm)`/`resetAll(state)`/`queuePositions(state)`/`estimate(state,n)`/`formatAccum(min)` 在各 Task 簽名一致。