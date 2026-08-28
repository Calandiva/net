// 지판 위에서 운지를 찾는다. 그림은 render/fret.js 가 그리고, 여기는 "어디를 짚는가" 만 계산한다.

import { TUNINGS, FRET_METRIC } from './../config.js';
import { degShort } from './intervals.js';
import { notePc } from './notes.js';

const SEARCH = {
  maxFret: 14,        // 이 위로는 찾지 않는다(초보가 쓸 자리가 아니다)
  span: 4,            // 한 손이 덮는 프렛 수
  maxFingers: 4,
  maxCombos: 40000,   // 한 자리에서 살펴볼 조합 수 상한
  keep: 3,            // 돌려줄 운지 개수
};

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

// 짚는 데 손가락이 몇 개 드는가.
// 한 프렛에 연달아 붙은 줄들은 한 손가락으로 눌러(바레) 하나로 친다.
// 바레가 되려면 그 구간의 모든 줄이 그 프렛 이상이어야 한다 — 사이에 개방현이나 뮤트가
// 있으면 바레가 그 줄까지 눌러 버리므로 바레가 아니다.
function fingering(frets) {
  const fretted = [];
  frets.forEach((f, i) => { if (f > 0) fretted.push(i); });
  if (!fretted.length) return { fingers: 0, barre: null };

  let best = { fingers: fretted.length, barre: null };
  const levels = Array.from(new Set(fretted.map((i) => frets[i])));
  levels.forEach((lv) => {
    for (let lo = 0; lo < frets.length; lo++) {
      if (frets[lo] !== lv) continue;
      for (let hi = lo + 1; hi < frets.length; hi++) {
        if (frets[hi] !== lv) continue;
        let ok = true;
        for (let s = lo; s <= hi; s++) if (frets[s] < lv) ok = false;
        if (!ok) continue;
        let cost = 1;                                  // 바레 손가락 하나
        fretted.forEach((i) => {
          if (i >= lo && i <= hi && frets[i] === lv) return;   // 바레가 덮는다
          cost += 1;
        });
        if (cost < best.fingers) best = { fingers: cost, barre: { fret: lv, from: lo, to: hi } };
      }
    }
  });
  return best;
}

// 코드 계획(남긴 음들)을 그 악기 지판 위 운지로.
export function findShapes(tuningKey, plan, bassPc) {
  const tuning = TUNINGS[tuningKey];
  if (!tuning) return [];
  const open = tuning.strings;
  const N = open.length;
  const want = plan.kept.map((t) => notePc(t.note));
  const pcSet = new Set(want);
  const need = pcSet.size;
  const rootPc = bassPc == null ? notePc(plan.chord.root) : bassPc;
  const minStrings = need;
  const maxStrings = Math.min(N, need + 2);

  const found = [];
  const seen = new Set();

  for (let w = 0; w <= SEARCH.maxFret - SEARCH.span + 1; w++) {
    const cands = open.map((o) => candidates(o, pcSet, w, w + SEARCH.span - 1));
    let budget = SEARCH.maxCombos;
    const frets = new Array(N).fill(-1);

    const check = (f) => {
      const sounding = [];
      for (let i = 0; i < N; i++) if (f[i] >= 0) sounding.push(i);
      if (sounding.length < minStrings || sounding.length > maxStrings) return;
      // 필요한 음이 하나도 빠지면 안 된다
      const got = new Set(sounding.map((i) => pcOf(open[i] + f[i])));
      if (got.size !== need) return;
      // 제일 낮게 울리는 음은 루트(분수코드면 지정된 베이스)
      if (pcOf(open[sounding[0]] + f[sounding[0]]) !== rootPc) return;
      const fg = fingering(f);
      if (fg.fingers > SEARCH.maxFingers) return;

      const key = f.join(',');
      if (seen.has(key)) return;
      seen.add(key);

      // 사이에 낀 뮤트 — 줄을 건너뛰어야 해서 어렵다
      let gaps = 0, innerOpen = 0;
      for (let i = sounding[0]; i <= sounding[sounding.length - 1]; i++) {
        if (f[i] < 0) gaps++;
        else if (f[i] === 0) innerOpen++;
      }
      const used = f.filter((x) => x > 0);
      const lowF = used.length ? Math.min.apply(null, used) : 0;
      const highF = used.length ? Math.max.apply(null, used) : 0;
      const opens = f.filter((x) => x === 0).length;

      // 낮은 자리 · 적은 손가락 · 안 건너뛰는 것을 좋아한다.
      // 개방현 덤은 낮은 자리에서만 준다 — 12프렛에서 개방현을 섞는 건 초보용이 아니다.
      const score =
        sounding.length * 3 +
        (lowF <= 4 ? opens * 1.5 : 0) -
        fg.fingers * 1.2 -
        gaps * 4 -
        (lowF >= 5 ? innerOpen * 1.6 : 0) -
        lowF * 0.9 -
        (highF - lowF) * 1.1 +
        (fg.barre ? -0.6 : 0);

      found.push({
        frets: f,
        fingers: fg.fingers,
        barre: fg.barre,
        lowFret: lowF,
        span: used.length ? highF - lowF + 1 : 1,
        score: score,
        tuningKey: tuningKey,
        tones: sounding.map((i) => {
          const midi = open[i] + f[i];
          return { string: i, fret: f[i], midi: midi, tone: toneOf(plan, midi) };
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
  // 같은 자리의 사소한 변형은 하나만 남긴다
  const out = [];
  for (const s2 of found) {
    const dup = out.some((o) => {
      if (Math.abs(o.lowFret - s2.lowFret) > 1) return false;
      let same = 0;
      for (let i = 0; i < s2.frets.length; i++) if (o.frets[i] === s2.frets[i]) same++;
      return same >= s2.frets.length - 1;
    });
    if (dup) continue;
    out.push(s2);
    if (out.length >= SEARCH.keep) break;
  }
  return out;
}

// midi 가 계획 안의 어느 도수인지
function toneOf(plan, midi) {
  const rootPc = notePc(plan.chord.root);
  const semi = ((midi - rootPc) % 12 + 12) % 12;
  const found = plan.tones.find((t) => ((notePc(t.note) - rootPc) % 12 + 12) % 12 === semi);
  return found || null;
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
