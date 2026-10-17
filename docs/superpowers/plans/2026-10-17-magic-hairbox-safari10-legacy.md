# 魔法盒人數球：Safari 10 相容版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 iOS 10.3.3（Safari 10.1）的舊 iPad 能顯示並操作本 App，且**完全不改動原版**。

**Architecture:** 相容版獨立放在 `legacy/`，以獨立 Firebase Hosting Site `mhb-legacy-sk` 部署；原版 `index.html`、`src/*` 一字不動、原版 site 不重新部署。相容版把 ES 模組改成傳統 script、移除 ES2018+ 語法與新 API、指標事件退回觸控事件、CSS 換成舊寫法。核心邏輯與原版等價，用差分測試驗證。

**Tech Stack:** 原生 HTML/CSS/JS（瀏覽器端零依賴）；測試用 Vitest + acorn（僅 devDependency）。部署用 Firebase CLI。

設計依據：`docs/superpowers/specs/2026-10-17-magic-hairbox-safari10-legacy-design.md`

## Global Constraints

- **禁止修改** `index.html`、`src/main.js`、`src/core.js`、`src/style.css`（客戶近期要用）。驗收以 `git diff` 確認這四個檔案零變動。
- 相容版所有檔案只放 `legacy/` 底下；**不修改根目錄 `firebase.json` 與 `.firebaserc`**。
- 相容版 JS 必須可用 `acorn` 的 `ecmaVersion: 2017` 解析（即不含 ES2018+ 語法：物件展開、optional chaining、nullish、numeric separator 等）。
- 介面全部繁體中文。
- 號碼球 1~150；狀態：`gray` 未下訂、`blue` 已下訂、`orange` 亮燈中、`overdue` 過號、`cut` 已剪。
- localStorage key 沿用 `mhb-state`、`mhb-daily`、`mhb-view`（與原版格式相容）。
- 相容版網址目標：`https://mhb-legacy-sk.web.app`；原版網址 `https://mhb-sk.web.app` 不變。
- 部署相容版一律在 `legacy/` 目錄內執行 `firebase deploy --only hosting`（cwd = legacy，讀 `legacy/firebase.json`＋`legacy/.firebaserc`）。

---

### Task 1: 獨立 Hosting Site ＋ Phase 1 煙霧測試頁

**Files:**
- Create: `legacy/firebase.json`
- Create: `legacy/.firebaserc`
- Create: `legacy/index.html`（臨時煙霧測試頁，Task 4 會被完整版覆蓋）

**Interfaces:**
- Consumes: 無。
- Produces: 可供舊 iPad 連線的 Hosting Site `mhb-legacy-sk`；`legacy/` 部署設定。

- [ ] **Step 1: 建立 Hosting Site**

Run（在專案根目錄）：
```
firebase hosting:sites:create mhb-legacy-sk --project opencode-sk
```
Expected: `Successfully created site mhb-legacy-sk`（若已存在則訊息會提示已存在，可續用）。

- [ ] **Step 2: 寫入 `legacy/firebase.json`**

```json
{
  "hosting": {
    "site": "mhb-legacy-sk",
    "public": ".",
    "ignore": ["firebase.json", ".firebaserc", "**/.*"],
    "headers": [
      {
        "source": "**",
        "headers": [
          { "key": "Cache-Control", "value": "no-cache" }
        ]
      }
    ]
  }
}
```

- [ ] **Step 3: 寫入 `legacy/.firebaserc`**

```json
{
  "projects": {
    "default": "opencode-sk"
  }
}
```

- [ ] **Step 4: 寫入煙霧測試頁 `legacy/index.html`（自包含，不引用外部檔）**

```html
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>相容性測試</title>
<style>
  body { font-family: -apple-system, "Microsoft JhengHei", sans-serif; margin: 12px; }
  h1 { font-size: 17px; line-height: 1.5; }
  #grid { display: grid; grid-template-columns: repeat(auto-fill, 48px); grid-row-gap: 6px; grid-column-gap: 6px; }
  .ball { width: 48px; height: 48px; border-radius: 50%; background: #1a73e8; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; }
  .cell { width: 48px; height: 48px; border-radius: 3px; background: #9aa0a6; color: #fff; display: flex; align-items: center; justify-content: center; }
</style>
</head>
<body>
<h1>相容性測試：若下方出現圓球與方格，代表此裝置可執行本 App 的舊語法版本</h1>
<div id="grid"></div>
<script>
(function () {
  var grid = document.getElementById("grid");
  for (var i = 1; i <= 24; i++) {
    var el = document.createElement("div");
    el.className = (i % 2 === 0) ? "ball" : "cell";
    el.textContent = i;
    grid.appendChild(el);
  }
})();
</script>
</body>
</html>
```

- [ ] **Step 5: 本機快速檢查（可選）**

Run（在 `legacy/` 目錄）：`npx --yes serve .`
Expected: 開 `http://localhost:3000` 能看到 24 個球與方格交錯。

- [ ] **Step 6: 部署（在 `legacy/` 目錄內執行）**

Run（workdir = `legacy`）：
```
firebase deploy --only hosting
```
Expected: 輸出含 `Hosting URL: https://mhb-legacy-sk.web.app`。

- [ ] **Step 7: 實機驗收（使用者操作，Phase 1）**

請使用者在舊 iPad 開啟 `https://mhb-legacy-sk.web.app`。
Expected: 看到 24 個藍色圓球與灰色方格。
若**沒有**出現 → 停止後續任務，回報（代表相容策略需重新評估）。

- [ ] **Step 8: Commit**

```
git add legacy/firebase.json legacy/.firebaserc legacy/index.html
git commit -m "feat(legacy): 獨立 hosting site 與 Safari 10 煙霧測試頁"
```

---

### Task 2: `legacy/core.js` 邏輯移植 ＋ 差分測試 ＋ 語法閘門

**Files:**
- Create: `legacy/core.js`
- Create: `tests/legacy-core.test.js`
- Create: `tests/legacy-compat.test.js`
- Modify: `package.json`（新增 devDependency `acorn`）

**Interfaces:**
- Consumes: 原版 `src/core.js`（唯讀，作為等價比對基準）。
- Produces:
  - 全域 `window.MHB`：物件，含 `TOTAL` 與所有核心函式（`todayStr`、`createState`、`apply`、`undo`、`ballStatus`、`orderUpTo`、`setCurrent`、`batchCut`、`cutThrough`、`lightUp`、`toggleOverdue`、`cutOverdue`、`setMinutes`、`resetAll`、`queuePositions`、`formatAccum`、`estimate`、`recordDaily`、`pruneDaily`、`rollover`、`resetDay`、`setScheduled`、`cutBall`、`revertToGray`）。
  - Task 3／4 依賴此介面名稱。

