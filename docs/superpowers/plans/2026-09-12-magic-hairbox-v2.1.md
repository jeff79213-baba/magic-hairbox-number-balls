# 魔法盒人數球 v2.1 互動修訂 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **狀態：已於 2026-09-12 完成並提交（commit `229ba21`）。** 以下步驟為**實際執行記錄**（as-executed），全部核取；程式碼片段即最終落地的版本。設計依據見 `docs/superpowers/specs/2026-09-12-magic-hairbox-v2.1-design.md`。
>
> 同日另追加 `lightUp`（亮燈不限球色：前段剪完＋按的那顆亮燈、不被剪），見文末「增補 Task A」。

**Goal:** 修訂 v2 的三處互動摩擦：批量剪完要含操作的那顆球、灰色球可用「亮燈」一次剪完、四個模式（預定時間／剪完／未下訂／過號）對任何狀態都可執行；並把「還原」改名為「返回」、在標題右側加上過號提示。

**Architecture:** 沿用 v2 單一自包含 Web App。純邏輯在 `src/core.js`（Vitest 可測）；`src/main.js` 負責 DOM、模式分流與手勢；`index.html`＋`src/style.css` 負責版面。狀態存 localStorage（`mhb-state`、`mhb-daily`），本次**不新增欄位**，無資料移轉。

**Tech Stack:** 原生 HTML/CSS/JS（零外部依賴）；dev 依賴只有 Vitest。

## Global Constraints

- 全部繁體中文介面。
- 號碼球 1~150；狀態：`gray` 未下訂、`blue` 已下訂、`orange` 亮燈中、`overdue` 過號、`cut` 已剪。
- 批量剪完（左滑）跳過：`current`（亮燈中）、`overdue`（過號）、`scheduled`（有預定時間）、`grayOut`（未下訂）；**含滑動的那顆球本身**。
- `cutThrough` 只跳過 `current` 與 `overdue`，其餘（含未下訂與有預定時間者）一併剪完，並把 `maxOrdered` 帶到 `n`。
- 「預定時間」「剪完」「未下訂」「過號」四模式對**任何狀態**皆可執行。
- 有預定時間的球一律顯示預定時間（含灰色、已剪的球）。
- 模式按鈕互斥切換，再按一次取消；無模式＝預設下訂行為。
- localStorage key 前綴 `mhb-`；狀態格式與 v1／v2 相容。

---

### Task 1: core.js 批量剪完含本球 ＋ 新增 cutThrough

**Files:**
- Modify: `src/core.js`
- Modify: `tests/core.test.js`

**Interfaces:**
- Consumes: 既有 `apply`、`cutPush`、`TOTAL`。
- Produces（Task 2 依賴）:
  - `batchCut(state, n)` — 迴圈改為 `1..n`
  - `cutThrough(state, n) → newState` — 新匯出函式

- [x] **Step 1: batchCut 迴圈改為含本球**

`src/core.js`：

```js
// 批量剪完：含點擊／滑動的那顆號碼本身（1..n），跳過亮燈中、過號、有預定時間與未下訂的球
// （未下訂的球請改用 cutThrough，見下方註解）
export function batchCut(state, n) {
  if (n < 1 || n > TOTAL) return state;
  return apply(state, (s) => {
    for (let i = 1; i <= n; i++) {
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

- [x] **Step 2: 於 batchCut 之後新增 cutThrough**

```js
// 亮燈於灰色（未下訂）球：把該號碼與之前的所有號碼一次改為剪完（含未下訂者），
// 但過號的球保留過號，亮燈中的球也保留。
export function cutThrough(state, n) {
  if (n < 1 || n > TOTAL) return state;
  return apply(state, (s) => {
    for (let i = 1; i <= n; i++) {
      if (i === s.current) continue;
      if (s.overdue.includes(i)) continue;
      const gi = s.grayOut.indexOf(i);
      if (gi >= 0) s.grayOut.splice(gi, 1);
      s.scheduled = s.scheduled.filter((o) => o.n !== i);
      cutPush(s, i);
    }
    if (n > s.maxOrdered) s.maxOrdered = n;
  });
}
```

- [x] **Step 3: 更新測試 import 並調整 batchCut 斷言**

`tests/core.test.js` import 加入 `cutThrough`；`batchCut` 測試改為：

```js
    expect(ballStatus(state, 35)).toBe("cut"); // 含滑動的號碼本身
    expect(ballStatus(state, 34)).toBe("cut");
    expect(ballStatus(state, 36)).toBe("blue");
