// 코드 사전의 공통 머리 — 입력칸, 음 개수 고르개, 도수 표.
// 악기별 화면(inst-*.js)이 이걸 먼저 붙이고 자기 내용을 이어 붙인다.
// 코드 이름은 악기 탭을 옮겨도 그대로 남는다(같은 코드를 세 악기로 비교하라고).

import { el, clear, chipGroup } from './../util/dom.js';
import { DEG_COLOR } from './../config.js';
import { parseChord, chordExamples } from './../theory/chords.js';
import { tonePlan, countHint } from './../theory/voicing.js';
import { degLabel } from './../theory/intervals.js';
import { noteName } from './../theory/notes.js';

export const CHORD = { text: 'Cmaj7', count: null };

const ROOTS = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const QUALITIES = ['', 'm', '7', 'maj7', 'm7', 'm7♭5', 'dim7', 'aug', 'sus4', 'sus2',
  '6', 'm6', 'add9', '9', 'maj9', 'm9', '11', 'm11', '13', '7♭9', '7♯9', '7alt'];

// 지금 입력된 이름을 코드와 계획으로. 못 읽으면 null.
export function resolveChord() {
  const chord = parseChord(CHORD.text);
  if (!chord) return null;
  const max = chord.degs.length;
  if (CHORD.count == null || CHORD.count > max) CHORD.count = max;
  return { chord, plan: tonePlan(chord, CHORD.count), max };
}

// 입력칸 + 빠른 고르개
export function searchCard(onChange) {
  const input = el('input.chord-input', {
    type: 'text', value: CHORD.text, spellcheck: 'false',
    placeholder: 'Cmaj7 · Am7 · G7sus4 · F♯m7♭5 · B♭13 · C/E',
  });
  input.addEventListener('input', () => { CHORD.text = input.value; CHORD.count = null; onChange(); });

  const setRoot = (r) => {
    CHORD.text = r + CHORD.text.replace(/^[A-Ga-g][#b♯♭]*/, '');
    CHORD.count = null; onChange();
  };
  const setQuality = (q) => {
    const m = /^([A-Ga-g][#b♯♭]*)/.exec(CHORD.text);
    CHORD.text = (m ? m[1] : 'C') + q;
    CHORD.count = null; onChange();
  };

  return el('div.card.chord-search', [
    input,
    el('div.pick-row', [el('span.field-label', '루트'),
      el('div.chips', ROOTS.map((r) => el('button.chip.ghost', { type: 'button', onclick: () => setRoot(r) }, r)))]),
    el('div.pick-row', [el('span.field-label', '성질'),
      el('div.chips', QUALITIES.map((q) => el('button.chip.ghost', { type: 'button', onclick: () => setQuality(q) }, q || 'major')))]),
  ]);
}

export function errorCard() {
  return el('div.card.warn', [
    el('b', '읽을 수 없는 코드 이름이다.'),
    el('p', 'Cmaj7 · Am7 · G7sus4 · B♭13 · C/E 처럼 적는다. 위의 루트·성질 버튼을 눌러도 된다.'),
    el('p.tip', '아는 표기: ' + chordExamples('C').join(' · ') + ' 그리고 -7 · Δ7 · ø · °7 · 7+9 같은 별칭.'),
  ]);
}

// 코드 이름 + 잡을 음 개수
export function headCard(st, onChange) {
  return el('div.card.chord-head', [
    el('div.chord-name', [el('b', st.chord.sym), el('span.chord-kor', st.chord.name)]),
    st.chord.hint ? el('p.tagline', st.chord.hint) : null,
    el('div.count-row', [
      el('span.field-label', '잡을 음 개수'),
      chipGroup(
        Array.from({ length: st.max }, (_, i) => ({ value: i + 1, label: String(i + 1) })),
        st.plan.count,
        (v) => { CHORD.count = v; onChange(); }
      ),
    ]),
    el('p.tip', countHint(st.plan)),
  ]);
}

// 도수 표 — 무엇이 남고 무엇이 빠지는지, 왜 그런지
export function toneCard(plan) {
  const rows = plan.tones.map((t) => el('tr', { class: t.keep ? '' : 'off' }, [
    el('td', [el('span.deg-dot', { style: { background: t.keep ? DEG_COLOR[t.role] : 'transparent', borderColor: DEG_COLOR[t.role] } }), el('b', t.short)]),
    el('td', degLabel(t.deg)),
    el('td', noteName(t.note) + (t.alias ? ' (= ' + t.alias + ')' : '')),
    el('td.muted', t.keep ? t.roleText : '생략 — ' + t.omitWhy),
  ]));
  const omittable = plan.tones.filter((t) => t.bandOmit).map((t) => t.short).join(' · ');
  return el('div.card', [
    el('h3.section', '이 코드에 든 음'),
    el('table.tone-table', [
      el('thead', el('tr', [el('th', '도수'), el('th', ''), el('th', '음'), el('th', '하는 일')])),
      el('tbody', rows),
    ]),
    el('p.tip', ['밴드에서 빼도 되는 음: ', el('b', omittable || '없다'),
      ' — 베이스가 루트를 치고 완전5도는 소리에 거의 영향이 없다.']),
  ]);
}

// 악기 화면마다 반복되는 껍데기. render 는 화면을 다시 그리는 함수를 받는다.
export function chordPage(host, render, body) {
  clear(host);
  const st = resolveChord();
  host.appendChild(searchCard(render));
  if (!st) { host.appendChild(errorCard()); return null; }
  host.appendChild(headCard(st, render));
  host.appendChild(toneCard(st.plan));
  if (body) body(st);
  return st;
}
