// 튜너 화면. 마이크를 켜면 지금 내는 소리가 무슨 음이고 몇 센트 어긋났는지 보여 준다.

import { el, clear, chipGroup } from './../util/dom.js';
import { COLOR, TUNER, TUNINGS } from './../config.js';
import { sv, svgRoot, line, path, text, circle, rect } from './../util/svg.js';
import { createTuner } from './../audio/tuner.js';
import { playFreq } from './../audio/engine.js';
import { midiToNote, noteName, midiToFreq } from './../theory/notes.js';

const st = { preset: 'guitar', tuner: null, on: false };

export function mountTuner(host) {
  clear(host);
  const gauge = el('div.gauge');
  const read = el('div.tuner-read', '—');
  const detail = el('div.tuner-detail', '마이크를 켜고 한 줄씩 울려 본다');
  const strings = el('div.string-row');

  const paint = (r) => {
    clear(gauge);
    gauge.appendChild(needle(r));
    if (!r) { read.textContent = '—'; read.className = 'tuner-read'; detail.textContent = st.on ? '소리를 기다리는 중' : '마이크가 꺼져 있다'; return; }
    read.textContent = noteName(r.note, true);
    const good = Math.abs(r.cents) <= TUNER.inTuneCents;
    read.className = 'tuner-read' + (good ? ' good' : '');
    detail.textContent = r.hz.toFixed(1) + ' Hz · ' + (r.cents > 0 ? '+' : '') + r.cents + ' 센트 · '
      + (good ? '맞았다' : r.cents > 0 ? '높다 — 조금 풀어라' : '낮다 — 조금 조여라');
    paintStrings(strings, r.midi);
  };

  const btn = el('button.big', { type: 'button' }, '마이크 켜기');
  btn.addEventListener('click', async () => {
    if (st.on) { st.tuner.stop(); st.on = false; btn.textContent = '마이크 켜기'; paint(null); return; }
    st.tuner = createTuner(paint);
    try {
      await st.tuner.start();
      st.on = true; btn.textContent = '마이크 끄기';
    } catch (e) {
      detail.textContent = '마이크를 열 수 없다. 브라우저 주소창의 권한을 확인하라. (' + (e && e.name) + ')';
    }
  });

  host.appendChild(el('div.page-head', [
    el('h2', '튜너'),
    el('p.tagline', '자기상관으로 기본 주파수를 찾는다. 소리는 브라우저 밖으로 나가지 않는다.'),
  ]));
  host.appendChild(el('div.card.tuner-card', [
    gauge, read, detail, btn,
    el('div.count-row', [el('span.field-label', '조율'),
      chipGroup(Object.keys(TUNINGS).map((k) => ({ value: k, label: TUNINGS[k].short, title: TUNINGS[k].label })),
        st.preset, (v) => { st.preset = v; paintStrings(strings, null); })]),
    strings,
    el('p.tip', '줄 이름을 누르면 기준음이 난다. 그 소리에 귀를 맞춘 뒤 줄을 울려 바늘을 본다.'),
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
  for (let c = -50; c <= 50; c += 10) {
    const a = (c / 50) * (Math.PI / 2.6) - Math.PI / 2;
    const x1 = cx + Math.cos(a) * (R - 10), y1 = cy + Math.sin(a) * (R - 10);
    const x2 = cx + Math.cos(a) * R, y2 = cy + Math.sin(a) * R;
    g.appendChild(line(x1, y1, x2, y2, c === 0 ? COLOR.ok : COLOR.line, c === 0 ? 2.4 : 1.2));
    if (c % 25 === 0) g.appendChild(text(cx + Math.cos(a) * (R - 24), cy + Math.sin(a) * (R - 24), c, { 'font-size': 10, fill: COLOR.dim }));
  }
  const cents = r ? Math.max(-50, Math.min(50, r.cents)) : 0;
  const a = (cents / 50) * (Math.PI / 2.6) - Math.PI / 2;
  const col = !r ? COLOR.line : Math.abs(r.cents) <= TUNER.inTuneCents ? COLOR.ok : COLOR.accent;
  g.appendChild(line(cx, cy, cx + Math.cos(a) * (R - 16), cy + Math.sin(a) * (R - 16), col, 3));
  g.appendChild(circle(cx, cy, 5, col));
  return root;
}

function paintStrings(host, midi) {
  clear(host);
  const t = TUNINGS[st.preset];
  t.strings.forEach((m, i) => {
    const b = el('button.string-btn', { type: 'button', onclick: () => playFreq(midiToFreq(m), null, 1.6, 0.9) },
      [el('b', t.names[i]), el('span', noteName(midiToNote(m), true))]);
    if (midi != null && Math.abs(midi - m) <= 1) b.classList.add('near');
    host.appendChild(b);
  });
}
