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
