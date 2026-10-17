# 魔法盒人數球：Safari 10（iOS 10.3.3）相容版 設計文件

> 日期：2026-10-17
> 目的：讓一台 iOS 10.3.3（Safari 10.1）的舊 iPad 能顯示並操作本 App。
> 硬約束：**原版 `index.html`、`src/main.js`、`src/core.js`、`src/style.css` 完全不改**（客戶近期要用），相容版走獨立 Hosting Site。
> 對應程式碼來源：`index.html`、`src/core.js`、`src/main.js`、`src/style.css`（commit `9973eb5`）。

## 1. 問題與根因

在舊 iPad（iPad 2/3 世代，iOS 10.3.3，Safari 10.1）上，頁面上的靜態文字正常，但**人數球與格子完全沒出現**。

根因：球與格子是 `src/main.js` 以 JavaScript 動態產生（`main.js:87-92`），靜態文字則寫死於 HTML。**Safari 10.1 不支援 ES 模組**（`<script type="module">` 自 Safari 11 才支援），瀏覽器看不懂 `type="module"` 便整支腳本略過不執行 → 一顆球都長不出來。

即使繞過模組問題，尚有多處新語法／新 API 會讓 Safari 10.1 直接報錯或渲染失敗：

| 目前寫法 | 位置 | Safari 10.1 | 症狀 |
|---|---|---|---|
| `type="module"` + `import`/`export` | `index.html:99`、`core.js`、`main.js` | 不支援 | 整個 JS 不執行 |
| `?.`（optional chaining） | `main.js:221` | 不支援 | 語法錯誤，整檔不執行 |
| `60_000`（numeric separator） | `main.js:367` | 不支援 | 語法錯誤，整檔不執行 |
| `{...s}`（object spread） | `core.js:36,44,253` | 不支援（ES2018） | 語法錯誤，整檔不執行 |
| `replaceChildren()` | `main.js:97,298` | 需 Safari 14 | 執行期錯誤 |
| Pointer Events | `main.js:217-241` | 需 Safari 13 | 手勢完全失效 |
| `scrollTo({behavior})` | `main.js:279` | 不支援 options | 跳號不捲動 |
| CSS `clamp()` | `style.css:98,104,154,173,195,202` | 需 Safari 13.1 | 尺寸失效 |
| CSS `aspect-ratio` | `style.css:99,160,172` | 需 Safari 15 | 球/格子塌陷 |
| flexbox `gap` | `style.css` 多處 | 需 Safari 14.1 | 間距消失 |
| `inset` | `style.css:123,139` | 需 Safari 14.1 | 定位失效 |
| `min()` in `grid-template-columns` | `style.css:79,154` | 不支援 | 欄寬失效 |
| `position: sticky`（無前綴） | `style.css:24` | 需 Safari 13 | 頂欄不固定 |

## 2. 隔離策略

**原版零改動**，相容版獨立：

- 相容版全部放 `legacy/` 資料夾。
- 新增獨立 Firebase Hosting Site：**`mhb-legacy-sk`**（已確認 `opencode-sk` project 內無同名，見 `firebase hosting:sites:list`）。
- 相容版自帶 `legacy/firebase.json`，以 `--config legacy/firebase.json` 部署，**根目錄 `firebase.json` 與 `.firebaserc` 不動**。
- 客戶原網址 `https://mhb-sk.web.app` 不重新部署，行為與內容與現在完全一致。

| 項目 | 原版 | 相容版 |
|---|---|---|
| 網址 | https://mhb-sk.web.app | https://mhb-legacy-sk.web.app |
| 檔案 | `index.html`、`src/*` | `legacy/*` |
| Hosting 設定 | 根目錄 `firebase.json` | `legacy/firebase.json` |
| 部署指令 | `firebase deploy --only hosting`（既有） | `firebase deploy --only hosting --config legacy/firebase.json` |

> 附帶：push 後 GitHub Pages 也會一併託管 `legacy/`（例如 `https://jeff79213-baba.github.io/magic-hairbox-number-balls/legacy/`），可作為備援測試網址；不影響原版根目錄頁面。

> 已知無害副作用：若日後對原版 site 執行完整部署，`legacy/` 會被一起帶上（`mhb-sk.web.app/legacy/`）。目前刻意不動根目錄設定以維持「完全凍結」；若日後要排除，再加 ignore 即可。

## 3. 相容版檔案結構

```
legacy/
├── index.html      # 標題與控制列同上，<script> 改為傳統 script（非 module）
├── core.js         # 邏輯等同 src/core.js，語法降到 Safari 10 可執行；掛 window.MHB
├── app.js          # UI 邏輯（等同 src/main.js），使用 window.MHB
├── style.css       # 新 CSS 屬性全部替換為舊寫法
└── firebase.json   # { "hosting": { "site": "mhb-legacy-sk", "public": "." } }
```

