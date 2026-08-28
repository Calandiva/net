// 메트로놈. setInterval 로 소리를 내면 타이머 지터가 그대로 들리므로,
// 25ms 마다 깨어나 100ms 앞까지의 클릭을 오디오 시계에 미리 예약해 둔다.

import { METRO } from './../config.js';
import { getCtx, click } from './engine.js';

export function createMetronome() {
  const st = {
    bpm: METRO.bpmDefault,
    beats: 4,           // 한 마디 박 수
    sub: 1,             // 한 박을 몇 등분할지 (1 · 2 · 3 · 4)
    accent: true,
    voice: 'click',
    trainer: false,     // 자동 증속: 몇 마디마다 BPM 을 올린다
    silentEvery: 0,     // N 마디마다 한 마디를 쉰다(0 이면 안 쉰다). 속으로 세는 연습
    running: false,
    bar: 0,
    tickIdx: 0,
    next: 0,
    timer: null,
  };

  function stepDur() { return 60 / st.bpm / st.sub; }

  function schedule() {
    const c = getCtx();
    if (!c) return;
    while (st.next < c.currentTime + METRO.lookahead) {
      const perBar = st.beats * st.sub;
      const bar = Math.floor(st.tickIdx / perBar);
      const inBar = st.tickIdx % perBar;
      const isBeat = inBar % st.sub === 0;
      const beatNo = Math.floor(inBar / st.sub);
      const isBarStart = inBar === 0;
      // 쉬는 마디: 소리는 안 나지만 박은 그대로 흐른다
      const silent = st.silentEvery > 0 && (bar % st.silentEvery) === st.silentEvery - 1;

      if (!silent) {
        const v = METRO.voices[st.voice] || METRO.voices.click;
        const hz = isBarStart && st.accent ? v.hz[0] : isBeat ? v.hz[1] : v.hz[2];
        const gain = isBarStart && st.accent ? 0.75 : isBeat ? 0.5 : 0.22;
        click(hz, st.next, gain, v.type, v.dur);
      }

      // 램프는 소리보다 눈에 늦게 보여도 되므로 타이머로 따라 붙는다
      const at = st.next, b = beatNo, sb = inBar % st.sub, si = silent, ba = bar;
      const delay = Math.max(0, (at - c.currentTime) * 1000);
      setTimeout(() => { if (st.running && api.onBeat) api.onBeat(b, sb, ba, si); }, delay);

      // 자동 증속: 마디가 넘어가는 순간에만 올린다
      if (isBarStart && st.trainer && bar > 0 && bar % METRO.trainerBars === 0) {
        st.bpm = Math.min(METRO.bpmMax, st.bpm + METRO.trainerStep);
        if (api.onTempo) setTimeout(() => api.onTempo(st.bpm), delay);
      }

      st.next += stepDur();
      st.tickIdx += 1;
    }
  }

  const api = {
    onBeat: null,        // 화면이 갈아 끼운다
    onTempo: null,
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
