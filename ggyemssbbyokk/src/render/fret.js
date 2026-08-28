// 지판 그림. 코드 다이어그램(세로)과 지판 전체 지도(가로) 두 가지.

import { FRET_METRIC, COLOR, DEG_COLOR, TUNINGS } from './../config.js';
import { sv, svgRoot, line, rect, circle, text } from './../util/svg.js';
import { noteName, midiToNote } from './../theory/notes.js';

const F = FRET_METRIC;
const INLAY = [3, 5, 7, 9, 15, 17, 19, 21];

// 점 안에 무엇을 적을지. 도수 · 손가락 번호 · 음이름 중 고른다.
export const LABEL_MODES = [
  { id: 'deg', label: '도수', hint: '이 음이 코드에서 몇 도인지. 다른 코드로 옮길 때 쓸모 있다.' },
  { id: 'finger', label: '손가락', hint: '검지1 중지2 약지3 새끼4. 처음 잡을 때는 이쪽.' },
  { id: 'note', label: '음이름', hint: '실제로 나는 음.' },
];

function labelOf(t, mode) {
  if (mode === 'finger') return t.finger ? String(t.finger) : '○';
  if (mode === 'note') return noteName(t.tone ? t.tone.note : midiToNote(t.midi));
  return t.tone ? t.tone.short : '';
}

// 코드 하나의 운지. shape 는 theory/fretboard.js 의 findShapes 결과.
export function renderChordBox(shape, opts) {
  const o = opts || {};
  const tuning = TUNINGS[shape.tuningKey];
  const n = shape.frets.length;
  const rows = F.windowFrets;
  const baseFret = shape.lowFret <= 1 ? 1 : shape.lowFret;   // 첫 칸에 해당하는 프렛 번호
  const boxW = (n - 1) * F.stringGap;
  const boxH = rows * F.fretGap;
  const padL = F.pad + 14, padT = 64;      // 위쪽은 ○✕ 와 도수 이름 자리
  const W = boxW + padL + F.pad + 10, H = boxH + padT + 34;

  const root = svgRoot(W, H, 'fretbox');
  const g = sv('g');
  root.appendChild(rect(0, 0, W, H, COLOR.panel2, { rx: 10 }));
  root.appendChild(g);

  const xOf = (i) => padL + i * F.stringGap;
  const yOf = (r) => padT + r * F.fretGap;

  // 프렛(가로줄)
  for (let r = 0; r <= rows; r++) {
    const nut = r === 0 && baseFret === 1;
    g.appendChild(line(xOf(0), yOf(r), xOf(n - 1), yOf(r), nut ? COLOR.ink : COLOR.line, nut ? 5 : 1.4));
  }
  // 줄(세로줄) — 낮은 줄이 왼쪽
  for (let i = 0; i < n; i++) g.appendChild(line(xOf(i), yOf(0), xOf(i), yOf(rows), COLOR.line, i === 0 ? 2 : 1.4));

  // 몇 번 프렛인지
  if (baseFret > 1) g.appendChild(text(padL - 20, yOf(0) + F.fretGap / 2, baseFret + 'fr', { 'font-size': 11, fill: COLOR.dim }));

  // 위쪽 ○ ✕
  shape.frets.forEach((f, i) => {
    const mark = f < 0 ? '✕' : f === 0 ? '○' : '';
    if (mark) g.appendChild(text(xOf(i), padT - 16, mark, { 'font-size': 13, fill: f < 0 ? COLOR.dim : COLOR.ok }));
  });

  // 바레
  if (shape.barre) {
    const r = shape.barre.fret - baseFret + 0.5;
    if (r >= 0 && r < rows) {
      g.appendChild(rect(xOf(shape.barre.from) - 8, yOf(r) - 8, (shape.barre.to - shape.barre.from) * F.stringGap + 16, 16,
        'rgba(228,87,46,.28)', { rx: 8, stroke: DEG_COLOR.R, 'stroke-width': 1 }));
    }
  }

  // 짚는 자리
  shape.tones.forEach((t) => {
    if (t.fret === 0) {
      const col = t.tone ? DEG_COLOR[t.tone.role] : COLOR.ok;
      g.appendChild(circle(xOf(t.string), padT - 16, 7, 'none', { stroke: col, 'stroke-width': 2 }));
      g.appendChild(text(xOf(t.string), padT - 34, o.labelMode === 'finger' ? '개방' : labelOf(t, o.labelMode),
        { 'font-size': 10, fill: col, 'font-weight': 700 }));
      return;
    }
    const r = t.fret - baseFret + 0.5;
    if (r < 0 || r > rows) return;
    const col = t.tone ? DEG_COLOR[t.tone.role] : COLOR.accent;
    g.appendChild(circle(xOf(t.string), yOf(r), F.dotR + 2, col));
    g.appendChild(text(xOf(t.string), yOf(r), labelOf(t, o.labelMode), { 'font-size': 9.5, fill: '#fff', 'font-weight': 700 }));
  });

  // 줄 이름
  tuning.names.forEach((nm, i) => {
    g.appendChild(text(xOf(i), yOf(rows) + 16, nm.slice(1), { 'font-size': 10, fill: COLOR.dim }));
  });

  if (o.caption) root.appendChild(text(W / 2, 14, o.caption, { 'font-size': 11, fill: COLOR.dim }));
  return root;
}

