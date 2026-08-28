// 오선보를 SVG 로 그린다. 이미지 파일은 한 장도 쓰지 않는다 — 클레프까지 코드가 그린다.
//
// 악보 자료 꼴:
//   { clef:'treble'|'bass'|'perc', time:[4,4], measures:[ [ev, ev...], ... ] }
//   ev = { p:'C4' | ['C4','E4'] | null(쉼표), d:4, dot:true, label:'R', head:'x', text:'가' }

import { STAFF_METRIC, COLOR, DEG_COLOR } from './../config.js';
import { sv, svgRoot, line, rect, circle, path, text, ellipse } from './../util/svg.js';
import { parseNote, noteStep, ALTER_SIGN } from './../theory/notes.js';

const S = STAFF_METRIC;

// 클레프마다 "제일 아래 줄이 무슨 음인가"
const BOTTOM_STEP = { treble: 4 * 7 + 2, bass: 2 * 7 + 4 };   // E4 · G2

function stepToY(clef, step, top) {
  const base = BOTTOM_STEP[clef] != null ? BOTTOM_STEP[clef] : BOTTOM_STEP.treble;
  return top + 4 * S.s - (step - base) * (S.s / 2);
}

// 오선 다섯 줄
function staffLines(x, top, w, g) {
  for (let i = 0; i < 5; i++) g.appendChild(line(x, top + i * S.s, x + w, top + i * S.s, COLOR.paperInk, 0.9));
}

