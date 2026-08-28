// 베이스 코드 사전.
// 베이스는 한 번에 한 음이다. 그래서 "어떻게 잡느냐" 가 아니라 "어느 음을 언제 고르느냐" 가
// 이 화면의 내용이 된다 — 루트 자리, 코드톤 자리, 그리고 그 음들을 잇는 라인.

import { el, chipGroup } from './../util/dom.js';
import { INSTRUMENTS, TUNINGS } from './../config.js';
import { chordPage } from './chordbar.js';
import { optionRow } from './inst-fret.js';
import { fretMap, notePositions } from './../theory/fretboard.js';
import { renderFretMap, renderSingleNote } from './../render/fret.js';
import { renderChordStaff, renderScore } from './../render/staff.js';
import { notePc, noteName, makeNote, noteMidi } from './../theory/notes.js';
import { playMidis } from './../audio/engine.js';

const s = { tuning: 'bass', pattern: 'root8' };

const PATTERNS = [
  { id: 'root8', label: '루트 8비트', hint: '코드가 바뀌면 그 루트로. 이것만 해도 곡이 굴러간다.' },
  { id: 'fifth', label: '루트–5도–옥타브', hint: '한 음씩 넓힌다. 록·팝에서 제일 흔한 모양.' },
  { id: 'walk',  label: '코드톤 워킹', hint: '루트–3–5–7 로 걸어 올라간다. 재즈·블루스.' },
  { id: 'arp',   label: '아르페지오', hint: '코드톤을 위아래로. 손과 귀를 같이 익힌다.' },
];

export function mountBass(host) {
  const info = INSTRUMENTS.bass;
  const render = () => mountBass(host);

  chordPage(host, render, (st) => {
    const bassNote = st.chord.bass || st.chord.root;
    const pos = notePositions(s.tuning, notePc(bassNote), 12);
    const rootTone = st.plan.tones.find((t) => notePc(t.note) === notePc(bassNote)) || st.plan.tones[0];
    const rootMidi = pos.length ? pos[0].midi : 40;

    host.appendChild(el('div.card.panel', [
      el('div.panel-head', [el('h3', info.icon + ' 베이스'), el('span.badge', '언제나 한 음')]),
      el('div.panel-body', [
        optionRow('조율', info.tunings.map((t) => ({ value: t, label: TUNINGS[t].short, title: TUNINGS[t].label })),
          s.tuning, (v) => { s.tuning = v; render(); }),
        el('p.tip', ['이 코드에서 베이스가 칠 음은 ', el('b', noteName(bassNote)), ' 다. ',
          '화음을 잡지 않는 이유는 낮은 음끼리 겹치면 배음이 부딪혀 뭉개지기 때문이다. ',
          '화음은 기타와 건반이 맡는다.']),
      ]),
    ]));

    host.appendChild(el('div.card.panel', [
      el('div.panel-head', [el('h3', '루트를 잡을 자리')]),
      el('div.score-scroll', renderSingleNote(s.tuning, pos, noteName(bassNote),
        { caption: '색이 찬 것이 제일 낮은(기본) 자리' })),
      el('div.score-scroll', renderChordStaff([{ note: fit(rootTone, rootMidi + info.octaveShift), tone: rootTone }], 'bass',
        { width: 230, note: '실제 소리보다 한 옥타브 높게 적었다' })),
      el('button.mini', { type: 'button', onclick: () => playMidis([rootMidi], 'block') }, '소리 ▶'),
    ]));

    // 라인 만들기
    const line = buildLine(st.plan, rootMidi, s.pattern, info.octaveShift);
    host.appendChild(el('div.card.panel', [
      el('div.panel-head', [el('h3', '라인'), el('span.badge', st.chord.sym + ' 한 마디')]),
      el('div.panel-body', [
        optionRow('패턴', PATTERNS.map((p) => ({ value: p.id, label: p.label, title: p.hint })),
          s.pattern, (v) => { s.pattern = v; render(); }),
        el('p.tip', (PATTERNS.find((p) => p.id === s.pattern) || {}).hint),
        el('div.score-scroll', renderScore({ clef: 'bass', time: [4, 4], measures: [line.events] })),
        el('button.mini', { type: 'button', onclick: () => playMidis(line.midis, 'arp') }, '들어 보기 ▶'),
      ]),
    ]));

    host.appendChild(el('div.card.panel', [
      el('div.panel-head', [el('h3', '코드톤 위치')]),
      el('div.score-scroll', renderFretMap(fretMap(s.tuning, st.plan),
        { caption: '워킹으로 넓힐 때 쓴다. 점선은 이 개수에서 생략한 음' })),
      el('p.tip', '루트에서 두 칸 위·한 줄 아래가 5도다. 이 모양 하나만 외워도 절반은 된다.'),
    ]));
  });
}

// 한 마디짜리 베이스 라인을 만든다. 악보와 소리가 같은 자료를 쓴다.
function buildLine(plan, rootMidi, pattern, shift) {
  const kept = plan.tones;
  const pick = (num) => kept.find((t) => t.deg.num === num) || null;
  const root = pick(1) || kept[0];
  const third = kept.find((t) => t.deg.num === 3 || t.deg.num === 4 || t.deg.num === 2) || root;
  const fifth = pick(5) || root;
  const seventh = kept.find((t) => t.deg.num === 7 || t.deg.num === 6) || fifth;

  const at = (tone, above) => {
    const n = fit(tone, above);
    return { name: noteName(n, true), midi: noteMidi(n) - shift, tone };
  };
  const R = at(root, rootMidi + shift);
  const seq = {
    root8: [R, R, R, R, R, R, R, R],
    fifth: [R, at(fifth, R.midi + shift + 1), at(root, R.midi + shift + 12), at(fifth, R.midi + shift + 1)],
    walk:  [R, at(third, R.midi + shift + 1), at(fifth, R.midi + shift + 1), at(seventh, R.midi + shift + 1)],
    arp:   [R, at(third, R.midi + shift + 1), at(fifth, R.midi + shift + 1), at(root, R.midi + shift + 12),
            at(fifth, R.midi + shift + 1), at(third, R.midi + shift + 1), R, R],
  }[pattern] || [R];

  const d = seq.length === 8 ? 8 : 4;
  return {
    events: seq.map((x) => ({ p: x.name, d, label: x.tone.short })),
    midis: seq.map((x) => x.midi),
  };
}

// 도수 음을 원하는 높이 위쪽 가장 가까운 자리에 앉힌다
function fit(tone, above) {
  const n = makeNote(tone.note.letter, tone.note.alter, 1);
  while (noteMidi(n) < above) n.oct += 1;
  return n;
}