- [ ] **Step 1: 寫入差分測試 `tests/legacy-core.test.js`（先寫，會失敗）**

```js
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import * as src from "../src/core.js";

function loadLegacy() {
  const code = readFileSync(new URL("../legacy/core.js", import.meta.url), "utf8");
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  const ctx = createContext(sandbox);
  runInContext(code, ctx, { filename: "legacy/core.js" });
  return sandbox.MHB;
}

function scenario(C) {
  let s = C.createState();
  s = C.orderUpTo(s, 58);
  s = C.setCurrent(s, 18, "15:00");
  s = C.toggleOverdue(s, 10);
  s = C.toggleOverdue(s, 12);
  s = C.batchCut(s, 18);
  s = C.lightUp(s, 30, "15:30");
  s = C.setScheduled(s, 40, "16:00");
  s = C.cutBall(s, 5);
  s = C.revertToGray(s, 25);
  s = C.cutThrough(s, 3);
  s = C.undo(s);
  const statuses = [];
  for (let i = 1; i <= C.TOTAL; i++) statuses.push(C.ballStatus(s, i));
  return {
    statuses,
    queue: C.queuePositions(s),
    est19: C.estimate(s, 19),
    est40: C.estimate(s, 40),
    fmt: [C.formatAccum(45), C.formatAccum(60), C.formatAccum(195)],
    summary: {
      maxOrdered: s.maxOrdered,
      current: s.current,
      overdue: s.overdue,
      cut: s.cut,
      scheduled: s.scheduled,
      grayOut: s.grayOut,
      minutes: s.minutes,
      t0: s.t0,
      historyLen: s.history.length,
    },
  };
}

describe("legacy/core.js 與 src/core.js 行為等價", () => {
  it("同一串操作後狀態、狀態查詢與估計一致", () => {
    const M = loadLegacy();
    expect(scenario(M)).toEqual(scenario(src));
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run tests/legacy-core.test.js`
Expected: FAIL（`ENOENT` 找不到 `legacy/core.js`）。

- [ ] **Step 3: 寫入 `legacy/core.js`（完整移植）**

