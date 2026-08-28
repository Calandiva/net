// 건반 코드 사전.
// 같은 코드라도 어느 음을 어느 손이 어느 높이에서 잡느냐에 따라 소리가 다르다.
// 그 "어떻게 나눌 것인가" 를 보이싱이라고 부르고, 이 화면은 그 목록이다.

import { el } from './../util/dom.js';
import { INSTRUMENTS } from './../config.js';
import { chordPage } from './chordbar.js';
import { optionRow } from './inst-fret.js';
import { handVoicing, voicingIndex, voicingMidis, KEY_VOICINGS } from './../theory/keyboard.js';
import { renderKeyboard } from './../render/keys.js';
import { renderGrandChord } from './../render/staff.js';
import { noteName, noteMidi } from './../theory/notes.js';
import { playMidis } from './../audio/engine.js';

const s = { style: 'hands', span: 4 };

export function mountKeys(host) {
  const info = INSTRUMENTS.keys;
  const render = () => mountKeys(host);

  chordPage(host, render, (st) => {
    const v = handVoicing(st.plan, s.style);
    const press = voicingIndex(v);
    const midis = voicingMidis(v);
    const lows = midis.length ? Math.min.apply(null, midis) : 60;
    // 제일 낮은 음이 든 옥타브의 도(C)부터 그린다. 왼쪽이 텅 비면 그림이 아깝다.
    const low = Math.max(24, Math.min(48, Math.floor(lows / 12) * 12));

    host.appendChild(el('div.card.panel', [
      el('div.panel-head', [el('h3', info.icon + ' 건반 보이싱'), el('span.badge', '양손')]),
      el('div.panel-body', [
        optionRow('보이싱', KEY_VOICINGS.map((x) => ({ value: x.id, label: x.label, title: x.hint })),
          s.style, (v2) => { s.style = v2; render(); }),
        optionRow('건반 범위', [{ value: 3, label: '3옥타브' }, { value: 4, label: '4옥타브' }, { value: 5, label: '5옥타브' }],
          s.span, (v2) => { s.span = v2; render(); }),
        el('p.tip', v.note),
      ]),
    ]));

    host.appendChild(el('div.card.panel', [
      el('div.panel-head', [el('h3', '어느 건반을 누르나')]),
      el('div.hands', [handLine(v.left, '왼손'), handLine(v.right, '오른손')]),
      el('div.score-scroll', renderKeyboard(press, { low, octaves: s.span })),
      el('p.tip', '건반 위의 왼/오 는 어느 손인지, 아래 작은 숫자는 손가락 번호다 (엄지1 … 새끼5).'),
      el('div.btn-row', [
        el('button.mini', { type: 'button', onclick: () => playMidis(midis, 'block') }, '한꺼번에 ▶'),
        el('button.mini', { type: 'button', onclick: () => playMidis(midis, 'arp') }, '한 음씩 ▶'),
        el('button.mini', { type: 'button', onclick: () => playMidis(v.left.map((x) => noteMidi(x.note)), 'block') }, '왼손만 ▶'),
        el('button.mini', { type: 'button', onclick: () => playMidis(v.right.map((x) => noteMidi(x.note)), 'block') }, '오른손만 ▶'),
      ]),
    ]));

    host.appendChild(el('div.card.panel', [
      el('div.panel-head', [el('h3', '악보')]),
      el('div.score-scroll', renderGrandChord(v, { width: 340 })),
      el('p.tip', '큰보표는 위가 오른손(높은음자리표), 아래가 왼손(낮은음자리표)이다.'),
    ]));

    host.appendChild(el('div.card', [
      el('h3.section', '보이싱 고르는 법'),
      el('ul', KEY_VOICINGS.map((x) => el('li', [el('b', x.label), ' — ', x.hint]))),
    ]));
  });
}

function handLine(list, label) {
  return el('div.hand', [
    el('span.hand-label', label),
    el('span', list.length
      ? list.map((x) => noteName(x.note, true) + ' (' + x.tone.short + (x.finger ? '·' + x.finger + '번' : '') + ')').join('  ')
      : '없음'),
  ]);
}