```

- [x] **Step 4: 新增 cutThrough 測試群**

```js
describe("cutThrough", () => {
  it("灰球亮燈：該號碼與之前全部變 cut（含未下訂者）", () => {
    state = orderUpTo(state, 30);
    state = cutThrough(state, 40);
    expect(ballStatus(state, 40)).toBe("cut");
    expect(ballStatus(state, 31)).toBe("cut");
    expect(ballStatus(state, 1)).toBe("cut");
    expect(ballStatus(state, 41)).toBe("gray");
    expect(state.grayOut).toEqual([]);
  });
  it("過號保留過號，亮燈中的球保留亮燈", () => {
    state = orderUpTo(state, 30);
    state = setCurrent(state, 5, "15:00");
    state = toggleOverdue(state, 10);
    state = cutThrough(state, 30);
    expect(ballStatus(state, 10)).toBe("overdue");
    expect(ballStatus(state, 5)).toBe("orange");
    expect(ballStatus(state, 20)).toBe("cut");
  });
  it("已剪／有預定時間的球也一併整理為 cut", () => {
    state = orderUpTo(state, 30);
    state = setScheduled(state, 20, "14:00");
    state = cutBall(state, 25);
    state = cutThrough(state, 30);
    expect(ballStatus(state, 20)).toBe("cut");
    expect(state.scheduled).toEqual([]);
    expect(ballStatus(state, 25)).toBe("cut");
  });
  it("下滑的號碼為 maxOrdered 之上：一併納入（仍保留過號）", () => {
    state = orderUpTo(state, 10);
    state = cutThrough(state, 12);
    expect(state.maxOrdered).toBe(12);
    expect(ballStatus(state, 12)).toBe("cut");
  });
  it("邊界 0 / 151：直接忽略", () => {
    state = cutThrough(state, 0);
    expect(state.cut).toEqual([]);
    state = cutThrough(state, 151);
    expect(state.cut).toEqual([]);
  });
});
```

- [x] **Step 5: 跑測試**

Run: `npx vitest run`
Expected: PASS

---

### Task 2: main.js 亮燈分流（灰球走 cutThrough）

**Files:**
- Modify: `src/main.js`

- [x] **Step 1: import 加入 cutThrough**

```js
  orderUpTo, setCurrent, batchCut, cutThrough, toggleOverdue, cutOverdue,
```

- [x] **Step 2: handleBallAction 的 light 分支分流**

```js
    case "light":
      // 灰球（未下訂）：該號碼與之前的一次剪完（過號保留），不亮燈
      if (st === "gray") commit(cutThrough(state, n));
      // 藍球以外的狀態（過號／亮燈中／已剪）在 lightUp 內即 no-op
      else commit(lightUp(state, n, nowHHMM()));
      break;
