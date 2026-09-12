# 魔法盒人數球 v2 互動改版 設計文件

> 日期：2026-09-12
> 基於 v1（既有 150 顆號碼球、雙時間估計、每日紀錄）之局部改版。僅改動互動與狀態模型，不動既有版面框架與每日紀錄機制。

> ### ⚠️ 已被 v2.1 修訂（2026-09-12，commit `229ba21`）
>
> 本文以下段落與**現行程式行為不一致**，請以 [`2026-09-12-magic-hairbox-v2.1-design.md`](./2026-09-12-magic-hairbox-v2.1-design.md) 為準：
>
> | 本文段落 | 現行行為 |
> |----------|----------|
> | §3「批量剪完＝把該球**以前**的球全部剪完」 | **含**操作的那顆球本身（`1..n`） |
> | §3 批量剪完跳過 current／overdue／scheduled／grayOut | 跳過規則本身不變；但新增 `cutThrough`：灰球按「亮燈」時**連未下訂球一起剪完** |
> | §4 `[亮燈]`：`setCurrent(n)` | 灰球改走 `cutThrough(n)`；其餘狀態仍 `setCurrent(n)` |
> | §4 `[預定時間]`／`[未下訂]`／`[過號]` 的狀態限制 | 三者的狀態限制**全部解除**（任何狀態皆可執行） |
> | §5 控制列按鈕「還原」 | 文案改為「**返回**」 |
> | §6 `setScheduled`／`revertToGray` 的限定條件 | 同上，限制已移除 |
> | — | 新增：標題右側**過號提示**（列出過號號碼球，點擊跳轉） |

## 1. 改版動機

原設計以「滑動四方向」觸發所有操作，實務上容易誤觸與不直覺。本次改版：

- 將「上滑＝叫號」「下滑＝基準時間」改為**按鈕模式＋點球**。
- **保留** 左右滑動功能（左滑＝批量剪完、右滑＝下訂）。
- 新增「未下訂」「剪完」模式按鈕，讓誤操作與被處理過的球可還原。
- 將「基準時間」改為**每顆球的預定時間**（顧客預約時間），取代全域基準時間設定。
- 被「處理過」的球（亮燈、過號、有預定時間）不會被批量剪完誤剪。

## 2. 名詞對照

| 舊名 | 新名 | 說明 |
|------|------|------|
| 叫號 | **亮燈** | 指定目前服務中的球，使其發亮（橘色） |
| 基準時間 | **預定時間** | 每顆球可設定顧客專屬預約時間 |
| 當前叫號（圖例） | **亮燈中** | 顏色圖例文字 |
| 手勢說明「↑ 叫號、↓ 基準時間」 | 移除 | 只保留「← 批量剪完、→ 下訂」 |

## 3. 滑動手勢規則

- **保留：**
  - 左滑（已訂球上）＝批量剪完：把該球**以前**的球全部剪完。
  - 右滑（已訂球上）＝下訂。
  - 點擊＝依目前啟動的模式決定（見 §4）。
- **移除：**
  - 上滑（原叫號／亮燈）。
  - 下滑（原基準時間／預定時間彈窗觸發）。
- **批量剪完（左滑）跳過下列「已處理」球，不誤剪：**
  - 目前亮燈球（current）
  - 過號球（overdue）
  - 有預定時間的球（scheduled）

## 4. 模式按鈕（點球行為決定）

控制列新增模式按鈕。模式為**互斥切換**：按下反白（`active`），再按一次取消；切換到別的按鈕時自動離開前一個模式。無任何模式啟動時使用「預設」行為。

| 模式按鈕 | 點球後動作 |
|----------|-----------|
| （無／預設） | `orderUpTo(n)` 下訂；若該球為過號 → `cutOverdue(n)` 剪完過號球 |
| **[亮燈]** | `setCurrent(n)`：該球變橘亮燈，原亮燈球自動剪完，並將 T0 設為目前實際時間 |
| **[預定時間]** | 彈出時間輸入視窗 → `setScheduled(n, hhmm)`：賦予該球專屬預定時間；球上時間改顯示預定時間 |
| **[剪完]** | `cutBall(n)`：該球直接變已剪完（灰色／藍色／過號／有預定時間皆可剪；亮燈球亦剪；current 同時清除） |
| **[未下訂]** | `revertToGray(n)`：該球還原為灰色（藍色／已剪／過號／有預定時間皆可還原；**亮燈中不可**，no-op） |
| **[過號]** | `toggleOverdue(n)`：切換過號標記（沿用 v1，僅限已下訂且非剪完、非亮燈的球） |

**預設點球限制：**
- greyOut（被還原為灰色的球）點擊 → 重新下訂（移出 grayOut）。
- 已剪（cut）球點擊 → no-op。

## 5. 顯示與樣式

- 橘色圖例文字改為「亮燈中」。
- 手勢區移除「↑ 叫號」「↓ 基準時間」兩個 pill，保留「← 批量剪完」「→ 下訂」。
- 控制列按鈕順序：每球分鐘輸入、**[亮燈]**、**[預定時間]**、**[未下訂]**、**[剪完]**、**[過號]**、每日紀錄、每日重置、還原、全螢幕。
- 有預定時間的球：第二行時間顯示預定時間（替代推算的預計時刻）；第一行加總時間仍照常顯示。以可辨識樣式（如紫色數字或小標籤「預」）標記預定球。