```js
/* 魔法盒人數球 — 相容版核心邏輯（Safari 10 / ES2017 以內語法）
   行為與 src/core.js 相同，差異：非 ES 模組；物件展開改為 Object.assign；掛到 window.MHB。 */
(function () {
  "use strict";

  var TOTAL = 150;

  function todayStr(d) {
    d = d || new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function createState() {
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
      history: []
    };
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function apply(state, mutator) {
    var s = clone(state);
    var history = Array.from(state.history);
    delete s.history;
    var before = clone(s);
    mutator(s);
    if (JSON.stringify(before) === JSON.stringify(s)) return state;
    history.push(before);
    if (history.length > 100) history.shift();
    return Object.assign({}, s, { history: history });
  }

  function undo(state) {
    if (!state.history.length) return state;
    var history = Array.from(state.history);
    var prev = history.pop();
    if (!prev) return state;
    return Object.assign({}, clone(state), prev, { history: history });
  }

  function cutPush(s, n) {
    if (s.cut.indexOf(n) === -1) s.cut.push(n);
    s.cut.sort(function (a, b) { return a - b; });
  }

  function ballStatus(state, n) {
    if (state.cut.indexOf(n) >= 0) return "cut";
    if (state.current === n) return "orange";
    if (state.overdue.indexOf(n) >= 0) return "overdue";
    if (state.grayOut.indexOf(n) >= 0) return "gray";
    if (n <= state.maxOrdered) return "blue";
    return "gray";
  }

  function orderUpTo(state, n) {
    if (n < 1 || n > TOTAL) return state;
    if (state.cut.indexOf(n) >= 0) return state;
    return apply(state, function (s) {
      if (n > s.maxOrdered) s.maxOrdered = n;
      var gi = s.grayOut.indexOf(n);
      if (gi >= 0) s.grayOut.splice(gi, 1);
    });
  }

  function lightMutate(s, n, nowHHMM) {
    if (s.current !== null && s.current !== n) cutPush(s, s.current);
    s.current = n;
    var oi = s.overdue.indexOf(n);
    if (oi >= 0) s.overdue.splice(oi, 1);
    if (n > s.maxOrdered) s.maxOrdered = n;
    if (nowHHMM) s.t0 = nowHHMM;
  }

  function setCurrent(state, n, nowHHMM) {
    if (nowHHMM === undefined) nowHHMM = null;
    if (n < 1 || n > TOTAL) return state;
    var st = ballStatus(state, n);
    if (st === "gray" || st === "cut") return state;
    if (state.current === n) return state;
    return apply(state, function (s) { lightMutate(s, n, nowHHMM); });
  }

  function batchCut(state, n) {
    if (n < 1 || n > TOTAL) return state;
    return apply(state, function (s) {
      for (var i = 1; i <= n; i++) {
        if (i === s.current) continue;
        if (s.overdue.indexOf(i) >= 0) continue;
        if (s.scheduled.some(function (o) { return o.n === i; })) continue;
        if (s.grayOut.indexOf(i) >= 0) continue;
        if (i > s.maxOrdered) continue;
        cutPush(s, i);
      }
    });
  }

  function cutSweep(s, from, to, keepCurrent) {
    for (var i = from; i <= to; i++) {
      if (keepCurrent && i === s.current) continue;
      if (s.overdue.indexOf(i) >= 0) continue;
      var gi = s.grayOut.indexOf(i);
      if (gi >= 0) s.grayOut.splice(gi, 1);
      s.scheduled = s.scheduled.filter(function (o) { return o.n !== i; });
      cutPush(s, i);
    }
  }

  function cutThrough(state, n) {
    if (n < 1 || n > TOTAL) return state;
    return apply(state, function (s) {
      cutSweep(s, 1, n, true);
      if (n > s.maxOrdered) s.maxOrdered = n;
    });
  }

  function lightUp(state, n, nowHHMM) {
    if (nowHHMM === undefined) nowHHMM = null;
    if (n < 1 || n > TOTAL) return state;
    var st = ballStatus(state, n);
    if (st === "cut" || st === "orange") return state;
    return apply(state, function (s) {
      cutSweep(s, 1, n - 1, false);
      var gi = s.grayOut.indexOf(n);
      if (gi >= 0) s.grayOut.splice(gi, 1);
      lightMutate(s, n, nowHHMM);
    });
  }

  function toggleOverdue(state, n) {
    if (n < 1 || n > TOTAL) return state;
    return apply(state, function (s) {
      var i = s.overdue.indexOf(n);
      if (i >= 0) {
        s.overdue.splice(i, 1);
        return;
      }
      s.overdue.push(n);
      s.overdue.sort(function (a, b) { return a - b; });
      var ci = s.cut.indexOf(n);
      if (ci >= 0) s.cut.splice(ci, 1);
      if (s.current === n) s.current = null;
    });
  }

  function cutOverdue(state, n) {
    if (state.overdue.indexOf(n) < 0) return state;
    return apply(state, function (s) {
      s.overdue = s.overdue.filter(function (x) { return x !== n; });
      cutPush(s, n);
    });
  }

  function setMinutes(state, m) {
    var v = Math.max(1, Math.min(240, Math.round(m) || 15));
    return apply(state, function (s) { s.minutes = v; });
  }

  function resetAll(state) {
    return apply(state, function (s) {
      s.maxOrdered = 0;
      s.current = null;
      s.overdue = [];
      s.cut = [];
      s.scheduled = [];
      s.grayOut = [];
    });
  }

  function queuePositions(state) {
    var seq = [];
    for (var i = 1; i <= state.maxOrdered; i++) {
      if (i === state.current) continue;
      if (state.cut.indexOf(i) >= 0) continue;
      if (state.overdue.indexOf(i) >= 0) continue;
      if (state.grayOut.indexOf(i) >= 0) continue;
      seq.push(i);
    }
    var overdue = state.overdue
      .filter(function (o) {
        return o <= state.maxOrdered && state.cut.indexOf(o) < 0 && state.grayOut.indexOf(o) < 0;
      })
      .sort(function (a, b) { return a - b; });
    return state.current !== null ? [state.current].concat(seq, overdue) : seq.concat(overdue);
  }

  function minOfDay(hhmm) {
    var parts = hhmm.split(":");
    var h = Number(parts[0]);
    var m = Number(parts[1]);
    return (h || 0) * 60 + (m || 0);
  }

  function fmtTime(min) {
    var h = Math.floor(min / 60) % 24;
    var m = min % 60;
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  }

  function formatAccum(min) {
    var h = Math.floor(min / 60);
    var m = min % 60;
    if (h < 1) return m + "分";
    if (m === 0) return h + "小時";
    return h + "小時" + m + "分";
  }

  function estimate(state, n) {
    var pos = queuePositions(state).indexOf(n);
    if (pos === -1) return null;
    var accumMin = (pos + 1) * state.minutes;
    var sched = null;
    for (var i = 0; i < state.scheduled.length; i++) {
      if (state.scheduled[i].n === n) { sched = state.scheduled[i]; break; }
    }
    return { accumMin: accumMin, time: sched ? sched.time : fmtTime(minOfDay(state.t0) + accumMin) };
  }

  function recordDaily(daily, date, maxOrdered) {
    if (maxOrdered > 0) daily[date] = Math.max(daily[date] || 0, maxOrdered);
    return daily;
  }

  function pruneDaily(daily, today) {
    var d = new Date(today + "T00:00:00");
    d.setDate(d.getDate() - 90);
    var cutoff = todayStr(d);
    var keys = Object.keys(daily);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i] <= cutoff) delete daily[keys[i]];
    }
  }

  function rollover(state, today) {
    var daily = {};
    if (state.date !== today) {
      recordDaily(daily, state.date, state.maxOrdered);
      var base = clone(state);
      delete base.history;
      return {
        daily: daily,
        state: Object.assign({}, base, {
          maxOrdered: 0,
          current: null,
          overdue: [],
          cut: [],
          scheduled: [],
          grayOut: [],
          date: today,
          history: []
        })
      };
    }
    return { daily: daily, state: state };
  }

  function resetDay(state) {
    return apply(state, function (s) {
      s.maxOrdered = 0;
      s.current = null;
      s.overdue = [];
      s.cut = [];
      s.scheduled = [];
      s.grayOut = [];
      s.date = todayStr();
    });
  }

  function setScheduled(state, n, hhmm) {
    if (n < 1 || n > TOTAL || !/^\d{2}:\d{2}$/.test(hhmm)) return state;
    return apply(state, function (s) {
      s.scheduled = s.scheduled.filter(function (o) { return o.n !== n; });
      s.scheduled.push({ n: n, time: hhmm });
      s.scheduled.sort(function (a, b) { return a.n - b.n; });
    });
  }

  function cutBall(state, n) {
    if (n < 1 || n > TOTAL) return state;
    return apply(state, function (s) {
      if (s.current === n) s.current = null;
      s.overdue = s.overdue.filter(function (x) { return x !== n; });
      s.scheduled = s.scheduled.filter(function (o) { return o.n !== n; });
      var gi = s.grayOut.indexOf(n);
      if (gi >= 0) s.grayOut.splice(gi, 1);
      cutPush(s, n);
    });
  }

  function revertToGray(state, n) {
    if (n < 1 || n > TOTAL) return state;
    if (ballStatus(state, n) === "gray") return state;
    return apply(state, function (s) {
      if (s.current === n) s.current = null;
      s.overdue = s.overdue.filter(function (x) { return x !== n; });
      s.scheduled = s.scheduled.filter(function (o) { return o.n !== n; });
      var ci = s.cut.indexOf(n);
      if (ci >= 0) s.cut.splice(ci, 1);
      if (s.grayOut.indexOf(n) < 0) s.grayOut.push(n);
      s.grayOut.sort(function (a, b) { return a - b; });
    });
  }

  window.MHB = {
    TOTAL: TOTAL,
    todayStr: todayStr,
    createState: createState,
    apply: apply,
    undo: undo,
    ballStatus: ballStatus,
    orderUpTo: orderUpTo,
    setCurrent: setCurrent,
    batchCut: batchCut,
    cutThrough: cutThrough,
    lightUp: lightUp,
    toggleOverdue: toggleOverdue,
    cutOverdue: cutOverdue,
    setMinutes: setMinutes,
    resetAll: resetAll,
    queuePositions: queuePositions,
    formatAccum: formatAccum,
    estimate: estimate,
    recordDaily: recordDaily,
    pruneDaily: pruneDaily,
    rollover: rollover,
    resetDay: resetDay,
    setScheduled: setScheduled,
    cutBall: cutBall,
    revertToGray: revertToGray
  };
})();
```

- [ ] **Step 4: 執行差分測試確認通過**

Run: `npx vitest run tests/legacy-core.test.js`
Expected: PASS（1 passed）。

- [ ] **Step 5: 確認原版測試仍全綠**

Run: `npx vitest run tests/core.test.js`
Expected: PASS（78 passed）。

- [ ] **Step 6: 加入 `acorn` devDependency**

Run（專案根目錄）：
```
npm install -D acorn
```
Expected: `package.json` devDependencies 出現 `"acorn"`。

- [ ] **Step 7: 寫入語法閘門 `tests/legacy-compat.test.js`**

