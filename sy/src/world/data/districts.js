// 블록 채움 규칙. 폴리곤 하나가 "이 구역은 이런 식으로 채워진다"를 뜻한다.
// world/blocks.js 가 이 규칙을 읽어 이면도로 격자와 건물을 결정적으로 만들어 낸다.
//
// 스키마
//   kind    apartment 아파트단지 · commercial 상가 · house 단독/빌라
//           · industrial 공장 · rural 농가
//   block   블록 한 칸 크기 (미터). 블록 격자는 타일 축(동서남북)에 맞춘다 —
//           이름 있는 도로만 실제 방위각대로 비스듬히 지나간다.
//   street  블록 사이 도로 등급 (config.js ROAD_CLASS 키)
//   fill    종류별 세부 규칙. 크기는 전부 미터.

export const DISTRICTS = [
  // ── 구래동 아파트 단지 ──────────────────────────────────────────
  {
    id: 'hosu-maeul', name: '호수마을', kind: 'apartment',
    block: { w: 130, h: 105 }, street: 'local',
    fill: { bw: 62, bh: 15, gap: 26, floors: [15, 25], start: 101 },
    path: [[126.6300, 37.6484], [126.6392, 37.6478], [126.6388, 37.6444],
      [126.6300, 37.6450]],
  },
  {
    id: 'hangaram-maeul', name: '한가람마을', kind: 'apartment',
    block: { w: 130, h: 105 }, street: 'local',
    fill: { bw: 58, bh: 15, gap: 24, floors: [12, 22], start: 101 },
    path: [[126.6188, 37.6522], [126.6282, 37.6526], [126.6280, 37.6486],
      [126.6190, 37.6482]],
  },
  {
    id: 'chungsong-maeul', name: '청송마을', kind: 'apartment',
    block: { w: 125, h: 100 }, street: 'local',
    fill: { bw: 56, bh: 15, gap: 24, floors: [10, 20], start: 101 },
    path: [[126.6156, 37.6480], [126.6246, 37.6478], [126.6242, 37.6430],
      [126.6158, 37.6434]],
  },
  {
    id: 'eunyeoul-maeul', name: '은여울마을', kind: 'apartment',
    block: { w: 125, h: 100 }, street: 'local',
    fill: { bw: 58, bh: 15, gap: 25, floors: [12, 24], start: 101 },
    path: [[126.6330, 37.6406], [126.6422, 37.6398], [126.6416, 37.6358],
      [126.6328, 37.6366]],
  },
  {
    id: 'solteo-maeul', name: '솔터마을', kind: 'apartment',
    block: { w: 130, h: 100 }, street: 'local',
    fill: { bw: 60, bh: 15, gap: 26, floors: [14, 26], start: 101 },
    path: [[126.6428, 37.6452], [126.6508, 37.6444], [126.6502, 37.6396],
      [126.6426, 37.6404]],
  },

  // ── 상가 ───────────────────────────────────────────────────────
  {
    id: 'gurae-rodeo', name: '구래역 로데오거리', kind: 'commercial',
    block: { w: 80, h: 62 }, street: 'alley',
    fill: { depth: 14, minW: 8, maxW: 16, floors: [2, 7] },
    path: [[126.6246, 37.6434], [126.6332, 37.6428], [126.6328, 37.6394],
      [126.6244, 37.6400]],
  },
  {
    id: 'gurae-north', name: '구래역 북측상가', kind: 'commercial',
    block: { w: 78, h: 60 }, street: 'alley',
    fill: { depth: 13, minW: 8, maxW: 15, floors: [2, 5] },
    path: [[126.6250, 37.6472], [126.6302, 37.6470], [126.6300, 37.6446],
      [126.6248, 37.6448]],
  },
  {
    id: 'masan-sanggwon', name: '마산역 상가', kind: 'commercial',
    block: { w: 78, h: 60 }, street: 'alley',
    fill: { depth: 13, minW: 8, maxW: 15, floors: [2, 6] },
    path: [[126.6368, 37.6414], [126.6434, 37.6408], [126.6430, 37.6378],
      [126.6366, 37.6384]],
  },
  {
    id: 'yanggok-sijang', name: '양곡 시가지 상가', kind: 'commercial',
    block: { w: 76, h: 58 }, street: 'alley',
    fill: { depth: 12, minW: 7, maxW: 14, floors: [2, 4] },
    path: [[126.6028, 37.6568], [126.6088, 37.6564], [126.6084, 37.6534],
      [126.6026, 37.6538]],
  },

  // ── 단독·빌라 ──────────────────────────────────────────────────
  {
    id: 'yanggok-house', name: '양곡 주택가', kind: 'house',
    block: { w: 62, h: 52 }, street: 'alley',
    fill: { size: 15, jitter: 4, floors: [2, 5] },
    path: [[126.5992, 37.6602], [126.6112, 37.6594], [126.6106, 37.6520],
      [126.5996, 37.6526]],
  },
  {
    id: 'gurae-house', name: '구래 단독주택지', kind: 'house',
    block: { w: 60, h: 50 }, street: 'alley',
    fill: { size: 14, jitter: 4, floors: [2, 4] },
    path: [[126.6160, 37.6422], [126.6252, 37.6416], [126.6248, 37.6380],
      [126.6158, 37.6386]],
  },

  // ── 공단 ───────────────────────────────────────────────────────
  {
    id: 'yangchon-a', name: '양촌산단 A블록', kind: 'industrial',
    block: { w: 210, h: 150 }, street: 'local',
    fill: { minW: 60, maxW: 130, minH: 40, maxH: 78, floors: [1, 3] },
    path: [[126.5876, 37.6462], [126.6082, 37.6450], [126.6078, 37.6392],
      [126.5878, 37.6402]],
  },
  {
    id: 'yangchon-b', name: '양촌산단 B블록', kind: 'industrial',
    block: { w: 200, h: 140 }, street: 'local',
    fill: { minW: 55, maxW: 120, minH: 38, maxH: 70, floors: [1, 3] },
    path: [[126.5880, 37.6384], [126.6084, 37.6372], [126.6082, 37.6336],
      [126.5882, 37.6348]],
  },
  {
    id: 'hagun', name: '학운산업단지', kind: 'industrial',
    block: { w: 205, h: 150 }, street: 'local',
    fill: { minW: 58, maxW: 125, minH: 40, maxH: 74, floors: [1, 3] },
    path: [[126.6000, 37.6302], [126.6192, 37.6292], [126.6184, 37.6222],
      [126.5994, 37.6230]],
  },

  // ── 농촌 마을 ──────────────────────────────────────────────────
  {
    id: 'daepo-ri', name: '대포리', kind: 'rural',
    block: { w: 150, h: 130 }, street: 'alley',
    fill: { size: 16, jitter: 8, floors: [1, 2], rate: 0.55 },
    path: [[126.6140, 37.6302], [126.6224, 37.6296], [126.6218, 37.6258],
      [126.6136, 37.6264]],
  },
  {
    id: 'nusan-ri', name: '누산리', kind: 'rural',
    block: { w: 150, h: 130 }, street: 'alley',
    fill: { size: 16, jitter: 8, floors: [1, 2], rate: 0.5 },
    path: [[126.6300, 37.6352], [126.6392, 37.6346], [126.6388, 37.6308],
      [126.6296, 37.6314]],
  },
  {
    id: 'heungsin-ri', name: '흥신리', kind: 'rural',
    block: { w: 150, h: 130 }, street: 'alley',
    fill: { size: 16, jitter: 8, floors: [1, 2], rate: 0.5 },
    path: [[126.5900, 37.6300], [126.5990, 37.6294], [126.5986, 37.6256],
      [126.5896, 37.6262]],
  },
  {
    id: 'hangaram-2', name: '한가람마을', kind: 'apartment',
    block: { w: 128, h: 102 }, street: 'local',
    fill: { bw: 58, bh: 15, gap: 25, floors: [13, 23], start: 201 },
    path: [[126.6290, 37.6550], [126.6392, 37.6540], [126.6386, 37.6488],
      [126.6288, 37.6494]],
  },
  {
    id: 'naru-maeul', name: '나루마을', kind: 'apartment',
    block: { w: 125, h: 100 }, street: 'local',
    fill: { bw: 56, bh: 15, gap: 24, floors: [11, 21], start: 101 },
    path: [[126.6356, 37.6472], [126.6428, 37.6464], [126.6424, 37.6418],
      [126.6352, 37.6426]],
  },
  {
    id: 'gurae-north-house', name: '구래 북측 주택가', kind: 'house',
    block: { w: 60, h: 50 }, street: 'alley',
    fill: { size: 14, jitter: 4, floors: [2, 5] },
    path: [[126.6182, 37.6558], [126.6288, 37.6554], [126.6286, 37.6524],
      [126.6186, 37.6528]],
  },
  {
    id: 'masan-house', name: '마산 남측 주택가', kind: 'house',
    block: { w: 60, h: 50 }, street: 'alley',
    fill: { size: 14, jitter: 4, floors: [2, 4] },
    path: [[126.6390, 37.6362], [126.6472, 37.6354], [126.6468, 37.6322],
      [126.6386, 37.6330]],
  },
  {
    id: 'gurae-station-shops', name: '구래역 앞 상가', kind: 'commercial',
    block: { w: 78, h: 60 }, street: 'alley',
    fill: { depth: 12, minW: 8, maxW: 15, floors: [2, 6] },
    path: [[126.6250, 37.6450], [126.6334, 37.6444], [126.6330, 37.6428],
      [126.6248, 37.6434]],
  },
];
