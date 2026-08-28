// 건반은 양손이다. 왼손은 뿌리를 잡고, 오른손이 나머지를 쌓는다.
// 여기서 정한 음 높이를 건반 그림과 오선보가 그대로 쓴다.

import { makeNote, noteMidi, notePc } from './notes.js';

const LEFT_LOW = 36, LEFT_HIGH = 52;   // 왼손이 놓일 자리(C2~E3)
const RIGHT_LOW = 59;                  // 오른손은 가온다 언저리부터 쌓는다

// 철자는 그대로 두고 옥타브만 옮겨 원하는 높이에 앉힌다
function placeAt(note, lowMidi) {
  const n = makeNote(note.letter, note.alter, note.oct);
  while (noteMidi(n) < lowMidi) n.oct += 1;
  while (noteMidi(n) - 12 >= lowMidi) n.oct -= 1;
  return n;
}

// 코드 계획 → 왼손 · 오른손 음 목록
export function handVoicing(plan) {
  const chord = plan.chord;
  const kept = plan.kept;
  const bassNote = chord.bass || chord.root;
  const bassPc = notePc(bassNote);

  // 왼손: 베이스 한 음. 잡을 음이 다섯 개를 넘으면 5도를 얹어 받쳐 준다.
  const left = [];
  const lowRoot = placeAt(bassNote, LEFT_LOW);
  const rootTone = kept.find((t) => notePc(t.note) === bassPc) || kept[0];
  left.push({ note: lowRoot, tone: rootTone, hand: 'L' });

  const fifth = kept.find((t) => t.deg.num === 5 && !t.deg.alter);
  if (plan.count >= 5 && fifth) {
    const f = placeAt(fifth.note, noteMidi(lowRoot) + 1);
    if (noteMidi(f) <= LEFT_HIGH + 7) left.push({ note: f, tone: fifth, hand: 'L' });
  }

  // 오른손: 왼손이 가져간 음을 빼고 낮은 도수부터 쌓는다
  const leftPcs = new Set(left.map((x) => notePc(x.note)));
  const rest = kept.filter((t) => !leftPcs.has(notePc(t.note)));
  const right = [];
  let floor = RIGHT_LOW;
  rest.forEach((t) => {
    const n = placeAt(t.note, floor);
    right.push({ note: n, tone: t, hand: 'R' });
    floor = noteMidi(n) + 1;
  });

  // 한 손이 한 옥타브 반을 넘게 벌어지면 제일 위를 한 옥타브 내려 접는다
  if (right.length >= 2) {
    const span = noteMidi(right[right.length - 1].note) - noteMidi(right[0].note);
    if (span > 16) right[right.length - 1].note.oct -= 1;
    right.sort((a, b) => noteMidi(a.note) - noteMidi(b.note));
  }

  return { left, right, all: left.concat(right) };
}

// 소리 낼 때 쓸 MIDI 번호들
export function voicingMidis(v) {
  return v.all.map((x) => noteMidi(x.note));
}

// 건반 그림이 강조할 것들: midi → {tone, hand}
export function voicingIndex(v) {
  const map = new Map();
  v.all.forEach((x) => map.set(noteMidi(x.note), x));
  return map;
}
