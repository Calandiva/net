// 음정 찾기 알고리즘 모음.
//
// 다 같은 일을 하지만 잘하는 것과 못하는 것이 다르다. 튜너 화면에서 골라 쓰면서
// 차이를 직접 들어 보라고 여섯 가지를 다 넣었다. 전부 같은 모양을 지킨다:
//   fn(x: Float32Array, sr: number) -> { hz, clarity } | null
// x 는 이미 솎아 낸(다운샘플된) 파형이고, sr 은 그 파형의 표본율이다.

import { TUNER } from './../config.js';

// 봉우리·골짜기의 진짜 자리를 소수점 아래까지. 세 점으로 포물선을 맞춘다.
function refine(arr, i) {
  const y1 = arr[i - 1], y2 = arr[i], y3 = arr[i + 1];
  if (y1 == null || y3 == null) return i;
  const a = (y1 + y3 - 2 * y2) / 2;
  const b = (y3 - y1) / 2;
  return a ? i - b / (2 * a) : i;
}

function rmsOf(x) {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i] * x[i];
  return Math.sqrt(s / x.length);
}

function lagRange(sr, n) {
  return {
    lo: Math.max(2, Math.floor(sr / TUNER.maxHz)),
    hi: Math.min(n - 32, Math.ceil(sr / TUNER.minHz)),
  };
}

function ok(hz) {
  return isFinite(hz) && hz >= TUNER.minHz && hz <= TUNER.maxHz;
}

// ── 1. 자기상관 (ACF) ─────────────────────────────
// 파형을 자기 자신과 겹쳐 보며 제일 잘 겹치는 지연을 찾는다. 가장 오래되고 단순하다.
// 배음이 기음보다 세면 주기의 배수에 더 큰 봉우리가 서서 한 옥타브를 틀리기 쉽다.
export function pitchACF(x, sr) {
  const n = x.length;
  if (rmsOf(x) < 0.006) return null;
  const { lo, hi } = lagRange(sr, n);
  if (hi <= lo + 2) return null;

  let c0 = 0;
  for (let i = 0; i < n; i++) c0 += x[i] * x[i];
  if (c0 <= 0) return null;

  const c = new Float32Array(hi + 2);
  for (let lag = lo - 1; lag <= hi + 1; lag++) {
    let s = 0;
    const m = n - lag;
    for (let i = 0; i < m; i++) s += x[i] * x[i + lag];
    c[lag] = s;
  }
  // 교과서대로: 0 에서 처음 내려가는 구간(첫 골짜기)을 지난 뒤의 최댓값을 쓴다.
  // 이걸 빼먹으면 아주 짧은 지연에서 가짜 봉우리를 집는다.
  let dip = lo;
  while (dip < hi && c[dip] > c[dip + 1]) dip++;
  let best = -Infinity, bi = -1;
  for (let lag = Math.max(lo, dip); lag <= hi; lag++) if (c[lag] > best) { best = c[lag]; bi = lag; }
  if (bi <= 0) return null;
  const hz = sr / refine(c, bi);
  return ok(hz) ? { hz, clarity: Math.max(0, Math.min(1, best / c0)) } : null;
}

