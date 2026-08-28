// 건반은 양손이다. 어느 음을 왼손이 잡고 어느 음을 오른손이 잡느냐가 곧 보이싱이다.
// 여기서 정한 음 높이를 건반 그림과 큰보표가 그대로 쓴다.

import { makeNote, noteMidi, notePc } from './notes.js';

const LEFT_LOW = 36;         // 왼손이 놓일 자리 아래끝(C2)
const RIGHT_LOW = 59;        // 오른손은 가온다 언저리부터 쌓는다

// 화면의 고르개가 쓰는 목록. 순서가 곧 화면 순서다.
export const KEY_VOICINGS = [
  { id: 'hands',  label: '기본',     hint: '왼손이 루트, 오른손이 나머지. 제일 먼저 익힐 모양.' },
  { id: 'close',  label: '클로즈',   hint: '오른손 안에서 음을 촘촘히 쌓는다. 좁고 단단하다.' },
  { id: 'drop2',  label: '드롭2',    hint: '클로즈에서 위에서 두 번째 음만 한 옥타브 내린다. 넓고 시원하다.' },
  { id: 'inv1',   label: '1전위',    hint: '3음을 제일 아래로. 베이스가 루트를 칠 때 쓴다.' },
  { id: 'inv2',   label: '2전위',    hint: '5음을 제일 아래로.' },
  { id: 'inv3',   label: '3전위',    hint: '7음을 제일 아래로. 7 코드에서만.' },
  { id: 'shell',  label: '쉘',       hint: '루트와 3·7음만. 두세 음으로 코드가 다 들린다.' },
  { id: 'rootA',  label: '루트리스 A', hint: '왼손 3-5-7-9. 루트를 아예 안 친다 — 베이스가 있을 때만.' },
  { id: 'rootB',  label: '루트리스 B', hint: '왼손 7-9-3-5. A 형과 번갈아 쓰면 손이 안 뛴다.' },
  { id: 'spread', label: '넓게',     hint: '왼손 루트, 오른손은 위로 벌려 쌓는다. 발라드 반주.' },
];

// 철자는 그대로 두고 옥타브만 옮겨 원하는 높이에 앉힌다
function placeAt(note, lowMidi) {
  const n = makeNote(note.letter, note.alter, note.oct);
  while (noteMidi(n) < lowMidi) n.oct += 1;
  while (noteMidi(n) - 12 >= lowMidi) n.oct -= 1;
  return n;
}

// 낮은 음부터 차곡차곡 쌓는다
function stackUp(tones, floor) {
  const out = [];
  let low = floor;
  tones.forEach((t) => {
    const n = placeAt(t.note, low);
    out.push({ note: n, tone: t });
    low = noteMidi(n) + 1;
  });
  return out;
}

// 손가락 번호. 왼손은 아래에서 5-3-2-1, 오른손은 아래에서 1-2-3-5.
const LEFT_FINGERS = { 1: [5], 2: [5, 1], 3: [5, 3, 1], 4: [5, 4, 2, 1], 5: [5, 4, 3, 2, 1] };
const RIGHT_FINGERS = { 1: [1], 2: [1, 5], 3: [1, 3, 5], 4: [1, 2, 3, 5], 5: [1, 2, 3, 4, 5] };

function label(list, hand) {
  const table = hand === 'L' ? LEFT_FINGERS : RIGHT_FINGERS;
  const f = table[Math.min(5, list.length)] || [];
  return list.map((x, i) => ({ note: x.note, tone: x.tone, hand, finger: f[i] || 0 }));
}