```js
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { parse } from "acorn";

const legacyDir = new URL("../legacy/", import.meta.url);
const stylePath = new URL("style.css", legacyDir);

describe("legacy JS 語法相容（可用 ES2017 解析 = 無 ES2018+ 語法）", () => {
  const jsFiles = readdirSync(legacyDir).filter((f) => f.endsWith(".js"));
  for (const f of jsFiles) {
    it(`${f} 無 ES2018+ 語法`, () => {
      const code = readFileSync(new URL(f, legacyDir), "utf8");
      expect(() => parse(code, { ecmaVersion: 2017 })).not.toThrow();
    });
  }
});

describe("legacy CSS 舊寫法", () => {
  const forbidden = [
    [/\bclamp\s*\(/, "clamp() 需 Safari 13.1"],
    [/aspect-ratio/, "aspect-ratio 需 Safari 15"],
    [/\binset\s*:/, "inset 需 Safari 14.1"],
    [/(^|[^-])\bgap\s*:/m, "flex/grid 的 gap 需 Safari 14.1（請用 grid-gap 或 margin）"],
    [/\bmin\s*\(/, "min() 需 Safari 13"],
  ];
  it("style.css 不含 Safari 10 不支援的屬性（若檔案存在）", () => {
    if (!existsSync(stylePath)) return;
    const css = readFileSync(stylePath, "utf8");
    for (const [re, msg] of forbidden) {
      expect(re.test(css), msg).toBe(false);
    }
  });
});
```

- [ ] **Step 8: 執行語法閘門**

Run: `npx vitest run tests/legacy-compat.test.js`
Expected: PASS（core.js 通過 ES2017 解析；style.css 尚不存在，CSS 檢查略過）。

- [ ] **Step 9: 全部測試一起跑**

Run: `npx vitest run`
Expected: 全數通過（原版 78 ＋ legacy 差分 1 ＋ 語法閘門）。

- [ ] **Step 10: Commit**

```
git add legacy/core.js tests/legacy-core.test.js tests/legacy-compat.test.js package.json package-lock.json
git commit -m "feat(legacy): core.js Safari 10 移植、差分測試與語法閘門"
```

---

### Task 3: `legacy/style.css` CSS 相容化

**Files:**
- Create: `legacy/style.css`
- Modify: `tests/legacy-compat.test.js`（無需改，Step 8 的 CSS 檢查會自動生效）

**Interfaces:**
- Consumes: Task 2 的 `legacy-compat.test.js`。
- Produces: `legacy/style.css`，供 Task 4 的 `legacy/index.html` 引用。

- [ ] **Step 1: 寫入 `legacy/style.css`（完整）**

