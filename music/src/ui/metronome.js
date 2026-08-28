// 메트로놈 화면. 박이 올 때마다 램프가 켜진다.

import { el, clear, chipGroup } from './../util/dom.js';
import { METRO } from './../config.js';
import { createMetronome, createTapTempo } from './../audio/metronome.js';

const st = { metro: null, tap: null };

export function mountMetronome(host) {
  clear(host);
  const lamps = el('div.lamps');
  const bpmView = el('div.bpm', String(METRO.bpmDefault));

  if (!st.metro) st.metro = createMetronome();
  if (!st.tap) st.tap = createTapTempo();
  const m = st.metro;
  bpmView.textContent = String(m.state.bpm);

  const drawLamps = (active) => {
    clear(lamps);
    for (let i = 0; i < m.state.beats; i++) {
      const d = el('span.lamp' + (i === 0 ? '.first' : ''));
      if (i === active) d.classList.add('on');
      lamps.appendChild(d);
    }
  };
  m.onBeat = (beat) => drawLamps(beat);

  const setBpm = (v) => {
    const bpm = Math.max(METRO.bpmMin, Math.min(METRO.bpmMax, Math.round(v)));
    m.set('bpm', bpm);
    bpmView.textContent = String(bpm);
    slider.value = String(bpm);
  };

  const slider = el('input.slider', { type: 'range', min: METRO.bpmMin, max: METRO.bpmMax, value: m.state.bpm,
    oninput: (e) => setBpm(+e.target.value) });

  const startBtn = el('button.big', { type: 'button' }, m.state.running ? '멈춤 ■' : '시작 ▶');
  startBtn.addEventListener('click', () => {
    if (m.state.running) { m.stop(); startBtn.textContent = '시작 ▶'; drawLamps(-1); }
    else { m.start(); startBtn.textContent = '멈춤 ■'; }
  });

  host.appendChild(el('div.page-head', [
    el('h2', '메트로놈'),
    el('p.tagline', 'setInterval 이 아니라 오디오 시계에 미리 잡아 두는 방식이라 흔들리지 않는다.'),
  ]));
  host.appendChild(el('div.card.metro-card', [
    bpmView, lamps,
    el('div.metro-row', [
      el('button.mini', { type: 'button', onclick: () => setBpm(m.state.bpm - 5) }, '−5'),
      slider,
      el('button.mini', { type: 'button', onclick: () => setBpm(m.state.bpm + 5) }, '+5'),
    ]),
    startBtn,
    el('div.metro-row', [
      el('button.mini', { type: 'button', onclick: () => { const v = st.tap(); if (v) setBpm(v); } }, '탭 템포 (두드려서 맞추기)'),
    ]),
    el('div.count-row', [el('span.field-label', '한 마디 박'),
      chipGroup([2, 3, 4, 5, 6, 7].map((v) => ({ value: v, label: v + '박' })), m.state.beats,
        (v) => { m.set('beats', v); drawLamps(-1); })]),
    el('div.count-row', [el('span.field-label', '쪼개기'),
      chipGroup([
        { value: 1, label: '４분' }, { value: 2, label: '８분' },
        { value: 3, label: '셋잇단' }, { value: 4, label: '16분' },
      ], m.state.sub, (v) => m.set('sub', v))]),
    el('div.count-row', [el('span.field-label', '첫 박 강조'),
      chipGroup([{ value: true, label: '켬' }, { value: false, label: '끔' }], m.state.accent,
        (v) => m.set('accent', v))]),
  ]));
  drawLamps(-1);
}
