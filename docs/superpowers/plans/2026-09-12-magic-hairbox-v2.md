# 魔法盒人數球 v2 互動改版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將「上滑叫號／下滑基準時間」改為「亮燈／預定時間」模式按鈕＋點球，保留左右滑動，並新增「剪完／未下訂」模式與 per-ball 預定時間與 grayOut 還原機制。

**Architecture:** 單一自包含 Web App。純邏輯在 `src/core.js`（Vitest 可測）；`src/main.js` 負責 DOM、模式切換與手勢；`index.html`＋`src/style.css` 負責版面。狀態存 localStorage（`mhb-state`、`mhb-daily`）。沿用既有 Firebase Hosting site `mhb-sk` 與 GitHub repo `magic-hairbox-number-balls`。

**Tech Stack:** 原生 HTML/CSS/JS（零外部依賴）；dev 依賴只有 Vitest。

## Global Constraints

- 全部繁體中文介面。
- 號碼球 1~150；狀態：`gray` 未下訂、`blue` 已下訂、`orange` 亮燈中、`overdue` 過號、`cut` 已剪。
- **保留**左右滑動：左滑＝批量剪完、右滑＝下訂；**移除**上下滑動。
- 批量剪完跳過：current（亮燈中）、overdue（過號）、scheduled（有預定時間）、grayOut（被還原的球）。
- 模式按鈕互斥切換：`亮燈`／`預定時間`／`剪完`／`未下訂`／`過號`；再按一次取消；無模式＝預設下訂行為。
- 有預定時間的球顯示預定時間（替代推算時刻）。
- 亮燈中球不可用「未下訂」還原。
- localStorage key 前綴一律 `mhb-`；既有狀態相容（缺 `scheduled`/`grayOut` 補空陣列）。

---

### Task 1: core.js 狀態欄位擴充＋查詢／批量邏輯修正

**Files:**
- Modify: `src/core.js`
- Modify: `tests/core.test.js`

**Interfaces:**
- Consumes: 既有 `apply`、`cutPush`、`minOfDay`、`fmtTime`（沿用）。
- Produces（Task 2/3/4 依賴）:
  - `createState()` 新增欄位 `scheduled: []`（元素 `{n, time}`）、`grayOut: []`
  - `ballStatus(state, n)` 新增 grayOut → 回傳 `"gray"`
  - `orderUpTo(state, n)` 移除 n 於 grayOut；cut 球 no-op
  - `batchCut(state, n)` 跳過 current／overdue／scheduled／grayOut
  - `queuePositions(state)` 排除 grayOut
  - `estimate(state, n)` 有 scheduled 的球回傳預定時間為 `time`
  - `rollover`／`resetDay`／`resetAll` 清空 scheduled 與 grayOut
  - **移除** `setBaseTime`

- [ ] **Step 1: 改 createState 加入欄位**

在 `src/core.js` 的 `createState()` 中，於 `cut: []` 之後加入兩欄：

```js
    cut: [],
    scheduled: [],
    grayOut: [],
```

- [ ] **Step 2: 改 ballStatus**

`src/core.js` 的 `ballStatus` 改為（在 `blue` 判斷前插入 grayOut）：

```js
export function ballStatus(state, n) {
  if (state.cut.includes(n)) return "cut";
  if (state.current === n) return "orange";
  if (state.overdue.includes(n)) return "overdue";
  if (state.grayOut.includes(n)) return "gray";
  if (n <= state.maxOrdered) return "blue";
  return "gray";
}
```

- [ ] **Step 3: 改 orderUpTo**

`src/core.js` 的 `orderUpTo` 改為：

```js
export function orderUpTo(state, n) {
  if (n < 1 || n > TOTAL) return state;
  if (state.cut.includes(n)) return state;
  return apply(state, (s) => {
    if (n > s.maxOrdered) s.maxOrdered = n;
    const gi = s.grayOut.indexOf(n);
    if (gi >= 0) s.grayOut.splice(gi, 1);
  });
}
```

- [ ] **Step 4: 改 batchCut 跳過已處理球**

`src/core.js` 的 `batchCut` 內迴圈改為：

```js
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
```

- [ ] **Step 5: 改 queuePositions 排除 grayOut**

`src/core.js` 的 `queuePositions` 改為：

```js
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
```

- [ ] **Step 6: 改 estimate 支援 scheduled**

