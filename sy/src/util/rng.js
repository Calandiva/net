// 시드 기반 난수 · 노이즈. 절차적 생성물이 항상 같은 모습으로 재현되도록 하는 토대.

// 문자열/숫자 조각들을 32비트 정수 해시 하나로 섞는다.
export function hash32(...parts) {
  let h = 0x811c9dc5;
  for (const part of parts) {
    const s = typeof part === 'string' ? part : String(part);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    h = Math.imul(h ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  }
  return h >>> 0;
}

// mulberry32 — 짧고 품질이 충분한 결정적 난수기.
export function makeRng(...seedParts) {
  let a = hash32(...seedParts);
  const rng = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // 편의 함수들
  rng.int = (min, max) => min + Math.floor(rng() * (max - min + 1));
  rng.range = (min, max) => min + rng() * (max - min);
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length) % arr.length];
  rng.chance = (p) => rng() < p;
  rng.shuffle = (arr) => {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  return rng;
}

// 시드 문자열들을 노이즈용 정수 시드 하나로 미리 굳혀 둔다.
// 노이즈 함수는 픽셀마다 불리므로 문자열을 만들지 않는 것이 중요하다.
export function seedOf(...parts) { return hash32(...parts); }

// 정수 좌표 해시 (0~1). 문자열을 거치지 않는다.
export function noiseAt(seed, x, y) {
  let h = seed ^ 0x9e3779b9;
  h = Math.imul(h ^ (x | 0), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h ^ (y | 0), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// 격자 보간 밸류 노이즈. scale 이 클수록 완만하다.
export function valueNoise(seed, x, y, scale) {
  const fx = x / scale, fy = y / scale;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = smooth(fx - x0), ty = smooth(fy - y0);
  const n00 = noiseAt(seed, x0, y0);
  const n10 = noiseAt(seed, x0 + 1, y0);
  const n01 = noiseAt(seed, x0, y0 + 1);
  const n11 = noiseAt(seed, x0 + 1, y0 + 1);
  return lerp(lerp(n00, n10, tx), lerp(n01, n11, tx), ty);
}

// 여러 옥타브를 겹쳐 자연스러운 얼룩을 만든다.
export function fbm(seed, x, y, scale, octaves = 3) {
  let sum = 0, amp = 1, norm = 0, s = scale, sd = seed;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(sd, x, y, s) * amp;
    norm += amp;
    amp *= 0.5;
    s *= 0.5;
    sd = (Math.imul(sd, 0x27d4eb2d) ^ 0x165667b1) >>> 0;
  }
  return sum / norm;
}

export function lerp(a, b, t) { return a + (b - a) * t; }
export function smooth(t) { return t * t * (3 - 2 * t); }
export function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }
