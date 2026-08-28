// 메트로놈. setInterval 로 소리를 내면 흔들리므로, 미리 잡아 두고(lookahead) WebAudio 시계에 맡긴다.

import { METRO } from './../config.js';
import { getCtx, click } from './engine.js';

export function createMetronome() {
  const st = {
    bpm: METRO.bpmDefault,
    beats: 4,          // 한 마디 박 수
    sub: 1,            // 한 박을 몇 등분할지 (1 · 2 · 3 · 4)
    accent: true,
    running: false,
    beat: 0,           // 마디 안의 박
    tickIdx: 0,        // 잘게 쪼갠 것까지 센 번호
    next: 0,
    timer: null,
  };

  function stepDur() { return 60 / st.bpm / st.sub; }

  function schedule() {
    const c = getCtx();
    if (!c) return;
    while (st.next < c.currentTime + METRO.lookahead) {
      const isBeat = st.tickIdx % st.sub === 0;
      const beatNo = Math.floor(st.tickIdx / st.sub) % st.beats;
      const isBar = isBeat && beatNo === 0;
      const hz = isBar && st.accent ? METRO.accentHz : isBeat ? METRO.beatHz : METRO.subHz;
      click(hz, st.next, isBar && st.accent ? 0.75 : isBeat ? 0.5 : 0.22);
      // 램프는 소리보다 눈에 늦게 보여도 되므로 타이머로 따라 붙인다
      const at = st.next, b = beatNo, sub = st.tickIdx % st.sub;
      const delay = Math.max(0, (at - c.currentTime) * 1000);
      setTimeout(() => { if (st.running && api.onBeat) api.onBeat(b, sub, isBar); }, delay);
      st.next += stepDur();
      st.tickIdx += 1;
    }
  }

  const api = {
    onBeat: null,        // 화면이 갈아 끼운다
    state: st,
    start() {
      const c = getCtx();
      if (!c || st.running) return;
      st.running = true;
      st.tickIdx = 0;
      st.next = c.currentTime + 0.08;
      schedule();
      st.timer = setInterval(schedule, METRO.tick);
    },
    stop() {
      st.running = false;
      if (st.timer) clearInterval(st.timer);
      st.timer = null;
    },
    toggle() { st.running ? this.stop() : this.start(); },
    set(k, v) {
      st[k] = v;
      if (st.running) { const c = getCtx(); st.next = Math.max(st.next, c.currentTime + 0.05); }
    },
  };
  return api;
}

// 탭 템포 — 최근 네 번의 간격 평균
export function createTapTempo() {
  let taps = [];
  return function tap() {
    const now = performance.now();
    if (taps.length && now - taps[taps.length - 1] > 2200) taps = [];
    taps.push(now);
    if (taps.length > 5) taps.shift();
    if (taps.length < 2) return null;
    let sum = 0;
    for (let i = 1; i < taps.length; i++) sum += taps[i] - taps[i - 1];
    return Math.round(60000 / (sum / (taps.length - 1)));
  };
}