- `index.html` 載入順序：`<link rel="stylesheet" href="style.css">` → 內容 → `<script src="core.js"></script>` → `<script src="app.js"></script>`（皆為傳統 script，不用 `type="module"`）。
- localStorage 沿用既有 key（`mhb-state`、`mhb-daily`、`mhb-view`），維持與原版相同的資料格式（舊 iPad 只會跑相容版，不衝突）。

## 4. JavaScript 相容改寫

### 4.1 模組 → 全域命名空間
- `legacy/core.js` 以 IIFE 包住，結尾 `window.MHB = { TOTAL, createState, todayStr, rollover, ballStatus, queuePositions, estimate, formatAccum, pruneDaily, orderUpTo, batchCut, lightUp, toggleOverdue, cutOverdue, setMinutes, setScheduled, cutBall, revertToGray, undo, resetAll, ... };`（與原 `export` 清單一致）。
- `legacy/app.js` 頂端 `var Core = window.MHB;`，以下用 `Core.xxx` 呼叫。
- `legacy/core.js` 需能在 vitest（Node）被載入以做等價測試 → 以 `typeof window !== "undefined"` 判斷掛載目標，測試端用 `node:vm` 提供 `window` 物件載入（見 §6）。

### 4.2 逐項語法／API 替換
| 原寫法 | 相容版寫法 |
|---|---|
| `e.currentTarget.setPointerCapture?.(id)` | `if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(id);` |
| `const BASE = 60_000;` | `var BASE = 60000;` |
| `return { ...s, history };` | `return Object.assign({}, s, { history: history });` |
| `{ ...clone(state), ...prev, history }` | `Object.assign({}, clone(state), prev, { history: history })` |
| `{ ...base, maxOrdered: 0, ... }` | `Object.assign({}, base, { maxOrdered: 0, ... })` |
| `el.replaceChildren()` | `clearChildren(el)` 工具函式（`while (el.firstChild) el.removeChild(el.firstChild);`） |
| `area.scrollTo({ top, behavior: "smooth" })` | `area.scrollTop = top;` |
| `grid.addEventListener("pointerdown"...)` 等 | 特徵偵測：有 `window.PointerEvent` 用指標事件，否則退回觸控＋滑鼠事件（見 §4.3） |
| `classList.toggle(token, force)` | `force ? add(token) : remove(token)`（避開舊實作差異） |

- 其餘 ES6 語法（`let`/`const`、箭頭函式、樣板字串、`for...of`、預設參數、解構、`Array.from`、`Set`、`Object.entries`、`Object.assign`、`padStart`、`Math.hypot`、`Element.closest`、`ChildNode.append`、`dataset`、`querySelector`）皆為 Safari 10 支援，保留。
- `async/await` 為 Safari 10.1 支援；全螢幕鈕沿用「不支援就隱藏」的判斷（iOS Safari 本就不支援元素全螢幕）。

### 4.3 手勢：指標事件 → 觸控事件退回
- 偵測 `window.PointerEvent`：
  - 有 → 維持現行 `pointerdown/pointermove/pointerup/pointercancel` 邏輯（現代裝置行為不變）。
  - 無（Safari 10.1）→ 使用 `touchstart/touchmove/touchend/touchcancel`。支援 `PointerEvent` 的現代桌機不會走這條路，故不做滑鼠退回（YAGNI）。
- 手勢判定與原版一致：位移 `> 30px` 且水平為主 → 左/右滑（`batchCut` / `orderUpTo`）；否則視為點擊（tap，走 `handleBallAction`）。
- **上下捲動保留**：因 Safari 10.1 不支援 `touch-action`，改為在 `touchmove` 時判斷——水平為主時 `preventDefault()` 並觸發手勢，垂直為主時不攔截、讓頁面正常捲動。
- 觸控事件記錄 `identifier` 以避免多指誤判；結束後清除狀態。

## 5. CSS 相容改寫

| 新屬性 | 相容版替代 |
|---|---|
| `position: sticky` | `position: -webkit-sticky; position: sticky;` |
| `clamp(...)` | 固定值＋`@media` 斷點（球直徑與字級分 3 段：手機／平板／大螢幕） |
| `aspect-ratio: 1`（圓球） | 圓球改固定 `width`/`height` 等長（由媒體查詢控制）；方格用固定 `height` |
| flex `gap` | 以子元素 `margin`（含負 margin 修正外緣）取代 |
| `inset: 0` | `top:0; right:0; bottom:0; left:0;` |
| `inset: -6px` | `top:-6px; right:-6px; bottom:-6px; left:-6px;` |
| `grid-template-columns: repeat(auto-fill, minmax(min(100%, 96px), 1fr))` | `repeat(auto-fill, minmax(96px, 1fr))`，窄螢幕以 `@media` 調為較小值 |
| grid `gap: 14px 12px` | `grid-row-gap: 14px; grid-column-gap: 12px;`（grid 間距 Safari 10.1 支援） |
| `overscroll-behavior` / `touch-action` | 移除（Safari 10.1 不支援，無作用） |
| `viewport-fit=cover`（meta） | 保留（舊版忽略，無害） |

