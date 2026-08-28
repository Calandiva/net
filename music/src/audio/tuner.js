// 튜너. 마이크에서 들어온 파형의 자기상관(autocorrelation)으로 기본 주파수를 찾는다.
// FFT 대신 자기상관을 쓰는 이유: 배음이 기음보다 센 악기(기타 저음현)에서도 잘 버틴다.

import { TUNER } from './../config.js';
import { getCtx } from './engine.js';
import { freqToMidi, midiToNote, midiToFreq } from './../theory/notes.js';

// 파형 한 토막 → 주파수(Hz) 와 또렷함(0~1). 못 찾으면 null.
//
// 그냥 자기상관의 최댓값을 고르면 한 옥타브 아래를 집는 일이 잦다(주기 T 의 배수에도
// 봉우리가 서기 때문). 그래서 McLeod 방식을 쓴다 — 정규화한 뒤(NSDF) 가장 높은 봉우리를
// 찾고, 그 높이의 일정 비율을 넘는 "첫" 봉우리를 고른다. 그 첫 봉우리가 진짜 주기다.
//
// 계산량을 줄이려고 절반으로 솎아 낸 뒤(24kHz 쯤) 잰다. 사람이 튜닝하는 음역에는 충분하다.
export function detectPitch(buf, sampleRate) {
  const n = buf.length >> 1;
  if (n < 512) return null;
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = (buf[2 * i] + buf[2 * i + 1]) * 0.5;
  const sr = sampleRate / 2;

  let rms = 0;
  for (let i = 0; i < n; i++) rms += x[i] * x[i];
  rms = Math.sqrt(rms / n);
  if (rms < 0.006) return null;                        // 너무 조용하면 포기

  const loLag = Math.max(2, Math.floor(sr / TUNER.maxHz));
  const hiLag = Math.min(n - 32, Math.ceil(sr / TUNER.minHz));
  if (hiLag <= loLag + 2) return null;

  // NSDF: 2·Σx[i]x[i+τ] / Σ(x[i]²+x[i+τ]²) — -1~1 사이로 정규화된다
  const nsdf = new Float32Array(hiLag + 1);
  for (let lag = loLag; lag <= hiLag; lag++) {
    let ac = 0, sq = 0;
    const m = n - lag;
    for (let i = 0; i < m; i++) {
      const a = x[i], b = x[i + lag];
      ac += a * b;
      sq += a * a + b * b;
    }
    nsdf[lag] = sq > 0 ? (2 * ac) / sq : 0;
  }

  // 봉우리들을 모으고, 가장 높은 봉우리의 일정 비율을 넘는 첫 봉우리를 고른다
  let best = 0;
  const peaks = [];
  for (let lag = loLag + 1; lag < hiLag; lag++) {
    if (nsdf[lag] > nsdf[lag - 1] && nsdf[lag] >= nsdf[lag + 1] && nsdf[lag] > 0) {
      peaks.push(lag);
      if (nsdf[lag] > best) best = nsdf[lag];
    }
  }
  if (!peaks.length || best <= 0) return null;
  const cut = best * 0.88;
  let pick = -1;
  for (const lag of peaks) if (nsdf[lag] >= cut) { pick = lag; break; }
  if (pick < 0) return null;

  // 포물선 보간으로 소수점 아래까지
  const y1 = nsdf[pick - 1], y2 = nsdf[pick], y3 = nsdf[pick + 1];
  const a2 = (y1 + y3 - 2 * y2) / 2;
  const b2 = (y3 - y1) / 2;
  const period = pick + (a2 ? -b2 / (2 * a2) : 0);
  const hz = sr / period;
  if (!isFinite(hz) || hz < TUNER.minHz || hz > TUNER.maxHz) return null;
  return { hz: hz, clarity: Math.max(0, Math.min(1, y2)) };
}

// 주파수 → 가장 가까운 음과 센트 어긋남
export function nearestNote(hz) {
  const exact = freqToMidi(hz);
  const midi = Math.round(exact);
  const cents = Math.round((exact - midi) * 100);
  return { midi, cents, note: midiToNote(midi), target: midiToFreq(midi) };
}

// 마이크를 열고 계속 재는 물건. cb(reading|null) 이 화면 갱신 주기마다 불린다.
export function createTuner(cb) {
  let stream = null, analyser = null, buf = null, raf = 0, running = false;
  let smoothHz = 0, lastAt = 0;

  async function start() {
    const c = getCtx();
    if (!c) throw new Error('이 브라우저는 오디오를 지원하지 않는다');
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    const src = c.createMediaStreamSource(stream);
    analyser = c.createAnalyser();
    analyser.fftSize = TUNER.fftSize;
    buf = new Float32Array(analyser.fftSize);
    src.connect(analyser);
    running = true;
    loop();
  }

  function loop() {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    // 자기상관은 무겁다. 매 프레임이 아니라 TUNER.periodMs 마다만 잰다.
    const now = performance.now();
    if (now - lastAt < TUNER.periodMs) return;
    lastAt = now;
    analyser.getFloatTimeDomainData(buf);
    const c = getCtx();
    const got = detectPitch(buf, c.sampleRate);
    if (got && got.clarity >= TUNER.clarityMin) {
      smoothHz = smoothHz ? smoothHz + (got.hz - smoothHz) * TUNER.smooth : got.hz;
      const near = nearestNote(smoothHz);
      cb({ hz: smoothHz, raw: got.hz, clarity: got.clarity, midi: near.midi, cents: near.cents, note: near.note });
    } else {
      cb(null);
    }
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null; smoothHz = 0;
  }

  return { start, stop, isRunning: () => running };
}