`src/core.js` 的 `estimate` 改為：

```js
export function estimate(state, n) {
  const pos = queuePositions(state).indexOf(n);
  if (pos === -1) return null;
  const accumMin = (pos + 1) * state.minutes;
  const sched = state.scheduled.find((o) => o.n === n);
  return { accumMin, time: sched ? sched.time : fmtTime(minOfDay(state.t0) + accumMin) };
}
```

- [ ] **Step 7: rollover／resetDay／resetAll 清空新欄位；移除 setBaseTime**

`src/core.js`：

- `rollover` 回傳的 `state` 物件中，`cut: []` 後加 `scheduled: [], grayOut: [],`
- `resetDay` 的 mutator 內，`s.cut = [];` 後加 `s.scheduled = []; s.grayOut = [];`
- `resetAll` 的 mutator 內，`s.cut = [];` 後加 `s.scheduled = []; s.grayOut = [];`
- 刪除整個 `setBaseTime` 函式（已無使用）。

- [ ] **Step 8: 更新測試 import 並改動 tests/core.test.js**

`tests/core.test.js` 的 import 改為（移除 `setBaseTime`）：

```js
import {
  TOTAL, createState, orderUpTo, setCurrent, batchCut,
  toggleOverdue, cutOverdue, setMinutes, ballStatus, undo, todayStr,
  queuePositions, estimate, formatAccum,
  recordDaily, pruneDaily, rollover, resetDay,
  resetAll,
} from "../src/core.js";
```

將檔案最尾端整段 `describe("setBaseTime / resetAll", ...)` 刪除，換成：

```js
describe("resetAll", () => {
  it("resetAll 全歸零但保留 minutes 與 t0", () => {
    state = orderUpTo(state, 58);
    state = setMinutes(state, 20);
    state.t0 = "10:00";
    const s = resetAll(state);
    expect(s.maxOrdered).toBe(0);
    expect(s.minutes).toBe(20);
    expect(s.t0).toBe("10:00");
    expect(ballStatus(s, 58)).toBe("gray");
  });
});
```

- [ ] **Step 9: 追加 Task 1 新測試**

在 `tests/core.test.js` 檔尾（resetAll describe 之後）追加：

```js
describe("createState 新欄位", () => {
  it("scheduled 與 grayOut 預設為空陣列", () => {
    expect(state.scheduled).toEqual([]);
    expect(state.grayOut).toEqual([]);
  });
});

describe("orderUpTo 與 grayOut", () => {
  it("grayOut 的球可重新下訂（移出 grayOut）", () => {
    state = orderUpTo(state, 58);
    state.grayOut = [55];
    state = orderUpTo(state, 55);
    expect(ballStatus(state, 55)).toBe("blue");
    expect(state.grayOut).not.toContain(55);
  });
  it("已剪的球不可重新下訂（no-op）", () => {
    state = orderUpTo(state, 58);
    state = setCurrent(state, 5, "15:00");
    state = setCurrent(state, 6, "16:00");
    const before = state.maxOrdered;
    state = orderUpTo(state, 5);
    expect(state.maxOrdered).toBe(before);
    expect(ballStatus(state, 5)).toBe("cut");
  });
});

describe("batchCut 跳過已處理球", () => {
  it("跳過 current / overdue / scheduled / grayOut，其餘照剪", () => {
    state = orderUpTo(state, 58);
    state = setCurrent(state, 18, "15:00");
    state = toggleOverdue(state, 10);
    state.scheduled = [{ n: 20, time: "15:00" }];
    state.grayOut = [22];
    state = batchCut(state, 35);
    expect(ballStatus(state, 17)).toBe("cut");
    expect(ballStatus(state, 18)).toBe("orange");
    expect(ballStatus(state, 10)).toBe("overdue");
    expect(ballStatus(state, 20)).toBe("blue");
    expect(ballStatus(state, 22)).toBe("gray");
    expect(ballStatus(state, 34)).toBe("cut");
  });
});

describe("queuePositions 排除 grayOut", () => {
  it("grayOut 的球不出現在佇列", () => {
    state = orderUpTo(state, 30);
    state.grayOut = [22, 25];
    const seq = queuePositions(state);
    expect(seq).not.toContain(22);
    expect(seq).not.toContain(25);
    expect(seq[0]).toBe(1);
  });
});

describe("estimate 與 scheduled", () => {
  it("有預定時間的球：time 顯示預定時間", () => {
    state = orderUpTo(state, 30);
    state.scheduled = [{ n: 19, time: "14:30" }];
    const e = estimate(state, 19);
    expect(e.time).toBe("14:30");
  });
  it("grayOut 的球回傳 null", () => {
    state = orderUpTo(state, 30);
    state.grayOut = [25];
    expect(estimate(state, 25)).toBeNull();
  });
});

describe("rollover / resetDay / resetAll 清空新欄位", () => {
  it("rollover 跨日清空 scheduled 與 grayOut", () => {
    state = orderUpTo(state, 58);
    state.scheduled = [{ n: 10, time: "15:00" }];
    state.grayOut = [12];
    state.date = "2026-09-11";
    const r = rollover(state, "2026-09-12");
    expect(r.state.scheduled).toEqual([]);
    expect(r.state.grayOut).toEqual([]);
  });
  it("resetDay 清空 scheduled 與 grayOut", () => {
    state = orderUpTo(state, 58);
    state.scheduled = [{ n: 10, time: "15:00" }];
    state.grayOut = [12];
    const s = resetDay(state);
    expect(s.scheduled).toEqual([]);
    expect(s.grayOut).toEqual([]);
  });
  it("resetAll 清空 scheduled 與 grayOut", () => {
    state = orderUpTo(state, 58);
    state.scheduled = [{ n: 10, time: "15:00" }];
    state.grayOut = [12];
    const s = resetAll(state);
    expect(s.scheduled).toEqual([]);
    expect(s.grayOut).toEqual([]);
  });
});
```