// 지판 전체 지도. 코드톤이 어디 있는지 한눈에 본다(베이스 · 루트 찾기용).
export function renderFretMap(map, opts) {
  const o = opts || {};
  const rowsN = map.rows.length;
  const cols = map.max;
  const padL = 62, padT = 30;             // 줄 이름 + 개방현 점 자리
  const cellW = o.cellW || 34, cellH = F.stringGap + 6;
  const W = padL + (cols + 1) * cellW + 16;
  const H = padT + (rowsN - 1) * cellH + 46;

  const root = svgRoot(W, H, 'fretmap');
  const g = sv('g');
  root.appendChild(rect(0, 0, W, H, COLOR.panel2, { rx: 10 }));
  root.appendChild(g);

  const xOf = (f) => padL + f * cellW + cellW * 0.5;
  // 낮은 줄이 아래로 가도록 뒤집어 그린다(연주자가 보는 방향)
  const yOf = (i) => padT + (rowsN - 1 - i) * cellH;

  for (let i = 0; i < rowsN; i++) {
    g.appendChild(line(padL, yOf(i), padL + (cols + 1) * cellW, yOf(i), COLOR.line, 1.2));
    g.appendChild(text(padL - 40, yOf(i), map.tuning.names[i], { 'font-size': 10, fill: COLOR.dim }));
  }
  for (let f = 0; f <= cols; f++) {
    const x = padL + f * cellW;
    g.appendChild(line(x, yOf(rowsN - 1), x, yOf(0), COLOR.line, f === 1 ? 3.5 : 1));
    if (INLAY.indexOf(f) >= 0 || f === 12) {
      g.appendChild(text(xOf(f), yOf(0) + 16, f, { 'font-size': 10, fill: f === 12 ? COLOR.warn : COLOR.dim }));
    }
  }

  map.rows.forEach((row, i) => {
    row.forEach((cell) => {
      if (!cell) return;
      const keep = cell.tone.keep;
      const col = keep ? DEG_COLOR[cell.tone.role] : DEG_COLOR.X;
      g.appendChild(circle(cell.fret === 0 ? padL - 16 : xOf(cell.fret), yOf(i), keep ? 8.5 : 6.5,
        keep ? col : 'none', keep ? null : { stroke: col, 'stroke-width': 1.4, 'stroke-dasharray': '2 2' }));
      g.appendChild(text(cell.fret === 0 ? padL - 16 : xOf(cell.fret), yOf(i), cell.label,
        { 'font-size': 9, fill: keep ? '#fff' : col, 'font-weight': 700 }));
    });
  });

  if (o.caption) root.appendChild(text(W / 2, 14, o.caption, { 'font-size': 11, fill: COLOR.dim }));
  return root;
}

// 한 음만 짚는 그림(베이스). positions 중 앞의 몇 개만 찍는다.
export function renderSingleNote(tuningKey, positions, label, opts) {
  const o = opts || {};
  const tuning = TUNINGS[tuningKey];
  const rowsN = tuning.strings.length;
  const cols = o.frets || 12;
  const padL = 62, padT = 30, cellW = 34, cellH = F.stringGap + 6;
  const W = padL + (cols + 1) * cellW + 16, H = padT + (rowsN - 1) * cellH + 46;
  const root = svgRoot(W, H, 'fretmap');
  const g = sv('g');
  root.appendChild(rect(0, 0, W, H, COLOR.panel2, { rx: 10 }));
  root.appendChild(g);
  const xOf = (f) => padL + f * cellW + cellW * 0.5;
  const yOf = (i) => padT + (rowsN - 1 - i) * cellH;
  for (let i = 0; i < rowsN; i++) {
    g.appendChild(line(padL, yOf(i), padL + (cols + 1) * cellW, yOf(i), COLOR.line, 1.2));
    g.appendChild(text(padL - 40, yOf(i), tuning.names[i], { 'font-size': 10, fill: COLOR.dim }));
  }
  for (let f = 0; f <= cols; f++) {
    const x = padL + f * cellW;
    g.appendChild(line(x, yOf(rowsN - 1), x, yOf(0), COLOR.line, f === 1 ? 3.5 : 1));
    if (INLAY.indexOf(f) >= 0 || f === 12) g.appendChild(text(xOf(f), yOf(0) + 16, f, { 'font-size': 10, fill: COLOR.dim }));
  }
  positions.forEach((p, k) => {
    const first = k === 0;
    g.appendChild(circle(p.fret === 0 ? padL - 16 : xOf(p.fret), yOf(p.string), first ? 9.5 : 7.5,
      first ? DEG_COLOR.R : 'none', first ? null : { stroke: DEG_COLOR.R, 'stroke-width': 1.4 }));
    g.appendChild(text(p.fret === 0 ? padL - 16 : xOf(p.fret), yOf(p.string), label,
      { 'font-size': 9, fill: first ? '#fff' : DEG_COLOR.R, 'font-weight': 700 }));
  });
  if (o.caption) root.appendChild(text(W / 2, 14, o.caption, { 'font-size': 11, fill: COLOR.dim }));
  return root;
}

