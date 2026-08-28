// 메트로놈 화면. 박마다 램프가 켜지고, 마디 수가 올라간다.

import { el, clear, chipGroup } from './../util/dom.js';
import { METRO } from './../config.js';
import { createMetronome, createTapTempo } from './../audio/metronome.js';

const keep = { metro: null, tap: null };

export function mountMetronome(host) {
  clear(host);
  if (!keep.metro) keep.metro = createMetronome();
  if (!keep.tap) keep.tap = createTapTempo();
  const m = keep.metro;

  const bpmView = el('div.bpm', String(m.state.bpm));
  const barView = el('div.barcount', '마디 —');
  const lamps = el('div.lamps');

  const drawLamps = (active, silent) => {
    clear(lamps);
    for (let i = 0; i < m.state.beats; i++) {
      const d = el('span.lamp' + (i === 0 ? '.first' : ''));
      if (i === active) d.classList.add(silent ? 'silent' : 'on');
      lamps.appendChild(d);
    }
  };

  m.onBeat = (beat, sub, bar, silent) => {
    if (sub !== 0) return;
    drawLamps(beat, silent);
    barView.textContent = '마디 ' + (bar + 1) + (silent ? ' · 쉬는 마디 (속으로 세라)' : '');
  };
  m.onTempo = (bpm) => { bpmView.textContent = String(bpm); slider.value = String(bpm); };

  const setBpm = (v) => {
    const bpm = Math.max(METRO.bpmMin, Math.min(METRO.bpmMax, Math.round(v)));
    m.set('bpm', bpm);
    bpmView.textContent = String(bpm);
    slider.value = String(bpm);
  };

  const slider = el('input.slider', {
    type: 'range', min: METRO.bpmMin, max: METRO.bpmMax, value: m.state.bpm,
    oninput: (e) => setBpm(+e.target.value),
  });

  const startBtn = el('button.big', { type: 'button' }, m.state.running ? '멈춤 ■' : '시작 ▶');
  startBtn.addEventListener('click', () => {
    if (m.state.running) { m.stop(); startBtn.textContent = '시작 ▶'; drawLamps(-1); barView.textContent = '마디 —'; }
    else { m.start(); startBtn.textContent = '멈춤 ■'; }
  });

  host.appendChild(el('div.page-head', [
    el('h2', '메트로놈'),
    el('p.tagline', '오디오 시계에 미리 예약하는 방식이라 흔들리지 않는다.'),
  ]));

  host.appendChild(el('div.card.metro-card', [
    bpmView, barView, lamps,
    el('div.metro-row', [
      el('button.mini', { type: 'button', onclick: () => setBpm(m.state.bpm - 5) }, '−5'),
      el('button.mini', { type: 'button', onclick: () => setBpm(m.state.bpm - 1) }, '−1'),
      slider,
      el('button.mini', { type: 'button', onclick: () => setBpm(m.state.bpm + 1) }, '+1'),
      el('button.mini', { type: 'button', onclick: () => setBpm(m.state.bpm + 5) }, '+5'),
    ]),
    startBtn,
    el('div.metro-row', [
      el('button.mini', { type: 'button', onclick: () => { const v = keep.tap(); if (v) setBpm(v); } }, '탭 템포 — 두드려서 맞추기'),
    ]),
  ]));

  host.appendChild(el('div.card', [
    el('h3.section', '박'),
    row('한 마디', [2, 3, 4, 5, 6, 7].map((v) => ({ value: v, label: v + '박' })), m.state.beats,
      (v) => { m.set('beats', v); drawLamps(-1); }),
    row('쪼개기', [
      { value: 1, label: '４분' }, { value: 2, label: '８분' },
      { value: 3, label: '셋잇단' }, { value: 4, label: '16분' },
    ], m.state.sub, (v) => m.set('sub', v)),
    row('첫 박 강조', [{ value: true, label: '켬' }, { value: false, label: '끔' }], m.state.accent,
      (v) => m.set('accent', v)),
    row('소리', Object.keys(METRO.voices).map((k) => ({ value: k, label: METRO.voices[k].label })),
      m.state.voice, (v) => m.set('voice', v)),
  ]));

  host.appendChild(el('div.card', [
    el('h3.section', '연습 도구'),
    row('자동 증속', [{ value: false, label: '끔' }, { value: true, label: '켬' }], m.state.trainer,
      (v) => m.set('trainer', v)),
    el('p.tip', METRO.trainerBars + '마디마다 ' + METRO.trainerStep + 'BPM 씩 올린다. 못 따라가는 지점이 지금 실력의 끝이다.'),
    row('쉬는 마디', [
      { value: 0, label: '끔' }, { value: 2, label: '2마디마다' },
      { value: 4, label: '4마디마다' }, { value: 8, label: '8마디마다' },
    ], m.state.silentEvery, (v) => m.set('silentEvery', v)),
    el('p.tip', '마지막 한 마디를 소리 없이 지나간다. 속으로 박을 세다가 다시 소리가 들어올 때 어긋나면 아직 박이 몸에 안 든 것이다.'),
  ]));

  drawLamps(-1);
}

function row(label, items, value, onPick) {
  return el('div.count-row', [el('span.field-label', label), chipGroup(items, value, onPick)]);
}
