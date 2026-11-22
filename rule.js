(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.NOMiNAL_RULE = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var VERSION = "1.0";
  var ALPH = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  var KST_MS = 9 * 3600 * 1000;
  function pad(n, w) { n = String(n); while (n.length < (w || 2)) n = "0" + n; return n; }
  function cleanNumber(s) { return String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }
  function checkChar(body7) {
    var sum = 0;
    for (var i = 0; i < 7; i++) {
      var idx = ALPH.indexOf(body7.charAt(i));
      if (idx < 0) return null;
      sum += (2 * i + 1) * idx;
    }
    return ALPH.charAt(sum % 32);
  }
  function checkNumber(raw) {
    var s = cleanNumber(raw);
    if (s.length !== 8) return "format";
    for (var i = 0; i < 8; i++) if (ALPH.indexOf(s.charAt(i)) < 0) return "none";
    return checkChar(s.slice(0, 7)) === s.charAt(7) ? "ok" : "none";
  }
  function displayNumber(s) { s = cleanNumber(s); return s.slice(0, 4) + "-" + s.slice(4, 8); }
  function fnv1a(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }
  function kstToMs(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(s);
    if (!m) throw new Error("기준 시각 형식: YYYY-MM-DDTHH:MM");
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - KST_MS;
  }
  function numberPrevAccessMs(raw, numberTime) {
    var s = cleanNumber(raw);
    var span = numberTime.spanDays * 1440;
    var off = fnv1a("NOMiNAL:" + s) % span;
    return kstToMs(numberTime.baseKST) + off * 60000;
  }
  function localPrevAccessMs(firstViewMs) {
    return Math.floor(firstViewMs / 60000) * 60000 - 24 * 3600 * 1000;
  }
  function formatKST(ms, withSec) {
    var d = new Date(ms + KST_MS);
    var s = d.getUTCFullYear() + "." + pad(d.getUTCMonth() + 1) + "." + pad(d.getUTCDate()) +
      " " + pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes());
    return withSec ? s + ":" + pad(d.getUTCSeconds()) : s;
  }
  function makeNumber(rand) {
    var b = "";
    for (var i = 0; i < 7; i++) b += ALPH.charAt(rand(32));
    return b + checkChar(b);
  }
  return {
    VERSION: VERSION, ALPH: ALPH, pad: pad, cleanNumber: cleanNumber, checkChar: checkChar, checkNumber: checkNumber,
    displayNumber: displayNumber, fnv1a: fnv1a, kstToMs: kstToMs, numberPrevAccessMs: numberPrevAccessMs,
    localPrevAccessMs: localPrevAccessMs, formatKST: formatKST, makeNumber: makeNumber
  };
});
