// 색. 여기 값만 바꾸면 게임 전체 톤이 바뀐다.
// 도트 톤은 채도를 조금 낮추고 명도 차이로 구분한다 — 눈이 덜 피로하다.

import { GROUND, PROP, KIND, IN } from '../config.js';

// ── 지면 ────────────────────────────────────────────────────────────────
export const GROUND_COLOR = {
  [GROUND.FIELD]: '#c3cf85',
  [GROUND.GRASS]: '#8cc069',
  [GROUND.DIRT]: '#c0a578',
  [GROUND.ROAD]: '#6d6f78',
  [GROUND.SIDEWALK]: '#c7c1b3',
  [GROUND.CROSSWALK]: '#d8d4c8',
  [GROUND.PLAZA]: '#d9d1bf',
  [GROUND.WATER]: '#6cb2d6',
  [GROUND.SAND]: '#e0d3a4',
  [GROUND.PARKING]: '#87878f',
  [GROUND.YARD]: '#a6a29a',
  [GROUND.FLOOR]: '#b9b2a6',
  [GROUND.TRACK]: '#cfa47f',
  [GROUND.ROAD_LINE]: '#6d6f78',
};

// 타일마다 살짝 흔들 밝기 폭 (0 이면 단색)
export const GROUND_JITTER = {
  [GROUND.FIELD]: 0.10,
  [GROUND.GRASS]: 0.09,
  [GROUND.DIRT]: 0.08,
  [GROUND.ROAD]: 0.04,
  [GROUND.SIDEWALK]: 0.05,
  [GROUND.CROSSWALK]: 0.02,
  [GROUND.PLAZA]: 0.05,
  [GROUND.WATER]: 0.07,
  [GROUND.SAND]: 0.07,
  [GROUND.PARKING]: 0.04,
  [GROUND.YARD]: 0.05,
  [GROUND.FLOOR]: 0.03,
  [GROUND.TRACK]: 0.06,
  [GROUND.ROAD_LINE]: 0.03,
};

// ── 소품 ────────────────────────────────────────────────────────────────
export const PROP_COLOR = {
  [PROP.TREE]: { leaf: '#4e9147', leafHi: '#6cb35f', trunk: '#7a5a3a' },
  [PROP.BUSH]: { leaf: '#5aa055', leafHi: '#7cbd6e' },
  [PROP.LAMP]: { pole: '#8e8e96', head: '#f2e6a8' },
  [PROP.BENCH]: { wood: '#b07a4c', leg: '#7d7d85' },
  [PROP.SIGN]: { pole: '#8e8e96', board: '#4f7fbf', text: '#f2f2f0' },
  [PROP.HYDRANT]: { body: '#cf5b52', cap: '#e6e6e6' },
  [PROP.PLANTER]: { pot: '#b1705a', leaf: '#5aa055' },
  [PROP.FENCE]: { wood: '#9b8a6a' },
  [PROP.ROCK]: { body: '#9a9a95', hi: '#b8b8b2' },
  [PROP.FLOWER]: { stem: '#5aa055', petal: ['#f2a2c0', '#f6e07a', '#e88a6a', '#c8a8ee'] },
  [PROP.VENDING]: { body: '#cf5b52', glass: '#8fd2e6' },
};

