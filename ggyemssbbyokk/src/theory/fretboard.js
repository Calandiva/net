// 지판 위에서 운지를 찾는다. 그림은 render/fret.js 가 그리고, 여기는 "어디를 짚는가" 만 계산한다.
//
// 코드 하나에 운지는 하나가 아니다. 자리(프렛)마다 다르고, 몇 줄을 쓰느냐에 따라 다르고,
// 베이스에 어느 음을 두느냐(전위)에 따라 다르다. 그래서 조건을 받아 여러 벌을 돌려준다.

import { TUNINGS, FRET_METRIC } from './../config.js';
import { degShort } from './intervals.js';
import { notePc } from './notes.js';

const SEARCH = {
  maxFret: 15,        // 이 위로는 찾지 않는다
  span: 4,            // 한 손이 덮는 프렛 수
  maxFingers: 4,
  maxCombos: 60000,   // 한 자리에서 살펴볼 조합 수 상한
};

// 운지 모양. 화면의 고르개가 이 목록을 그대로 쓴다.
export const SHAPE_STYLES = [
  { id: 'all',   label: '전부',   hint: '조건 없이 점수순으로.' },
  { id: 'open',  label: '개방',   hint: '개방현이 섞인 낮은 자리. 초보가 먼저 잡는 모양.' },
  { id: 'barre', label: '바레',   hint: '검지로 세 줄 이상 눌러 통째로 옮길 수 있는 모양.' },
  { id: 'triad', label: '트라이어드', hint: '붙어 있는 세 줄만. 반주가 가벼워진다.' },
  { id: 'top',   label: '윗줄',   hint: '가는 줄 쪽만 쓴다. 베이스와 안 겹친다.' },
];

const pcOf = (midi) => ((midi % 12) + 12) % 12;

// 줄마다 이 자리에서 짚을 수 있는 후보(뮤트 포함)
function candidates(open, pcSet, from, to) {
  const out = [{ fret: -1 }];                       // 뮤트
  if (pcSet.has(pcOf(open))) out.push({ fret: 0 }); // 개방현
  for (let f = Math.max(1, from); f <= to; f++) {
    if (pcSet.has(pcOf(open + f))) out.push({ fret: f });
  }
  return out;
}

// 짚는 데 손가락이 몇 개 드는가, 그리고 어느 손가락인가. 못 잡는 모양이면 null.
//
// 손가락은 1<2<3<4 순으로 프렛이 커지는 쪽에 놓인다. 이 순서를 어기면 손이 꼬인다.
// 그래서 "이론상 음은 맞지만 사람 손으로는 못 잡는" 모양을 여기서 걸러 낸다.
//
// 걸러 내는 두 가지:
//  1) 바레보다 얇은 줄에 바레보다 낮은 프렛이 있으면 안 된다.
//     — 바레 손가락 뒤로 다른 손가락이 돌아 들어갈 수 없다. (x02210 을 "바레 2손가락" 으로
//        치지 않는 이유가 이것이다)
//  2) 같은 프렛을 다른 손가락 둘로 짚어야 하는데, 그 사이 줄에 더 높은 프렛이 있으면 안 된다.
//     — 사이를 넘어 손가락이 건너뛸 수 없다. 반대로 사이가 더 낮은 프렛이면 괜찮다
//        (320003 의 3프렛 두 개 사이에 2프렛이 있는 것은 실제로 다들 잡는 모양이다)
function fingering(frets) {
  const fretted = [];
  frets.forEach((f, i) => { if (f > 0) fretted.push(i); });
  if (!fretted.length) return { fingers: 0, barre: null, hand: frets.map(() => 0) };

  const barreOk = (lv, lo, hi) => {
    for (let s = lo; s <= hi; s++) if (frets[s] < lv) return false;      // 사이에 개방현·뮤트
    for (let s = hi + 1; s < frets.length; s++) if (frets[s] > 0 && frets[s] < lv) return false;
    return true;
  };

  let best = null;
  const tryOne = (barre) => {
    if (!playable(frets, barre)) return;
    let cost = barre ? 1 : 0;
    fretted.forEach((i) => {
      if (barre && i >= barre.from && i <= barre.to && frets[i] === barre.fret) return;
      cost += 1;
    });
    if (!best || cost < best.fingers) best = { fingers: cost, barre };
  };

  tryOne(null);
  Array.from(new Set(fretted.map((i) => frets[i]))).forEach((lv) => {
    for (let lo = 0; lo < frets.length; lo++) {
      if (frets[lo] !== lv) continue;
      for (let hi = lo + 1; hi < frets.length; hi++) {
        if (frets[hi] !== lv) continue;
        if (barreOk(lv, lo, hi)) tryOne({ fret: lv, from: lo, to: hi });
      }
    }
  });
  if (!best) return null;

  // 손가락 번호를 매긴다. 바레는 1번, 나머지는 낮은 프렛부터 차례로.
  const hand = frets.map(() => 0);
  const barre = best.barre;
  const rest = fretted.filter((i) => !(barre && i >= barre.from && i <= barre.to && frets[i] === barre.fret));
  rest.sort((a, b) => frets[a] - frets[b] || b - a);
  let next = barre ? 2 : 1;
  rest.forEach((i) => { hand[i] = Math.min(4, next); next += 1; });
  if (barre) for (let s = barre.from; s <= barre.to; s++) if (frets[s] === barre.fret) hand[s] = 1;
  return { fingers: best.fingers, barre, hand };
}

