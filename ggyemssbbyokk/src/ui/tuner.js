// 튜너 화면.
// 기본은 크로매틱이다 — 아무 음이나 내면 그게 무슨 음인지 알려 준다. 악기를 고르면
// 그 조율의 줄만 놓고 본다. 음정 찾는 방법(알고리즘)도 골라서 차이를 들여다볼 수 있다.

import { el, clear, chipGroup } from './../util/dom.js';
import { COLOR, TUNER, TUNINGS } from './../config.js';
import { sv, svgRoot, line, path, text, circle, rect } from './../util/svg.js';
import { createTuner } from './../audio/tuner.js';
import { PITCH_ALGOS, algoById } from './../audio/pitch.js';
import { playFreq } from './../audio/engine.js';
import { midiToNote, noteName, midiToFreq, setReferenceA, referenceA } from './../theory/notes.js';

const st = {
  mode: 'chromatic',      // 'chromatic' 또는 조율 키
  algo: 'nsdf',
  flat: false,
  smooth: TUNER.smooth,
  tuner: null,
  on: false,
  hist: [],               // 센트 이력
};

const SMOOTHS = [
  { value: 0.5, label: '빠름' },
  { value: 0.25, label: '보통' },
  { value: 0.1, label: '느림' },
];

export function mountTuner(host) {
  clear(host);
  const gauge = el('div.gauge');
  const read = el('div.tuner-read', '—');
  const detail = el('div.tuner-detail', '마이크를 켜면 시작한다');
  const strip = el('div.strip');
  const meter = el('div.meter');
  const strings = el('div.string-row');
  const cost = el('div.cost', '');

  const paint = (r, idle) => {
    clear(gauge);
    gauge.appendChild(needle(r));
    clear(strip);
    strip.appendChild(history());
    clear(meter);
    meter.appendChild(levelBar(r ? r.level : (idle ? idle.level : 0), r ? r.clarity : (idle ? idle.clarity : 0)));
    const ms = r ? r.ms : (idle ? idle.ms : null);
    cost.textContent = ms != null ? algoById(st.algo).name + ' · 한 번 재는 데 ' + ms.toFixed(1) + 'ms' : '';

    if (!r) {
      read.textContent = '—';
      read.className = 'tuner-read';
      detail.textContent = st.on ? '소리를 기다리는 중' : '마이크가 꺼져 있다';
      st.hist.push(null);
      trim();
      return;
    }
    st.hist.push(r.cents);
    trim();
    read.textContent = noteName(r.note, true);
    const good = Math.abs(r.cents) <= TUNER.inTuneCents;
    read.className = 'tuner-read' + (good ? ' good' : '');
    detail.textContent = r.hz.toFixed(1) + ' Hz · ' + (r.cents > 0 ? '+' : '') + r.cents + ' 센트 · '
      + (good ? '맞았다' : r.cents > 0 ? '높다 — 조금 풀어라' : '낮다 — 조금 조여라');
    paintStrings(strings, r.midi);
  };

  const trim = () => { while (st.hist.length > TUNER.historyLen) st.hist.shift(); };

  const btn = el('button.big', { type: 'button' }, st.on ? '마이크 끄기' : '마이크 켜기');
  btn.addEventListener('click', async () => {
    if (st.on && st.tuner) { st.tuner.stop(); st.on = false; btn.textContent = '마이크 켜기'; paint(null); return; }
    st.tuner = createTuner(paint);
    st.tuner.setOpt('algo', st.algo);
    st.tuner.setOpt('flat', st.flat);
    st.tuner.setOpt('smooth', st.smooth);
    try {
      await st.tuner.start();
      st.on = true; btn.textContent = '마이크 끄기';
    } catch (e) {
      detail.textContent = '마이크를 열 수 없다. 브라우저의 마이크 권한을 확인하라. (' + (e && e.name) + ')';
    }
  });

  const setOpt = (k, v) => { st[k] = v; if (st.tuner) st.tuner.setOpt(k, v); };

  const a4 = el('input.slider', {
    type: 'range', min: TUNER.a4Min, max: TUNER.a4Max, value: referenceA(),
    oninput: (e) => { setReferenceA(+e.target.value); a4v.textContent = e.target.value + ' Hz'; },
  });
  const a4v = el('span.a4v', referenceA() + ' Hz');

  host.appendChild(el('div.page-head', [
    el('h2', '튜너'),
    el('p.tagline', '크로매틱이 기본이다. 소리는 브라우저 밖으로 나가지 않는다 — 서버가 없으니 나갈 곳도 없다.'),
  ]));

  host.appendChild(el('div.card.tuner-card', [
    gauge, read, detail, strip, meter, cost, btn,
  ]));

  host.appendChild(el('div.card', [
    el('h3.section', '무엇에 맞출까'),
    el('div.count-row', [el('span.field-label', '모드'),
      chipGroup([{ value: 'chromatic', label: '크로매틱', title: '아무 음이나. 가장 가까운 반음으로 알려 준다' }]
        .concat(Object.keys(TUNINGS).map((k) => ({ value: k, label: TUNINGS[k].short, title: TUNINGS[k].label }))),
        st.mode, (v) => { st.mode = v; paintStrings(strings, null); })]),
    strings,
    el('p.tip', '크로매틱은 목소리·관악기·아무 악기에나 쓴다. 조율을 고르면 그 줄들만 놓고 보고, 줄 이름을 누르면 기준음이 난다.'),
  ]));

  const algoNote = el('p.tip', algoById(st.algo).full + ' — ' + algoById(st.algo).good);
  host.appendChild(el('div.card', [
    el('h3.section', '음정 찾는 방법'),
    el('div.count-row', [el('span.field-label', '알고리즘'),
      chipGroup(PITCH_ALGOS.map((a) => ({ value: a.id, label: a.name, title: a.full + ' — ' + a.good })),
        st.algo, (v) => { setOpt('algo', v); algoNote.textContent = algoById(v).full + ' — ' + algoById(v).good; })]),
    algoNote,
    el('ul.algo-list', PITCH_ALGOS.map((a) => el('li', [el('b', a.name), ' ', el('span.muted', a.good)]))),
  ]));

  host.appendChild(el('div.card', [
    el('h3.section', '세부'),
    el('div.count-row', [el('span.field-label', '표기'),
      chipGroup([{ value: false, label: '♯ 올림' }, { value: true, label: '♭ 내림' }], st.flat, (v) => setOpt('flat', v))]),
    el('div.count-row', [el('span.field-label', '반응'),
      chipGroup(SMOOTHS, st.smooth, (v) => setOpt('smooth', v))]),
    el('div.count-row', [el('span.field-label', '기준 A'), a4, a4v]),
    el('p.tip', '기준 A 는 보통 440Hz 다. 오케스트라는 442~443, 옛 악기는 415 를 쓰기도 한다. 바꾸면 모든 음의 기준이 같이 옮겨간다.'),
  ]));

  paintStrings(strings, null);
  paint(null);
}

