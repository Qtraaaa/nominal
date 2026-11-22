window.NOMiNAL_PLAN = (function () {
  "use strict";
  var pad = window.NOMiNAL_RULE.pad;
  function n1(v) { return Math.round(v * 100) / 100; }
  function sec(s) { var m = /^(\d+):(\d+(?:\.\d+)?)$/.exec(String(s)); return m ? +m[1] * 60 + +m[2] : +s; }
  function parse(svgText, path, cams) {
    var doc = new DOMParser().parseFromString(svgText, "image/svg+xml"), root = doc.documentElement;
    var vb = (root.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(Number);
    if (root.nodeName !== "svg" || vb.length !== 4 || vb.some(isNaN)) throw new Error("도면 SVG에 viewBox가 없음");
    root.querySelectorAll("style,script,title,desc,metadata").forEach(function (x) { x.remove(); });
    root.querySelectorAll("*").forEach(function (x) { ["style", "class", "stroke", "stroke-width", "fill", "id"].forEach(function (a) { x.removeAttribute(a); }); });
    var rows = (Array.isArray(path) ? path : path.path || path.points).map(function (p) {
      return { t: sec(p.t), x: +p.x, y: +p.y, dir: +p.dir, rewind: !!p.rewind, floor: p.floor === undefined ? "" : String(p.floor) };
    });
    var out = {};
    (Array.isArray(cams) ? cams : cams.cameras).forEach(function (c) {
      out[parseInt(String(c.id).replace(/\D/g, ""), 10)] = { x: +c.x, y: +c.y, dir: +c.dir, fov: +c.fov, floor: c.floor === undefined ? "" : String(c.floor) };
    });
    if (!rows.length || [1, 2, 3, 4, 5, 6].some(function (i) { return !out[i] || [out[i].x, out[i].y, out[i].dir, out[i].fov].some(isNaN); })) throw new Error("경로나 카메라 값이 빠짐");
    return { svg: root.innerHTML, vb: vb, path: rows, cams: out };
  }
  function at(P, t) {
    var best = 0, bd = Infinity;
    P.path.forEach(function (p, i) {
      var d = Math.abs(p.t - t);
      if (d < bd - 1e-6 || (Math.abs(d - bd) <= 1e-6 && p.rewind && !P.path[best].rewind)) { best = i; bd = d; }
    });
    return best;
  }
  function nearest(P, t) {
    var p = P.path[at(P, t)], best = 1, bd = Infinity;
    var same = [1, 2, 3, 4, 5, 6].filter(function (i) { return P.cams[i].floor === p.floor; });
    (same.length ? same : [1, 2, 3, 4, 5, 6]).forEach(function (i) {
      var d = Math.hypot(P.cams[i].x - p.x, P.cams[i].y - p.y);
      if (d < bd) { best = i; bd = d; }
    });
    return best;
  }
  function draw(P, t, id, trailSec, name, link) {
    if (!P) {
      return '<svg viewBox="0 0 300 120" preserveAspectRatio="none"><rect class="ph" x="0" y="6" width="300" height="108"/></svg>';
    }
    var vb = P.vb, u = Math.max(vb[2] / 2.4, vb[3]) / 100, i = at(P, t), p = P.path[i];
    function cam(k) {
      var c = P.cams[k], on = k === id, a = c.dir * Math.PI / 180, f = c.fov * Math.PI / 360, r = 18 * u, s = 4 * u;
      function pt(ang, d) { return n1(c.x + Math.cos(ang) * d) + " " + n1(c.y + Math.sin(ang) * d); }
      var h = on ? '<path class="fan" d="M' + n1(c.x) + " " + n1(c.y) + "L" + pt(a - f, r) + "A" + n1(r) + " " + n1(r) + " 0 0 1 " + pt(a + f, r) + 'Z"/>' : "";
      return h + '<g class="cam' + (on ? "" : " off") + '"><path d="M' + pt(a, s) + "L" + pt(a + 2.6, s) + "L" + pt(a - 2.6, s) + 'Z"/>' +
        (on ? label(c, k) : "") + "</g>";
    }
    function label(c, k) {
      var mx = vb[0] + vb[2] / 2, my = vb[1] + vb[3] / 2, L = Math.hypot(mx - c.x, my - c.y) || 1, dx = (mx - c.x) / L, dy = (my - c.y) / L;
      return '<text font-size="' + n1(8 * u) + '" x="' + n1(c.x + dx * 22 * u) + '" y="' + n1(c.y + dy * 22 * u + 2.8 * u) + '" text-anchor="' +
        (dx < -0.5 ? "end" : dx > 0.5 ? "start" : "middle") + '">' + name(k) + "</text>";
    }
    var tr = [];
    for (var j = i; j >= 0 && j >= i - trailSec * 2 && P.path[j].floor === p.floor; j--) tr.push(n1(P.path[j].x) + "," + n1(P.path[j].y));
    var m = 4 * u;
    return '<svg viewBox="' + [vb[0] - m, vb[1] - m, vb[2] + 2 * m, vb[3] + 2 * m].map(n1).join(" ") + '"><g class="wall">' + P.svg + "</g>" +
      [1, 2, 3, 4, 5, 6].filter(function (k) { return k !== id; }).map(cam).join("") +
      (link ? '<line class="lnk" x1="' + n1(p.x) + '" y1="' + n1(p.y) + '" x2="' + n1(P.cams[id].x) + '" y2="' + n1(P.cams[id].y) + '"/>' : "") + cam(id) +
      '<polyline class="trail" points="' + tr.join(" ") + '"/><circle class="dev" cx="' + n1(p.x) + '" cy="' + n1(p.y) + '" r="' + n1(2.6 * u) + '"/></svg>';
  }
  return { parse: parse, at: at, nearest: nearest, draw: draw };
})();