- [ ] **Step 10: 跑測試確認通過**

Run: `npx vitest run`
Expected: PASS（既有測試 + 新增測試全綠）

- [ ] **Step 11: Commit**

```powershell
git add src/core.js tests/core.test.js
git commit -m "feat: core 新增 scheduled/grayOut 欄位、批量剪跳過已處理球、移除全域基準時間"
```

---

### Task 2: core.js 新增操作函式（setScheduled / cutBall / revertToGray）

**Files:**
- Modify: `src/core.js`
- Modify: `tests/core.test.js`

**Interfaces:**
- Consumes: `apply`、`cutPush`、`ballStatus`、`TOTAL`（Task 1 已存在）。
- Produces（Task 4 依賴）:
  - `setScheduled(state, n, hhmm) → newState`（僅限 blue／overdue 球；同球覆寫）
  - `cutBall(state, n) → newState`（任意球變 cut；current 清除；移出 overdue/scheduled/grayOut）
  - `revertToGray(state, n) → newState`（blue/cut/overdue/scheduled → gray（加入 grayOut）；current 與已灰 no-op）

- [ ] **Step 1: 在 src/core.js 檔尾（resetDay 之後）追加三個函式**

```js
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
```

- [ ] **Step 2: 更新測試 import**

`tests/core.test.js` import 改為：

```js
import {
  TOTAL, createState, orderUpTo, setCurrent, batchCut,
  toggleOverdue, cutOverdue, setMinutes, ballStatus, undo, todayStr,
  queuePositions, estimate, formatAccum,
  recordDaily, pruneDaily, rollover, resetDay,
  resetAll, setScheduled, cutBall, revertToGray,
} from "../src/core.js";
```

- [ ] **Step 3: 追加 Task 2 測試（檔尾）**

