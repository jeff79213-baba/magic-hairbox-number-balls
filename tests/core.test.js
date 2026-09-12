import { describe, it, expect, beforeEach } from "vitest";
import {
  TOTAL, createState, orderUpTo, setCurrent, batchCut,
  toggleOverdue, cutOverdue, setMinutes, ballStatus, undo, todayStr,
  queuePositions, estimate, formatAccum,
  recordDaily, pruneDaily, rollover, resetDay,
  resetAll,
} from "../src/core.js";

let state;
beforeEach(() => { state = createState(); });

describe("ballStatus", () => {
  it("初始所有球都是 gray", () => {
    for (let i = 1; i <= TOTAL; i++) expect(ballStatus(state, i)).toBe("gray");
  });
});

describe("orderUpTo", () => {
  it("order 到 58：1~58 是 blue，59 是 gray", () => {
    state = orderUpTo(state, 58);
    expect(ballStatus(state, 58)).toBe("blue");
    expect(ballStatus(state, 59)).toBe("gray");
  });
  it("往後 order 較小數字不會減少已 order 的上限", () => {
    state = orderUpTo(state, 58);
    state = orderUpTo(state, 30);
    expect(state.maxOrdered).toBe(58);
    expect(ballStatus(state, 58)).toBe("blue");
  });
  it("邊界 0 / 151：直接忽略", () => {
    state = orderUpTo(state, 0);
    expect(state.maxOrdered).toBe(0);
    state = orderUpTo(state, 151);
    expect(state.maxOrdered).toBe(0);
  });
  it("重複下訂已達上限：no-op 不推 history", () => {
    state = orderUpTo(state, 58);
    const len = state.history.length;
    state = orderUpTo(state, 58);
    expect(state.maxOrdered).toBe(58);
    expect(state.history.length).toBe(len);
  });
});

describe("setCurrent", () => {
  it("設定 18 為 current：18 是 orange，t0 更新為 now", () => {
    state = orderUpTo(state, 58);
    state = setCurrent(state, 18, "15:00");
    expect(ballStatus(state, 18)).toBe("orange");
    expect(state.t0).toBe("15:00");
  });
  it("切換到 19 取代 18：原本 18 變成 cut", () => {
    state = orderUpTo(state, 58);
    state = setCurrent(state, 18, "15:00");
    state = setCurrent(state, 19, "15:20");
    expect(ballStatus(state, 18)).toBe("cut");
    expect(ballStatus(state, 19)).toBe("orange");
  });
  it("原本 overdue 的球設為 current：變回 orange 且移除 overdue", () => {
    state = orderUpTo(state, 58);
    state = toggleOverdue(state, 10);
    state = setCurrent(state, 10, "15:00");
    expect(ballStatus(state, 10)).toBe("orange");
    expect(state.overdue).not.toContain(10);
  });
  it("gray 或 cut 不可設為 current", () => {
    state = orderUpTo(state, 58);
    state = setCurrent(state, 60, "15:00");
    expect(state.current).toBeNull();
    state = setCurrent(state, 5, "15:00");
    state = setCurrent(state, 6, "15:00");
    expect(ballStatus(state, 5)).toBe("cut");
    const before = state.current;
    state = setCurrent(state, 5, "16:00");
    expect(state.current).toBe(before);
  });
  it("同球重複叫號：no-op，不重錨 t0、不加 history", () => {
    state = orderUpTo(state, 58);
    state = setCurrent(state, 18, "15:00");
    expect(state.t0).toBe("15:00");
    const len = state.history.length;
    state = setCurrent(state, 18, "16:00");
    expect(state.t0).toBe("15:00");
    expect(state.history.length).toBe(len);
  });
});

describe("batchCut", () => {
  it("batchCut 到 35：35 之前非 current/overdue 的已 order 球全變 cut，其餘不變", () => {
    state = orderUpTo(state, 58);
    state = setCurrent(state, 18, "15:00");
    state = toggleOverdue(state, 10);
    state = toggleOverdue(state, 12);
    state = orderUpTo(state, 58);
    state = batchCut(state, 35);
    expect(ballStatus(state, 17)).toBe("cut");
    expect(ballStatus(state, 18)).toBe("orange");
    expect(ballStatus(state, 19)).toBe("cut");
    expect(ballStatus(state, 10)).toBe("overdue");
    expect(ballStatus(state, 12)).toBe("overdue");
    expect(ballStatus(state, 35)).toBe("blue");
    expect(ballStatus(state, 34)).toBe("cut");
  });
  it("不會切到未 order 的球（35 維持 gray），且不下修 maxOrdered", () => {
    state = orderUpTo(state, 30);
    state = batchCut(state, 35);
    expect(ballStatus(state, 30)).toBe("cut");
    expect(ballStatus(state, 35)).toBe("gray");
  });
});