// ── 2. NSDF / MPM (McLeod) ────────────────────────
// 자기상관을 에너지로 정규화한 뒤(-1~1), 제일 높은 봉우리의 88% 를 넘는 "첫" 봉우리를
// 고른다. 그 첫 봉우리가 진짜 주기라서 옥타브를 잘 안 틀린다. 이 앱의 기본값.
export function pitchNSDF(x, sr) {
  const n = x.length;
  if (rmsOf(x) < 0.006) return null;
  const { lo, hi } = lagRange(sr, n);
  if (hi <= lo + 2) return null;

  const nsdf = new Float32Array(hi + 2);
  for (let lag = lo; lag <= hi; lag++) {
    let ac = 0, sq = 0;
    const m = n - lag;
    for (let i = 0; i < m; i++) {
      const a = x[i], b = x[i + lag];
      ac += a * b; sq += a * a + b * b;
    }
    nsdf[lag] = sq > 0 ? (2 * ac) / sq : 0;
  }

  let best = 0;
  const peaks = [];
  for (let lag = lo + 1; lag < hi; lag++) {
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
  const hz = sr / refine(nsdf, pick);
  return ok(hz) ? { hz, clarity: Math.max(0, Math.min(1, nsdf[pick])) } : null;
}

// ── 3. YIN ────────────────────────────────────────
// 차이 함수 d(τ)=Σ(x[i]-x[i+τ])² 를 누적 평균으로 나눠(CMND) 작은 τ 쪽 편향을 없앤다.
// 문턱값(0.15) 아래로 처음 떨어지는 τ 를 쓴다. 목소리에 특히 강하다.
export function pitchYIN(x, sr) {
  const n = x.length;
  if (rmsOf(x) < 0.006) return null;
  const { lo, hi } = lagRange(sr, n);
  if (hi <= lo + 2) return null;

  const d = new Float32Array(hi + 2);
  for (let lag = 1; lag <= hi + 1; lag++) {
    let s = 0;
    const m = n - lag;
    for (let i = 0; i < m; i++) { const v = x[i] - x[i + lag]; s += v * v; }
    d[lag] = s;
  }
  // 누적 평균 정규화
  const cm = new Float32Array(hi + 2);
  cm[0] = 1;
  let run = 0;
  for (let lag = 1; lag <= hi + 1; lag++) {
    run += d[lag];
    cm[lag] = run === 0 ? 1 : d[lag] * lag / run;
  }

  const THRESH = 0.15;
  let pick = -1;
  for (let lag = lo; lag <= hi; lag++) {
    if (cm[lag] < THRESH) {
      while (lag + 1 <= hi && cm[lag + 1] < cm[lag]) lag++;   // 골짜기 바닥까지
      pick = lag; break;
    }
  }
  if (pick < 0) {                                   // 문턱 아래로 안 내려가면 최솟값
    let mv = Infinity;
    for (let lag = lo; lag <= hi; lag++) if (cm[lag] < mv) { mv = cm[lag]; pick = lag; }
  }
  if (pick < 0) return null;
  const hz = sr / refine(cm, pick);
  return ok(hz) ? { hz, clarity: Math.max(0, Math.min(1, 1 - cm[pick])) } : null;
}

// ── 4. AMDF ───────────────────────────────────────
// 제곱 대신 절댓값 차이를 쓴다. 곱셈이 없어 가볍다 — 옛날 기기가 쓰던 방식.
// 잡음에는 약하다.
export function pitchAMDF(x, sr) {
  const n = x.length;
  if (rmsOf(x) < 0.006) return null;
  const { lo, hi } = lagRange(sr, n);
  if (hi <= lo + 2) return null;

  const d = new Float32Array(hi + 2);
  let dmax = 0;
  for (let lag = lo - 1; lag <= hi + 1; lag++) {
    let s = 0;
    const m = n - lag;
    for (let i = 0; i < m; i++) s += Math.abs(x[i] - x[i + lag]);
    d[lag] = m > 0 ? s / m : 0;
    if (d[lag] > dmax) dmax = d[lag];
  }
  // 차이 함수는 τ 가 커질수록 완만히 내려간다. 전체 최솟값을 그냥 고르면 주기의 배수를
  // 집어 한 옥타브(또는 그 이하)로 내려간다. 그래서 최솟값에 가까운 "첫" 골짜기를 쓴다.
  let mv = Infinity;
  for (let lag = lo; lag <= hi; lag++) if (d[lag] < mv) mv = d[lag];
  if (dmax <= 0 || !isFinite(mv)) return null;
  // 문턱은 "최솟값의 몇 배" 가 아니라 "최솟값과 최댓값 사이 어디쯤" 으로 잡아야 한다.
  // 깨끗한 소리는 최솟값이 0 에 붙어 버려서 비율로 재면 아무것도 못 고른다.
  const gate = mv + (dmax - mv) * 0.15;
  let mi = -1;
  for (let lag = lo + 1; lag < hi; lag++) {
    if (d[lag] <= d[lag - 1] && d[lag] <= d[lag + 1] && d[lag] <= gate) { mi = lag; break; }
  }
  if (mi < 0) return null;
  const at = d[mi];
  const hz = sr / refine(d, mi);
  return ok(hz) ? { hz, clarity: Math.max(0, Math.min(1, 1 - at / dmax)) } : null;
}

// ── 5. HPS (FFT 하모닉 곱) ────────────────────────
// 주파수 영역으로 옮긴 뒤 2배·3배·4배로 압축한 스펙트럼을 곱한다.
// 배음이 겹치는 자리 = 기음이 크게 남는다. 계산이 빠르지만 낮은 음은 분해능이 모자란다.
export function pitchHPS(x, sr) {
  if (rmsOf(x) < 0.006) return null;
  let N = 1;
  while (N * 2 <= x.length) N *= 2;
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));   // 해닝 창
    re[i] = x[i] * w;
  }
  fft(re, im);

  const half = N >> 1;
  const mag = new Float32Array(half);
  for (let i = 0; i < half; i++) mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);

  const H = 4;
  const hps = new Float32Array(Math.floor(half / H));
  for (let i = 0; i < hps.length; i++) {
    let p = mag[i];
    for (let h = 2; h <= H; h++) p *= mag[i * h];
    hps[i] = p;
  }
  const binHz = sr / N;
  const lo = Math.max(2, Math.floor(TUNER.minHz / binHz));
  const hi = Math.min(hps.length - 2, Math.ceil(TUNER.maxHz / binHz));
  if (hi <= lo) return null;
  let best = 0, bi = -1, total = 0;
  for (let i = lo; i <= hi; i++) { total += hps[i]; if (hps[i] > best) { best = hps[i]; bi = i; } }
  if (bi < 0 || best <= 0) return null;

  // 순음(배음이 없는 소리)에서는 곱이 기음의 1/2·1/3 자리에 서 버린다. 원래 스펙트럼에
  // 에너지가 실제로 있는지 확인하고, 없으면 배수 자리로 올라간다.
  let maxMag = 0;
  for (let i = lo; i < half; i++) if (mag[i] > maxMag) maxMag = mag[i];
  if (maxMag > 0 && mag[bi] < maxMag * 0.15) {
    for (let m = 2; m <= 4; m++) {
      const j = bi * m;
      if (j < half && mag[j] >= maxMag * 0.15) { bi = j; break; }
    }
  }

  // 크기 그대로 포물선을 맞추면 치우친다. 로그 크기로 다듬어야 몇 센트 안으로 들어온다.
  const lg = new Float32Array(3);
  for (let k = -1; k <= 1; k++) lg[k + 1] = Math.log(Math.max(1e-12, mag[bi + k] || 1e-12));
  const aa = (lg[0] + lg[2] - 2 * lg[1]) / 2;
  const bb = (lg[2] - lg[0]) / 2;
  const pos = bi + (aa ? -bb / (2 * aa) : 0);
  const hz = pos * binHz;
  const share = total > 0 ? best / total : 0;
  return ok(hz) ? { hz, clarity: Math.max(0, Math.min(1, Math.sqrt(share * (hi - lo)) / 6)) } : null;
}