// 같은 프렛을 여러 손가락(또는 바레)으로 나눠 짚어야 하는데 그 사이 줄에 더 높은 프렛이
// 끼어 있으면 못 잡는다 — 손가락이 다른 손가락을 넘어갈 수 없기 때문이다.
// 사이가 더 낮은 프렛이면 괜찮다(320003 의 3프렛 두 개 사이에 2프렛이 있는 것처럼).
function playable(frets, barre) {
  const levels = new Map();
  const put = (lv, lo, hi) => {
    if (!levels.has(lv)) levels.set(lv, []);
    levels.get(lv).push({ lo, hi });
  };
  frets.forEach((f, i) => {
    if (f <= 0) return;
    if (barre && i >= barre.from && i <= barre.to && f === barre.fret) return;
    put(f, i, i);
  });
  if (barre) put(barre.fret, barre.from, barre.to);          // 바레도 한 덩어리로 센다

  let okAll = true;
  levels.forEach((units, lv) => {
    units.sort((a2, b2) => a2.lo - b2.lo);
    for (let k = 1; k < units.length; k++) {
      for (let s = units[k - 1].hi + 1; s < units[k].lo; s++) if (frets[s] > lv) okAll = false;
    }
  });
  return okAll;
}

// midi 가 계획 안의 어느 도수인지
function toneOf(plan, midi) {
  const rootPc = notePc(plan.chord.root);
  const semi = ((midi - rootPc) % 12 + 12) % 12;
  return plan.tones.find((t) => ((notePc(t.note) - rootPc) % 12 + 12) % 12 === semi) || null;
}

