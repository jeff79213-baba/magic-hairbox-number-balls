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