// ── 클레프 ─────────────────────────────
// 높은음자리표. 이름 그대로 나선의 중심이 "솔(G)" 줄에 앉는다.
// 나선은 손으로 찍은 곡선이 아니라 계산해서 그린다 — 그래야 크기를 바꿔도 안 망가진다.
function trebleClef(x, top) {
  const s = S.s, gy = top + 3 * s;                    // 둘째 줄 = 솔
  const turns = 1.75, r0 = 1.2 * s, r1 = 0.12 * s;
  const a0 = Math.PI * 1.25;                          // 나선의 바깥 끝은 왼쪽 위
  const pts = [];
  const steps = 46;
  for (let i = steps; i >= 0; i--) {                  // 안쪽에서 바깥쪽으로 그린다
    const t = i / steps;
    const a = a0 + t * turns * 2 * Math.PI;
    const r = r1 + (r0 - r1) * t;
    pts.push([x + Math.cos(a) * r, gy + Math.sin(a) * r]);
  }
  const d = ['M', pts[0][0], pts[0][1]]
    .concat(pts.slice(1).reduce((acc, p) => acc.concat(['L', p[0], p[1]]), []))
    .concat([
      // 나선 바깥 끝에서 이어서: 위로 크게 돌아 꼭대기 → 오른쪽으로 내려와 오선을 가로지르고 → 아래 꼬리
      'C', x - 1.02 * s, gy - 2.0 * s, x - 0.2 * s, gy - 3.45 * s, x + 0.35 * s, gy - 2.9 * s,
      'C', x + 0.9 * s, gy - 2.35 * s, x + 0.78 * s, gy - 1.15 * s, x + 0.25 * s, gy - 0.15 * s,
      'C', x - 0.4 * s, gy + 1.15 * s, x + 0.7 * s, gy + 1.65 * s, x + 0.2 * s, gy + 3.15 * s,
      'C', x + 0.05 * s, gy + 3.7 * s, x - 0.62 * s, gy + 3.4 * s, x - 0.55 * s, gy + 2.8 * s,
    ]).join(' ');
  return sv('g', null, [
    path(d, { stroke: COLOR.paperInk, 'stroke-width': s * 0.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
  ]);
}

function bassClef(x, top) {
  const s = S.s, fy = top + s;                        // 넷째 줄 = 파
  const d = [
    'M', x + 0.05 * s, fy - 0.75 * s,
    'C', x + 0.75 * s, fy - 1.1 * s, x + 1.25 * s, fy - 0.3 * s, x + 1.0 * s, fy + 0.7 * s,
    'C', x + 0.75 * s, fy + 1.75 * s, x - 0.15 * s, fy + 2.3 * s, x - 0.9 * s, fy + 2.6 * s,
  ].join(' ');
  return sv('g', null, [
    path(d, { stroke: COLOR.paperInk, 'stroke-width': s * 0.22, 'stroke-linecap': 'round' }),
    circle(x - 0.05 * s, fy - 0.55 * s, s * 0.28, COLOR.paperInk),
    circle(x + 1.45 * s, fy - 0.5 * s, s * 0.15, COLOR.paperInk),
    circle(x + 1.45 * s, fy + 0.5 * s, s * 0.15, COLOR.paperInk),
  ]);
}

function percClef(x, top) {
  const s = S.s;
  return sv('g', null, [
    rect(x, top + s * 0.9, s * 0.34, s * 2.2, COLOR.paperInk),
    rect(x + s * 0.62, top + s * 0.9, s * 0.34, s * 2.2, COLOR.paperInk),
  ]);
}

function clefOf(kind, x, top) {
  if (kind === 'bass') return bassClef(x, top);
  if (kind === 'perc') return percClef(x, top);
  return trebleClef(x, top);
}

// ── 박자표 ─────────────────────────────
function timeSig(x, top, t) {
  const s = S.s;
  return sv('g', null, [
    text(x, top + s * 1.05, t[0], { 'font-size': s * 2.3, 'font-weight': 700, fill: COLOR.paperInk }),
    text(x, top + s * 3.05, t[1], { 'font-size': s * 2.3, 'font-weight': 700, fill: COLOR.paperInk }),
  ]);
}

// ── 음표 ──────────────────────────────
function ledgers(clef, step, x, top, g) {
  const base = BOTTOM_STEP[clef] != null ? BOTTOM_STEP[clef] : BOTTOM_STEP.treble;
  const w = S.noteR * 2.1;
  for (let k = base + 10; k <= step; k += 2) g.appendChild(line(x - w, stepToY(clef, k, top), x + w, stepToY(clef, k, top), COLOR.paperInk, 0.9));
  for (let k = base - 2; k >= step; k -= 2) g.appendChild(line(x - w, stepToY(clef, k, top), x + w, stepToY(clef, k, top), COLOR.paperInk, 0.9));
}

function head(x, y, dur, kind, fill) {
  if (kind === 'x') {
    const r = S.noteR * 0.86;
    return sv('g', null, [
      line(x - r, y - r, x + r, y + r, fill, 1.8),
      line(x - r, y + r, x + r, y - r, fill, 1.8),
    ]);
  }
  const hollow = dur <= 2;
  return ellipse(x, y, S.noteR, S.noteR * 0.76, hollow ? 'none' : fill, -18,
    hollow ? { stroke: fill, 'stroke-width': 1.7 } : null);
}

function flags(x, y, dir, dur, g, fill) {
  const n = dur === 8 ? 1 : dur === 16 ? 2 : 0;
  for (let i = 0; i < n; i++) {
    const y0 = y + dir * (i * S.s * 0.85);
    g.appendChild(path(
      ['M', x, y0, 'C', x + S.s * 0.9, y0 + dir * S.s * 0.55, x + S.s * 0.75, y0 + dir * S.s * 1.35, x + S.s * 0.15, y0 + dir * S.s * 1.7].join(' '),
      { stroke: fill, 'stroke-width': 1.9, 'stroke-linecap': 'round' }));
  }
}

// 쉼표
function restGlyph(x, top, dur) {
  const s = S.s, midY = top + 2 * s;
  if (dur <= 1) return rect(x - s * 0.5, top + s - s * 0.28, s, s * 0.42, COLOR.paperInk);
  if (dur === 2) return rect(x - s * 0.5, top + 2 * s - s * 0.14, s, s * 0.42, COLOR.paperInk);
  if (dur === 4) {
    return path(['M', x - s * 0.25, midY - s * 1.1, 'l', s * 0.55, s * 0.75, 'l', -s * 0.6, s * 0.7,
      'l', s * 0.7, s * 0.8].join(' '), { stroke: COLOR.paperInk, 'stroke-width': 2.1, 'stroke-linecap': 'round' });
  }
  const g = sv('g');
  g.appendChild(path(['M', x + s * 0.4, midY - s * 0.9, 'L', x - s * 0.2, midY + s * 1.0].join(' '),
    { stroke: COLOR.paperInk, 'stroke-width': 1.6 }));
  g.appendChild(circle(x - s * 0.1, midY - s * 0.65, s * 0.22, COLOR.paperInk));
  if (dur >= 16) g.appendChild(circle(x + s * 0.05, midY + s * 0.1, s * 0.22, COLOR.paperInk));
  return g;
}

const WIDTH_OF = { 1: 3.0, 2: 1.9, 4: 1.15, 8: 0.75, 16: 0.55 };
// 한 박(4분음표)을 넘어가면 빔을 끊는다. 4/4 에서 "1앤 2앤" 이 따로 묶이는 이유.
const BEAM_UNIT = 1;

// 이벤트 하나의 머리를 그리고, 기둥이 어디서 시작해야 하는지 돌려준다.
// 기둥 끝은 빔 묶음이 정해진 뒤에야 알 수 있으므로 여기서 그리지 않는다.
function drawHeads(g, ev, x, top, clef, percMap) {
  const dur = ev.d || 4;
  const fill = ev.color || COLOR.paperInk;
  if (ev.p == null) { g.appendChild(restGlyph(x, top, dur)); return null; }

  const list = Array.isArray(ev.p) ? ev.p : [ev.p];
  const ys = [];
  list.forEach((p) => {
    let y, kind = ev.head || 'normal', up = true;
    if (clef === 'perc') {
      const m = percMap && percMap[p];
      if (!m) return;
      y = top + 4 * S.s - m.pos * (S.s / 2);
      kind = m.head || 'normal';
      up = m.up !== false;
    } else {
      const n = parseNote(p);
      if (!n) return;
      const step = noteStep(n);
      y = stepToY(clef, step, top);
      ledgers(clef, step, x, top, g);
      up = true;                        // 방향은 아래에서 화음 전체를 보고 한 번에 정한다
      if (n.alter) g.appendChild(text(x - S.noteR - 6, y, ALTER_SIGN[String(n.alter)], { 'font-size': S.s * 1.7, fill: fill }));
    }
    ys.push({ y: y, up: up });
    g.appendChild(head(x, y, dur, kind, fill));
    if (ev.dot) g.appendChild(circle(x + S.noteR + 4, y - S.s * 0.25, 1.9, fill));
  });
  if (!ys.length) return null;
  // 음표를 하나로 묶는 규칙: 화음은 기둥이 하나다.
  // 가운데 줄에서 가장 멀리 떨어진 음이 아래에 있으면 기둥은 위로, 위에 있으면 아래로.
  if (clef !== 'perc') {
    const mid = top + 2 * S.s;
    let far = ys[0].y;
    ys.forEach((v) => { if (Math.abs(v.y - mid) > Math.abs(far - mid)) far = v.y; });
    const up = far > mid;
    ys.forEach((v) => { v.up = up; });
  }
  if (dur <= 1) return null;
  return { x: x, dur: dur, fill: fill, ys: ys };
}

// 기둥 하나(위 또는 아래). tipY 를 주면 그 높이까지 뽑는다(빔에 맞추기).
function drawStem(g, st, up, tipY, withFlag) {
  const part = st.ys.filter((v) => v.up === up);
  if (!part.length) return null;
  const yTop = Math.min.apply(null, part.map((v) => v.y));
  const yBot = Math.max.apply(null, part.map((v) => v.y));
  const sx = up ? st.x + S.noteR - 0.8 : st.x - S.noteR + 0.8;
  const end = tipY != null ? tipY : (up ? yTop - S.stem : yBot + S.stem);
  g.appendChild(line(sx, up ? yBot : yTop, sx, end, st.fill, 1.7));
  if (withFlag) flags(sx, end, up ? 1 : -1, st.dur, g, st.fill);
  return { sx: sx, end: end };
}

// 이어진 8분·16분음표를 박 단위로 묶는다
function beamGroups(events) {
  const groups = [];
  let cur = [], pos = 0, curStart = 0;
  const flush = () => { if (cur.length > 1) groups.push(cur); cur = []; };
  events.forEach((e) => {
    const dur = e.ev.d || 4;
    const len = (4 / dur) * (e.ev.dot ? 1.5 : 1);
    const beamable = e.ev.p != null && dur >= 8 && !e.ev.dot;
    if (!beamable) { flush(); pos += len; return; }
    if (cur.length && Math.floor(pos / BEAM_UNIT) !== Math.floor(curStart / BEAM_UNIT)) flush();
    if (!cur.length) curStart = pos;
    cur.push(e);
    pos += len;
  });
  flush();
  return groups;
}

// 악보 전체
export function renderScore(spec) {
  const clef = spec.clef || 'treble';
  const measures = spec.measures || [];
  const top = spec.top == null ? 52 : spec.top;
  const showTime = spec.time !== false;

  // 가로 자리 먼저 계산
  let x = S.leftPad + (showTime ? 34 : 0);
  const placed = [];
  measures.forEach((m, mi) => {
    x += S.measurePad * 0.6;
    m.forEach((ev) => {
      const w = S.noteGap * (WIDTH_OF[ev.d || 4] || 1) * (ev.dot ? 1.25 : 1);
      placed.push({ ev, x: x + w / 2, mi });
      x += w;
    });
    x += S.measurePad * 0.6;
    placed.push({ bar: true, x: x, mi });
  });
  const W = Math.max(x + 16, 260);
  const H = top + 4 * S.s + (spec.bottom == null ? 62 : spec.bottom);

  const root = svgRoot(W, H, 'score');
  const g = sv('g');
  root.appendChild(rect(0, 0, W, H, COLOR.paper, { rx: 8 }));
  root.appendChild(g);

  staffLines(S.leftPad * 0.35, top, W - S.leftPad * 0.35 - 12, g);
  g.appendChild(clefOf(clef, S.leftPad * 0.35 + (clef === 'bass' ? 10 : 14), top));
  if (showTime) g.appendChild(timeSig(S.leftPad + 8, top, spec.time || [4, 4]));

  // 1) 머리를 먼저 그리고 기둥 정보를 모은다
  const stems = new Map();
  placed.forEach((p) => {
    if (p.bar) {
      g.appendChild(line(p.x, top, p.x, top + 4 * S.s, COLOR.paperInk, p.mi === measures.length - 1 ? 2.6 : 1));
      return;
    }
    const st = drawHeads(g, p.ev, p.x, top, clef, spec.percMap);
    if (st) stems.set(p, st);
    if (p.ev.text) g.appendChild(text(p.x, top + 4 * S.s + 34, p.ev.text, { 'font-size': 12, fill: '#444' }));
    if (p.ev.label) g.appendChild(text(p.x, top - 24, p.ev.label, { 'font-size': 11, fill: '#666' }));
  });

  // 2) 빔으로 묶일 것들을 먼저 처리한다. 방향마다 따로 센다 —
  //    드럼은 한 이벤트에서 손(위)만 빔으로 묶이고 발(아래)은 홀로 남는 일이 흔하다.
  const beamedUp = new Set(), beamedDown = new Set();
  measures.forEach((m, mi) => {
    const evs = placed.filter((p) => !p.bar && p.mi === mi);
    beamGroups(evs).forEach((grp) => {
      const sts = grp.map((p) => stems.get(p)).filter(Boolean);
      if (sts.length < 2) return;
      // 묶음 안에서 위·아래 기둥을 각각 빔으로 잇는다(드럼은 손이 위, 발이 아래)
      [true, false].forEach((up) => {
        const part = sts.filter((st) => st.ys.some((v) => v.up === up));
        if (part.length < 2) return;
        const extremes = part.map((st) => {
          const ys = st.ys.filter((v) => v.up === up).map((v) => v.y);
          return up ? Math.min.apply(null, ys) : Math.max.apply(null, ys);
        });
        const tip = up ? Math.min.apply(null, extremes) - S.stem : Math.max.apply(null, extremes) + S.stem;
        const tips = part.map((st) => drawStem(g, st, up, tip, false)).filter(Boolean);
        part.forEach((st) => (up ? beamedUp : beamedDown).add(st));
        const x1 = tips[0].sx, x2 = tips[tips.length - 1].sx;
        const th = S.s * 0.46;
        g.appendChild(rect(x1, up ? tip : tip - th, x2 - x1, th, part[0].fill));
        if (part.every((st) => st.dur >= 16)) {
          const off = up ? th + S.s * 0.3 : -(th + S.s * 0.3);
          g.appendChild(rect(x1, (up ? tip : tip - th) + off, x2 - x1, th, part[0].fill));
        }
      });
    });
  });

  // 3) 빔에 안 들어간 것들은 기둥 + 꼬리
  placed.forEach((p) => {
    const st = stems.get(p);
    if (!st) return;
    [true, false].forEach((up) => {
      if ((up ? beamedUp : beamedDown).has(st)) return;
      drawStem(g, st, up, null, true);
    });
  });

  if (spec.title) root.appendChild(text(14, 18, spec.title, { 'text-anchor': 'start', 'font-size': 12, fill: '#555' }));
  return root;
}

// 코드 한 개를 큰보표(오른손 위 · 왼손 아래)에 세로로 쌓아 그린다. 도수 이름을 옆에 붙인다.
export function renderGrandChord(voicing, opts) {
  const o = opts || {};
  const s = S.s;
  const topT = 46, topB = topT + 4 * s + 44;          // 두 보표 사이 간격
  const W = o.width || 320, H = topB + 4 * s + 34;
  const root = svgRoot(W, H, 'score');
  const g = sv('g');
  root.appendChild(rect(0, 0, W, H, COLOR.paper, { rx: 8 }));
  root.appendChild(g);

  const x0 = S.leftPad * 0.35;
  const w = W - x0 - 14;
  staffLines(x0, topT, w, g);
  staffLines(x0, topB, w, g);
  g.appendChild(trebleClef(x0 + 14, topT));
  g.appendChild(bassClef(x0 + 10, topB));
  // 큰보표 묶음
  g.appendChild(line(x0, topT, x0, topB + 4 * s, COLOR.paperInk, 2.4));
  g.appendChild(line(x0 + w, topT, x0 + w, topB + 4 * s, COLOR.paperInk, 2.4));

  const noteX = x0 + 108;
  const draw = (items, clef, top) => {
    items.forEach((it) => {
      const step = noteStep(it.note);
      const y = stepToY(clef, step, top);
      ledgers(clef, step, noteX, top, g);
      const col = DEG_COLOR[it.tone ? it.tone.role : 'R'] || COLOR.paperInk;
      if (it.note.alter) g.appendChild(text(noteX - S.noteR - 7, y, ALTER_SIGN[String(it.note.alter)], { 'font-size': s * 1.7, fill: col }));
      g.appendChild(head(noteX, y, 2, 'normal', col));
      g.appendChild(text(noteX + 30, y, it.tone ? it.tone.short : '', { 'font-size': 11, fill: col, 'font-weight': 700 }));
    });
  };
  draw(voicing.right, 'treble', topT);
  draw(voicing.left, 'bass', topB);

  g.appendChild(text(x0 + 8, topT - 26, '오른손', { 'text-anchor': 'start', 'font-size': 11, fill: '#777' }));
  g.appendChild(text(x0 + 8, topB - 12, '왼손', { 'text-anchor': 'start', 'font-size': 11, fill: '#777' }));
  return root;
}

// 한 보표만 쓰는 코드 그림(기타 · 베이스용). 낮은 음부터 쌓는다.
export function renderChordStaff(items, clef, opts) {
  const o = opts || {};
  const s = S.s, top = 52;
  const W = o.width || 240, H = top + 4 * s + 52;
  const root = svgRoot(W, H, 'score');
  const g = sv('g');
  root.appendChild(rect(0, 0, W, H, COLOR.paper, { rx: 8 }));
  root.appendChild(g);
  const x0 = S.leftPad * 0.35;
  staffLines(x0, top, W - x0 - 14, g);
  g.appendChild(clefOf(clef, x0 + (clef === 'bass' ? 10 : 14), top));

  const noteX = x0 + 96;
  items.forEach((it) => {
    const step = noteStep(it.note);
    const y = stepToY(clef, step, top);
    ledgers(clef, step, noteX, top, g);
    const col = DEG_COLOR[it.tone ? it.tone.role : 'R'] || COLOR.paperInk;
    if (it.note.alter) g.appendChild(text(noteX - S.noteR - 7, y, ALTER_SIGN[String(it.note.alter)], { 'font-size': s * 1.7, fill: col }));
    g.appendChild(head(noteX, y, 2, 'normal', col));
    g.appendChild(text(noteX + 28, y, it.tone ? it.tone.short : '', { 'font-size': 11, fill: col, 'font-weight': 700 }));
  });
  if (o.note) root.appendChild(text(12, H - 12, o.note, { 'text-anchor': 'start', 'font-size': 11, fill: '#777' }));
  return root;
}

// 기타 악보는 실제 소리보다 한 옥타브 높게 적는다는 표시(8vb)
export function octaveHint() {
  return '기타 악보는 실제 소리보다 한 옥타브 높게 적는다 (8vb)';
}