```css
:root {
  --gray: #9aa0a6;
  --blue: #1a73e8;
  --orange: #f09300;
  --cut: #e53935;
  --ring: #b71c1c;
  --bg: #f5f5f5;
}

* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html, body { margin: 0; height: 100%; }
html { overflow: hidden; }
body {
  font-family: -apple-system, "Segoe UI", "Microsoft JhengHei", sans-serif;
  background: var(--bg);
  display: flex;
  flex-direction: column;
}

#topbar {
  position: -webkit-sticky;
  position: sticky;
  top: 0;
  z-index: 50;
  background: #fff;
  border-bottom: 1px solid #ddd;
  padding: 5px 5px 7px;
  box-shadow: 0 2px 6px rgba(0,0,0,.08);
}

.top-row { display: flex; flex-wrap: wrap; align-items: center; }
.top-row > * { margin: 3px 5px; }
h1 { margin: 0; font-size: 18px; padding-right: 8px; }

.clock {
  font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums;
  color: var(--orange); margin-left: auto; padding-right: 2px;
}

.overdue-hint { display: inline-flex; align-items: center; font-size: 12px; color: #666; }
.overdue-hint > * { margin-right: 4px; }
.overdue-hint > *:last-child { margin-right: 0; }
.overdue-hint .ov-label { white-space: nowrap; }
.overdue-hint .ov-none { color: #aaa; }
.overdue-hint .ov-chip {
  width: 22px; height: 22px; padding: 0; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums;
  color: #fff; background: var(--blue); cursor: pointer;
  border: 2px solid var(--ring); box-shadow: 0 0 0 1px #fff inset;
}

.row-label { font-size: 13px; color: #666; white-space: nowrap; }

#quickBtns { display: flex; flex-wrap: wrap; }
#quickBtns button { margin-right: 6px; margin-bottom: 6px; }
#quickBtns button {
  min-width: 46px; padding: 6px 10px; font-size: 15px; border-radius: 999px;
  border: 1px solid #bbb; background: #fff; cursor: pointer;
}

.legend { display: inline-flex; align-items: center; font-size: 13px; color: #444; white-space: nowrap; }
.legend > * { margin-right: 4px; }
.legend > *:last-child { margin-right: 0; }
.sw { display: inline-block; width: 18px; height: 18px; border-radius: 50%; border: 1px solid rgba(0,0,0,.2); }
.sw.gray { background: var(--gray); }
.sw.blue { background: var(--blue); }
.sw.orange { background: var(--orange); }
.sw.red { background: repeating-linear-gradient(45deg, #fff3f3 0 4px, var(--cut) 4px 8px); }
.sw.ring { background: var(--blue); box-shadow: 0 0 0 3px var(--ring) inset, 0 0 0 6px #fff; }

.gest { font-size: 13px; color: #444; background: #f0f0f0; padding: 2px 8px; border-radius: 999px; }

#controlRow .ctrl { font-size: 14px; display: inline-flex; align-items: center; }
#controlRow .ctrl > * { margin-right: 4px; }
#controlRow .ctrl > *:last-child { margin-right: 0; }
#controlRow input[type="number"] { width: 56px; padding: 4px 6px; font-size: 15px; }
#controlRow button {
  font-size: 14px; padding: 6px 10px; border-radius: 8px; border: 1px solid #bbb; background: #fff; cursor: pointer;
}
#controlRow button.ctrl-mode.active { background: var(--ring); color: #fff; border-color: var(--ring); }
#controlRow button.danger { color: var(--cut); border-color: var(--cut); }

#gridArea { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; }
#grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  grid-row-gap: 14px;
  grid-column-gap: 12px;
  padding: 14px 12px 40px;
  align-items: center;
}

.ball {
  user-select: none;
  -webkit-user-select: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 2px;
  cursor: pointer;
}
.ball .num {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 700;
  color: #fff;
  position: relative;
  background: var(--gray);
  border: 2px solid rgba(0,0,0,.15);
  -webkit-transition: -webkit-transform .06s;
  transition: transform .06s;
}
.ball:active .num { -webkit-transform: scale(.94); transform: scale(.94); }

.ball[data-st="blue"] .num { background: var(--blue); }
.ball[data-st="orange"] .num {
  background: var(--orange);
  box-shadow: 0 0 0 4px rgba(240,147,0,.28), 0 0 12px rgba(240,147,0,.5);
}
.ball[data-st="overdue"] .num { background: var(--blue); }
.ball[data-st="overdue"] .num:after {
  content: "";
  position: absolute;
  top: -6px; right: -6px; bottom: -6px; left: -6px;
  border-radius: 50%;
  border: 4px solid var(--ring);
}
.ball[data-st="cut"] .num {
  background: repeating-linear-gradient(45deg, #e8e8e8 0 6px, var(--cut) 6px 12px);
  color: #5b1212;
}
.ball[data-st="gray"] .num { background: var(--gray); color: rgba(255,255,255,.85); }

.ball .accum { font-size: 11px; color: #555; min-height: 14px; font-variant-numeric: tabular-nums; margin-top: 2px; }
.ball[data-st="cut"] .accum, .ball[data-st="gray"] .accum { visibility: hidden; }
.ball .when { font-size: 12px; font-weight: 600; color: #222; min-height: 14px; font-variant-numeric: tabular-nums; margin-top: 2px; }
.ball[data-st="cut"] .when, .ball[data-st="gray"] .when { visibility: hidden; }

@media (max-width: 600px) {
  .ball .num { width: 56px; height: 56px; font-size: 19px; }
  #grid { grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); }
}
@media (min-width: 1000px) {
  .ball .num { width: 80px; height: 80px; font-size: 27px; }
}

.modal {
  position: fixed; top: 0; right: 0; bottom: 0; left: 0; background: rgba(0,0,0,.4);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal.hidden { display: none; }
.hidden { display: none !important; }
.panel { background: #fff; border-radius: 12px; padding: 18px; width: 420px; max-width: 92vw; box-shadow: 0 8px 30px rgba(0,0,0,.25); }
.panel h2 { margin: 0 0 8px; font-size: 17px; }
.panel .hint { margin: 0 0 10px; font-size: 13px; color: #666; }
.panel input[type="time"] { font-size: 20px; width: 100%; padding: 8px; }
.panel .actions { display: flex; justify-content: flex-end; margin-top: 14px; }
.panel .actions button { margin-left: 8px; padding: 8px 14px; border-radius: 8px; border: 1px solid #bbb; background: #fff; font-size: 15px; cursor: pointer; }
.panel .actions button.danger { color: var(--cut); border-color: var(--cut); }
#recordList { max-height: 46vh; overflow-y: auto; list-style: none; margin: 0; padding: 0; }
#recordList li { display: flex; justify-content: space-between; padding: 6px 2px; border-bottom: 1px dashed #eee; font-size: 14px; }

#grid.cells {
  grid-template-columns: repeat(auto-fill, 48px);
  grid-row-gap: 2px;
  grid-column-gap: 2px;
  padding: 8px 8px 40px;
  align-items: stretch;
}
#grid.cells .ball {
  height: 48px;
  border-radius: 3px;
  padding: 1px 0;
  justify-content: center;
  background: var(--gray);
  border: 1px solid rgba(0,0,0,.08);
}
#grid.cells .ball .num {
  width: 100%;
  height: auto;
  border-radius: 0;
  border: 0;
  font-size: 18px;
  font-weight: 400;
  line-height: 1.15;
  color: #fff;
  position: static;
  background: transparent;
  margin: 0;
}
#grid.cells .ball:active .num { -webkit-transform: none; transform: none; }
#grid.cells .ball[data-st="blue"] { background: var(--blue); }
#grid.cells .ball[data-st="blue"] .num { background: transparent; }
#grid.cells .ball[data-st="orange"] { background: var(--orange); box-shadow: 0 0 0 4px rgba(240,147,0,.28), 0 0 12px rgba(240,147,0,.5); }
#grid.cells .ball[data-st="orange"] .num { background: transparent; box-shadow: none; }
#grid.cells .ball[data-st="overdue"] { background: var(--blue); box-shadow: 0 0 0 2px #fff, 0 0 0 5px var(--ring); }
#grid.cells .ball[data-st="overdue"] .num { background: transparent; box-shadow: none; }
#grid.cells .ball[data-st="overdue"] .num:after { content: none; }
#grid.cells .ball[data-st="cut"] { background: repeating-linear-gradient(45deg, #e8e8e8 0 6px, var(--cut) 6px 12px); }
#grid.cells .ball[data-st="cut"] .num { background: transparent; color: #5b1212; }
#grid.cells .ball[data-st="gray"] { background: var(--gray); }
#grid.cells .ball[data-st="gray"] .num { background: transparent; color: rgba(255,255,255,.9); }
#grid.cells .ball .accum { font-size: 10px; color: rgba(255,255,255,.92); min-height: 9px; line-height: 1.1; margin-top: 0; }
#grid.cells .ball[data-st="cut"] .accum { color: #5b1212; }
#grid.cells .ball .when { font-size: 10px; font-weight: 600; color: rgba(255,255,255,.95); min-height: 10px; line-height: 1.15; margin-top: 0; }
#grid.cells .ball[data-st="cut"] .when { color: #5b1212; }
#grid.cells .ball[data-sched="1"] .when { color: #7b1fa2; font-weight: 700; background: rgba(255,255,255,.95); border-radius: 3px; min-width: 24px; text-align: center; }

.ball[data-sched="1"] .when { color: #7b1fa2; font-weight: 700; visibility: visible; }
```

- [ ] **Step 2: 執行語法閘門（CSS 檢查開始生效）**

Run: `npx vitest run tests/legacy-compat.test.js`
Expected: PASS（style.css 無 clamp/aspect-ratio/inset/gap/min()）。

- [ ] **Step 3: Commit**

```
git add legacy/style.css
git commit -m "feat(legacy): style.css 改用 Safari 10 相容寫法"
```

---

### Task 4: `legacy/app.js` ＋ `legacy/index.html`（完整 UI）

**Files:**
- Create: `legacy/app.js`
- Modify: `legacy/index.html`（以完整版覆蓋 Task 1 的煙霧測試頁）

**Interfaces:**
- Consumes: `window.MHB`（Task 2）、`legacy/style.css`（Task 3）。
- Produces: 完整可操作的相容版 App。

- [ ] **Step 1: 寫入 `legacy/app.js`（完整移植 `src/main.js`）**

