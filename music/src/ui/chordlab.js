// 코드 사전. 코드 이름을 치면 기타 · 베이스 · 건반에서 어떻게 잡는지 한 화면에 보여 준다.
// 잡을 음 개수를 1 개부터 늘려 가며 볼 수 있고, 생략된 음은 왜 빼도 되는지까지 적는다.

import { el, clear, chipGroup } from './../util/dom.js';
import { DEG_COLOR, TUNINGS } from './../config.js';
import { parseChord, chordExamples } from './../theory/chords.js';
import { tonePlan, countHint } from './../theory/voicing.js';
import { degLabel } from './../theory/intervals.js';
import { findShapes, fretMap, notePositions } from './../theory/fretboard.js';
import { handVoicing, voicingIndex, voicingMidis } from './../theory/keyboard.js';
import { notePc, noteName, noteMidi, makeNote } from './../theory/notes.js';
import { renderChordBox, renderFretMap, renderSingleNote } from './../render/fret.js';
import { renderKeyboard } from './../render/keys.js';
import { renderGrandChord, renderChordStaff } from './../render/staff.js';
import { playMidis } from './../audio/engine.js';

const ROOTS = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

const state = { text: 'Cmaj7', count: null, guitarTuning: 'guitar', bassTuning: 'bass' };