- CSS 變數（`--gray` 等，Safari 9.1+）、`repeating-linear-gradient`、`font-variant-numeric`、`-webkit-user-select`、`-webkit-overflow-scrolling`、`rgba()` 皆保留。
- 版面外觀（顏色圖例、模式按鈕、彈窗、格子細字）以目視比對原版為準，力求一致。

## 6. 驗證與測試

### 6.1 原版零回歸
- `npm test`（vitest）對 `src/core.js` 的既有 78 條測試維持全綠（不改測試、不改 `src/`）。

### 6.2 相容版邏輯等價測試（新增 `tests/legacy-core.test.js`）
- 以 `node:vm` 建立沙箱（含 `window`）載入 `legacy/core.js`，取出 `MHB` 命名空間。
- 對 `src/core.js` 與 `legacy/core.js` 餵同一串操作序列，逐項比對回傳狀態（`maxOrdered`/`current`/`overdue`/`cut`/`scheduled`/`grayOut`/`history` 長度）與關鍵查詢（`ballStatus`、`queuePositions`、`estimate`、`formatAccum`）。
- 目的：證明相容版只是「換語法」，行為與原版一致。

### 6.3 語法閘門（新增 `tests/legacy-syntax.test.js` 或腳本）
- 用 `acorn` 以 `ecmaVersion: 2017` 解析 `legacy/core.js`、`legacy/app.js`；能解析即代表未含 ES2018+ 語法（object spread、optional chaining、numeric separator 等）。
- 若 `acorn` 非現成相依，加入 `devDependencies`。

### 6.4 實機驗收（分階段）
- **Phase 1 最小煙霧測試**：先只部署一個極簡 `legacy/index.html`（一頁用舊語法長出幾顆球與方格），確認 Safari 10.1 真的能顯示 → 由使用者在舊 iPad 開啟驗證。此頁為臨時驗證用，Phase 2 會以完整版覆蓋同一個 site。
- **Phase 2 完整移植**：球、格子、五種顏色狀態、五個模式、左右滑手勢、快捷跳號、過號提示、預定時間彈窗、每日紀錄、每日重置、返回、全螢幕（不支援則隱藏）。
- **Phase 3 實機驗收**：使用者在舊 iPad 逐項操作確認。

### 6.5 部署與測試網址
1. `firebase hosting:sites:create mhb-legacy-sk --project opencode-sk`
2. `firebase deploy --only hosting --config legacy/firebase.json`
3. 舊 iPad 開 `https://mhb-legacy-sk.web.app`
4. 觀察重點：球與格子是否出現、能否捲動、左右滑手勢、點擊模式是否生效

## 7. 風險與限制

- **效能風險**：該機型硬體老舊（連 LINE 啟動都吃力）。即使成功顯示，150 顆球＋每秒更新時鐘在舊機上可能偏鈍。此為硬體限制，非程式問題；Phase 1 即可盡早發現。
- **外觀微差**：CSS 以舊寫法重寫（固定尺寸取代 `clamp()`），不同螢幕下的間距/字級可能與原版略有出入，以「可讀、可操作」為優先。
- **不做的事（YAGNI）**：不改原版、不引入建置流程（Babel/esbuild）、不維護新舊雙版本分流。
- **未來守門**：語法閘門（§6.3）避免日後在 `legacy/` 不小心寫回新語法。

## 8. 驗收標準

- [ ] 原版四個檔案 `git diff` 無任何變動；原版 site 未重新部署。
- [ ] `npm test` 全綠，且新增的 legacy 等價測試通過。
- [ ] `legacy/*.js` 通過 ES2017 語法解析（無 ES2018+ 語法）。
- [ ] 舊 iPad（iOS 10.3.3）開啟 `https://mhb-legacy-sk.web.app` 能看到 150 顆球與格子視圖。
- [ ] 舊 iPad 上可上下捲動、左右滑手勢、點擊模式切換與各項操作正常（或於 Phase 3 記錄鈍感程度）。
- [ ] 客戶原網址 `https://mhb-sk.web.app` 行為與外觀與現狀一致。