```

（本步驟當時為 `setCurrent(state, n, nowHHMM())`；同日追加的增補 Task A 改為 `lightUp`，使**任何球色**亮燈時前段都一併剪完、而按的那顆亮燈不被剪。`setCurrent` 的 gray／cut 限制不變，仍保留在 core 供外部／測試使用。）

- [x] **Step 3: 語法檢查與測試**

Run: `node --check src/main.js`
Run: `npx vitest run`
Expected: 無錯誤；PASS

---

### Task 3: core.js 四模式解除狀態限制

**Files:**
- Modify: `src/core.js`
- Modify: `tests/core.test.js`

**Interfaces:**
- Produces: `setScheduled`／`toggleOverdue`／`revertToGray` 不再回傳 no-op 於「非 blue／overdue」的球。

- [x] **Step 1: setScheduled 移除狀態判斷**

```js
// 預定時間：任何狀態的球都可設定（灰色／已剪／亮燈中皆可，時間以小字顯示在球下方）
export function setScheduled(state, n, hhmm) {
  if (n < 1 || n > TOTAL || !/^\d{2}:\d{2}$/.test(hhmm)) return state;
  return apply(state, (s) => {
    s.scheduled = s.scheduled.filter((o) => o.n !== n);
    s.scheduled.push({ n, time: hhmm });
    s.scheduled.sort((a, b) => a.n - b.n);
  });
}
```

- [x] **Step 2: toggleOverdue 移除狀態判斷並處理 cut / current**

```js
// 過號切換：任何狀態的球都可執行（已剪者會改回過號、亮燈中者會退出亮燈）
export function toggleOverdue(state, n) {
  if (n < 1 || n > TOTAL) return state;
  return apply(state, (s) => {
    const i = s.overdue.indexOf(n);
    if (i >= 0) {
      s.overdue.splice(i, 1);
      return;
    }
    s.overdue.push(n);
    s.overdue.sort((a, b) => a - b);
    const ci = s.cut.indexOf(n);
    if (ci >= 0) s.cut.splice(ci, 1);
    if (s.current === n) s.current = null;
  });
}
```

- [x] **Step 3: revertToGray 移除「亮燈中 no-op」限制**

```js
// 未下訂（還原為灰）：任何狀態的球都可執行（亮燈中的球會一併退出亮燈）
export function revertToGray(state, n) {
  if (n < 1 || n > TOTAL) return state;
  if (ballStatus(state, n) === "gray") return state; // 已是灰色：no-op
  return apply(state, (s) => {
    if (s.current === n) s.current = null;
    s.overdue = s.overdue.filter((x) => x !== n);
    s.scheduled = s.scheduled.filter((o) => o.n !== n);
    const ci = s.cut.indexOf(n);
    if (ci >= 0) s.cut.splice(ci, 1);
    if (!s.grayOut.includes(n)) s.grayOut.push(n);
    s.grayOut.sort((a, b) => a - b);
  });
}
```

- [x] **Step 4: 更新既有測試**

- `describe("toggleOverdue")`：第一條改為單純來回切換；新增一條驗證「灰球可設、已剪改回過號（`cut` 不含該球）、亮燈中退出亮燈（`current` 為 `null`）」。
- `describe("setScheduled")`：把「gray / grayOut / cut / current 不可設」改為「任何狀態都可設」，並驗證球狀態維持不變（灰球設完仍是 `gray`、亮燈中仍是 `orange`、已剪仍是 `cut`）。
- `describe("revertToGray")`：「亮燈中的球不可還原（no-op）」改為「亮燈中的球可還原：退出亮燈並變灰」。

- [x] **Step 5: 跑測試**

Run: `npx vitest run`
Expected: PASS

---

### Task 4: main.js 移除預定時間的前端限制

**Files:**
- Modify: `src/main.js`

- [x] **Step 1: schedule 分支移除 early-return**

`handleBallAction` 的 `schedule` 分支刪除整行 `if (st === "gray" || st === "cut" || st === "orange") break;`，改為任何狀態點球都開啟時間輸入彈窗：

```js
    case "schedule":
      pendingSchedule.n = n;
      baseTimeInput.value = nowHHMM();
      dlgTime.classList.remove("hidden");
      break;
```

- [x] **Step 2: 語法檢查與測試**

Run: `node --check src/main.js`
Run: `npx vitest run`
Expected: 無錯誤；PASS

---

### Task 5: index.html／style.css（返回改名、過號提示、預定時間顯示）

**Files:**
- Modify: `index.html`
- Modify: `src/style.css`

**Interfaces:**
- Produces（Task 6 依賴）: DOM id `#overdueHint`；`.ov-label`／`.ov-none`／`.ov-chip` class。

- [x] **Step 1: 「還原」改名「返回」**

```html
    <button type="button" id="btnUndo">返回</button>
```

- [x] **Step 2: 標題列加入過號提示容器**

```html
  <div class="top-row">
    <h1>魔法箱人數球</h1>
    <div id="overdueHint" class="overdue-hint" title="目前過號的號碼（點號碼可跳到該球）"></div>
    <div id="clock" class="clock">--:--</div>
  </div>
```