```js
describe("setScheduled", () => {
  it("設定成功：球維持 blue，scheduled 記錄時間", () => {
    state = orderUpTo(state, 30);
    state = setScheduled(state, 19, "14:30");
    expect(state.scheduled).toEqual([{ n: 19, time: "14:30" }]);
    expect(ballStatus(state, 19)).toBe("blue");
  });
  it("overdue 球可設預定時間", () => {
    state = orderUpTo(state, 30);
    state = toggleOverdue(state, 10);
    state = setScheduled(state, 10, "13:00");
    expect(state.scheduled.some((o) => o.n === 10)).toBe(true);
  });
  it("同球覆寫：只留最新一筆", () => {
    state = orderUpTo(state, 30);
    state = setScheduled(state, 19, "14:30");
    state = setScheduled(state, 19, "15:00");
    expect(state.scheduled).toEqual([{ n: 19, time: "15:00" }]);
    expect(ballStatus(state, 19)).toBe("blue");
  });
  it("非法時間格式：no-op", () => {
    state = orderUpTo(state, 30);
    state = setScheduled(state, 19, "abc");
    expect(state.scheduled).toEqual([]);
    expect(state.history.length).toBe(1);
  });
  it("gray / grayOut / cut / current 不可設", () => {
    state = orderUpTo(state, 30);
    state = setScheduled(state, 60, "14:00");
    expect(state.scheduled).toEqual([]);
    state.grayOut = [25];
    state = setScheduled(state, 25, "14:00");
    expect(state.scheduled).toEqual([]);
    state = setCurrent(state, 5, "15:00");
    state = setScheduled(state, 5, "15:00");
    expect(state.scheduled).toEqual([]);
    state = setCurrent(state, 6, "16:00");
    state = setScheduled(state, 5, "15:00");
    expect(state.scheduled).toEqual([]);
  });
});

describe("cutBall", () => {
  it("剪灰色（未下訂）的球", () => {
    state = cutBall(state, 70);
    expect(ballStatus(state, 70)).toBe("cut");
  });
  it("剪藍色球", () => {
    state = orderUpTo(state, 30);
    state = cutBall(state, 20);
    expect(ballStatus(state, 20)).toBe("cut");
  });
  it("剪過號球：移出 overdue", () => {
    state = orderUpTo(state, 30);
    state = toggleOverdue(state, 10);
    state = cutBall(state, 10);
    expect(ballStatus(state, 10)).toBe("cut");
    expect(state.overdue).not.toContain(10);
  });
  it("剪有預定時間的球：移出 scheduled", () => {
    state = orderUpTo(state, 30);
    state = setScheduled(state, 15, "14:00");
    state = cutBall(state, 15);
    expect(state.scheduled).toEqual([]);
    expect(ballStatus(state, 15)).toBe("cut");
  });
  it("剪亮燈中的球：清除 current", () => {
    state = orderUpTo(state, 30);
    state = setCurrent(state, 8, "15:00");
    state = cutBall(state, 8);
    expect(state.current).toBeNull();
    expect(ballStatus(state, 8)).toBe("cut");
  });
  it("已是 cut：no-op 不重複推 history", () => {
    state = orderUpTo(state, 30);
    state = cutBall(state, 5);
    const len = state.history.length;
    state = cutBall(state, 5);
    expect(state.history.length).toBe(len);
  });
});

describe("revertToGray", () => {
  it("藍色球還原成灰", () => {
    state = orderUpTo(state, 30);
    state = revertToGray(state, 20);
    expect(ballStatus(state, 20)).toBe("gray");
    expect(state.grayOut).toContain(20);
  });
  it("已剪球還原成灰：移出 cut", () => {
    state = orderUpTo(state, 30);
    state = cutBall(state, 20);
    state = revertToGray(state, 20);
    expect(ballStatus(state, 20)).toBe("gray");
    expect(state.cut).not.toContain(20);
    expect(state.grayOut).toContain(20);
  });
  it("過號球還原成灰：移出 overdue", () => {
    state = orderUpTo(state, 30);
    state = toggleOverdue(state, 10);
    state = revertToGray(state, 10);
    expect(ballStatus(state, 10)).toBe("gray");
    expect(state.overdue).not.toContain(10);
  });
  it("有預定時間的球還原成灰：移出 scheduled", () => {
    state = orderUpTo(state, 30);
    state = setScheduled(state, 15, "14:00");
    state = revertToGray(state, 15);
    expect(ballStatus(state, 15)).toBe("gray");
    expect(state.scheduled).toEqual([]);
  });
  it("亮燈中的球不可還原（no-op）", () => {
    state = orderUpTo(state, 30);
    state = setCurrent(state, 8, "15:00");
    state = revertToGray(state, 8);
    expect(ballStatus(state, 8)).toBe("orange");
    expect(state.grayOut).toEqual([]);
  });
  it("已是灰色：no-op 不推 history", () => {
    state = orderUpTo(state, 30);
    state = revertToGray(state, 60);
    expect(state.grayOut).toEqual([]);
    expect(state.history.length).toBe(1);
  });
});
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run`
Expected: PASS（全部，含既有與新增）

- [ ] **Step 5: Commit**

