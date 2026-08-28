// 소리 내기. 라이브러리 없이 WebAudio 오실레이터만 쓴다.

import { AUDIO } from './../config.js';
import { midiToFreq } from './../theory/notes.js';

let ctx = null;
let master = null;

export function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = AUDIO.master;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// 음 하나. 배음을 두 개만 얹어도 오르간 비슷한 소리가 난다.
export function playFreq(hz, when, dur, gain) {
  const c = getCtx();
  if (!c) return;
  const t0 = when == null ? c.currentTime : when;
  const d = dur == null ? AUDIO.noteDur : dur;
  const g = c.createGain();
  g.connect(master);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime((gain == null ? 1 : gain) * 0.9, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);

  [[1, 1], [2, 0.32], [3, 0.14]].forEach((h) => {
    const o = c.createOscillator();
    o.type = h[0] === 1 ? 'triangle' : 'sine';
    o.frequency.value = hz * h[0];
    const hg = c.createGain();
    hg.gain.value = h[1];
    o.connect(hg); hg.connect(g);
    o.start(t0); o.stop(t0 + d + 0.05);
  });
}

// MIDI 번호 여러 개. strum 을 주면 기타처럼 아래에서 위로 훑는다.
export function playMidis(midis, strum) {
  const c = getCtx();
  if (!c) return;
  const gap = strum ? AUDIO.strumGap : 0;
  midis.slice().sort((a, b) => a - b).forEach((m, i) => {
    playFreq(midiToFreq(m), c.currentTime + i * gap, AUDIO.noteDur, 0.85);
  });
}

// 메트로놈 클릭(짧은 사인 + 급한 감쇠)
export function click(hz, when, gain) {
  const c = getCtx();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'square';
  o.frequency.value = hz;
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(gain == null ? 0.6 : gain, when + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.055);
  o.connect(g); g.connect(master);
  o.start(when); o.stop(when + 0.08);
}
