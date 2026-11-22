(function () {
  "use strict";
  var CFG = window.NOMiNAL_CFG, R = window.NOMiNAL_RULE, B = window.NOMiNAL_BRAND;
  var CH = {};
  B.channels.forEach(function (c) { CH[c.id] = c; });
  var LETTERS = B.channels.map(function (c) { return c.char; });
  var F = { cam: B.form.order[0], time: B.form.order[1], check: B.form.order[2], judge: B.form.order[3], s1: [] };
  CFG.s1Order.forEach(function (k, i) { F.s1[k] = (i + 1) + " " + B.form.s1[k].replace(/^\d+ /, ""); });
  var $ = function (id) { return document.getElementById(id); };
  var DEMO = false;
  try { DEMO = sessionStorage.getItem(CFG.storageKey + ".demo") === "1"; } catch (e) {  }
  var pad4 = function (n) { return R.pad(n, 4); };
  function toSec(mmss) { var m = /^(\d{1,2}):(\d{2})$/.exec(String(mmss).trim()); return m ? +m[1] * 60 + +m[2] : null; }
  var SEGS = B.channels.map(function (c) {
    return { id: c.id, s: toSec(c.time[0]), e: toSec(c.time[1]), rw: c.rewind ? c.rewind.map(toSec) : null };
  });
  function matchSeg(t) {
    var rw = SEGS.filter(function (g) { return g.rw && t >= g.rw[0] && t <= g.rw[1]; });
    if (rw.length) return rw[rw.length - 1];
    return SEGS.filter(function (g) { return t >= g.s && t < g.e; }).pop() || null;
  }
  var PLAN = null, PLAN_STATE = "임시";
  function loadPlan() {
    var C = CFG.plan;
    if (location.protocol === "file:" || !C) return Promise.resolve();
    function get(u, kind) { return fetch(encodeURI(u), { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error(u + " " + r.status); return r[kind](); }); }
    return Promise.all([get(C.svg, "text"), get(C.path, "json"), get(C.cams, "json")]).then(function (a) {
      PLAN = window.NOMiNAL_PLAN.parse(a[0], a[1], a[2]);
      PLAN_STATE = "납품본";
      if (CUR.s === "S1") S1(CUR.seq);
    }).catch(function (e) { console.warn("도면 자료를 읽지 못해 자리표시를 쓴다:", e.message); });
  }
  function nearCam(t) {
    if (PLAN) return window.NOMiNAL_PLAN.nearest(PLAN, t);
    var best = null, bd = Infinity;
    SEGS.forEach(function (g) {
      var d = t < g.s ? g.s - t : t > g.e ? t - g.e : 0;
      if (d < bd || (d === bd && g.id > best.id)) { best = g; bd = d; }
    });
    return best.id;
  }
  function camId(e) { return e.seg || nearCam(toSec(e.t)); }
  function camLabel(id) { return B.labelFormat.replace("{nn}", R.pad(id)).replace("{char}", CH[id].char); }
  function camName(e) { return camLabel(camId(e)); }
  function planHtml(e) { return ln(window.NOMiNAL_PLAN.draw(PLAN, toSec(e.t), camId(e), CFG.plan.trailSec, camLabel, !e.seg), "plan"); }
  function rangeOf(id) { return CH[id].time.join("–"); }
  var STAGES = ["s0", "v1", "v2", "v3"];
  function stageOf(L, e) {
    if (e.fx) return e.fx;
    if (!e.seg) return "normal";
    var n = L.entries.slice(0, e.seq - 1).filter(function (x) { return x.seg === e.seg; }).length;
    return STAGES[Math.min(n, STAGES.length - 1)];
  }
  function loopHtml(id, stage, tl) {
    var C = CFG.loops, f = "loop_" + R.pad(id) + "_" + C.names[stage] + C.suffix;
    return ln('<video autoplay muted loop playsinline preload="auto"' + (C.poster ? ' poster="' + encodeURI(C.poster.dir + f + C.poster.ext) + '"' : "") + ' data-loop="' + R.pad(id) + "_" + stage + '">' +
      C.paths.map(function (p) { return '<source src="' + encodeURI(p.dir + f + p.ext) + '" type="' + p.type + '">'; }).join("") + "</video>" +
      '<span class="hud tl">' + tl + '</span><span class="hud tr">' + camLabel(id) + '</span><span class="hud bl"><i role="img" aria-label="NOMiNAL"></i></span>', "lp");
  }
  function playLoop() { var v = document.querySelector(".lp video"); if (v) { v.muted = true; var p = v.play(); if (p) p.catch(function () {  }); } }
  var HIS = "정정 이력", ORG = "원본", ORGV = "인쇄 보관본", NONE = "기록 없음";
  function stageNo(L, e) { return e.seg ? STAGES.indexOf(stageOf(L, e)) + 1 : 0; }
  function seenMap(L) {
    var o = {};
    L.entries.forEach(function (e) { var k = stageNo(L, e); if (k) (o[e.seg] = o[e.seg] || {})[k] = true; });
    return o;
  }
  function seenCount(o) { return Object.keys(o).reduce(function (a, id) { return a + Object.keys(o[id]).length; }, 0); }
  function hisHtml(L, e) {
    var n = stageNo(L, e), seen = seenMap(L)[e.seg] || {};
    if (!n) return ln('<span class="k">' + HIS + '</span><span class="none">' + NONE + "</span>", "his");
    var h = '<b class="o">' + ORG + "</b>";
    for (var k = 1; k <= STAGES.length; k++) {
      h += seen[k] ? '<button type="button" class="' + (k === n ? "now" : "seen") + '" data-his="' + e.seg + "-" + k + '">' + k + "</button>" : "<b>" + k + "</b>";
    }
    return ln('<span class="k">' + HIS + '</span><span class="st">' + h + "</span>", "his");
  }
  function checkVal(v) {
    var m = /^([\d.:]+)(\s*)(.*)$/.exec(v);
    return m ? m[1] + (m[3] ? m[2] + '<span class="u' + (m[3] === "°" ? " dg" : "") + '">' + m[3] + "</span>" : "") : '<span class="t">' + v + "</span>";
  }
  function inText(v) { return v.replace(/[\d][\d.:]*/g, '<span class="n">$&</span>'); }
  function checkRows(id) {
    return ln('<span class="k">' + F.s1[2] + "</span>", "row cap") + CH[id].checks.map(function (c) { return row(c[0], checkVal(c[1]), "ck"); }).join("");
  }
  function item1(e) { var c = CH[camId(e)].checks[0]; return c[0] + " " + inText(c[1]); }
  function ledHead() {
    return '<span class="s">순번</span><span class="c">' + F.cam + '</span><span class="tt">' + F.time + '</span><span class="i">' + F.check + '</span><span class="m">기록 대조</span><span class="a">접속</span>';
  }
  function ledRow(e) {
    var mm = e.seg || e.again;
    return '<span class="s">' + pad4(e.seq) + '</span><span class="c">' + camName(e) + '</span><span class="tt">' + e.t + '</span><span class="i">' + item1(e) +
      '</span><span class="m' + (mm ? " b" : "") + '">' + (mm ? "불일치 1건" : "일치") + '</span><span class="a">' + R.formatKST(e.at, true) + "</span>";
  }
  function blankLedger() { return { entries: [] }; }
  var S = (function load() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(CFG.storageKey)); } catch (e) { s = null; }
    if (!s || !s.led) s = { v: 3, number: null, led: { _local: blankLedger() } };
    if (!s.led._local) s.led._local = blankLedger();
    return s;
  })();
  function save() { try { localStorage.setItem(CFG.storageKey, JSON.stringify(S)); } catch (e) {  } }
  save();
  function ledKey() { return S.number || "_local"; }
  function ledger() { var k = ledKey(); if (!S.led[k]) S.led[k] = blankLedger(); return S.led[k]; }
  function preAt(L) { return S.number ? R.numberPrevAccessMs(S.number, CFG.numberTime) : L.entries.length ? R.localPrevAccessMs(L.entries[0].at) : null; }
  function corrAt(L, e) { return L.entries[e.seq - 2].at - B.correctionSec * 1000; }
  function lastAgain(L) { return L.entries.filter(function (e) { return e.again; }).pop() || null; }
  function after(last, now) { return last && Math.floor(now / 1000) <= Math.floor(last.at / 1000) ? last.at + 1000 : now; }
  function opened() {
    var o = {};
    ledger().entries.forEach(function (e) { if (e.seg) o[e.seg] = 1; });
    return o;
  }
  function openedCount() { return Object.keys(opened()).length; }
  function firstAccess(L) { return L.entries[0].at; }
  function doneBy(L, seq) {
    var o = {};
    L.entries.slice(0, seq).forEach(function (e) { if (e.seg) o[e.seg] = 1; });
    return Object.keys(o).length === 6;
  }
  var delay = 0;
  function ln(html, cls, tag) {
    var d = delay; delay += 120;
    return "<" + (tag || "div") + ' class="ln ' + (cls || "") + '" style="animation-delay:' + d + 'ms">' + html + "</" + (tag || "div") + ">";
  }
  function kv(k, v) { return '<span class="k">' + k + '</span><span class="v">' + v + "</span>"; }
  function row(k, v, cls) { return ln(kv(k, v), "row " + (cls || "")); }
  function rg(id) { return '<span class="rg">' + rangeOf(id) + "</span>"; }
  function doneVal(L) {
    var m = /^(\D+)(\d+)(\D+)$/.exec(B.reader.records);
    return '<span class="t b">' + m[1] + "</span>" + m[2] + '<span class="u">' + m[3] + '</span><span class="sub">' + R.formatKST(firstAccess(L)) + "</span>";
  }
  function chip() { return '<span class="chip"><i role="img" aria-label="NOMiNAL"></i></span>'; }
  function link(to, label) { return '<button type="button" class="lk" data-go="' + to + '">' + label + "</button>"; }
  function links(arr) { return '<div class="lks">' + arr.join("") + "</div>"; }
  function lnLinks(arr) { return ln(arr.join(""), "lks"); }
  function drawProgress() {
    var o = opened(), n = Object.keys(o).length, h = "<span>" + n + "/6</span><span class=\"ls\">";
    LETTERS.forEach(function (c, i) {
      if (i) h += "<s>·</s>";
      h += '<b class="' + (o[i + 1] ? "on" : "") + '">' + c + "</b>";
    });
    $("pg").innerHTML = h + "</span>";
  }
  function show(name, html, focusId) {
    document.body.classList.remove("pv", "wide");
    $("scr").textContent = name;
    $("view").innerHTML = html;
    drawProgress();
    window.scrollTo(0, 0);
    if (focusId && !DEMO && !matchMedia("(pointer:coarse)").matches) { var f = $(focusId); if (f) f.focus({ preventScroll: true }); }
  }
  function S0(err) {
    delay = 0;
    show("기록 열람",
      '<form class="fld" id="f0" novalidate autocomplete="off">' +
      '<label class="lab" for="t">' + F.time + "</label>" +
      '<input class="big time" id="t" name="t" inputmode="numeric" maxlength="5" placeholder="00:00" aria-describedby="e0">' +
      '<div class="err" id="e0" role="alert">' + (err || "") + "</div>" +
      '<button class="act" type="submit">기록 열람</button></form>' +
      links([link("S2", "열람 번호 등록"), link("S3", "열람자 기록"), link("S4", HIS)]), "t");
    $("t").addEventListener("input", function (e) {
      var d = e.target.value.replace(/\D/g, "").slice(0, 4);
      e.target.value = d.length > 2 ? d.slice(0, 2) + ":" + d.slice(2) : d;
    });
    $("f0").addEventListener("submit", function (e) {
      e.preventDefault();
      var v = $("t").value, m = /^(\d{2}):([0-5]\d)$/.exec(v);
      if (!m) { $("e0").textContent = "형식 불일치. mm:ss"; $("t").focus(); return; }
      openRecord(v);
    });
  }
  function openRecord(v) { go("S1", { seq: addEntry(v) }); }
  function addEntry(v) {
    var t = toSec(v), g = matchSeg(t), L = ledger(), n = L.entries.length, seg = g ? g.id : 0;
    var again = L.entries.some(function (x) { return x.seg === seg && Math.abs(toSec(x.t) - t) <= CFG.sameSec; });
    L.entries.push({ seq: n + 1, t: v, seg: seg, at: after(L.entries[n - 1], Date.now()), again: again });
    save();
    return n + 1;
  }
  function S1(seq) {
    var L = ledger(), e = L.entries[seq - 1];
    if (!e) return S0();
    delay = 0;
    var mismatch = e.seg || e.again, done = doneBy(L, e.seq);
    var no = S.number ? R.displayNumber(S.number) + " · " + pad4(e.seq) : '<span class="kr">미등록</span> · ' + pad4(e.seq);
    var id = camId(e), stage = stageOf(L, e);
    function cap(k) { return ln('<span class="k">' + F.s1[k] + "</span>", "row cap"); }
    var part = [
      function () { return cap(0) + planHtml(e); },
      function () { return cap(1) + loopHtml(id, stage, e.seg ? rangeOf(e.seg) : e.t) + hisHtml(L, e); },
      function () { return checkRows(id); },
      function () { return row(F.s1[3], '<span class="t' + (mismatch ? " b" : "") + '">' + (mismatch ? "불일치 1건" : "일치") + "</span>"); },
      function () { return row(F.s1[4], chip()); },
      function () { return row(F.s1[5], R.formatKST(e.at, true)); }
    ];
    var h = '<div class="rec">' +
      row("열람 번호 · 순번", no, "slim") +
      ln("<div>" + kv(F.cam, camName(e) + (e.seg ? rg(e.seg) : "")) + '</div><div class="time">' + kv(F.time, e.t) + "</div>", "row two") +
      CFG.s1Order.map(function (k) { return part[k](); }).join("") +
      row(e.again ? "이전 접속 (정정)" : "이전 접속 1건", e.again ? R.formatKST(corrAt(L, e), true) : R.formatKST(preAt(L)), "alert") +
      (e.again ? ln("원본: 인쇄 보관본", "note") : "") +
      (done ? row(B.reader.label, doneVal(L), "done") : "") +
      "</div>";
    var l = [link("S0", "다른 시각 열람")];
    if (!S.number) l.push(link("S2", "열람 번호 등록"));
    l.push(link("S3", "열람자 기록"), link("S4", HIS));
    show("열람 기록", h + lnLinks(l));
    playLoop();
  }
  function S2(err) {
    delay = 0;
    show("열람 번호 등록",
      '<form class="fld" id="f2" novalidate autocomplete="off">' +
      '<label class="lab" for="n">열람 번호</label>' +
      '<input class="big" id="n" name="n" maxlength="9" placeholder="XXXX-XXXX" autocapitalize="characters" spellcheck="false" aria-describedby="e2">' +
      '<div class="err" id="e2" role="alert">' + (err || "") + "</div>" +
      '<button class="act" type="submit">열람 번호 등록</button></form>' +
      links([link("S0", "기록 열람")]), "n");
    $("n").addEventListener("input", function (e) {
      var d = R.cleanNumber(e.target.value).slice(0, 8);
      e.target.value = d.length > 4 ? d.slice(0, 4) + "-" + d.slice(4) : d;
    });
    $("f2").addEventListener("submit", function (e) {
      e.preventDefault();
      var v = $("n").value, c = R.checkNumber(v);
      if (c === "format") { $("e2").textContent = "형식 불일치. 영숫자 8자"; $("n").focus(); return; }
      if (c === "none") { $("e2").textContent = "해당 번호 없음."; $("n").focus(); return; }
      register(R.cleanNumber(v));
      go("S0");
    });
  }
  function register(num) {
    var src = S.led._local, dst = S.led[num] || (S.led[num] = blankLedger());
    dst.entries = dst.entries.concat(src.entries).sort(function (a, b) { return a.at - b.at || a.seq - b.seq; });
    dst.entries.forEach(function (e, i, all) { e.seq = i + 1; e.at = after(all[i - 1], e.at); });
    S.led._local = blankLedger();
    S.number = num;
    save();
  }
  function S3() {
    delay = 0;
    var L = ledger(), done = openedCount() === 6, al = ledgerAlert(), ag = lastAgain(L);
    if (!S.number && !done) {
      show("열람자 기록", '<div class="fld"><div class="err" role="alert">열람 번호 없음.</div></div>' +
        links([link("S2", "열람 번호 등록"), link("S0", "기록 열람")]));
      return;
    }
    function wide(k, v, cls) { return ln('<span class="k">' + k + '</span><span class="v">' + v + "</span>", "row wide" + (cls ? " " + cls : "")); }
    var h = '<div class="rec led">' +
      wide("열람 번호", S.number ? R.displayNumber(S.number) : '<span class="kr">미등록</span>') +
      (L.entries.length ? ln(ledHead(), "row hdr") : "");
    L.entries.forEach(function (e) { h += ln(ledRow(e), "row"); });
    h += wide(F.judge, chip()) +
      wide("이전 접속 1건", R.formatKST(preAt(L)), al === "pre" ? "alert" : "") +
      (ag ? wide("이전 접속 (정정)", R.formatKST(corrAt(L, ag), true), "alert") : "") +
      (done ? wide(B.reader.label, doneVal(L), "done") : "");
    h += "</div>";
    show("열람자 기록", h + lnLinks(S.number ? [link("S0", "다른 시각 열람"), link("S4", HIS)] : [link("S2", "열람 번호 등록")]));
  }
  function S4(st) {
    delay = 0;
    var L = ledger(), seen = seenMap(L), id = st && st.id, k = st && st.k, h = '<div class="rec arc">';
    if (!(seen[id] && seen[id][k])) {
      var last = L.entries.filter(function (e) { return stageNo(L, e); }).pop();
      id = last ? last.seg : 0; k = last ? stageNo(L, last) : 0;
    }
    if (id) h += '<div class="sel">' + ln("<div>" + kv(F.cam, camLabel(id) + rg(id)) + '</div><div class="time">' + kv(HIS, k) + "</div>", "row two") + loopHtml(id, STAGES[k - 1], rangeOf(id)) + "</div>";
    h += '<div class="lst">' + ln("<span>" + ORG + "</span>" + STAGES.map(function (x, i) { return '<span class="n">' + (i + 1) + "</span>"; }).join(""), "g h");
    B.channels.forEach(function (c) {
      var s = seen[c.id] || {}, g = '<div class="c org"><span>' + ORGV.replace(" ", "<br>") + "</span></div>";
      STAGES.forEach(function (x, i) {
        g += s[i + 1] ? '<button type="button" class="c' + (c.id === id && i + 1 === k ? " now" : "") + '" data-his="' + c.id + "-" + (i + 1) + '" aria-label="' + camLabel(c.id) + " " + HIS + " " + (i + 1) + '"><img src="' +
          CFG.thumbs.dir + "loop_" + R.pad(c.id) + "_" + x + CFG.thumbs.ext + '" alt="" width="480" height="270"></button>' : '<div class="c"></div>';
      });
      h += ln('<div class="rh"><span>' + camLabel(c.id) + "</span><small>" + rangeOf(c.id) + '</small></div><div class="g">' + g + "</div>");
    });
    h += '</div><div class="sum">' + row("열람", seenCount(seen) + "/" + B.channels.length * STAGES.length, "slim") + row(F.judge, chip()) + "</div></div>";
    show(HIS, h + lnLinks([link("S0", L.entries.length ? "다른 시각 열람" : "기록 열람"), link("S3", "열람자 기록")]));
    document.body.classList.toggle("wide", !!id);
    playLoop();
  }
  function ledgerAlert() { return lastAgain(ledger()) ? "corr" : "pre"; }
  function receipt() {
    var L = ledger(), al = ledgerAlert(), o = opened();
    var pre = preAt(L), ag = lastAgain(L);
    function r(k, v, inv) { return '<div class="r' + (inv ? " inv" : "") + '"><span class="k">' + k + '</span><span class="v">' + v + "</span></div>"; }
    var h = '<div class="rhd"><span class="rlogo" role="img" aria-label="NOMiNAL"></span><span>열람자 기록</span></div>' +
      r("열람 번호", S.number ? R.displayNumber(S.number) : '<span class="kr">미등록</span>') +
      (L.entries.length ? '<div class="r e hdr">' + ledHead() + "</div>" : "");
    L.entries.forEach(function (e) { h += '<div class="r e">' + ledRow(e) + "</div>"; });
    h += r(F.judge, '<span class="rchip"><i role="img" aria-label="NOMiNAL"></i></span>') +
      (pre === null ? "" : r("이전 접속 1건", R.formatKST(pre), al === "pre")) +
      (ag ? r("이전 접속 (정정)", R.formatKST(corrAt(L, ag), true), al === "corr") + '<div class="r"><span class="k">원본: 인쇄 보관본</span></div>' : "");
    if (openedCount() === 6) h += r(B.reader.label, doneVal(L));
    h += '<div class="rpg"><span>' + openedCount() + "/6</span><span>" + LETTERS.map(function (c, i) { return '<b class="' + (o[i + 1] ? "on" : "") + '">' + c + "</b>"; }).join(" · ") + "</span></div>" +
      '<div class="rft"><span class="wm" role="img" aria-label="NOMiNAL"></span> — 정상으로 기록된 이상</div>';
    $("rc").innerHTML = h;
    var el = $("rc"), keep = el.getAttribute("style");
    el.setAttribute("style", "display:block;position:absolute;left:-9999px;margin:0");
    var mm = Math.ceil(el.getBoundingClientRect().height * 25.4 / 96) + 1;
    if (keep === null) el.removeAttribute("style"); else el.setAttribute("style", keep);
    var st = $("rcpage") || document.head.appendChild(Object.assign(document.createElement("style"), { id: "rcpage" }));
    st.textContent = "@page{size:80mm " + mm + "mm;margin:0}";
  }
  function P() { receipt(); document.body.classList.add("pv"); window.scrollTo(0, 0); }
  window.addEventListener("beforeprint", receipt);
  var SCREENS = { S0: function () { S0(); }, S1: function (st) { S1(st && st.seq); }, S2: function () { S2(); }, S3: function () { S3(); }, S4: function (st) { S4(st); }, P: function () { P(); } };
  var CUR = { s: "S0" };
  function go(s, extra, replace) {
    var st = { s: s }; if (extra) for (var k in extra) st[k] = extra[k];
    try { history[replace ? "replaceState" : "pushState"](st, "", location.pathname); } catch (e) {  }
    CUR = st; SCREENS[s](st);
  }
  window.addEventListener("popstate", function (e) { var st = e.state || { s: "S0" }; CUR = st; (SCREENS[st.s] || SCREENS.S0)(st); });
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-go]"), c = e.target.closest("[data-his]");
    if (c) { var v = c.getAttribute("data-his").split("-"); return go("S4", { id: +v[0], k: +v[1] }, CUR.s === "S4"); }
    if (b) { if (b.getAttribute("data-go") === CUR.s) window.scrollTo(0, 0); else go(b.getAttribute("data-go")); }
    else if (e.target.closest(".lp")) playLoop();
  });
  function demoStart() {
    demoReset();
    DEMO = true;
    try { sessionStorage.setItem(CFG.storageKey + ".demo", "1"); } catch (e) {  }
  }
  function demoReset() { S = { v: 3, number: null, led: { _local: blankLedger() } }; save(); }
  function demoTime(id) {
    var g = SEGS.filter(function (x) { return x.id === id; })[0], t = Math.floor((g.s + g.e) / 2);
    return R.pad(Math.floor(t / 60)) + ":" + R.pad(t % 60);
  }
  function demoStage(d) {
    if (CUR.s !== "S1") return;
    var L = ledger(), e = L.entries[CUR.seq - 1], all = ["normal"].concat(STAGES);
    e.fx = all[Math.max(0, Math.min(all.length - 1, all.indexOf(stageOf(L, e)) + d))];
    save(); S1(CUR.seq);
  }
  var DEMO_KEYS = {
    ArrowLeft: function () { demoStage(-1); },
    ArrowRight: function () { demoStage(1); },
    Digit0: function () { openRecord(CFG.demo.normalTime); },
    KeyC: function () {
      var o = opened(), seq = 0;
      for (var i = 1; i <= 6; i++) if (!o[i]) seq = addEntry(demoTime(i));
      if (seq) go("S1", { seq: seq });
    },
    KeyN: function () {
      var a = CFG.sampleNumbers.map(R.cleanNumber);
      register(a[(a.indexOf(S.number) + 1) % a.length]);
      go("S0");
    },
    KeyS: function () { go("S3"); },
    KeyA: function () { go("S4"); },
    KeyH: function () { go("S0"); },
    KeyP: function () { go("P"); },
    KeyR: function () { demoReset(); go("S0"); },
    Escape: function () { if (CUR.s === "P") go("S3"); }
  };
  [1, 2, 3, 4, 5, 6].forEach(function (i) { DEMO_KEYS["Digit" + i] = function () { openRecord(demoTime(i)); }; });
  document.addEventListener("keydown", function (e) {
    if (!DEMO || e.ctrlKey || e.altKey || e.metaKey || e.repeat) return;
    if (/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) { if (e.code === "Escape") e.target.blur(); return; }
    var f = DEMO_KEYS[e.code.replace("Numpad", "Digit")];
    if (f) { e.preventDefault(); f(); }
  });
  var q = new URLSearchParams(location.search).get(CFG.entryParam);
  if (q === CFG.demo.code) demoStart();
  loadPlan();
  go(CFG.entry[q] || "S0", null, true);
  document.fonts && document.fonts.ready.then(function () { if (CUR.s === "P") receipt(); });
  window.NOMiNAL_CHECK = function () {
    return { alerts: document.querySelectorAll(".alert").length, brand: B, segs: SEGS, number: S.number, opened: openedCount(),
      loop: (function (v) { return v ? { id: v.getAttribute("data-loop"), src: decodeURI(v.currentSrc), w: v.videoWidth, t: v.currentTime, paused: v.paused, ready: v.readyState, err: !!v.error, poster: decodeURI(v.poster) } : null; })(document.querySelector(".lp video")),
      demo: DEMO, screen: CUR.s,
      plan: PLAN_STATE, hasPlan: !!PLAN, view: PLAN ? PLAN.vb : null,
      ledger: ledger().entries, judge: function (mmss) { var g = matchSeg(toSec(mmss)); return (g ? "이상 " : "정상 ") + camName({ t: mmss, seg: g ? g.id : 0 }); } };
  };
})();