- [x] **Step 3: 新增過號提示樣式與預定時間顯示**

`src/style.css`：

```css
.overdue-hint {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 12px; color: #666; margin-left: 6px; min-width: 0;
}
.overdue-hint .ov-label { white-space: nowrap; }
.overdue-hint .ov-none { color: #aaa; }
.overdue-hint .ov-chip {
  width: 22px; height: 22px; min-width: 22px; padding: 0; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums;
  color: #fff; background: var(--blue); cursor: pointer;
  border: 2px solid var(--ring); box-shadow: 0 0 0 1px #fff inset;
}
```

```css
.ball[data-sched="1"] .when { color: #7b1fa2; font-weight: 700; }
/* 有預定時間的球：即使是灰色或已剪，也把預定時間顯示出來（提示作用）*/
.ball[data-sched="1"] .when { visibility: visible; }
```

- [x] **Step 4: 關鍵字檢查與測試**

Run: `grep -n 'overdueHint\|btnUndo' index.html`
Run: `npx vitest run`
Expected: 找到 `#overdueHint` 與「返回」；PASS

---

### Task 6: main.js 過號提示渲染

**Files:**
- Modify: `src/main.js`

**Interfaces:**
- Consumes: Task 5 的 `#overdueHint`、`.ov-chip`；既有 `scrollToBall(n)`、`renderAll()`。

- [x] **Step 1: 取得節點**

在 `src/main.js` 頂部的節點查詢區（`const clockEl = $("clock");` 之後）加入：

```js
const overdueHintEl = $("overdueHint");
```

- [x] **Step 2: 新增 renderOverdueHint 並於 renderAll 尾端呼叫**

```js
// 標題右側小字：過號提示（列出對應號碼球，點擊可跳至該球）
function renderOverdueHint() {
  const list = Array.from(new Set(state.overdue)).sort((a, b) => a - b);
  overdueHintEl.replaceChildren();
  const label = document.createElement("span");
  label.className = "ov-label";
  label.textContent = "過號";
  overdueHintEl.appendChild(label);
  if (!list.length) {
    const none = document.createElement("span");
    none.className = "ov-none";
    none.textContent = "無";
    overdueHintEl.appendChild(none);
    return;
  }
  for (const n of list) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "ov-chip";
    chip.dataset.n = n;
    chip.textContent = n;
    chip.title = `跳到 ${n} 號`;
    overdueHintEl.appendChild(chip);
  }
}
```

`renderAll()` 內呼叫 `renderOverdueHint();`（放在迴圈更新完球之後）。

- [x] **Step 3: chip 點擊事件**

```js
overdueHintEl.addEventListener("click", (e) => {
  const chip = e.target.closest(".ov-chip");
  if (!chip) return;
  scrollToBall(+chip.dataset.n);
});
```

- [x] **Step 4: 語法檢查與測試**

Run: `node --check src/main.js`
Run: `npx vitest run`
Expected: 無錯誤；PASS

---

### Task 7: 整合驗證與提交

**Files:**
- Verify: 全部

- [x] **Step 1: 全測試**

Run: `npx vitest run`
Expected: **67 tests passed**（新增 `cutThrough` 5 條，其餘為既有測試更新）

- [x] **Step 2: 本機預覽冒煙測試**

```bash
nohup npx --yes serve . -l 4173 >/tmp/mhb-serve.log 2>&1 &
```

驗證項目：
- `亮燈` 模式點灰色球 20 → 1~20 全為 cut，21 之後不動。
- 左滑 35 號 → 35 本身變 cut、36 維持 blue。
- 四模式的複合操作（灰球設預定時間、已剪球設過號、亮燈球還原為灰）皆如預期。
- 標題右側過號提示正確列出號碼球，點擊可捲動至該球；無過號時顯示「無」。

Expected: 全部符合。

- [x] **Step 3: Commit**

```bash
git commit -am "feat: 批量剪完含本球、亮燈灰色球一次剪完（cutThrough）、四模式不限狀態、返回改名與過號提示"
```

