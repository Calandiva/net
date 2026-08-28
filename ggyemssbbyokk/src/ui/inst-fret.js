// 지판 악기(기타 · 우쿨렐레)의 코드 사전.
// 한 코드에 운지를 여러 벌 보여 주는 것이 이 화면의 전부다 — 모양 · 자리 · 전위를 바꿔 가며.

import { el, clear, chipGroup } from './../util/dom.js';
import { INSTRUMENTS, TUNINGS } from './../config.js';
import { chordPage } from './chordbar.js';
import { findShapes, fretMap, SHAPE_STYLES } from './../theory/fretboard.js';
import { renderChordBox, renderFretMap, LABEL_MODES } from './../render/fret.js';
import { renderChordStaff } from './../render/staff.js';
import { notePc, makeNote, noteMidi } from './../theory/notes.js';
import { playMidis } from './../audio/engine.js';

// 악기마다 고른 값을 따로 기억한다(기타에서 바레를 골랐다고 우쿨렐레까지 바뀌면 곤란하다)
const state = {};

const ZONES = [
  { value: 'all', label: '전체', from: 0, to: 15 },
  { value: 'low', label: '0–4', from: 0, to: 4 },
  { value: 'mid', label: '3–7', from: 3, to: 7 },
  { value: 'up',  label: '5–9', from: 5, to: 9 },
  { value: 'hi',  label: '7–12', from: 7, to: 12 },
];

function stateOf(inst) {
  if (!state[inst]) {
    state[inst] = {
      tuning: INSTRUMENTS[inst].tunings[0],
      style: 'all', labelMode: 'deg', zone: 'all', inversion: false,
    };
  }
  return state[inst];
}

export function mountFretInstrument(host, inst) {
  const s = stateOf(inst);
  const info = INSTRUMENTS[inst];
  const render = () => mountFretInstrument(host, inst);

  chordPage(host, render, (st) => {
    const zone = ZONES.find((z) => z.value === s.zone) || ZONES[0];
    const shapes = findShapes(s.tuning, st.plan, {
      bassPc: st.chord.bass ? notePc(st.chord.bass) : notePc(st.chord.root),
      style: s.style, fromFret: zone.from, toFret: zone.to,
      allowInversion: s.inversion, limit: 6,
    });

    host.appendChild(el('div.card.panel', [
      el('div.panel-head', [el('h3', info.icon + ' ' + info.label + ' 운지'),
        el('span.badge', shapes.length + '벌')]),
      el('div.panel-body', [
        optionRow('조율', info.tunings.map((t) => ({ value: t, label: TUNINGS[t].short, title: TUNINGS[t].label })), s.tuning, (v) => { s.tuning = v; render(); }),
        optionRow('모양', SHAPE_STYLES.map((x) => ({ value: x.id, label: x.label, title: x.hint })), s.style, (v) => { s.style = v; render(); }),
        optionRow('자리', ZONES, s.zone, (v) => { s.zone = v; render(); }),
        optionRow('표시', LABEL_MODES.map((x) => ({ value: x.id, label: x.label, title: x.hint })), s.labelMode, (v) => { s.labelMode = v; render(); }),
        optionRow('전위', [{ value: false, label: '루트가 베이스' }, { value: true, label: '전위 허용' }], s.inversion,
          (v) => { s.inversion = v; render(); }),
        el('p.tip', (SHAPE_STYLES.find((x) => x.id === s.style) || {}).hint),
      ]),
    ]));

    if (!shapes.length) {
      host.appendChild(el('div.card.warn',
        '이 조건에서는 손가락 네 개로 잡을 자리를 못 찾았다. 음 개수를 줄이거나 모양·자리 조건을 풀어 보라.'));
    } else {
      const grid = el('div.shape-grid');
      shapes.forEach((sh, i) => {
        const midis = sh.tones.map((t) => t.midi);
        const inv = sh.bassTone && sh.bassTone.deg.num !== 1
          ? sh.bassTone.short + ' 이 베이스' : '루트가 베이스';
        grid.appendChild(el('div.shape', [
          renderChordBox(sh, { caption: capOf(sh, i), labelMode: s.labelMode }),
          el('div.shape-meta', [
            el('div', (sh.barre ? '바레 · ' : '') + '손가락 ' + sh.fingers + '개 · ' + sh.strings + '줄'),
            el('div.muted', inv),
          ]),
          el('div.btn-row', [
            el('button.mini', { type: 'button', onclick: () => playMidis(midis, 'strum') }, '스트로크 ▶'),
            el('button.mini', { type: 'button', onclick: () => playMidis(midis, 'arp') }, '한 음씩 ▶'),
          ]),
        ]));
      });
      host.appendChild(el('div.card.panel', [
        el('div.panel-head', [el('h3', '운지 ' + shapes.length + '벌')]),
        grid,
        el('p.tip', '왼쪽이 굵은 줄(낮은 음)이다. ✕ 는 안 치는 줄, ○ 는 개방현. 주황 띠는 바레.'),
      ]));

      const staffItems = shapes[0].tones.map((t) => ({
        note: fitNote(t.tone, t.midi + info.octaveShift), tone: t.tone,
      }));
      host.appendChild(el('div.card.panel', [
        el('div.panel-head', [el('h3', '악보')]),
        el('div.score-scroll', renderChordStaff(staffItems, 'treble',
          { width: 280, note: info.octaveShift ? '기타 관례대로 실제 소리보다 한 옥타브 높게 적었다' : '' })),
      ]));
    }

    host.appendChild(el('div.card.panel', [
      el('div.panel-head', [el('h3', '지판 전체')]),
      el('div.score-scroll', renderFretMap(fretMap(s.tuning, st.plan),
        { caption: '색이 찬 것은 지금 잡는 음, 점선은 생략한 음' })),
      el('p.tip', '같은 도수는 어디서나 같은 색이다. 이 지도를 외우면 코드가 바뀌어도 자리를 찾는다.'),
    ]));
  });
}

function capOf(sh, i) {
  if (i === 0) return '가장 무난한 자리';
  return sh.lowFret === 0 ? '개방 자리' : sh.lowFret + '프렛 자리';
}

// 도수 음을 원하는 MIDI 높이에 맞춰 철자 유지한 채 옥타브만 정한다
function fitNote(tone, midi) {
  const n = makeNote(tone.note.letter, tone.note.alter, 4);
  while (noteMidi(n) < midi - 6) n.oct += 1;
  while (noteMidi(n) > midi + 6) n.oct -= 1;
  return n;
}

export function optionRow(label, items, value, onPick) {
  return el('div.count-row', [el('span.field-label', label), chipGroup(items, value, onPick)]);
}
