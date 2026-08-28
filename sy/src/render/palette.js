// 색. 여기 값만 바꾸면 게임 전체 톤이 바뀐다.
// 도트 톤은 채도를 조금 낮추고 명도 차이로 구분한다 — 눈이 덜 피로하다.

import { GROUND, PROP, KIND, IN } from '../config.js';

// ── 지면 ────────────────────────────────────────────────────────────────
export const GROUND_COLOR = {
  // 실제 항공사진 톤에 맞춘 값들. 김포 들녘은 여름에 녹색이고,
  // 도로는 진회색, 공단 마당은 콘크리트 회색, 수로는 탁한 청록이다.
  [GROUND.FIELD]: '#a6bc6c',      // 논
  [GROUND.GRASS]: '#7fa85a',
  [GROUND.DIRT]: '#b79f74',
  [GROUND.ROAD]: '#5a5c62',       // 아스팔트
  [GROUND.SIDEWALK]: '#c2bcb2',   // 보도블럭
  [GROUND.CROSSWALK]: '#d6d2c8',
  [GROUND.PLAZA]: '#cdc6b9',
  [GROUND.WATER]: '#5a8ea0',      // 수로 · 낚시터
  [GROUND.SAND]: '#d6c9a2',
  [GROUND.PARKING]: '#8f9098',
  [GROUND.YARD]: '#a8a49e',       // 공단 포장 마당
  [GROUND.FLOOR]: '#b0aaa0',
  [GROUND.TRACK]: '#c49a72',      // 산책로 · 등산로
  [GROUND.ROAD_LINE]: '#5a5c62',
  [GROUND.ASPHALT]: '#5f6167',   // 상가 마당 — 차도보다 아주 살짝 밝다
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
  [GROUND.ASPHALT]: 0.05,
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
  // 한국 도시 항공사진의 색을 따라간다.
  // 아파트는 베이지 벽에 녹회색 옥상 방수, 공장은 파란 샌드위치 패널 지붕,
  // 상가는 회색 옥상에 색색의 간판띠.
  [KIND.APARTMENT]: { wall: '#eae4d8', roof: '#9aa79b', trim: '#8a978c', accent: '#9fc0dd' },
  [KIND.HOUSE]: { wall: '#ece3d2', roof: '#b0705c', trim: '#8f5a49', accent: '#9fc0dd' },
  [KIND.SHOP]: { wall: '#e8e2d6', roof: '#b5b1a8', trim: '#8f8b83', accent: '#d4574a' },
  [KIND.TOWER]: { wall: '#dfe5ea', roof: '#9aa4ac', trim: '#7d868e', accent: '#7fb0d8' },
  [KIND.MART]: { wall: '#f0e6e0', roof: '#b8b4ac', trim: '#94908a', accent: '#e2b93b' },
  [KIND.SCHOOL]: { wall: '#efe6cd', roof: '#b2ab97', trim: '#8f8a78', accent: '#8fb87f' },
  [KIND.PUBLIC]: { wall: '#e6ecf0', roof: '#9fb0bd', trim: '#7f8f9c', accent: '#5f8fc0' },
  [KIND.STATION]: { wall: '#e2eaf0', roof: '#8fa8bd', trim: '#6f8798', accent: '#e2b93b' },
  [KIND.FACTORY]: { wall: '#d6d9dc', roof: '#4f76a8', trim: '#3f5f8a', accent: '#c8ccd0' },
  [KIND.WAREHOUSE]: { wall: '#d2d6d8', roof: '#8fa8b8', trim: '#6f8797', accent: '#b8c4cc' },
  [KIND.CHURCH]: { wall: '#efe8f2', roof: '#a89fb8', trim: '#8a809c', accent: '#d8c46a' },
  [KIND.HOSPITAL]: { wall: '#f2f2f0', roof: '#c4ccd0', trim: '#a0a8ac', accent: '#e2655c' },
  [KIND.PARK_FACILITY]: { wall: '#e4d6bc', roof: '#a8763f', trim: '#7f5730', accent: '#5aa055' },
  [KIND.FARMHOUSE]: { wall: '#ded6c2', roof: '#7f9a86', trim: '#63796b', accent: '#c8d8e0' },
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
  [IN.CAR]: '#7f8790',
  [IN.PILLAR]: '#9a938a',
  [IN.SEAT]: '#8f4a4a',
  [IN.SCREEN]: '#d8d8d0',
  [IN.CART]: '#b8bcc2',
  [IN.DOOR]: '#8a6a45',
  [IN.DOOR_OPEN]: '#8a6a45',
  [IN.LOCKER]: '#7f8f9c',
  [IN.SMOKE]: '#8c8c94',
  [IN.BOX]: '#b98f5c',
  [IN.PUDDLE]: '#7fa8bd',
  [IN.CONE]: '#e2703a',
  [IN.SOFA]: '#7f6f8c',
  [IN.FRIDGE]: '#dfe4e8',
  [IN.SINK]: '#b8c4cc',
  [IN.BOOKS]: '#8a6a52',
  [IN.BOARD]: '#3f5f4a',
  [IN.VENDING]: '#c05a4a',
  [IN.RACK]: '#a89a8a',
  [IN.BENCH]: '#b08a5c',
  [IN.MAT]: '#7f8a72',
};

// 건물 분위기별 바닥·벽 색. 같은 구조라도 색이 달라 보이게.
export const THEME_COLOR = {
  home:     { floor: '#e2d6bf', wall: '#a8927a' },   // 장판과 벽지
  office:   { floor: '#cfd2d6', wall: '#8f959c' },   // 타일 카펫
  school:   { floor: '#d8d2b8', wall: '#9aa88f' },   // 리놀륨
  mart:     { floor: '#e8e4dc', wall: '#b8b2a6' },   // 밝은 타일
  factory:  { floor: '#a8a49c', wall: '#7c7876' },   // 콘크리트
  hospital: { floor: '#dfe6e8', wall: '#a8bcc2' },
  station:  { floor: '#c8c4bc', wall: '#8a8f96' },   // 석재
  church:   { floor: '#d8c8a8', wall: '#9a8464' },
  park:     { floor: '#d2cdbc', wall: '#94957f' },
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

// ── 지도 ────────────────────────────────────────────────────────────────
// 미니맵·전체지도는 실제 지형색 대신 지도 기호색을 쓴다. 그래야 시가지와 논이 구분된다.
export const MAP_KIND = {
  FIELD: 0, CITY: 1, INDUSTRIAL: 2, PARK: 3, FOREST: 4, WATER: 5, ROAD: 6, MAIN_ROAD: 7,
};
export const MAP_COLOR = {
  [MAP_KIND.FIELD]: '#cfd8a8',       // 논밭
  [MAP_KIND.CITY]: '#e6dfd2',        // 시가지
  [MAP_KIND.INDUSTRIAL]: '#c9cdd2',  // 산업단지
  [MAP_KIND.PARK]: '#a8d49a',        // 공원
  [MAP_KIND.FOREST]: '#7fae74',      // 산
  [MAP_KIND.WATER]: '#8fc0d8',       // 물
  [MAP_KIND.ROAD]: '#a8a49c',        // 이면도로
  [MAP_KIND.MAIN_ROAD]: '#f2c14e',   // 간선도로
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
