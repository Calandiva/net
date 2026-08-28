// 튜너의 몸통. 마이크를 열고, 파형을 솎아 내고, 고른 알고리즘에 넘긴다.
// 알고리즘 자체는 pitch.js 에 있다.

import { TUNER } from './../config.js';
import { getCtx, ensureCtx } from './engine.js';
import { algoById } from './pitch.js';
import { freqToMidi, midiToNote, midiToFreq } from './../theory/notes.js';

// 주파수 → 가장 가까운 음과 센트 어긋남
export function nearestNote(hz, preferFlat) {
  const exact = freqToMidi(hz);
  const midi = Math.round(exact);
  const cents = Math.round((exact - midi) * 100);
  return { midi, cents, note: midiToNote(midi, preferFlat), target: midiToFreq(midi) };
}

// 마이크를 열고 계속 재는 물건.
// opts.algo 와 opts.flat 은 켜 놓은 채로 바꿀 수 있다(setOpt).
export function createTuner(cb) {
  // src 를 붙들고 있어야 한다. 지역 변수로만 두면 GC 가 노드를 걷어 가면서
  // 그래프가 끊기고 파형이 통째로 0 이 되어 버린다.
  let stream = null, src = null, analyser = null, buf = null, down = null;
  let timer = 0, running = false, smoothHz = 0;
  let deadTicks = 0, rebuilds = 0;
  const opt = { algo: 'nsdf', flat: false, smooth: TUNER.smooth };

  async function start() {
    const c = await ensureCtx();
    if (!c) throw new Error('이 브라우저는 오디오를 지원하지 않는다');
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    await ensureCtx();                       // 권한 대화상자 동안 다시 잠들었을 수도 있다
    src = c.createMediaStreamSource(stream);
    analyser = c.createAnalyser();
    analyser.fftSize = TUNER.fftSize;
    buf = new Float32Array(analyser.fftSize);
    down = new Float32Array(analyser.fftSize >> 1);
    running = true;
    // requestAnimationFrame 을 쓰지 않는다. 화면이 안 그려지는 상황(탭이 뒤로 가거나
    // 렌더링이 멈춘 창)에서는 rAF 가 아예 안 불려서 튜너가 조용히 얼어붙는다.
    // 어차피 TUNER.periodMs 마다만 재면 되므로 타이머로 돈다.
    timer = setInterval(tick, TUNER.periodMs);
    tick();
  }

  // 마이크를 오디오 그래프에 붙인다. 다시 붙일 수 있게 따로 뺐다 — 아래 tick() 참고.
  function attach() {
    const c = getCtx();
    if (src) { try { src.disconnect(); } catch (e) { /* 이미 끊겼으면 그만 */ } }
    src = c.createMediaStreamSource(stream);
    analyser = c.createAnalyser();
    analyser.fftSize = TUNER.fftSize;
    buf = new Float32Array(analyser.fftSize);
    down = new Float32Array(analyser.fftSize >> 1);
    src.connect(analyser);
  }

  function tick() {
    if (!running || !analyser) return;
    analyser.getFloatTimeDomainData(buf);
    // 절반으로 솎아 낸다(≈24kHz). 사람이 튜닝하는 음역에는 충분하고 계산이 네 배 줄어든다.
    for (let i = 0; i < down.length; i++) down[i] = (buf[2 * i] + buf[2 * i + 1]) * 0.5;
    const sr = getCtx().sampleRate / 2;

    let level = 0;
    for (let i = 0; i < buf.length; i++) level += buf[i] * buf[i];
    level = Math.sqrt(level / buf.length);

    // 파형이 통째로 0 이면 마이크가 조용한 게 아니라 그래프가 죽은 것이다.
    // (브라우저에 따라 컨텍스트가 깨어나기 전에 만든 소스 노드가 영영 무음이 된다)
    // 트랙은 살아 있는데 0.5초 넘게 정확히 0 이면 다시 붙여 본다.
    if (level < 1e-7) {
      const live = stream && stream.getAudioTracks().some((t) => t.readyState === 'live');
      if (live && ++deadTicks > 12 && rebuilds < 3) { deadTicks = 0; rebuilds += 1; attach(); return; }
    } else {
      deadTicks = 0;
    }

    const t0 = performance.now();
    const got = algoById(opt.algo).fn(down, sr);
    const ms = performance.now() - t0;

    if (got && got.clarity >= TUNER.clarityMin) {
      smoothHz = smoothHz ? smoothHz + (got.hz - smoothHz) * opt.smooth : got.hz;
      const near = nearestNote(smoothHz, opt.flat);
      cb({ hz: smoothHz, raw: got.hz, clarity: got.clarity, level, ms,
           midi: near.midi, cents: near.cents, note: near.note });
    } else {
      cb(null, { level, ms, clarity: got ? got.clarity : 0 });
    }
  }

  function stop() {
    running = false;
    if (timer) clearInterval(timer);
    timer = 0;
    if (src) { try { src.disconnect(); } catch (e) { /* 이미 끊겼으면 그만 */ } }
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null; src = null; analyser = null; smoothHz = 0; deadTicks = 0; rebuilds = 0;
  }

  return {
    start, stop,
    isRunning: () => running,
    setOpt(k, v) { opt[k] = v; if (k === 'algo') smoothHz = 0; },
    getOpt(k) { return opt[k]; },
  };
}