// ── 건물 ────────────────────────────────────────────────────────────────
// wall 옆벽 · roof 옥상 · trim 테두리 · accent 간판/창문
export const BUILDING_COLOR = {
  [KIND.APARTMENT]: { wall: '#e9e1d3', roof: '#b7c2ce', trim: '#9aa4b0', accent: '#8fb8d8' },
  [KIND.HOUSE]: { wall: '#efe4d2', roof: '#d0806a', trim: '#a8624f', accent: '#8fb8d8' },
  [KIND.SHOP]: { wall: '#f0e6d6', roof: '#dcb05f', trim: '#b58840', accent: '#e2705f' },
  [KIND.TOWER]: { wall: '#dfe6ec', roof: '#93a9bd', trim: '#7c93a8', accent: '#6fa8d8' },
  [KIND.MART]: { wall: '#f2e2dc', roof: '#d1756c', trim: '#a95a52', accent: '#f2c14e' },
  [KIND.SCHOOL]: { wall: '#f0e6c8', roof: '#c9b071', trim: '#a08c50', accent: '#7fb87f' },
  [KIND.PUBLIC]: { wall: '#e4ecf2', roof: '#9ebbd2', trim: '#7d9cb5', accent: '#5f8fc0' },
  [KIND.STATION]: { wall: '#dfe9f2', roof: '#7fa5c6', trim: '#5f85a8', accent: '#f2c14e' },
  [KIND.FACTORY]: { wall: '#d8dade', roof: '#a9b1b8', trim: '#8b939a', accent: '#6f8fa8' },
  [KIND.WAREHOUSE]: { wall: '#d2d6d8', roof: '#98a2a8', trim: '#7c868c', accent: '#8a949a' },
  [KIND.CHURCH]: { wall: '#efe8f2', roof: '#b2a4c4', trim: '#8e80a2', accent: '#d8c46a' },
  [KIND.HOSPITAL]: { wall: '#f2f2f0', roof: '#cfd6da', trim: '#a8b0b4', accent: '#e2655c' },
  [KIND.PARK_FACILITY]: { wall: '#e8d9bd', roof: '#b57f4e', trim: '#8a5f39', accent: '#5aa055' },
  [KIND.FARMHOUSE]: { wall: '#e4dcc6', roof: '#9aa88c', trim: '#7d8a72', accent: '#c9d8e0' },
};

// ── 실내 ────────────────────────────────────────────────────────────────
export const INTERIOR_COLOR = {
  [IN.VOID]: '#1c1a21',
  [IN.FLOOR]: '#e2d6bf',
  [IN.WALL]: '#a8927a',
  [IN.EXIT]: '#8fd08a',
  [IN.STAIR_UP]: '#c9b892',
  [IN.STAIR_DOWN]: '#a89878',
  [IN.ELEVATOR]: '#9fb6c9',
  [IN.COUNTER]: '#c08b5c',
  [IN.SHELF]: '#b08a62',
  [IN.DESK]: '#c2a077',
  [IN.PLANT]: '#5aa055',
  [IN.RUG]: '#d9a2a2',
  [IN.WINDOW]: '#a8d8ea',
  [IN.BED]: '#dcd2e2',
  [IN.TABLE]: '#cba97e',
  [IN.MACHINE]: '#93a2ac',
};

// ── 인물 ────────────────────────────────────────────────────────────────
export const PLAYER_COLOR = {
  skin: '#f2cfa8', hair: '#3c2f2a', top: '#e2705f', bottom: '#4a5a78',
  shoe: '#2f2f38', outline: '#2a2028',
};

// NPC 옷 색 후보 — 시드로 골라 쓴다
export const NPC_COLORS = {
  hair: ['#3c2f2a', '#5a4030', '#20202a', '#7a5a3a', '#a06a4a'],
  top: ['#8fb8d8', '#e2a0b8', '#8fc48a', '#f2c14e', '#c8a8ee', '#e88a6a', '#dfe6ec'],
  bottom: ['#4a5a78', '#5a5a62', '#7a6a52', '#3c4a5a'],
};

// ── UI ─────────────────────────────────────────────────────────────────
export const UI_COLOR = {
  panel: 'rgba(28, 26, 33, 0.82)',
  panelEdge: 'rgba(255, 255, 255, 0.16)',
  text: '#f4f1ea',
  textDim: '#b9b3a8',
  accent: '#f2c14e',
  label: '#fffdf6',
  labelShadow: 'rgba(20, 18, 24, 0.85)',
  labelLandmark: '#ffe9a8',
  minimapEdge: 'rgba(255,255,255,0.25)',
  player: '#e2705f',
  sky: '#9fd0e8',
};

// ── 색 계산 도구 ────────────────────────────────────────────────────────
export function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function rgbToHex([r, g, b]) {
  const c = (n) => Math.max(0, Math.min(255, Math.round(n)));
  return '#' + ((1 << 24) + (c(r) << 16) + (c(g) << 8) + c(b)).toString(16).slice(1);
}

// amount > 0 밝게, < 0 어둡게
export function shade(hex, amount) {
  const [r, g, b] = hexToRgb(hex);
  const t = amount > 0 ? 255 : 0;
  const p = Math.abs(amount);
  return rgbToHex([r + (t - r) * p, g + (t - g) * p, b + (t - b) * p]);
}

export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}
