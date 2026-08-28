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
// 컨텍스트가 확실히 깨어난 뒤에 돌려준다.
// 마이크를 열 때 이걸 안 기다리면, 아직 잠들어 있는 컨텍스트 위에 만들어진
// MediaStreamAudioSourceNode 가 영영 무음이 되는 일이 생긴다.
export async function ensureCtx() {
  const c = getCtx();
  if (c && c.state !== 'running') {
    try { await c.resume(); } catch (e) { /* 막혀 있으면 그대로 둔다 */ }
  }
  return c;
}

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

// MIDI 번호 여러 개.
//   'block'  한꺼번에 (건반)
//   'strum'  아래에서 위로 살짝 밀며 (기타 스트로크)
//   'arp'    한 음씩 또박또박 (아르페지오 — 어느 음이 들었는지 확인할 때)
export function playMidis(midis, mode) {
  const c = getCtx();
  if (!c) return;
  const gap = mode === 'strum' ? AUDIO.strumGap : mode === 'arp' ? AUDIO.arpGap : 0;
  const dur = mode === 'arp' ? AUDIO.arpGap * 2.2 : AUDIO.noteDur;
  midis.slice().sort((a, b) => a - b).forEach((m, i) => {
    playFreq(midiToFreq(m), c.currentTime + i * gap, dur, 0.85);
  });
}

// 메트로놈 클릭. 짧게 때리고 급하게 죽인다 — 그래야 박이 또렷하다.
export function click(hz, when, gain, type, dur) {
  const c = getCtx();
  if (!c) return;
  const d = dur == null ? 0.055 : dur;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type || 'square';
  o.frequency.value = hz;
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(gain == null ? 0.6 : gain, when + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, when + d);
  o.connect(g); g.connect(master);
  o.start(when); o.stop(when + d + 0.03);
}
