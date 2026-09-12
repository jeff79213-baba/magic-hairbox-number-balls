# 魔法盒人數球 v2.1 互動修訂 設計文件

> 日期：2026-09-12
> 基於 v2（模式按鈕＋點球、保留左右滑動）。本次僅修訂 v2 的**狀態限制與批量剪完範圍**，並補上過號提示；不動版面框架、時間估計與每日紀錄機制。
> 對應程式碼：`src/core.js`、`src/main.js`、`index.html`、`src/style.css`（commit `229ba21`）。

## 1. 修訂動機

v2 上線後實務發現四個摩擦點：

1. **批量剪完（左滑）不剪自己那一顆**：v2 只剪 `1..n-1`，操作員滑完後還得再補一次點擊，容易漏剪。
2. **灰色（未下訂）球無法清理**：v2 的「亮燈」只能作用於 blue／overdue／scheduled，遇到前面一整段沒下訂的球（例如臨時吞掉的號碼）無法一次帶過。
3. **模式限制過嚴**：設定預定時間、標過號、還原為灰，v2 各自限定球狀態，實務上常需要對「已經處理過」的球回頭修正，被擋掉反而更麻煩。
4. **過號球不易定位**：過號的球散在 150 顆之中，v2 只能自己捲動找。

## 2. 改動總覽

| # | 改動 | 觸及檔案 |
|---|------|----------|
| 1 | 批量剪完**含本球**（`1..n`） | `src/core.js` |
| 2 | 新增 `cutThrough`：亮燈於灰球＝該號碼與之前一次剪完 | `src/core.js`、`src/main.js` |
| 3 | 四個模式**解除狀態限制**（預定時間／剪完／未下訂／過號） | `src/core.js`、`src/main.js`、`src/style.css` |
| 4 | 按鈕文案「還原」→「返回」 | `index.html` |
| 5 | 標題右側**過號提示**（列出過號號碼球，點擊跳轉） | `index.html`、`src/main.js`、`src/style.css` |
| 6 | 新增 `lightUp`：亮燈**不限球色**（灰／藍／過號）＝之前的號碼一併剪完（過號保留）＋按的那顆亮燈（不剪）（2026-09-12 追加） | `src/core.js`、`src/main.js` |
| 7 | 取消「灰球按亮燈＝連它自己一起剪完」的舊規則（`cutThrough` 已無 UI 入口）（2026-09-12 更正） | `src/core.js`、`src/main.js` |

## 3. 批量剪完含本球

`batchCut(state, n)` 迴圈由 `for (let i = 1; i < n; i++)` 改為 `for (let i = 1; i <= n; i++)`。

- **跳過規則不變**：亮燈中（`current`）、過號（`overdue`）、有預定時間（`scheduled`）、未下訂（`grayOut`）、`i > maxOrdered`。
- 因此左滑／長按的那顆球本身在「已下訂且非上述特例」時會一併變已剪；若它是亮燈球或過號球則仍保留原狀態。
- 觸發端不變：`handleBallAction(n, "left")`。

## 4. 亮燈（light）：依球狀態分流

v2 的「亮燈」一律走 `setCurrent`，對灰色（未下訂）球是 no-op（`setCurrent` 擋掉 `gray`）。v2.1 由 `main.js` 依球狀態分流：

```js
case "light":
  // 不限球色：之前的號碼一併剪完（過號保留），按的那顆亮燈（不會被剪）
  commit(lightUp(state, n, nowHHMM()));
  break;
```

**不再依球色分流**：亮燈的語意是「之前的都剪完了，這顆就是要剪的下一號」，所以灰球、藍球、過號球都可以按 —— 按的那顆不會被剪，而是變成亮燈中（橘色）作為「這位客人要剪了」的提示；只有**已剪**的球例外（它已經剪過了），以及同一顆已亮燈的球重按（避免重錨 `t0`）。兩個分支都保留過號。

### 4.1 `cutThrough`（已無 UI 入口）

```js
export function cutThrough(state, n)
// 1..n 逐球：
//   - 跳過 current（亮燈中保留亮燈）
//   - 跳過 overdue（過號保留過號）
//   - 移出 grayOut（未下訂者一併剪完）
//   - 移除該球的 scheduled（預定時間一併清掉）
//   - cutPush → 加入 cut
// 迴圈結束後 maxOrdered = max(maxOrdered, n)（把下訂上限帶到 n）
// n < 1 或 n > TOTAL → no-op
```

這個函式是第一版「灰球按亮燈＝連它自己一起剪完」的實作；使用者同日更正為「不管甚麼色，按亮燈都代表之前都剪完了，按的那顆是提示、還沒剪」後，亮燈模式已統一走 `lightUp`，`cutThrough` 目前**沒有任何 UI 入口**（保留在 core 供日後需要「只剪穿、不亮燈」時使用，測試也一併保留）。

### 4.2 亮燈主流程 → `lightUp`（2026-09-12 追加）