describe("toggleOverdue / cutOverdue", () => {
  it("overdue 可來回切換；gray/cut/current 不可設為 overdue", () => {
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
  it("cutOverdue：將 overdue 的球標為 cut", () => {
    state = orderUpTo(state, 58);
    state = toggleOverdue(state, 12);
    state = cutOverdue(state, 12);
    expect(ballStatus(state, 12)).toBe("cut");
    expect(state.overdue).not.toContain(12);
  });
});

describe("setMinutes", () => {
  it("限制 1..240 且自動取捨", () => {
    state = setMinutes(state, 20);
    expect(state.minutes).toBe(20);
    state = setMinutes(state, -3);
    expect(state.minutes).toBe(1);
    state = setMinutes(state, 999);
    expect(state.minutes).toBe(240);
  });
});

describe("undo", () => {
  it("可以 undo 回上一個狀態", () => {
    state = orderUpTo(state, 58);
    state = state.history.length ? undo(state) : state;
    expect(state.maxOrdered).toBe(0);
  });
  it("history 為空時 return 原 state", () => {
    const s = undo(state);
    expect(s).toBe(state);
  });
});

describe("todayStr", () => {
  it("格式化為 yyyy-mm-dd", () => {
    expect(todayStr(new Date(2026, 8, 12))).toBe("2026-09-12");
  });
});

describe("queuePositions", () => {
  it("叫號 18（前面已剪完）、過號 {10,12}、下訂 58 → [18,19,..58,10,12]", () => {
    state = orderUpTo(state, 58);
    state = setCurrent(state, 18, "15:00");
    state = toggleOverdue(state, 10);
    state = toggleOverdue(state, 12);
    state = batchCut(state, 18);
    const seq = queuePositions(state);
    expect(seq[0]).toBe(18);
    expect(seq[1]).toBe(19);
    expect(seq[seq.length - 1]).toBe(12);
    expect(seq[seq.length - 3]).toBe(58);
  });
  it("沒有 current：overdue 依序排到最後", () => {
    state = orderUpTo(state, 58);
    state = toggleOverdue(state, 12);
    state = toggleOverdue(state, 10);
    const seq = queuePositions(state);
    expect(seq.slice(-2)).toEqual([10, 12]);
  });
  it("cut 的球不會出現在序列中", () => {
    state = orderUpTo(state, 58);
    state = setCurrent(state, 18, "15:00");
    state = batchCut(state, 18);
    const seq = queuePositions(state);
    expect(seq[0]).toBe(18);
    expect(seq).not.toContain(17);
  });
});

describe("estimate", () => {
  it("13 顆每人 15 分 = +195 分 = 3 小時 15 分 → 18:15（t0=15:00）", () => {
    state = orderUpTo(state, 30);
    state = setCurrent(state, 18, "15:00");
    state = batchCut(state, 18);
    const seq = queuePositions(state);
    expect(seq.length).toBe(13);
    const last = estimate(state, seq[seq.length - 1]);
    expect(last.accumMin).toBe(195);
    expect(last.time).toBe("18:15");
    const first = estimate(state, seq[0]);
    expect(first.accumMin).toBe(15);
    expect(first.time).toBe("15:15");
  });
  it("過號排在正常人後面，時間往後累加", () => {
    state = orderUpTo(state, 58);
    state = setCurrent(state, 18, "15:00");
    state = toggleOverdue(state, 10);
    state = batchCut(state, 18);
    const e58 = estimate(state, 58);
    const e10 = estimate(state, 10);
    expect(e58.accumMin).toBe((58 - 18 + 1) * 15);
    expect(e10.accumMin).toBe(e58.accumMin + 15);
  });
  it("gray/cut 的球回傳 null", () => {
    state = orderUpTo(state, 30);
    state = setCurrent(state, 18, "15:00");
    state = batchCut(state, 18);
    expect(estimate(state, 17)).toBeNull();
    expect(estimate(state, 60)).toBeNull();
  });
});

describe("formatAccum", () => {
  it("未滿 60 分：45 分", () => expect(formatAccum(45)).toBe("45分"));
  it("剛好一小時：1 小時", () => expect(formatAccum(60)).toBe("1小時"));
  it("跨小時：3 小時 15 分", () => expect(formatAccum(195)).toBe("3小時15分"));
});

describe("daily records", () => {
  it("recordDaily 只記錄 >0", () => {
    const daily = {};
    recordDaily(daily, "2026-09-11", 0);
    expect(daily).toEqual({});
    recordDaily(daily, "2026-09-11", 58);
    expect(daily["2026-09-11"]).toBe(58);
  });

  it("recordDaily 重複記錄保留當天最大（不覆蓋）", () => {
    const daily = recordDaily({}, "2026-09-12", 40);
    recordDaily(daily, "2026-09-12", 30);
    expect(daily["2026-09-12"]).toBe(40);
    recordDaily(daily, "2026-09-12", 50);
    expect(daily["2026-09-12"]).toBe(50);
  });

  it("pruneDaily 保留 90 天以內的資料", () => {
    const today = "2026-09-12";
    const daily = {
      "2026-06-14": 1, // 90 天前，清除
      "2026-06-15": 2, // 90 天內，保留
      "2026-09-12": 58,
    };
    pruneDaily(daily, today);
    expect(daily["2026-06-14"]).toBeUndefined();
    expect(daily["2026-06-15"]).toBe(2);
  });

  it("rollover 同日：直接回傳原狀態", () => {
    state = orderUpTo(state, 58);
    const r = rollover(state, todayStr());
    expect(r.state.maxOrdered).toBe(58);
    expect(r.daily).toEqual({});
  });

  it("rollover 跨日：記錄昨日並回傳清空的新狀態", () => {
    state = orderUpTo(state, 58);
    state.date = "2026-09-11";
    const r = rollover(state, "2026-09-12");
    expect(r.daily["2026-09-11"]).toBe(58);
    expect(r.state.maxOrdered).toBe(0);
    expect(r.state.date).toBe("2026-09-12");
    expect(r.state.history).toEqual([]);
  });

  it("resetDay 換日：清空計數但保留設定與歷史", () => {
    state = orderUpTo(state, 58);
    state = setCurrent(state, 18, "15:00");
    state = toggleOverdue(state, 10);
    const s = resetDay(state);
    expect(s.maxOrdered).toBe(0);
    expect(s.current).toBeNull();
    expect(s.overdue).toEqual([]);
    expect(s.cut).toEqual([]);
    expect(s.minutes).toBe(15);
    expect(s.history.length).toBeGreaterThan(0); // 有動作可 undo
  });
});

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