// 제자리 FFT (radix-2 Cooley–Tukey). 라이브러리를 안 쓰려고 직접 둔다.
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {                 // 비트 뒤집기
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
}

// ── 6. 영교차 ─────────────────────────────────────
// 파형이 0 을 몇 번 지나는지만 센다. 제일 가볍고 제일 잘 틀린다.
// 배음이 조금만 있어도 헛돈다 — 왜 나머지 다섯 개가 필요한지 보여 주는 용도.
export function pitchZC(x, sr) {
  const n = x.length;
  if (rmsOf(x) < 0.006) return null;
  const cross = [];
  for (let i = 1; i < n; i++) {
    if (x[i - 1] <= 0 && x[i] > 0) {
      const t = x[i] - x[i - 1];
      cross.push(i - 1 + (t ? -x[i - 1] / t : 0));    // 선형 보간
    }
  }
  if (cross.length < 3) return null;
  const gaps = [];
  for (let i = 1; i < cross.length; i++) gaps.push(cross[i] - cross[i - 1]);
  gaps.sort((a, b) => a - b);
  const med = gaps[gaps.length >> 1];
  if (!med) return null;
  // 간격이 얼마나 고른가로 또렷함을 삼는다
  let dev = 0;
  gaps.forEach((g) => { dev += Math.abs(g - med); });
  const clarity = Math.max(0, 1 - (dev / gaps.length) / med);
  const hz = sr / med;
  return ok(hz) ? { hz, clarity } : null;
}

// 화면의 고르개가 쓰는 목록. 순서가 곧 화면 순서다.
export const PITCH_ALGOS = [
  { id: 'nsdf', name: 'NSDF', full: 'McLeod (MPM)', fn: pitchNSDF,
    good: '기본값. 배음이 센 저음현에서도 옥타브를 안 틀린다.' },
  { id: 'yin',  name: 'YIN',  full: 'YIN (CMND)', fn: pitchYIN,
    good: '목소리·관악기에 강하다. 조금 무겁다.' },
  { id: 'acf',  name: '자기상관', full: 'Autocorrelation', fn: pitchACF,
    good: '가장 단순하다. 잘 맞지만 잡음이 끼면 몇 센트씩 흔들린다.' },
  { id: 'amdf', name: 'AMDF', full: 'Average Magnitude Difference', fn: pitchAMDF,
    good: '곱셈이 없어 가볍다. 잡음에는 약하다.' },
  { id: 'hps',  name: 'HPS',  full: 'Harmonic Product Spectrum (FFT)', fn: pitchHPS,
    good: '주파수 영역이라 20배 빠르다. 배음이 없는 순음에는 보정이 필요하다.' },
  { id: 'zc',   name: '영교차', full: 'Zero Crossing', fn: pitchZC,
    good: '제일 가볍지만 배음이 조금만 있어도 옥타브를 틀린다. 왜 나머지가 필요한지 보는 용도.' },
];

export function algoById(id) {
  return PITCH_ALGOS.find((a) => a.id === id) || PITCH_ALGOS[0];
}