// 코드 계획(남긴 음들)을 그 악기 지판 위 운지로.
// opts = { bassPc, style, fromFret, toFret, allowInversion, limit }
export function findShapes(tuningKey, plan, opts) {
  const o = opts || {};
  const tuning = TUNINGS[tuningKey];
  if (!tuning) return [];
  const open = tuning.strings;
  const N = open.length;
  const pcSet = new Set(plan.kept.map((t) => notePc(t.note)));
  const need = pcSet.size;
  const bassPc = o.bassPc == null ? notePc(plan.chord.root) : o.bassPc;
  const style = o.style || 'all';
  const from = o.fromFret == null ? 0 : o.fromFret;
  const to = o.toFret == null ? SEARCH.maxFret : o.toFret;
  const limit = o.limit || 6;

  // 3화음 이상은 줄을 겹쳐 눌러도 된다(옥타브 겹침). 그래야 133211 같은 6줄 바레가 나온다.
  let minStrings = need, maxStrings = need <= 2 ? Math.min(N, need + 1) : N;
  if (style === 'triad') { minStrings = Math.min(3, need); maxStrings = 3; }
  if (style === 'top') maxStrings = Math.min(maxStrings, 4);

  const found = [];
  const seen = new Set();

  const lastWindow = Math.max(from, to - SEARCH.span + 1);
  for (let w = from; w <= lastWindow; w++) {
    const cands = open.map((s) => candidates(s, pcSet, w, Math.min(w + SEARCH.span - 1, to)));
    let budget = SEARCH.maxCombos;
    const frets = new Array(N).fill(-1);

    const check = (f) => {
      const sounding = [];
      for (let i = 0; i < N; i++) if (f[i] >= 0) sounding.push(i);
      if (sounding.length < minStrings || sounding.length > maxStrings) return;
      const got = new Set(sounding.map((i) => pcOf(open[i] + f[i])));
      if (got.size !== need) return;                          // 필요한 음이 하나도 빠지면 안 된다

      // 제일 "낮게 울리는" 음을 찾는다. 줄 순서가 아니라 실제 음높이로 봐야 한다 —
      // 우쿨렐레 하이G 조율은 4번 줄이 제일 높다.
      let bassIdx = sounding[0];
      sounding.forEach((i) => { if (open[i] + f[i] < open[bassIdx] + f[bassIdx]) bassIdx = i; });
      const lowPc = pcOf(open[bassIdx] + f[bassIdx]);
      if (!o.allowInversion && !tuning.reentrant && lowPc !== bassPc) return;

      const fg = fingering(f);
      if (!fg || fg.fingers > SEARCH.maxFingers) return;

      let gaps = 0, innerOpen = 0;
      for (let i = sounding[0]; i <= sounding[sounding.length - 1]; i++) {
        if (f[i] < 0) gaps++;
        else if (f[i] === 0) innerOpen++;
      }
      const used = f.filter((v) => v > 0);
      const lowF = used.length ? Math.min.apply(null, used) : 0;
      const highF = used.length ? Math.max.apply(null, used) : 0;
      const opens = f.filter((v) => v === 0).length;

      // 모양별 조건
      if (style === 'open' && !(opens > 0 && lowF <= 4)) return;
      if (style === 'barre' && !(fg.barre && fg.barre.to - fg.barre.from >= 2)) return;
      if (style === 'triad' && gaps > 0) return;
      if (style === 'top' && sounding[0] < N - 4) return;

      const key = f.join(',');
      if (seen.has(key)) return;
      seen.add(key);

      // 낮은 자리 · 적은 손가락 · 안 건너뛰는 것을 좋아한다.
      // 개방현 덤은 낮은 자리에서만 준다 — 12프렛에서 개방현을 섞는 건 초보용이 아니다.
      const score =
        sounding.length * 3 +
        (lowF <= 4 ? opens * 1.5 : 0) -
        fg.fingers * 1.2 -
        gaps * 4 -
        (lowF >= 5 ? innerOpen * 1.6 : 0) -
        (lowF + highF) * 0.52 -          // 손이 놓이는 자리 전체가 낮을수록 좋다

        (highF - lowF) * 1.1 +
        (fg.barre ? -0.6 : 0) -
        (N - sounding.length) * (N <= 4 ? 1.6 : 0.9) +     // 안 쓰는 줄은 아깝다(줄이 적은 악기일수록 더)
        (!tuning.reentrant && lowPc === bassPc ? 2.5 : 0);

      found.push({
        frets: f, fingers: fg.fingers, barre: fg.barre, hand: fg.hand,
        lowFret: lowF, span: used.length ? highF - lowF + 1 : 1,
        score, tuningKey,
        bassTone: toneOf(plan, open[bassIdx] + f[bassIdx]),
        strings: sounding.length,
        tones: sounding.map((i) => {
          const midi = open[i] + f[i];
          return { string: i, fret: f[i], midi, finger: fg.hand[i], tone: toneOf(plan, midi) };
        }),
      });
    };

    const walk = (i) => {
      if (budget-- <= 0) return;
      if (i === N) { check(frets.slice()); return; }
      for (const c of cands[i]) { frets[i] = c.fret; walk(i + 1); }
      frets[i] = -1;
    };
    walk(0);
  }

  found.sort((a, b) => b.score - a.score);

  // 비슷한 것만 잔뜩 나오면 소용이 없다. 자리와 베이스음이 겹치지 않게 골라 낸다.
  const out = [];
  for (const s of found) {
    const dup = out.some((p) => {
      if (p.bassTone !== s.bassTone) return false;
      if (Math.abs(p.lowFret - s.lowFret) > 1) return false;
      let same = 0;
      for (let i = 0; i < s.frets.length; i++) if (p.frets[i] === s.frets[i]) same++;
      return same >= s.frets.length - 1;
    });
    if (dup) continue;
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

// 지판 전체에서 코드톤이 어디 있는지. 베이스와 "루트 찾기" 화면이 쓴다.
export function fretMap(tuningKey, plan, frets) {
  const tuning = TUNINGS[tuningKey];
  const max = frets == null ? FRET_METRIC.mapFrets : frets;
  const rootPc = notePc(plan.chord.root);
  const rows = [];
  for (let i = 0; i < tuning.strings.length; i++) {
    const row = [];
    for (let f = 0; f <= max; f++) {
      const midi = tuning.strings[i] + f;
      const semi = ((midi - rootPc) % 12 + 12) % 12;
      const tone = plan.tones.find((t) => ((notePc(t.note) - rootPc) % 12 + 12) % 12 === semi) || null;
      row.push(tone ? { fret: f, midi, tone, label: degShort(tone.deg) } : null);
    }
    rows.push(row);
  }
  return { tuning, rows, max };
}

// 한 음만 짚을 자리들(베이스). 낮은 자리부터.
export function notePositions(tuningKey, pc, maxFret) {
  const tuning = TUNINGS[tuningKey];
  const out = [];
  const max = maxFret == null ? 12 : maxFret;
  tuning.strings.forEach((open, i) => {
    for (let f = 0; f <= max; f++) if (pcOf(open + f) === pc) out.push({ string: i, fret: f, midi: open + f });
  });
  out.sort((a, b) => a.midi - b.midi);
  return out;
}