## 6. 核心狀態模型（src/core.js）

### 狀態欄位變更

`createState()` 新增：

```js
scheduled: []    // [{ n, time }]，每顆球最多一筆；n 為球號，time 為 "HH:MM"
grayOut: []      // 被「未下訂」還原為灰色的球號（仍 ≤ maxOrdered 但視為未下訂）
```

`rollover()` ／ `resetDay()` 跨日時一併清空 `scheduled` 與 `grayOut`。

### ballStatus 判斷順序

```
cut → current（亮燈中）→ overdue → grayOut → blue（≤ maxOrdered）→ gray
```

- `grayOut` 的球回傳 `"gray"`（視覺上與未下訂相同）。
- scheduled 是與狀態**正交**的附加資訊（藍球帶預約時間仍為 blue）。

### 函式變更

| 函式 | 變更 |
|------|------|
| `batchCut(state, n)` | 除了既有的 current、overdue 跳過規則外，**再跳過有 scheduled 的球** |
| `queuePositions(state)` | 排除 `grayOut` 的球（不會出現在佇列與預估時間） |
| `estimate(state, n)` | 若 n 不在佇列（含 grayOut）→ `null`（不顯示時間）；若 n 有 scheduled → 回傳 `{ accumMin, time: 預定時間 }` |
| `orderUpTo(state, n)` | 將 `n` 從 `grayOut` 移除（重新下訂）；若 n 是 cut → no-op |
| `setCurrent(state, n, nowHHMM)` | 不可設定 grayOut／cut／gray（維持 v1 規則：僅限 blue／overdue／scheduled 可亮燈） |

### 新增函式

```js
export function setScheduled(state, n, hhmm)
// 限定球狀態為 blue／overdue（不得 gray／grayOut／cut／current）
// hhmm 需符合 /^\d{2}:\d{2}$/，否則 no-op
// 覆寫已存在的 scheduled 同球
// 回傳新 state（推入 history）

export function cutBall(state, n)
// 將單顆球直接設為已剪：
// - current（亮燈）→ 清除 current，加入 cut
// - overdue → 移出 overdue，加入 cut
// - scheduled → 移除 scheduled，加入 cut
// - grayOut → 移出 grayOut，加入 cut（灰色球剪完）
// - gray（未下訂，> maxOrdered）→ 加入 cut（灰色球剪完，此後排程排除）
//   ：cut 加入方式沿用 cutPush（排序、去重）
// 回傳新 state（推入 history）

export function revertToGray(state, n)
// 將單顆球還原為灰色（未下訂）：
// - blue（≤ maxOrdered）→ 加入 grayOut
// - cut → 移出 cut，加入 grayOut
// - overdue → 移出 overdue，加入 grayOut
// - scheduled → 移出 scheduled，加入 grayOut
// - current（亮燈中）→ no-op
// - 已為 gray / grayOut → no-op
// 回傳新 state（推入 history）
```

## 7. 資料移轉（localStorage）

- 既有 `mhb-state` 若缺 `scheduled` / `grayOut` 欄位 → 載入時補空陣列（`loadState` 以 `createState()` 為基底合併，相容 v1）。
- 不需清除既有每日紀錄（`mhb-daily` 不受影響）。

## 8. 互動實作（src/main.js）

- 移除 pointermove / pointerup 中與「上／下」相關的分支；只保留 tap、向左、向右。
- 新增模式列：`activeMode` 變數（`"light" | "schedule" | "cut" | "unorder" | "overdue" | null`）。
- 按鈕事件統一處理：切換模式（互斥）、反黃顯示。
- `handleBallAction(n, dir)`：
  - 依 activeMode 對應動作（§4 表）。
  - `dir` 只可能是 `"tap" | "left" | "right"`。
- 預定時間彈窗：點球後先填入目前實際時間做預設值，使用者可改；套用後 `setScheduled`。
- 移除 `openTimeDialog` 下滑觸發，改由 [`預定時間` 模式＋點球] 觸發。
- 每日重置流程保留，但 `resetAll` ／ `resetDay` 需同步清掉 scheduled、grayOut。

## 9. 測試策略

- **單元測試（Vitest，tests/core.test.js）：**
  - `setScheduled`：設定成功、覆寫同球、非法時間 no-op、灰色／grayOut／cut／current 不可設。
  - `cutBall`：灰→剪、藍→剪、過號→剪（移出過號）、預定→剪（移出預定）、亮燈→剪（清除 current）、重複剪 no-op。
  - `revertToGray`：藍→灰、已剪→灰（移出 cut）、過號→灰、預定→灰（移出 scheduled）、亮燈中 no-op、已灰 no-op。
  - `batchCut`：跳過 current／overdue／scheduled，其餘照剪。
  - `queuePositions`：排除 grayOut。
  - `estimate`：grayOut → null；scheduled 球回傳預定時間。
  - `orderUpTo`：grayOut 重訂回藍（移出 grayOut）；cut no-op。
  - `rollover`／`resetDay`：清空 scheduled 與 grayOut。
- **不新增 E2E**：本功能不涉及跨角色權限、金流、敏感資料或跨頁面導向（不符合 AGENTS.md E2E 觸發條件）。

## 10. 部署

- 沿用既有 `mhb-sk` Firebase Hosting site 與 `magic-hairbox-number-balls` GitHub repo。
- 驗證 `npx vitest run` 全綠後 `firebase deploy --only hosting`，並 push GitHub。