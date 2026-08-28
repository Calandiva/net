// "몇 개만 잡을 것인가" 를 정하는 곳.
// 코드에 든 음을 중요한 순서로 줄 세우고, 앞에서 n 개만 남긴다. 나머지는 생략된 음으로 표시한다.

import { keepRank, degRole, degToNote, degShort } from './intervals.js';
import { notePc, midiToNote, noteName, noteMidi } from './notes.js';

// 텐션끼리는 코드 이름에 적힌 것(가장 높은 것 · 변형된 것)이 먼저 남는다.
// 13 코드는 9 를 빼고 13 을 남기는 쪽이 실제로 치는 방식이다.
function rankAll(degs) {
  const tension = degs.filter((t) => t.num >= 9);
  tension.sort((a, b) => (b.alter !== 0) - (a.alter !== 0) || b.num - a.num);
  const tensionRank = new Map();
  tension.forEach((t, i) => tensionRank.set(t, 4 + i));
  return degs.map((t) => ({ deg: t, rank: tensionRank.has(t) ? tensionRank.get(t) : keepRank(t) }));
}

// 왜 뺄 수 있는지 / 왜 못 빼는지 한 줄.
function omitNote(deg) {
  if (deg.num === 5 && !deg.alter) return '소리에 거의 영향이 없다. 제일 먼저 뺀다.';
  if (deg.num === 1) return '밴드에서는 베이스가 루트를 치므로 빼도 된다.';
  if (deg.num === 3 || deg.num === 4 || deg.num === 2) return '빼면 코드가 밝은지 어두운지 알 수 없어진다.';
  if (deg.num === 7 || deg.num === 6) return '빼면 그냥 3화음이 된다.';
  if (deg.num === 5 && deg.alter) return '이 코드의 성격이라 뺄 수 없다.';
  return '색깔만 담당한다. 손이 모자라면 뺀다.';
}

// 밴드 안에서(베이스가 따로 있을 때) 빼도 되는 음인가
function isBandOmittable(deg) {
  return deg.num === 1 || (deg.num === 5 && !deg.alter);
}

export const MIN_TONES = 1;

// F♯♯ 처럼 겹올림·겹내림이 나오면 같은 소리의 쉬운 이름을 알려 준다(이론상 철자는 그대로 둔다)
function aliasOf(note) {
  if (Math.abs(note.alter) < 2) return null;
  return noteName(midiToNote(noteMidi(note), note.alter < 0));
}

// 코드 + 잡을 음 개수 → 무엇을 남기고 무엇을 뺄지의 계획.
export function tonePlan(chord, count) {
  const ranked = rankAll(chord.degs);
  const order = ranked.slice().sort((a, b) => a.rank - b.rank);
  const max = chord.degs.length;
  const n = Math.max(MIN_TONES, Math.min(count == null ? max : count, max));
  const keepSet = new Set(order.slice(0, n).map((r) => r.deg));

  const tones = ranked.map((r) => {
    const role = degRole(r.deg);
    return {
      deg: r.deg,
      rank: r.rank,
      keep: keepSet.has(r.deg),
      role: role.key,
      roleText: role.text,
      short: degShort(r.deg),
      note: degToNote(chord.root, r.deg),      // 옥타브 없이 철자만 보는 용도
      alias: aliasOf(degToNote(chord.root, r.deg)),  // ♯♯ ♭♭ 은 쉬운 이름을 함께 적는다
      omitWhy: omitNote(r.deg),
      bandOmit: isBandOmittable(r.deg),
    };
  });

  // 잡는 순서(낮은 도수부터)로 정렬해서 돌려준다
  tones.sort((a, b) => a.deg.num - b.deg.num || a.deg.alter - b.deg.alter);
  return { chord, count: n, max, tones, kept: tones.filter((t) => t.keep) };
}

// 남긴 음들의 피치클래스 집합(지판 검색이 쓴다)
export function keptPcs(plan) {
  return plan.kept.map((t) => ({ pc: notePc(t.note), tone: t }));
}

// 개수 고르개에 쓸 설명
export function countHint(plan) {
  const n = plan.count;
  if (n === 1) return '루트 한 음. 코드의 이름을 알려 줄 뿐 성격은 아직 없다.';
  if (n === 2) return '두 음. 여기까지가 "이 코드는 무엇인가" 의 최소한이다.';
  if (n === plan.max) return '적힌 음을 다 잡았다. 손이 닿는지가 문제.';
  return n + '개. 뺀 음은 아래에 회색으로 남겨 두었다.';
}