// 바늘 눈금 — 가운데가 0센트, 좌우 ±50
function needle(r) {
  const W = 420, H = 150, cx = W / 2, cy = H - 14, R = 118;
  const root = svgRoot(W, H, 'gauge-svg');
  const g = sv('g');
  root.appendChild(rect(0, 0, W, H, COLOR.panel2, { rx: 10 }));
  root.appendChild(g);
  for (let c = -50; c <= 50; c += 5) {
    const a = (c / 50) * (Math.PI / 2.6) - Math.PI / 2;
    const big = c % 25 === 0, mid = c % 10 === 0;
    const len = big ? 16 : mid ? 11 : 6;
    g.appendChild(line(cx + Math.cos(a) * (R - len), cy + Math.sin(a) * (R - len),
      cx + Math.cos(a) * R, cy + Math.sin(a) * R,
      c === 0 ? COLOR.ok : COLOR.line, c === 0 ? 2.6 : 1.1));
    if (big) g.appendChild(text(cx + Math.cos(a) * (R - 28), cy + Math.sin(a) * (R - 28), c, { 'font-size': 10, fill: COLOR.dim }));
  }
  // 맞은 것으로 보는 구간을 옅게 칠한다
  const a1 = (-TUNER.inTuneCents / 50) * (Math.PI / 2.6) - Math.PI / 2;
  const a2 = (TUNER.inTuneCents / 50) * (Math.PI / 2.6) - Math.PI / 2;
  g.appendChild(path(['M', cx, cy, 'L', cx + Math.cos(a1) * R, cy + Math.sin(a1) * R,
    'A', R, R, 0, 0, 1, cx + Math.cos(a2) * R, cy + Math.sin(a2) * R, 'Z'].join(' '),
    { fill: 'rgba(90,164,105,.14)' }));

  const cents = r ? Math.max(-50, Math.min(50, r.cents)) : 0;
  const a = (cents / 50) * (Math.PI / 2.6) - Math.PI / 2;
  const col = !r ? COLOR.line : Math.abs(r.cents) <= TUNER.inTuneCents ? COLOR.ok : COLOR.accent;
  g.appendChild(line(cx, cy, cx + Math.cos(a) * (R - 18), cy + Math.sin(a) * (R - 18), col, 3.2));
  g.appendChild(circle(cx, cy, 6, col));
  return root;
}