export function mountChordLab(host) {
  clear(host);
  const input = el('input.chord-input', { type: 'text', value: state.text, spellcheck: 'false',
    placeholder: '코드 이름 — Cmaj7 · Am7 · G7sus4 · F♯m7♭5 · B♭13 · C/E' });
  const out = el('div.chord-out');

  const redraw = () => { state.text = input.value; draw(out, input); };
  input.addEventListener('input', () => { state.count = null; redraw(); });

  host.appendChild(el('div.page-head', [
    el('h2', '코드 사전'),
    el('p.tagline', '이름을 치면 세 악기에서 어디를 잡는지 나온다. 몇 개만 잡을지도 고를 수 있다.'),
  ]));
  host.appendChild(el('div.card.chord-search', [
    input,
    el('div.chips.static', ROOTS.map((r) => el('button.chip.ghost', { type: 'button', onclick: () => {
      const rest = input.value.replace(/^[A-Ga-g][#b♯♭]*/, '');
      input.value = r + rest; state.count = null; redraw();
    } }, r))),
    el('div.chips.static', chordExamples('C').map((c) => el('button.chip.ghost', { type: 'button', onclick: () => {
      input.value = c; state.count = null; redraw();
    } }, c))),
  ]));
  host.appendChild(out);
  draw(out, input);
}

function draw(out, input) {
  clear(out);
  const chord = parseChord(state.text);
  if (!chord) {
    out.appendChild(el('div.card.warn', '읽을 수 없는 코드 이름이다. Cmaj7 · Am7 · G7sus4 · B♭13 · C/E 처럼 적는다.'));
    return;
  }
  const max = chord.degs.length;
  if (state.count == null || state.count > max) state.count = max;
  const plan = tonePlan(chord, state.count);

  // 머리말 + 개수 고르개
  out.appendChild(el('div.card.chord-head', [
    el('div.chord-name', [el('b', chord.sym), el('span.chord-kor', chord.name)]),
    chord.hint ? el('p.tagline', chord.hint) : null,
    el('div.count-row', [
      el('span.field-label', '잡을 음 개수'),
      chipGroup(
        Array.from({ length: max }, (_, i) => ({ value: i + 1, label: String(i + 1) })),
        plan.count,
        (v) => { state.count = v; draw(out, input); }
      ),
    ]),
    el('p.tip', countHint(plan)),
  ]));

  out.appendChild(tonePanel(plan));
  out.appendChild(guitarPanel(plan, out, input));
  out.appendChild(bassPanel(plan, out, input));
  out.appendChild(keysPanel(plan));
}

// ── 도수 표 ───────────────────────────
function tonePanel(plan) {
  const rows = plan.tones.map((t) => el('tr', { class: t.keep ? '' : 'off' }, [
    el('td', [el('span.deg-dot', { style: { background: t.keep ? DEG_COLOR[t.role] : 'transparent',
      borderColor: DEG_COLOR[t.role] } }), el('b', t.short)]),
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

// ── 기타 ─────────────────────────────
function guitarPanel(plan, out, input) {
  const bassPc = plan.chord.bass ? notePc(plan.chord.bass) : notePc(plan.chord.root);
  const shapes = findShapes(state.guitarTuning, plan, bassPc);
  const body = el('div.panel-body');

  if (!shapes.length) {
    body.appendChild(el('p.tip', '이 조합은 여섯 줄 안에서 손가락 네 개로 잡을 자리를 못 찾았다. 개수를 줄여 보라.'));
  } else {
    const boxes = el('div.shape-row');
    shapes.forEach((s, i) => {
      const midis = s.tones.map((t) => t.midi);
      boxes.appendChild(el('div.shape', [
        renderChordBox(s, { caption: i === 0 ? '가장 쉬운 자리' : (s.lowFret || 1) + '프렛 자리' }),
        el('button.mini', { type: 'button', onclick: () => playMidis(midis, true) }, '소리 ▶'),
        el('div.shape-meta', (s.barre ? '바레 · ' : '') + '손가락 ' + s.fingers + '개'),
      ]));
    });
    body.appendChild(boxes);

    // 악보에는 기타 관례대로 실제 소리보다 한 옥타브 높여 적는다
    const staffItems = shapes[0].tones.map((t) => {
      const tone = t.tone;
      const n = fitNote(tone, t.midi + 12);
      return { note: n, tone: tone };
    });
    body.appendChild(el('div.score-scroll', renderChordStaff(staffItems, 'treble',
      { width: 260, note: '실제 소리보다 한 옥타브 높게 적었다' })));
  }

  body.appendChild(el('div.score-scroll', renderFretMap(fretMap(state.guitarTuning, plan),
    { caption: '지판 전체 — 색이 찬 것은 지금 잡는 음, 점선은 생략한 음' })));

  return el('div.card.panel', [
    el('div.panel-head', [el('h3', '🎸 기타'), tuningPicker('guitarTuning', ['guitar', 'guitarDrop', 'guitarHalf'], out, input)]),
    body,
  ]);
}

// 도수 음을 원하는 MIDI 높이에 맞춰 철자 유지한 채 옥타브만 정한다
function fitNote(tone, midi) {
  const n = makeNote(tone.note.letter, tone.note.alter, 4);
  while (noteMidi(n) < midi - 6) n.oct += 1;
  while (noteMidi(n) > midi + 6) n.oct -= 1;
  return n;
}

// ── 베이스 ────────────────────────────
function bassPanel(plan, out, input) {
  const bassNote = plan.chord.bass || plan.chord.root;
  const pos = notePositions(state.bassTuning, notePc(bassNote), 12);
  const rootTone = plan.tones.find((t) => notePc(t.note) === notePc(bassNote)) || plan.tones[0];
  const staffNote = fitNote(rootTone, pos.length ? pos[0].midi : 40);

  return el('div.card.panel', [
    el('div.panel-head', [el('h3', '🎻 베이스'), el('span.badge', '언제나 한 음'),
      tuningPicker('bassTuning', ['bass', 'bass5'], out, input)]),
    el('div.panel-body', [
      el('p.tip', ['베이스는 ', el('b', noteName(bassNote)), ' 한 음만 잡는다. 낮은 음끼리 겹치면 뭉개지기 때문이다. ',
        '색이 진한 자리가 제일 낮은(기본) 자리이고, 나머지는 같은 음의 다른 자리다.']),
      el('div.score-scroll', renderSingleNote(state.bassTuning, pos, noteName(bassNote),
        { caption: '이 음을 잡을 수 있는 자리' })),
      el('div.score-scroll', renderChordStaff([{ note: staffNote, tone: rootTone }], 'bass',
        { width: 220, note: '실제 소리보다 한 옥타브 높게 적었다' })),
      el('div.score-scroll', renderFretMap(fretMap(state.bassTuning, plan),
        { caption: '코드톤 위치 — 워킹 베이스로 넓힐 때 쓴다' })),
      el('button.mini', { type: 'button', onclick: () => playMidis([pos.length ? pos[0].midi : 40], false) }, '소리 ▶'),
    ]),
  ]);
}

// ── 건반 ─────────────────────────────
function keysPanel(plan) {
  const v = handVoicing(plan);
  const press = voicingIndex(v);
  const midis = voicingMidis(v);
  const hands = (list, label) => el('div.hand', [
    el('span.hand-label', label),
    el('span', list.length ? list.map((x) => noteName(x.note, true) + ' (' + x.tone.short + ')').join(' · ') : '없음'),
  ]);

  return el('div.card.panel', [
    el('div.panel-head', [el('h3', '🎹 건반'), el('span.badge', '양손')]),
    el('div.panel-body', [
      el('div.hands', [hands(v.left, '왼손'), hands(v.right, '오른손')]),
      el('div.score-scroll', renderKeyboard(press, { low: 36, octaves: 4 })),
      el('div.score-scroll', renderGrandChord(v, { width: 330 })),
      el('button.mini', { type: 'button', onclick: () => playMidis(midis, false) }, '소리 ▶'),
      el('p.tip', '왼손이 뿌리를 잡고 오른손이 성격을 만든다. 개수를 줄이면 오른손부터 가벼워진다.'),
    ]),
  ]);
}

function tuningPicker(key, opts, out, input) {
  return chipGroup(
    opts.map((o) => ({ value: o, label: TUNINGS[o].short, title: TUNINGS[o].label })),
    state[key],
    (v) => { state[key] = v; draw(out, input); }
  );
}