亮燈按在**任何未剪的球**上時：把該球**之前的號碼全部剪完**，該球本身**不剪**，而是設為亮燈中（橘色）。實務上就是「叫到這個號碼，前面的人都已經處理完了」，讓佇列與預估時間立刻反映實況，同時把那顆球標成「下一位要剪」的提示。

```js
export function lightUp(state, n, nowHHMM = null)
// 前置條件：ballStatus 不是 "cut" 也不是 "orange"（已剪／同一顆已亮燈重按）否則 no-op
//   ：灰球、grayOut、藍球、過號球皆可亮燈
// 1..n-1 逐球剪完（沿用 cutSweep：跳過 overdue、清掉 grayOut 與 scheduled）
// n 若在 grayOut 則移除（要剪的號碼不再算「未下訂」）
// 再比照 setCurrent 的規則亮燈：
//   - 原亮燈球（若還在）一併剪完
//   - n 從 overdue 移除
//   - maxOrdered = max(maxOrdered, n)、t0 = nowHHMM
```

實作上把「亮燈的 mutation」抽成內部 `lightMutate(s, n, nowHHMM)`，由 `setCurrent` 與 `lightUp` 共用；「把某段號碼標為已剪」抽成內部 `cutSweep(s, from, to, keepCurrent)`，由 `cutThrough`（`keepCurrent = true`，保留亮燈球）與 `lightUp`（`keepCurrent = false`，連原亮燈球一起剪）共用。

| 情境 | 之前（v2／v2.1 初版） | 現在 |
|------|----------------------|------|
| 亮燈按在藍球 20（1~19 仍為藍） | 20 亮燈，1~19 不動 | 1~19 剪完，20 亮燈 |
| 亮燈按在藍球 20（10 為過號） | — | 10 保留過號，其餘剪完 |
| 亮燈按在藍球 20（12 未下訂、15 有預定時間） | — | 12、15 一併剪完（清掉預定時間） |
| 亮燈按在藍球 20（原亮燈球為 30） | 30 剪完（setCurrent 規則） | 不變，30 剪完 |
| 亮燈按在**灰球** 60（maxOrdered = 30） | 1~60 剪完（`cutThrough`），**不亮燈** | 1~59 剪完、**60 亮燈**、61 維持 gray、maxOrdered 帶到 60 |
| 亮燈按在**過號球** 20 | 20 亮燈（退出過號），1~19 剪完 | **不變**（20 亮燈、退出過號、1~19 剪完） |
| 亮燈按在**已剪球** | no-op | 不變 |
| 亮燈按在**同一顆已亮燈的球** | 重錨 `t0` 到當下時間 | **no-op**（不重錨 `t0`、不推 history） |

### 與 `batchCut` 的差異

| 比較項 | `batchCut`（左滑） | `cutThrough`（亮燈於灰球） |
|--------|-------------------|---------------------------|
| 含本球 | 是（v2.1 起） | 是 |
| 亮燈中 `current` | 跳過，保留亮燈 | 跳過，保留亮燈 |
| 過號 `overdue` | 跳過，保留過號 | 跳過，保留過號 |
| 未下訂 `grayOut` | 跳過 | **一併剪完**（移出 `grayOut`） |
| 未下訂 `> maxOrdered`（`gray`） | 跳過 | **一併剪完** |
| 有預定時間 `scheduled` | 跳過 | **一併剪完**（清掉預定時間） |
| `maxOrdered` | 不上修也不下修 | 上修至 `n` |
| 觸發 | 左滑／左向拖曳 | 「亮燈」模式點灰色球 |

## 5. 四模式解除狀態限制

v2 的狀態限制是「前端先擋、core 再擋一層」。v2.1 兩層都拿掉，core 只保留號碼範圍與格式等基本驗證。

| 模式 | v2 限制 | v2.1 行為 | 實作要點 |
|------|---------|-----------|----------|
| **[預定時間]** | 僅 blue／overdue | **任何狀態皆可設**（灰／未下訂／已剪／亮燈中） | `setScheduled` 移除 `ballStatus` 判斷；`main.js` schedule 分支移除 `if (st === "gray" \|\| st === "cut" \|\| st === "orange") break;` |
| **[剪完]** | 無限制（v2 已如此） | 不變 | `cutBall` 保持；亮燈球會一併清除 `current` |
| **[未下訂]** | 亮燈中 no-op | **亮燈中也可還原**：清除 `current` 並變灰 | `revertToGray` 改為「已是 `gray` → no-op」，其餘一律清掉 `overdue`／`scheduled`／`cut` 並加入 `grayOut` |
| **[過號]** | 僅 blue／scheduled（已下訂且非剪完、非亮燈） | **任何狀態皆可切換** | `toggleOverdue` 移除狀態判斷；**設為**過號時移出 `cut`、清除 `current`；**取消**過號時僅移出 `overdue`（狀態依 `maxOrdered` 回到 blue／gray） |