```powershell
git add src/core.js tests/core.test.js
git commit -m "feat: core 新增 setScheduled/cutBall/revertToGray 與測試"
```

---

### Task 3: HTML／CSS（模式按鈕、圖例文字、預定球樣式）

**Files:**
- Modify: `index.html`
- Modify: `src/style.css`

**Interfaces:**
- Produces（Task 4 依賴）新的 DOM id：
  - `#btnLight`（亮燈）、`#btnSchedule`（預定時間）、`#btnUnorder`（未下訂）、`#btnCut`（剪完）
  - 沿用 `#overdueMode`（過號）、`#dlgTime`／`#baseTimeInput`／`#btnTimeCancel`／`#btnTimeOk`（預定時間彈窗）
  - `#grid` 內 `.ball` 新增 `data-sched="1"` 標記（由 Task 4 render 設定）

- [ ] **Step 1: 改顏色圖例文字**

`index.html` 中 `#colorRow` 這行：

```html
    <span class="legend"><i class="sw orange"></i>當前叫號</span>
```

改為：

```html
    <span class="legend"><i class="sw orange"></i>亮燈中</span>
```

- [ ] **Step 2: 改手勢說明（移除上下滑）**

`index.html` 中 `#gestureLegend` 整段改為：

```html
  <div class="top-row" id="gestureLegend">
    <span class="row-label">滑動手勢</span>
    <span class="gest">← 批量剪完</span>
    <span class="gest">→ 下訂</span>
  </div>
```

- [ ] **Step 3: 控制列加入模式按鈕**

`index.html` 中 `#controlRow` 整段改為：

```html
  <div class="top-row" id="controlRow">
    <label class="ctrl">每球<input id="minutesInput" type="number" min="1" max="240" value="15" inputmode="numeric">分</label>
    <button type="button" id="btnLight" class="ctrl-mode">亮燈</button>
    <button type="button" id="btnSchedule" class="ctrl-mode">預定時間</button>
    <button type="button" id="btnUnorder" class="ctrl-mode">未下訂</button>
    <button type="button" id="btnCut" class="ctrl-mode">剪完</button>
    <button type="button" id="overdueMode" class="ctrl-mode">過號</button>
    <button type="button" id="btnRecords">每日紀錄</button>
    <button type="button" id="btnReset" class="danger">每日重置</button>
    <button type="button" id="btnUndo">還原</button>
    <button type="button" id="btnFullscreen">全螢幕</button>
  </div>
```

- [ ] **Step 4: 預定時間彈窗文案**

`index.html` 中 `#dlgTime` 內：

```html
    <h2>基準時間</h2>
    <p class="hint">設定時間錨點，整條時間表據此重新計算。</p>
```

改為：

```html
    <h2>預定時間</h2>
    <p class="hint">輸入此顆號碼球的預約時間，該球時刻改顯示這組時間。</p>
```

- [ ] **Step 5: 新增預定球樣式**

`src/style.css` 檔尾追加：

```css
.ball[data-sched="1"] .when { color: #7b1fa2; font-weight: 700; }
```

- [ ] **Step 6: 語法檢查**

Run: `Test-Path index.html, src/style.css`
Run: `Get-Content index.html | Select-String -Pattern 'btnLight|btnSchedule|btnUnorder|btnCut|亮燈中|滑動手勢'`
Expected: 全部關鍵字都找到；CSS 檔尾含新樣式規則。

- [ ] **Step 7: 跑測試確認未破壞**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 8: Commit**

```powershell
git add index.html src/style.css
git commit -m "feat: 版面加入模式按鈕、移除上下滑手勢說明、預定球樣式"
```

---

### Task 4: main.js 互動改造（模式按鈕、手勢、預定時間彈窗）

**Files:**
- Modify: `src/main.js`

**Interfaces:**
- Consumes: core 匯出 `createState, todayStr, rollover, ballStatus, queuePositions, estimate, formatAccum, pruneDaily, orderUpTo, setCurrent, batchCut, toggleOverdue, cutOverdue, setMinutes, setScheduled, cutBall, revertToGray, undo, resetAll`
- Consumes: Task 3 產生的 `#btnLight`／`#btnSchedule`／`#btnUnorder`／`#btnCut`
- Produces: 互動（無新 interface 給後續依賴）

- [ ] **Step 1: 更新 import**

