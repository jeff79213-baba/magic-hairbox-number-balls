import { describe, it, expect, beforeEach } from "vitest";
import {
  TOTAL, createState, orderUpTo, setCurrent, batchCut,
  toggleOverdue, cutOverdue, setMinutes, ballStatus, undo, todayStr,
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