Expected: `229ba21`，5 files changed（`index.html`、`src/core.js`、`src/main.js`、`src/style.css`、`tests/core.test.js`），+163 −35。

---

### 增補 Task A（2026-09-12 追加）: `lightUp` —— 亮燈於非灰球時前段一併剪完

**需求：** 原本只有灰球走「前面的號碼一起剪完」；使用者追加要求亮燈按在**藍球**時，之前的號碼也要一併改為剪完。

**Files:**
- Modify: `src/core.js`
- Modify: `src/main.js`
- Modify: `tests/core.test.js`

- [x] **Step A1: 抽出共用內部函式**

`src/core.js` 把重複的迴圈與亮燈 mutation 抽成兩個內部 helper：

```js
// from..to 逐球標為已剪：跳過過號（保留過號）、清掉 grayOut（未下訂）與預定時間。
// keepCurrent 為 true 時連亮燈中的球也保留（cutThrough 用）。
function cutSweep(s, from, to, keepCurrent) {
  for (let i = from; i <= to; i++) {
    if (keepCurrent && i === s.current) continue;
    if (s.overdue.includes(i)) continue;
    const gi = s.grayOut.indexOf(i);
    if (gi >= 0) s.grayOut.splice(gi, 1);
    s.scheduled = s.scheduled.filter((o) => o.n !== i);
    cutPush(s, i);
  }
}

// 亮燈的共用 mutation（setCurrent 與 lightUp 都用）：原亮燈球剪完、n 設為亮燈中
function lightMutate(s, n, nowHHMM) {
  if (s.current !== null && s.current !== n) cutPush(s, s.current);
  s.current = n;
  const oi = s.overdue.indexOf(n);
  if (oi >= 0) s.overdue.splice(oi, 1);
  if (n > s.maxOrdered) s.maxOrdered = n;
  if (nowHHMM) s.t0 = nowHHMM;
}
```

`setCurrent` 與 `cutThrough` 改為呼叫這兩個 helper，行為不變（`cutThrough` 用 `cutSweep(s, 1, n, true)`）。

- [x] **Step A2: 新增 lightUp**

```js
// 亮燈：代表「之前的都剪完了，這顆就是要剪的下一號」。
// 不限球色（灰／藍／過號皆可），一律先把該號碼之前的球全部剪完（過號保留），
// 再把該號碼設為亮燈中 —— 按的那顆不會被剪。原亮燈球比照 setCurrent 規則一併剪完。
// 已剪（已經剪過）與已亮燈（同一顆重按）皆 no-op，後者可避免重錨 t0。
export function lightUp(state, n, nowHHMM = null) {
  if (n < 1 || n > TOTAL) return state;
  const st = ballStatus(state, n);
  if (st === "cut" || st === "orange") return state;
  return apply(state, (s) => {
    cutSweep(s, 1, n - 1, false);
    const gi = s.grayOut.indexOf(n);
    if (gi >= 0) s.grayOut.splice(gi, 1); // 要剪的號碼不再算「未下訂」
    lightMutate(s, n, nowHHMM);
  });
}
```

（前置條件經過兩次收斂：「非 gray／cut」→「必須是 blue」→ 最終「限非 cut／orange」，見 Step A6、A7。）

順帶補上 `setCurrent` 與 `lightUp` 的號碼範圍守衛（`n < 1` 或 `n > TOTAL` → no-op）——`ballStatus(state, 0)` 在 `maxOrdered === 0` 時會回 `blue`，原本 `setCurrent(state, 0)` 會把 `current` 設成 0。

- [x] **Step A3: main.js 改走 lightUp**

```js
  orderUpTo, batchCut, lightUp, toggleOverdue, cutOverdue,
```

```js
    case "light":
      // 不限球色：之前的號碼一併剪完（過號保留），按的那顆亮燈（不會被剪）
      commit(lightUp(state, n, nowHHMM()));
      break;
```

- [x] **Step A4: 測試**