`src/main.js` 頂部 import 改為：

```js
import {
  createState, todayStr, rollover, ballStatus,
  queuePositions, estimate, formatAccum, pruneDaily,
  orderUpTo, setCurrent, batchCut, toggleOverdue, cutOverdue,
  setMinutes, setScheduled, cutBall, revertToGray, undo, resetAll,
} from "./core.js";
```

- [ ] **Step 2: renderAll 標記預定球**

`src/main.js` 的 `renderAll` 迴圈內，`el.dataset.st = st;` 之後插入：

```js
    el.dataset.sched = state.scheduled.some((o) => o.n === n) ? "1" : "";
```

- [ ] **Step 3: 替換模式相關變數與 DOM**

`src/main.js` 中：

```js
let overdueMode = false;
let gestureStart = null;
```

改為：

```js
let gestureStart = null;
```

並在 `const overdueModeBtn = $("overdueMode");` 附近加入（放在 `const recordList = $("recordList");` 之後）：

```js
const btnLight = $("btnLight");
const btnSchedule = $("btnSchedule");
const btnUnorder = $("btnUnorder");
const btnCut = $("btnCut");

let activeMode = null; // "light" | "schedule" | "cut" | "unorder" | "overdue" | null
const MODE_BTNS = {
  light: btnLight,
  schedule: btnSchedule,
  cut: btnCut,
  unorder: btnUnorder,
  overdue: overdueModeBtn,
};
const pendingSchedule = { n: null };
```

- [ ] **Step 4: 替換 refreshTop**

`src/main.js` 的 `refreshTop` 改為：

```js
function refreshTop() {
  for (const [mode, btn] of Object.entries(MODE_BTNS)) {
    btn.classList.toggle("active", activeMode === mode);
  }
  minutesInput.value = state.minutes;
}
```

- [ ] **Step 5: 替換 handleBallAction**

`src/main.js` 的整段 `handleBallAction` 改為：

```js
function handleBallAction(n, dir) {
  if (dir === "left") { commit(batchCut(state, n)); return; }
  if (dir === "right") { commit(orderUpTo(state, n)); return; }
  const st = ballStatus(state, n);
  switch (activeMode) {
    case "light":
      commit(setCurrent(state, n, nowHHMM()));
      break;
    case "schedule":
      if (st === "gray" || st === "cut" || st === "orange") break;
      pendingSchedule.n = n;
      baseTimeInput.value = nowHHMM();
      dlgTime.classList.remove("hidden");
      break;
    case "cut":
      commit(cutBall(state, n));
      break;
    case "unorder":
      commit(revertToGray(state, n));
      break;
    case "overdue":
      commit(toggleOverdue(state, n));
      break;
    default:
      if (st === "overdue") commit(cutOverdue(state, n));
      else commit(orderUpTo(state, n));
  }
}
```

- [ ] **Step 6: 簡化 pointermove（移除上下滑）**

`src/main.js` 的 `pointermove` 監聽改為：

```js
grid.addEventListener("pointermove", (e) => {
  if (!gestureStart || e.pointerId !== gestureStart.id) return;
  const dx = e.clientX - gestureStart.x;
  const dy = e.clientY - gestureStart.y;
  if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) {
    gestureStart.done = true;
    handleBallAction(gestureStart.n, dx > 0 ? "right" : "left");
  }
});
```

- [ ] **Step 7: 模式按鈕 click 事件**

`src/main.js` 中刪除舊的：

```js
overdueModeBtn.addEventListener("click", () => {
  overdueMode = !overdueMode;
  refreshTop();
});
```

改為（放在 `minutesInput` 的 change 監聽之後）：

```js
function setMode(mode) {
  activeMode = activeMode === mode ? null : mode;
  refreshTop();
}
btnLight.addEventListener("click", () => setMode("light"));
btnSchedule.addEventListener("click", () => setMode("schedule"));
btnCut.addEventListener("click", () => setMode("cut"));
btnUnorder.addEventListener("click", () => setMode("unorder"));
overdueModeBtn.addEventListener("click", () => setMode("overdue"));
```

- [ ] **Step 8: 替換基準時間彈窗為預定時間彈窗**

`src/main.js` 中刪除整個 `openTimeDialog` 函式，並把：