```js
/* 魔法盒人數球 — 相容版 UI 邏輯（Safari 10 / ES2017 以內語法）
   行為與 src/main.js 相同；差異：非 ES 模組；無 ?. / 數字底線 / replaceChildren；
   指標事件在舊 Safari 退回觸控事件。 */
(function () {
  "use strict";

  var Core = window.MHB;
  var TOTAL = 150;

  function $(id) { return document.getElementById(id); }

  var grid = $("grid");
  var clockEl = $("clock");
  var overdueHintEl = $("overdueHint");
  var recordKey = "mhb-daily";
  var viewKey = "mhb-view";
  var btnView = $("btnView");

  function isCellView() { return grid.classList.contains("cells"); }
  function updateViewBtn() { btnView.textContent = isCellView() ? "切換球" : "切換格子"; }

  function clearChildren(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function loadViewPref() {
    try { return localStorage.getItem(viewKey) || "balls"; }
    catch (e) { return "balls"; }
  }
  function saveViewPref(mode) {
    try { localStorage.setItem(viewKey, mode); } catch (e) { /* 忽略 */ }
  }

  function loadState() {
    try {
      var raw = localStorage.getItem("mhb-state");
      if (!raw) return Core.createState();
      var s = JSON.parse(raw);
      var base = Core.createState();
      s.history = Array.isArray(s.history) ? s.history : [];
      return Object.assign(base, s);
    } catch (e) {
      return Core.createState();
    }
  }

  function saveState(s) {
    try { localStorage.setItem("mhb-state", JSON.stringify(s)); } catch (e) { /* 忽略 */ }
  }

  function loadDaily() {
    try { return JSON.parse(localStorage.getItem(recordKey)) || {}; }
    catch (e) { return {}; }
  }
  function saveDaily(d) {
    try { localStorage.setItem(recordKey, JSON.stringify(d)); } catch (e) { /* 忽略 */ }
  }

  var state = loadState();
  var daily = loadDaily();
  Core.pruneDaily(daily, Core.todayStr());
  saveDaily(daily);

  function performRollover() {
    var today = Core.todayStr();
    if (state.date === today) return;
    var r = Core.rollover(state, today);
    Object.assign(daily, r.daily);
    Core.pruneDaily(daily, today);
    saveDaily(daily);
    state = r.state;
    saveState(state);
    renderAll();
  }

  function makeBallEl(n) {
    var el = document.createElement("div");
    el.className = "ball";
    el.dataset.n = n;
    var num = document.createElement("div");
    num.className = "num";
    num.textContent = n;
    var accum = document.createElement("div");
    accum.className = "accum";
    var when = document.createElement("div");
    when.className = "when";
    el.appendChild(num);
    el.appendChild(accum);
    el.appendChild(when);
    return el;
  }

  var balls = [];
  for (var i = 1; i <= TOTAL; i++) {
    var el = makeBallEl(i);
    balls.push(el);
    grid.appendChild(el);
  }

  function renderOverdueHint() {
    var list = Array.from(new Set(state.overdue)).sort(function (a, b) { return a - b; });
    clearChildren(overdueHintEl);
    var label = document.createElement("span");
    label.className = "ov-label";
    label.textContent = "過號";
    overdueHintEl.appendChild(label);
    if (!list.length) {
      var none = document.createElement("span");
      none.className = "ov-none";
      none.textContent = "無";
      overdueHintEl.appendChild(none);
      return;
    }
    for (var j = 0; j < list.length; j++) {
      var n = list[j];
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "ov-chip";
      chip.dataset.n = n;
      chip.textContent = n;
      chip.title = "跳到 " + n + " 號";
      overdueHintEl.appendChild(chip);
    }
  }

  function renderAll() {
    var seq = Core.queuePositions(state);
    var seqSet = new Set(seq);
    for (var i = 0; i < TOTAL; i++) {
      var n = i + 1;
      var el = balls[i];
      var st = Core.ballStatus(state, n);
      el.dataset.st = st;
      var sched = false;
      for (var k = 0; k < state.scheduled.length; k++) {
        if (state.scheduled[k].n === n) { sched = true; break; }
      }
      el.dataset.sched = sched ? "1" : "";
      var accumEl = el.querySelector(".accum");
      var whenEl = el.querySelector(".when");
      if (seqSet.has(n)) {
        var e = Core.estimate(state, n);
        accumEl.textContent = "+" + Core.formatAccum(e.accumMin);
        whenEl.textContent = e.time;
      } else {
        accumEl.textContent = "";
        whenEl.textContent = "";
      }
    }
    renderOverdueHint();
  }

  var overdueModeBtn = $("overdueMode");
  var minutesInput = $("minutesInput");
  var quickBtns = $("quickBtns");
  var btnRecords = $("btnRecords");
  var btnReset = $("btnReset");
  var btnUndo = $("btnUndo");
  var btnFullscreen = $("btnFullscreen");
  var dlgTime = $("dlgTime");
  var dlgRecords = $("dlgRecords");
  var dlgConfirm = $("dlgConfirm");
  var baseTimeInput = $("baseTimeInput");
  var recordList = $("recordList");

  var btnLight = $("btnLight");
  var btnSchedule = $("btnSchedule");
  var btnUnorder = $("btnUnorder");
  var btnCut = $("btnCut");

  var activeMode = null;
  var MODE_BTNS = {
    light: btnLight,
    schedule: btnSchedule,
    cut: btnCut,
    unorder: btnUnorder,
    overdue: overdueModeBtn
  };
  var pendingSchedule = { n: null };

  function refreshTop() {
    var modes = ["light", "schedule", "cut", "unorder", "overdue"];
    for (var i = 0; i < modes.length; i++) {
      var mode = modes[i];
      if (activeMode === mode) MODE_BTNS[mode].classList.add("active");
      else MODE_BTNS[mode].classList.remove("active");
    }
    minutesInput.value = state.minutes;
  }

  function commit(next) {
    if (next) state = next;
    saveState(state);
    renderAll();
    refreshTop();
  }

  function nowHHMM() {
    var d = new Date();
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  function handleBallAction(n, dir) {
    if (dir === "left") { commit(Core.batchCut(state, n)); return; }
    if (dir === "right") { commit(Core.orderUpTo(state, n)); return; }
    var st = Core.ballStatus(state, n);
    switch (activeMode) {
      case "light":
        commit(Core.lightUp(state, n, nowHHMM()));
        break;
      case "schedule":
        pendingSchedule.n = n;
        baseTimeInput.value = nowHHMM();
        dlgTime.classList.remove("hidden");
        break;
      case "cut":
        commit(Core.cutBall(state, n));
        break;
      case "unorder":
        commit(Core.revertToGray(state, n));
        break;
      case "overdue":
        commit(Core.toggleOverdue(state, n));
        break;
      default:
        if (st === "overdue") commit(Core.cutOverdue(state, n));
        else commit(Core.orderUpTo(state, n));
    }
  }

  // --- 手勢：有 PointerEvent 用指標事件，否則退回觸控事件 ---
  var gestureStart = null;

  function closestBall(target) {
    if (!target || !target.closest) return null;
    return target.closest(".ball");
  }
  function gestureBegin(n, x, y, id) {
    gestureStart = { x: x, y: y, n: n, id: id, done: false };
  }
  function gestureMove(x, y, id, evt) {
    if (!gestureStart || id !== gestureStart.id) return;
    var dx = x - gestureStart.x;
    var dy = y - gestureStart.y;
    if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) {
      if (evt && evt.cancelable) evt.preventDefault();
      if (!gestureStart.done) {
        gestureStart.done = true;
        handleBallAction(gestureStart.n, dx > 0 ? "right" : "left");
      }
    }
  }
  function gestureEnd(x, y, id) {
    if (!gestureStart || id !== gestureStart.id) return;
    var g = gestureStart;
    gestureStart = null;
    if (g.done) return;
    var dx = x - g.x;
    var dy = y - g.y;
    if (Math.hypot(dx, dy) < 30) handleBallAction(g.n, "tap");
  }
  function findTouch(list, id) {
    for (var t = 0; t < list.length; t++) {
      if (list[t].identifier === id) return list[t];
    }
    return null;
  }

  if (window.PointerEvent) {
    grid.addEventListener("pointerdown", function (e) {
      var ball = closestBall(e.target);
      if (!ball) return;
      gestureBegin(+ball.dataset.n, e.clientX, e.clientY, e.pointerId);
      if (grid.setPointerCapture) { try { grid.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ } }
    });
    grid.addEventListener("pointermove", function (e) {
      gestureMove(e.clientX, e.clientY, e.pointerId, null);
    });
    grid.addEventListener("pointerup", function (e) {
      gestureEnd(e.clientX, e.clientY, e.pointerId);
    });
    grid.addEventListener("pointercancel", function () { gestureStart = null; });
  } else {
    grid.addEventListener("touchstart", function (e) {
      var ball = closestBall(e.target);
      if (!ball) return;
      var t = e.changedTouches[0];
      gestureBegin(+ball.dataset.n, t.clientX, t.clientY, t.identifier);
    }, false);
    grid.addEventListener("touchmove", function (e) {
      if (!gestureStart) return;
      var t = findTouch(e.changedTouches, gestureStart.id);
      if (!t) return;
      gestureMove(t.clientX, t.clientY, gestureStart.id, e);
    }, false);
    grid.addEventListener("touchend", function (e) {
      if (!gestureStart) return;
      var t = findTouch(e.changedTouches, gestureStart.id);
      if (!t) return;
      gestureEnd(t.clientX, t.clientY, t.identifier);
    }, false);
    grid.addEventListener("touchcancel", function () { gestureStart = null; }, false);
  }
  grid.addEventListener("dblclick", function (e) { e.preventDefault(); });
  document.addEventListener("gesturestart", function (e) { e.preventDefault(); });

  // --- 控制列 ---
  minutesInput.addEventListener("change", function () {
    var m = parseInt(minutesInput.value, 10);
    commit(Core.setMinutes(state, m));
  });
  function setMode(mode) {
    activeMode = activeMode === mode ? null : mode;
    refreshTop();
  }
  btnLight.addEventListener("click", function () { setMode("light"); });
  btnSchedule.addEventListener("click", function () { setMode("schedule"); });
  btnCut.addEventListener("click", function () { setMode("cut"); });
  btnUnorder.addEventListener("click", function () { setMode("unorder"); });
  overdueModeBtn.addEventListener("click", function () { setMode("overdue"); });
  btnUndo.addEventListener("click", function () { commit(Core.undo(state)); });

  quickBtns.addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-n]");
    if (!btn) return;
    scrollToBall(+btn.dataset.n);
  });

  overdueHintEl.addEventListener("click", function (e) {
    var chip = e.target.closest(".ov-chip");
    if (!chip) return;
    scrollToBall(+chip.dataset.n);
  });

  function scrollToBall(n) {
    var el = balls[n - 1];
    if (!el) return;
    var area = $("gridArea");
    var top = el.getBoundingClientRect().top - area.getBoundingClientRect().top + area.scrollTop - 8;
    if (top < 0) top = 0;
    area.scrollTop = top;
  }

  // --- 預定時間彈窗 ---
  $("btnTimeCancel").addEventListener("click", function () {
    dlgTime.classList.add("hidden");
    pendingSchedule.n = null;
  });
  $("btnTimeOk").addEventListener("click", function () {
    var val = baseTimeInput.value;
    if (pendingSchedule.n === null) return;
    if (!/^\d{2}:\d{2}$/.test(val)) return;
    commit(Core.setScheduled(state, pendingSchedule.n, val));
    pendingSchedule.n = null;
    dlgTime.classList.add("hidden");
  });

  // --- 每日紀錄 ---
  btnRecords.addEventListener("click", function () {
    clearChildren(recordList);
    var keys = Object.keys(daily).sort().reverse();
    if (!keys.length) {
      var empty = document.createElement("li");
      empty.textContent = "尚無紀錄";
      recordList.appendChild(empty);
    } else {
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        var li = document.createElement("li");
        var d = document.createElement("span");
        d.textContent = k;
        var c = document.createElement("span");
        c.textContent = daily[k] + " 顆";
        li.appendChild(d);
        li.appendChild(c);
        recordList.appendChild(li);
      }
    }
    dlgRecords.classList.remove("hidden");
  });
  $("btnRecordsClose").addEventListener("click", function () { dlgRecords.classList.add("hidden"); });

  // --- 每日重置 ---
  btnReset.addEventListener("click", function () { dlgConfirm.classList.remove("hidden"); });
  $("btnConfirmNo").addEventListener("click", function () { dlgConfirm.classList.add("hidden"); });
  $("btnConfirmYes").addEventListener("click", function () {
    if (state.maxOrdered > 0 && state.date === Core.todayStr()) {
      daily[state.date] = Math.max(daily[state.date] || 0, state.maxOrdered);
    }
    Core.pruneDaily(daily, Core.todayStr());
    saveDaily(daily);
    commit(Core.resetAll(state));
    dlgConfirm.classList.add("hidden");
  });

  // --- 全螢幕（不支援則隱藏）---
  if (document.documentElement.requestFullscreen && document.fullscreenEnabled !== false) {
    btnFullscreen.addEventListener("click", function () {
      try {
        if (!document.fullscreenElement) {
          var p = document.documentElement.requestFullscreen();
          if (p && p.catch) p.catch(function () { /* 忽略 */ });
        } else {
          document.exitFullscreen();
        }
      } catch (err) { /* 忽略 */ }
    });
  } else {
    btnFullscreen.classList.add("hidden");
  }

  // --- 版面切換 ---
  btnView.addEventListener("click", function () {
    if (isCellView()) grid.classList.remove("cells");
    else grid.classList.add("cells");
    saveViewPref(isCellView() ? "cells" : "balls");
    updateViewBtn();
  });

  refreshTop();

  function updateClock() {
    var d = new Date();
    var hh = String(d.getHours()).padStart(2, "0");
    var mm = String(d.getMinutes()).padStart(2, "0");
    var ss = String(d.getSeconds()).padStart(2, "0");
    clockEl.textContent = hh + ":" + mm + ":" + ss;
    performRollover();
  }

  var BASE = 60000;
  setInterval(updateClock, 1000);
  setInterval(renderAll, BASE);

  (function init() {
    if (loadViewPref() === "cells") grid.classList.add("cells");
    updateViewBtn();
    performRollover();
    updateClock();
    renderAll();
  })();
})();
```