// 센트 이력 — 손이 떨리는지, 줄이 풀리는지가 여기 보인다
function history() {
  const W = 420, H = 54, mid = H / 2;
  const root = svgRoot(W, H, 'strip-svg');
  const g = sv('g');
  root.appendChild(rect(0, 0, W, H, COLOR.panel2, { rx: 8 }));
  root.appendChild(g);
  g.appendChild(rect(0, mid - (TUNER.inTuneCents / 50) * mid, W, (TUNER.inTuneCents / 50) * mid * 2, 'rgba(90,164,105,.16)'));
  g.appendChild(line(0, mid, W, mid, COLOR.line, 1));
  const n = TUNER.historyLen;
  const step = W / n;
  st.hist.forEach((c, i) => {
    if (c == null) return;
    const y = mid - Math.max(-50, Math.min(50, c)) / 50 * (mid - 4);
    const x = W - (st.hist.length - i) * step;
    g.appendChild(circle(x, y, 1.6, Math.abs(c) <= TUNER.inTuneCents ? COLOR.ok : COLOR.accent));
  });
  g.appendChild(text(W - 24, 10, '+50', { 'font-size': 8, fill: COLOR.dim }));
  g.appendChild(text(W - 24, H - 8, '−50', { 'font-size': 8, fill: COLOR.dim }));
  return root;
}

// 들어오는 소리 세기와 또렷함
function levelBar(level, clarity) {
  const W = 420, H = 20;
  const root = svgRoot(W, H, 'meter-svg');
  root.appendChild(rect(0, 0, W, H, COLOR.panel2, { rx: 6 }));
  const lw = Math.min(1, (level || 0) * 6) * (W / 2 - 12);
  const cw = Math.min(1, clarity || 0) * (W / 2 - 12);
  root.appendChild(rect(8, 6, lw, 8, COLOR.ok, { rx: 4 }));
  root.appendChild(rect(W / 2 + 4, 6, cw, 8, COLOR.warn, { rx: 4 }));
  root.appendChild(text(8, 10, '세기', { 'text-anchor': 'start', 'font-size': 8, fill: 'rgba(255,255,255,.35)' }));
  root.appendChild(text(W / 2 + 4, 10, '또렷함', { 'text-anchor': 'start', 'font-size': 8, fill: 'rgba(255,255,255,.35)' }));
  return root;
}

function paintStrings(host, midi) {
  clear(host);
  if (st.mode === 'chromatic') {
    host.appendChild(el('span.muted', '크로매틱 — 12반음 어디든 가장 가까운 음으로 맞춘다'));
    return;
  }
  const t = TUNINGS[st.mode];
  if (!t) return;
  t.strings.forEach((m, i) => {
    const b = el('button.string-btn', { type: 'button', onclick: () => playFreq(midiToFreq(m), null, 1.6, 0.9) },
      [el('b', t.names[i]), el('span', noteName(midiToNote(m, st.flat), true))]);
    if (midi != null && Math.abs(midi - m) <= 1) b.classList.add('near');
    host.appendChild(b);
  });
}