// 코드 계획 + 보이싱 모양 → 왼손 · 오른손 음 목록
export function handVoicing(plan, style) {
  const chord = plan.chord;
  const kept = plan.kept.slice();
  const bassNote = chord.bass || chord.root;
  const bassPc = notePc(bassNote);
  const st = style || 'hands';

  const find = (pred) => kept.find(pred);
  const third = find((t) => t.deg.num === 3 || t.deg.num === 4 || t.deg.num === 2);
  const fifth = find((t) => t.deg.num === 5);
  const seventh = find((t) => t.deg.num === 7 || t.deg.num === 6);
  const ninth = find((t) => t.deg.num >= 9);
  const rootTone = find((t) => t.deg.num === 1) || kept[0];

  let left = [], right = [], note = '';

  const lowRoot = () => [{ note: placeAt(bassNote, LEFT_LOW), tone: rootTone }];
  const others = () => kept.filter((t) => notePc(t.note) !== bassPc);

  if (st === 'close' || st === 'hands') {
    left = lowRoot();
    if (st === 'hands' && plan.count >= 5 && fifth && !fifth.deg.alter) {
      const f = placeAt(fifth.note, noteMidi(left[0].note) + 1);
      left.push({ note: f, tone: fifth });
    }
    const rest = kept.filter((t) => !left.some((l) => notePc(l.note) === notePc(t.note)));
    right = stackUp(rest, RIGHT_LOW);
    note = st === 'close' ? '오른손 안에서 촘촘히 쌓았다.' : '왼손이 뿌리, 오른손이 성격.';

  } else if (st === 'drop2') {
    left = lowRoot();
    const rest = kept.filter((t) => notePc(t.note) !== bassPc);
    const stack = stackUp(rest, RIGHT_LOW);
    if (stack.length >= 2) {
      const drop = stack.splice(stack.length - 2, 1)[0];   // 위에서 두 번째
      drop.note.oct -= 1;
      left.push(drop);
      left.sort((a, b) => noteMidi(a.note) - noteMidi(b.note));
    }
    right = stack;
    note = '위에서 두 번째 음을 한 옥타브 내렸다. 두 손 사이가 벌어져 소리가 트인다.';

  } else if (st === 'inv1' || st === 'inv2' || st === 'inv3') {
    const want = st === 'inv1' ? third : st === 'inv2' ? fifth : seventh;
    if (!want) return handVoicing(plan, 'hands');
    const order = kept.slice();
    const at = order.indexOf(want);
    const rot = order.slice(at).concat(order.slice(0, at));   // 그 음이 맨 아래로
    left = lowRoot();
    right = stackUp(rot, RIGHT_LOW);
    note = '베이스가 루트를 칠 때 오른손이 이렇게 굴러가면 손이 덜 뛴다.';

  } else if (st === 'shell') {
    left = lowRoot();
    const guide = [third, seventh].filter(Boolean);
    right = stackUp(guide.length ? guide : others().slice(0, 2), RIGHT_LOW);
    note = '3음과 7음만 남겼다. 이 둘이 코드의 성격을 다 가지고 있다.';

  } else if (st === 'rootA' || st === 'rootB') {
    const seq = st === 'rootA'
      ? [third, fifth, seventh, ninth]
      : [seventh, ninth, third, fifth];
    const use = seq.filter(Boolean);
    if (use.length < 2) return handVoicing(plan, 'shell');
    left = stackUp(use, 48);                                  // C3 언저리에서 시작
    right = [];
    note = '루트를 안 친다. 베이스가 루트를 맡고 있을 때만 쓴다.';

  } else if (st === 'spread') {
    left = lowRoot();
    if (seventh) {
      const s = placeAt(seventh.note, noteMidi(left[0].note) + 5);
      left.push({ note: s, tone: seventh });
    }
    const rest = kept.filter((t) => !left.some((l) => notePc(l.note) === notePc(t.note)));
    right = stackUp(rest, 64);                                // 한 옥타브 위에서
    note = '두 손 사이를 벌렸다. 느린 곡에서 울림이 좋다.';

  } else {
    return handVoicing(plan, 'hands');
  }

  // 한 손이 한 옥타브 반을 넘게 벌어지면 제일 위를 한 옥타브 내려 접는다
  [left, right].forEach((h) => {
    if (h.length < 2) return;
    const span = noteMidi(h[h.length - 1].note) - noteMidi(h[0].note);
    if (span > 16) h[h.length - 1].note.oct -= 1;
    h.sort((a, b) => noteMidi(a.note) - noteMidi(b.note));
  });

  const L = label(left, 'L'), R = label(right, 'R');
  return { left: L, right: R, all: L.concat(R), note, style: st };
}

// 소리 낼 때 쓸 MIDI 번호들
export function voicingMidis(v) {
  return v.all.map((x) => noteMidi(x.note));
}

// 건반 그림이 강조할 것들: midi → {tone, hand, finger}
export function voicingIndex(v) {
  const map = new Map();
  v.all.forEach((x) => map.set(noteMidi(x.note), x));
  return map;
}