- [ ] **Step 2: 以完整版覆蓋 `legacy/index.html`**

```html
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport"
  content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<meta name="format-detection" content="telephone=no">
<title>魔法箱人數球</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<header id="topbar">
  <div class="top-row">
    <h1>魔法箱人數球</h1>
    <div id="overdueHint" class="overdue-hint" title="目前過號的號碼（點號碼可跳到該球）"></div>
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
    <span class="legend"><i class="sw orange"></i>亮燈中</span>
    <span class="legend"><i class="sw red"></i>已剪</span>
    <span class="legend"><i class="sw ring"></i>過號</span>
  </div>

  <div class="top-row" id="gestureLegend">
    <span class="row-label">滑動手勢</span>
    <span class="gest">← 批量剪完</span>
    <span class="gest">→ 下訂</span>
  </div>

  <div class="top-row" id="controlRow">
    <label class="ctrl">每球<input id="minutesInput" type="number" min="1" max="240" value="15" inputmode="numeric">分</label>
    <button type="button" id="btnView">切換格子</button>
    <button type="button" id="btnLight" class="ctrl-mode">亮燈</button>
    <button type="button" id="btnSchedule" class="ctrl-mode">預定時間</button>
    <button type="button" id="btnUnorder" class="ctrl-mode">未下訂</button>
    <button type="button" id="btnCut" class="ctrl-mode">剪完</button>
    <button type="button" id="overdueMode" class="ctrl-mode">過號</button>
    <button type="button" id="btnRecords">每日紀錄</button>
    <button type="button" id="btnReset" class="danger">每日重置</button>
    <button type="button" id="btnUndo">返回</button>
    <button type="button" id="btnFullscreen">全螢幕</button>
  </div>
</header>

<main id="gridArea">
  <div id="grid" aria-label="人數球"></div>
</main>

<div id="dlgTime" class="modal hidden">
  <div class="panel">
    <h2>預定時間</h2>
    <p class="hint">輸入此顆號碼球的預約時間，該球時刻改顯示這組時間。</p>
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

<script src="core.js"></script>
<script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 3: 執行語法閘門（app.js 納入檢查）**

Run: `npx vitest run tests/legacy-compat.test.js`
Expected: PASS（`core.js`、`app.js` 皆通過 ES2017 解析）。

- [ ] **Step 4: 全部測試**

Run: `npx vitest run`
Expected: 全數通過。

- [ ] **Step 5: 本機手動檢查（可選）**

Run（在 `legacy/` 目錄）：`npx --yes serve .`
Expected: 開 `http://localhost:3000` 看到 150 顆球；點球、左/右滑、切換格子、開彈窗皆正常（與原版一致）。