```js
$("btnTimeCancel").addEventListener("click", () => dlgTime.classList.add("hidden"));
$("btnTimeOk").addEventListener("click", () => {
  const val = baseTimeInput.value || state.t0;
  if (!/^\d{2}:\d{2}$/.test(val)) return;
  commit(setBaseTime(state, val));
  dlgTime.classList.add("hidden");
});
```

改為：

```js
$("btnTimeCancel").addEventListener("click", () => {
  dlgTime.classList.add("hidden");
  pendingSchedule.n = null;
});
$("btnTimeOk").addEventListener("click", () => {
  const val = baseTimeInput.value;
  if (pendingSchedule.n === null) return;
  if (!/^\d{2}:\d{2}$/.test(val)) return;
  commit(setScheduled(state, pendingSchedule.n, val));
  pendingSchedule.n = null;
  dlgTime.classList.add("hidden");
});
```

- [ ] **Step 9: 語法檢查**

Run: `node --check src/main.js`
Expected: 無錯誤輸出

- [ ] **Step 10: 跑全測試**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 11: Commit**

```powershell
git add src/main.js
git commit -m "feat: 模式按鈕互動（亮燈/預定時間/剪完/未下訂/過號）、移除上下滑"
```

---

### Task 5: 整合驗證與部署

**Files:**
- Verify: 全部
- 若有修正調整：`src/main.js`、`src/core.js`、`index.html`、`src/style.css`

**Interfaces:**
- 最後驗證：單元測試全綠 → 本機 HTTP 200 → Firebase 部署 → GitHub push。

- [ ] **Step 1: 跑全部單元測試**

Run: `npx vitest run`
Expected: PASS（全部）

- [ ] **Step 2: 本機預覽冒煙測試**

```powershell
Start-Process powershell -ArgumentList '-NoExit','-Command','npx --yes serve . -l 4173'
Start-Sleep -Seconds 6
(Invoke-WebRequest http://localhost:4173 -UseBasicParsing).StatusCode
```

Expected: `200`
再驗證資源回傳：
```powershell
(Invoke-WebRequest http://localhost:4173/src/main.js -UseBasicParsing).Content
```
Expected: 內容含 `setScheduled` 與 `activeMode`。

- [ ] **Step 3: 停掉預覽 server**

```powershell
Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*node*' } | Stop-Process -Force
```

- [ ] **Step 4: 機密掃描（依 AGENTS.md）**

```powershell
Select-String -Path .\*,.\src\* -Pattern 'AIza[0-9A-Za-z_-]{20,}|password\s*=|secret\s*=|service_role|admin\.json' -ErrorAction SilentlyContinue
```
Expected: 無輸出（無機密）。

- [ ] **Step 5: Firebase 部署**

```powershell
firebase deploy --only hosting --project opencode-sk
```
Expected: 顯示部署到 `https://mhb-sk.web.app`

- [ ] **Step 6: Git push**

```powershell
git add -A
git commit -m "chore: v2 互動改版整合檢查"
git push origin main
```

Expected: push 成功（main → origin/main）

- [ ] **Step 7: 回報網址**

回報：`https://mhb-sk.web.app`（Firebase 已部署）、`https://jeff79213-baba.github.io/magic-hairbox-number-balls/`（Pages，若已更新）。

---

## Self-Review 記錄

- **Spec 覆蓋：** §2 名詞對照 → Task 3（圖例、手勢文案、彈窗文案）；§3 滑動手勢 → Task 4 Step 6、Task 1 Step 4；§4 模式按鈕 → Task 4 Step 3/5/7；§5 顯示與樣式 → Task 3；§6 核心狀態 → Task 1 + Task 2；§7 資料移轉 → Task 1 Step 1（createState 預設欄位相容）＋ Task 4（原 loadState Object.assign 保留基底欄位）；§8 互動實作 → Task 4；§9 測試策略 → Task 1/2/5；§10 部署 → Task 5。
- **無 placeholder：** 全部步驟含完整程式碼與命令。
- **型別一致性：** `setScheduled(state, n, hhmm)`、`cutBall(state, n)`、`revertToGray(state, n)`、`batchCut(state, n)` 於 Task 1（跳過規則）、Task 2（實作）、Task 4（呼叫）簽名一致；DOM id `btnLight/btnSchedule/btnUnorder/btnCut/overdueMode/dlgTime` 於 Task 3（建立）與 Task 4（使用）一致。