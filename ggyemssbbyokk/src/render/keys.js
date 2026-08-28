// 건반 그림. 어느 건반을 누르는지, 그게 왼손인지 오른손인지, 몇 도인지까지 한 장에 담는다.

import { KEY_METRIC, COLOR, DEG_COLOR } from './../config.js';
import { sv, svgRoot, rect, text, line } from './../util/svg.js';
import { midiToNote, noteName } from './../theory/notes.js';

const K = KEY_METRIC;
const WHITE_PC = [0, 2, 4, 5, 7, 9, 11];
const isWhite = (midi) => WHITE_PC.indexOf(((midi % 12) + 12) % 12) >= 0;

// low 부터 midi 까지 흰 건반이 몇 개인가
function whiteIndex(low, midi) {
  let k = 0;
  for (let m = low; m < midi; m++) if (isWhite(m)) k++;
  return k;
}

// press: Map(midi -> {tone, hand})
export function renderKeyboard(press, opts) {
  const o = opts || {};
  const low = o.low == null ? K.lowMidi : o.low;
  const octaves = o.octaves == null ? K.octaves : o.octaves;
  const high = low + octaves * 12;
  let whites = 0;
  for (let m = low; m <= high; m++) if (isWhite(m)) whites++;

  const padL = 10, padT = 22;
  const W = padL * 2 + whites * K.whiteW;
  const H = padT + K.whiteH + 30;
  const root = svgRoot(W, H, 'keyboard');
  const g = sv('g');
  root.appendChild(rect(0, 0, W, H, COLOR.panel2, { rx: 10 }));
  root.appendChild(g);

  const xWhite = (midi) => padL + whiteIndex(low, midi) * K.whiteW;

  // 흰 건반 먼저
  for (let m = low; m <= high; m++) {
    if (!isWhite(m)) continue;
    const x = xWhite(m);
    const hit = press && press.get(m);
    const col = hit ? DEG_COLOR[hit.tone ? hit.tone.role : 'R'] : '#f3f1ec';
    g.appendChild(rect(x, padT, K.whiteW - 1.5, K.whiteH, hit ? col : '#f3f1ec',
      { rx: 3, stroke: '#0d0f14', 'stroke-width': 1 }));
    if (((m % 12) + 12) % 12 === 0) {
      g.appendChild(text(x + K.whiteW / 2, padT + K.whiteH + 12, noteName(midiToNote(m), true),
        { 'font-size': 9, fill: COLOR.dim }));
    }
    if (hit) {
      g.appendChild(text(x + K.whiteW / 2, padT + K.whiteH - 16, hit.tone ? hit.tone.short : '',
        { 'font-size': 10, fill: '#fff', 'font-weight': 700 }));
      if (hit.finger) g.appendChild(text(x + K.whiteW / 2, padT + K.whiteH - 32, hit.finger,
        { 'font-size': 9, fill: 'rgba(255,255,255,.75)' }));
      g.appendChild(text(x + K.whiteW / 2, padT - 10, hit.hand === 'L' ? '왼' : '오',
        { 'font-size': 10, fill: hit.hand === 'L' ? COLOR.warn : COLOR.ok, 'font-weight': 700 }));
    }
  }

  // 검은 건반은 위에 얹는다
  for (let m = low; m <= high; m++) {
    if (isWhite(m)) continue;
    const x = xWhite(m) - K.blackW / 2;
    const hit = press && press.get(m);
    const col = hit ? DEG_COLOR[hit.tone ? hit.tone.role : 'R'] : '#15181f';
    g.appendChild(rect(x, padT, K.blackW, K.blackH, col, { rx: 2, stroke: '#0d0f14', 'stroke-width': 1 }));
    if (hit) {
      g.appendChild(text(x + K.blackW / 2, padT + K.blackH - 12, hit.tone ? hit.tone.short : '',
        { 'font-size': 9, fill: '#fff', 'font-weight': 700 }));
      if (hit.finger) g.appendChild(text(x + K.blackW / 2, padT + K.blackH - 26, hit.finger,
        { 'font-size': 8.5, fill: 'rgba(255,255,255,.75)' }));
      g.appendChild(text(x + K.blackW / 2, padT - 10, hit.hand === 'L' ? '왼' : '오',
        { 'font-size': 10, fill: hit.hand === 'L' ? COLOR.warn : COLOR.ok, 'font-weight': 700 }));
    }
  }

  // 가온다 표시
  if (low <= 60 && 60 <= high) {
    const x = xWhite(60);
    g.appendChild(line(x, padT + K.whiteH + 18, x + K.whiteW - 1.5, padT + K.whiteH + 18, COLOR.accent, 2));
  }
  return root;
}