- [ ] **Step 6: 確認原版四檔零變動**

Run: `git diff --stat 9973eb5 -- index.html src/`
Expected: 無任何輸出（原版檔案未變動）。

- [ ] **Step 7: Commit**

```
git add legacy/app.js legacy/index.html
git commit -m "feat(legacy): 完整 UI 移植（app.js 與 index.html）"
```

---

### Task 5: 部署、網址文件與實機驗收

**Files:**
- Modify: `網址.txt`

**Interfaces:**
- Consumes: Task 1～4 全部產出。
- Produces: 線上相容版與更新後的網址文件。

- [ ] **Step 1: 部署相容版（在 `legacy/` 目錄內執行）**

Run（workdir = `legacy`）：
```
firebase deploy --only hosting
```
Expected: 輸出含 `Hosting URL: https://mhb-legacy-sk.web.app`。

- [ ] **Step 2: 更新 `網址.txt`**

在檔尾追加（保留原有內容）：

```
--- Safari 10 相容版（舊 iPad 用）---
https://mhb-legacy-sk.web.app
```

- [ ] **Step 3: 實機驗收（使用者操作，Phase 3）**

請使用者在舊 iPad 開啟 `https://mhb-legacy-sk.web.app`，逐項確認：
- 150 顆球正常顯示；「切換格子」可切到格子視圖。
- 上下可捲動；左右滑動手勢（← 批量剪完、→ 下訂）可用。
- 各模式按鈕（亮燈／預定時間／未下訂／剪完／過號）可點且生效。
- 點球、快捷跳號、過號提示跳轉、每日紀錄、每日重置、返回正常。
- 記錄操作流暢度（是否有明顯鈍感）。

Expected: 各項正常；如有鈍感，記錄下來但視為硬體限制。

- [ ] **Step 4: 確認原版不受影響**

請使用者（或自行）開啟原版 `https://mhb-sk.web.app`。
Expected: 與現狀完全一致（未重新部署）。

- [ ] **Step 5: Commit**

```
git add 網址.txt
git commit -m "docs: 網址文件加入 Safari 10 相容版網址"
```

---

## Self-Review

**Spec coverage：**
- §1 根因／§4 JS 替換 → Task 2（core）＋Task 4（app）。
- §2 隔離策略（獨立 site、不動根設定）→ Task 1。
- §3 檔案結構 → Task 1～4。
- §5 CSS → Task 3。
- §6.1 原版零回歸 → Task 2 Step 5、Task 4 Step 6。
- §6.2 差分測試 → Task 2。
- §6.3 語法閘門 → Task 2 Step 7、Task 4 Step 3。
- §6.4 分階段驗收 → Task 1（Phase 1）、Task 4 Step 5、Task 5 Step 3。
- §6.5 部署與測試網址 → Task 1、Task 5。
- §7 風險 → Task 1 Step 7 的停止條件、Task 5 Step 3 的鈍感記錄。
- §8 驗收標準 → Task 4 Step 6、Task 5 Step 3／4。

**Placeholder scan：** 無 TBD／TODO；所有程式碼步驟均含完整內容。

**Type consistency：** 全域命名空間固定為 `window.MHB`（Task 2 產生，Task 4 以 `Core.` 取用）；Task 2 匯出名稱與 Task 4 呼叫名稱逐一對齊；CSS 類別與 `index.html`／`app.js` 產生的 `class` 名稱（`ball`、`num`、`accum`、`when`、`cells`、`ov-chip`、`ctrl-mode`、`active`、`hidden`）一致。

**已知偏差：** 設計文件 §6.5 寫以 `--config legacy/firebase.json` 部署；本計畫改用「在 `legacy/` 目錄內執行部署」以確保 `public` 路徑解析正確（等效且更可靠，根設定仍不動）。