新增 `describe("lightUp")` 共 11 條：亮燈前段全剪、過號保留、原亮燈球剪完、`grayOut`／`scheduled` 一併整理、原亮燈球在目標之後、灰球也可亮燈、`grayOut` 的球亮燈時移出 `grayOut`、過號球亮燈時退出過號、已剪球 no-op 不推 history、已亮燈重按 no-op 不重錨 `t0`、邊界 `0`／`151`。

Run: `npx vitest run` → **78 tests passed**
Run: `node --check src/main.js` → OK

- [x] **Step A5: 預覽實測**

預設模式點 30 → 過號模式點 10 → 亮燈模式點藍球 20：`1~19 cut`、`10 overdue 保留`、`20 orange`、`21~30 blue`；亮燈點灰球 60：`1~59 cut`、`60 orange`、`61 gray`（原亮燈的 20 也一併剪完）；亮燈點過號球 45：45 退出過號並變 orange。

- [x] **Step A6: 中繼版「只有藍球可亮燈」（已被 A7 取代）**

使用者一度回饋：「亮燈表示正要剪的號碼，所以按的號碼必須藍色，這號碼之前的都改為剪完，除了過號。」當時把前置條件收斂為 `ballStatus(state, n) !== "blue"`。此版**已被 Step A7 取代**，僅留作決策脈絡。

- [x] **Step A7: 更正為「不限球色」**

使用者更正：「不管甚麼色，用亮燈按就表示之前都剪完了，所以按的那顆是提示這個號碼的客人要剪了，所以這個號碼是藍色、還沒剪。」因此：

- `lightUp` 的前置條件改為「非 `cut`、非同一顆 `orange`」—— 灰球、`grayOut`、藍球、過號球都可亮燈。
- 灰球按亮燈＝前段剪完＋按的那顆亮燈（不再連它自己一起剪），並在亮燈時把該號碼移出 `grayOut`。
- 同一顆已亮燈的球重按仍 no-op（不重錨 `t0`）；這項在 A6 版是由「必須是 blue」順帶達成，A7 版需要顯式判斷。
- `main.js` 的 `light` 分支不再依球色分流，`cutThrough` 因此失去 UI 入口（保留在 core 與測試中，並加註說明）。
- 測試改為「灰球也可亮燈」、「`grayOut` 的球亮燈時移出 `grayOut`」、「過號球也可亮燈」、「已剪球 no-op」四條取代舊的兩條。

---

## Self-Review 記錄

- **Spec 覆蓋：** v2.1 設計文件 §2 改動總覽 → Task 1（#1）、Task 1 Step 2＋Task 2（#2）、Task 3＋Task 4＋Task 5 Step 3（#3）、Task 5 Step 1（#4）、Task 5 Step 2／Step 3＋Task 6（#5）。
- **與 v2 文件的落差已標註：** v2 設計文件 §3／§4／§5／§6 與 v2 實作計畫的對應段落（批量剪完範圍、四模式的狀態限制、按鈕名稱、`cutThrough` 缺失）都已在該兩份文件開頭加上修訂導引。
- **無 placeholder：** 所有程式碼片段皆為實際落地內容（對應 commit `229ba21`）。
- **型別一致性：** `cutThrough(state, n)`、`batchCut(state, n)`、`setScheduled(state, n, hhmm)`、`toggleOverdue(state, n)`、`revertToGray(state, n)` 於設計文件 §4／§5 與本計畫 Task 1／Task 3 簽名一致；DOM id `overdueHint` 於 Task 5（建立）與 Task 6（使用）一致。
- **未涵蓋：** 本次未新增 E2E（不涉及跨角色權限、金流、敏感資料或跨頁導向）；過號提示的捲動行為與各模式的點擊流程僅以手動冒煙測試驗證。
- **增補 Task A 的覆蓋：** 設計文件 §2 改動 #6／#7、§4.1（`cutThrough` 已無 UI 入口）、§4.2（`lightUp` 主流程）對應增補 Task A 的 Step A7；Task 2 Step 2 的 `light` 分流程式碼已同步更新為 `lightUp`，不再與現行版本落差。
- **決策脈絡保留：** Step A6 的「只有藍球可亮燈」是過渡版，已在文件內標明被 A7 取代，避免日後誤以為現行規則是藍球限定。
