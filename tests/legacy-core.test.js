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