附帶的顯示調整：預定時間原本只在佇列內的球上可見，放寬後為讓「已剪」或「未下訂」的預約球也看得到時間，`src/style.css` 加上

```css
.ball[data-sched="1"] .when { visibility: visible; }
```

（`.when` 於非佇列球原本被隱藏；有預定時間者一律顯示紫色時間。）

> 刻意保留的寬鬆：`revertToGray` 對「亮燈中」的球放行。若日後希望亮燈球不可被還原，只需恢復該分支的 no-op 判斷。

## 6. 按鈕文案：還原 → 返回

`index.html` 的 `#btnUndo` 文字由「還原」改為「**返回**」。行為完全不變：逐步回退（`undo(state)`），history 上限 100 筆。

「還原」一詞與「未下訂（還原為灰色）」語意重疊，改名為「返回」以區分「回上一動」與「把球改回未下訂」。

## 7. 標題右側過號提示

**HTML**（`index.html`，`.top-row` 內、`<h1>` 之後）：

```html
<div id="overdueHint" class="overdue-hint" title="目前過號的號碼（點號碼可跳到該球）"></div>
```

**渲染**（`src/main.js`，`renderOverdueHint()`，由 `renderAll()` 每次呼叫）：

- 取 `state.overdue` 去重、升冪排序。
- 先放標籤 `<span class="ov-label">過號</span>`。
- 無過號 → 放 `<span class="ov-none">無</span>`（灰色）並結束。
- 有過號 → 每顆號碼產生一顆迷你球 `<button class="ov-chip" data-n="…">`，點擊呼叫 `scrollToBall(n)` 捲動到該球（沿用既有 `scrollToBall`）。

**樣式**（`src/style.css`）：`.overdue-hint` 為 inline-flex、12px 灰字；`.ov-chip` 為 22px 圓形、藍底＋深紅圈（`border: 2px solid var(--ring)`）、白字、等寬數字——與棋盤上的號碼球同一套配色語言，作為「提示」而非操作鈕。

## 8. 測試（tests/core.test.js）

- **新增** `describe("cutThrough")`：灰球亮燈使 1..n 全變 cut（含未下訂）、過號保留過號、亮燈中保留亮燈、已剪／有預定時間者一併整理為 cut、下滑號碼在 `maxOrdered` 之上仍納入並上修、邊界 `0`／`151` 為 no-op。
- **更新**：
  - `batchCut`：滑動的號碼本身變 cut（35），其後（36）維持 blue。
  - `toggleOverdue`：灰球可設過號、已剪改回過號（移出 `cut`）、亮燈中退出亮燈（`current` 變 `null`）。
  - `setScheduled`：灰球／`grayOut`／亮燈中／已剪皆可設，且球狀態維持原樣。
  - `revertToGray`：亮燈中的球可還原（`current` 清空、加入 `grayOut`）。
- **追加** `describe("lightUp")`（2026-09-12）共 11 條：藍球亮燈使 1..n-1 全變 cut 且本球 orange、過號保留、原亮燈球一併剪完（含原亮燈球在目標之後的情況）、`grayOut` 與 `scheduled` 一併清掉、**灰球也可亮燈**（前段剪完、按的那顆亮燈、maxOrdered 帶上去）、`grayOut` 的球亮燈時移出 `grayOut`、過號球亮燈時退出過號且前段照剪、已剪球 no-op 不推 history、已亮燈重按 no-op 不重錨 `t0`、邊界 `0`／`151` 為 no-op。
- 已在預覽上實測：預設模式點 30（1~30 全 blue）→ 過號模式點 10（10 變 overdue）→ 亮燈模式點藍球 20 ⇒ 1~19 cut、**10 保留 overdue**、20 orange、21~30 維持 blue；亮燈點灰球 60 ⇒ 1~59 cut、**60 orange**、61 維持 gray，且原亮燈的 20 一併剪完；亮燈點過號球 45 ⇒ 45 退出過號且變 orange、標題旁提示回到「過號10」。
- 結果：`npx vitest run` → **78 tests passed**。

## 9. 未變動項

- 版面框架、顏色圖例、手勢說明列。
- 左右滑動手勢本身（左滑＝批量剪完、右滑＝下訂）與上下滑維持移除。
- `setCurrent` 的 gray／cut 限制（`main.js` 的亮燈已改走 `lightUp`，`setCurrent` 仍保留在 core 供外部／測試使用）、`orderUpTo` 對 cut 的 no-op、`cutOverdue` 預設點球行為。
- 左滑批量剪完（`batchCut`）的跳過規則不受本項影響：它仍會跳過灰球、過號球、有預定時間的球與亮燈球。
- 預設（無模式）點球、右滑下訂、左滑批量剪完的觸發方式。
- 每日紀錄（`mhb-daily`）、跨日 `rollover`、`resetDay`／`resetAll` 對 `scheduled`／`grayOut` 的清理。
- localStorage 格式與 v1／v2 相容性（無新增欄位）。
