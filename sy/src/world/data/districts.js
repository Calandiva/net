// 블록 채움 규칙. 폴리곤 하나가 "이 구역은 이런 식으로 채워진다"를 뜻한다.
// world/blocks.js 가 이 규칙을 읽어 이면도로 격자와 건물을 결정적으로 만들어 낸다.
//
// 이름은 전부 실제 단지·상권·산업단지 이름이다. 아파트 동 번호는 101동부터 매긴다.
// 폴리곤은 실제 위치에 맞춘 근사치이고, 단지 경계선까지 같지는 않다.
//
// 스키마
//   kind    apartment 아파트단지 · commercial 상가 · house 단독/빌라
//           · industrial 공장 · rural 농가
//   block   블록 한 칸 크기 (미터). 블록 격자는 타일 축(동서남북)에 맞춘다 —
//           이름 있는 도로만 실제 방위각대로 비스듬히 지나간다.
//   street  블록 사이 도로 등급 (config.js ROAD_CLASS 키)
//   fill    종류별 세부 규칙. 크기는 전부 미터.

export const DISTRICTS = [
  // ── 구래동 아파트 ───────────────────────────────────────────────
  {
    // 2011년 입주 · 26층 · 1,058세대 · 김포한강5로 417
    id: 'hangaram-umiline', name: '한가람마을 우미린', kind: 'apartment',
    block: { w: 150, h: 112 }, street: 'local',
    fill: { bw: 55, bh: 14, gap: 22, floors: [24, 26], start: 101 },
    path: [[126.6313, 37.6452], [126.6349, 37.6448], [126.6347, 37.6428], [126.6311, 37.6432]],
  },
  {
    // 2018년 입주 · 1,230세대
    id: 'hangang-ipark', name: '김포한강아이파크', kind: 'apartment',
    block: { w: 150, h: 112 }, street: 'local',
    fill: { bw: 55, bh: 14, gap: 22, floors: [20, 29], start: 101 },
    path: [[126.6231, 37.6474], [126.6267, 37.6470], [126.6265, 37.6450], [126.6229, 37.6454]],
  },
  {
    // 2017년 입주 · 1,510세대 · 김포한강8로 409
    id: 'prugio3', name: '한강신도시 3차 푸르지오', kind: 'apartment',
    block: { w: 150, h: 112 }, street: 'local',
    fill: { bw: 55, bh: 14, gap: 22, floors: [15, 25], start: 301 },
    path: [[126.6343, 37.6428], [126.6379, 37.6424], [126.6377, 37.6404], [126.6341, 37.6408]],
  },
  {
    // 2018년 입주
    id: 'yuborah4', name: '한강신도시 4차 반도유보라', kind: 'apartment',
    block: { w: 150, h: 112 }, street: 'local',
    fill: { bw: 55, bh: 14, gap: 22, floors: [15, 25], start: 401 },
    path: [[126.6188, 37.6444], [126.6224, 37.6440], [126.6222, 37.6420], [126.6186, 37.6424]],
  },
  {
    // 2013년 입주
    id: 'epyeonhansesang-hosu', name: 'e편한세상 호수마을', kind: 'apartment',
    block: { w: 150, h: 112 }, street: 'local',
    fill: { bw: 55, bh: 14, gap: 22, floors: [12, 22], start: 101 },
    path: [[126.6251, 37.6394], [126.6287, 37.6390], [126.6285, 37.6370], [126.6249, 37.6374]],
  },
  {
    // 1,770세대 · 김포한강9로
    id: 'yemiji', name: '김포한강예미지', kind: 'apartment',
    block: { w: 150, h: 112 }, street: 'local',
    fill: { bw: 55, bh: 14, gap: 22, floors: [15, 29], start: 101 },
    path: [[126.6270, 37.6512], [126.6308, 37.6508], [126.6306, 37.6486], [126.6268, 37.6490]],
  },
  {
    // 2014년 입주 · LH
    id: 'nabi-lh3', name: '나비마을 김포한강3단지', kind: 'apartment',
    block: { w: 150, h: 112 }, street: 'local',
    fill: { bw: 55, bh: 14, gap: 22, floors: [12, 20], start: 301 },
    path: [[126.6182, 37.6508], [126.6218, 37.6504], [126.6216, 37.6484], [126.6180, 37.6488]],
  },
  {
    id: 'moaelga2', name: '김포한강신도시 모아엘가 2차', kind: 'apartment',
    block: { w: 150, h: 112 }, street: 'local',
    fill: { bw: 55, bh: 14, gap: 22, floors: [15, 25], start: 201 },
    path: [[126.6331, 37.6390], [126.6367, 37.6386], [126.6365, 37.6366], [126.6329, 37.6370]],
  },

  // ── 마산동 아파트 ───────────────────────────────────────────────
  {
    // 2020년 입주 · 1,021세대
    id: 'dongil1', name: '김포한강동일스위트 더파크뷰 1단지', kind: 'apartment',
    block: { w: 150, h: 112 }, street: 'local',
    fill: { bw: 55, bh: 14, gap: 22, floors: [20, 29], start: 101 },
    path: [[126.6418, 37.6422], [126.6454, 37.6418], [126.6452, 37.6398], [126.6416, 37.6402]],
  },
  {
    id: 'dongil2', name: '김포한강동일스위트 더파크뷰 2단지', kind: 'apartment',
    block: { w: 150, h: 112 }, street: 'local',
    fill: { bw: 55, bh: 14, gap: 22, floors: [20, 29], start: 201 },
    path: [[126.6418, 37.6377], [126.6454, 37.6373], [126.6452, 37.6353], [126.6416, 37.6357]],
  },
  {
    id: 'hangang-hillstate', name: '한강힐스테이트', kind: 'apartment',
    block: { w: 150, h: 112 }, street: 'local',
    fill: { bw: 55, bh: 14, gap: 22, floors: [15, 25], start: 101 },
    path: [[126.6338, 37.6354], [126.6374, 37.6350], [126.6372, 37.6330], [126.6336, 37.6334]],
  },
  {
    id: 'jayeonand-desiang', name: '김포양촌자연앤데시앙', kind: 'apartment',
    block: { w: 150, h: 112 }, street: 'local',
    fill: { bw: 55, bh: 14, gap: 22, floors: [15, 25], start: 101 },
    path: [[126.6055, 37.6478], [126.6091, 37.6474], [126.6089, 37.6454], [126.6053, 37.6458]],
  },

  // ── 상가 ───────────────────────────────────────────────────────
  {
    // 한강신도시에서 가장 큰 상권. 구래역 남쪽 C지구.
    id: 'gurae-center', name: '구래동 중심상가', kind: 'commercial',
    block: { w: 82, h: 64 }, street: 'alley',
    fill: { depth: 13, minW: 8, maxW: 16, floors: [3, 8] },
    path: [[126.6262, 37.6444], [126.6314, 37.6438], [126.6310, 37.6410], [126.6258, 37.6416]],
  },
  {
    // 호수공원에서 구래역을 지나 중심상가까지 이어지는 1.4km 축
    id: 'gurae-culture', name: '구래동 문화의 거리', kind: 'commercial',
    block: { w: 78, h: 60 }, street: 'alley',
    fill: { depth: 12, minW: 8, maxW: 15, floors: [2, 6] },
    path: [[126.6270, 37.6472], [126.6304, 37.6468], [126.6302, 37.6454], [126.6268, 37.6458]],
  },
  {
    id: 'masan-sanggwon', name: '마산역 상가', kind: 'commercial',
    block: { w: 78, h: 60 }, street: 'alley',
    fill: { depth: 12, minW: 8, maxW: 15, floors: [2, 6] },
    path: [[126.6371, 37.6406], [126.6409, 37.6402], [126.6407, 37.6386], [126.6369, 37.6390]],
  },
  {
    id: 'yanggok-sanggwon', name: '양곡 시가지', kind: 'commercial',
    block: { w: 76, h: 58 }, street: 'alley',
    fill: { depth: 12, minW: 7, maxW: 14, floors: [2, 5] },
    path: [[126.6005, 37.6584], [126.6055, 37.6578], [126.6051, 37.6558], [126.6001, 37.6564]],
  },

  // ── 단독·빌라 ──────────────────────────────────────────────────
  {
    id: 'yanggok-house', name: '양곡 주택가', kind: 'house',
    block: { w: 62, h: 52 }, street: 'alley',
    fill: { size: 15, jitter: 4, floors: [2, 5] },
    path: [[126.5958, 37.6634], [126.6116, 37.6616], [126.6110, 37.6542],
      [126.5964, 37.6556]],
  },
  {
    id: 'yuhyeon-house', name: '유현리 마을', kind: 'house',
    block: { w: 62, h: 52 }, street: 'alley',
    fill: { size: 14, jitter: 4, floors: [1, 3] },
    path: [[126.6066, 37.6516], [126.6162, 37.6504], [126.6156, 37.6462],
      [126.6060, 37.6474]],
  },
  {
    // 마산동 타운하우스 단지
    id: 'xi-thevillage', name: '자이더빌리지', kind: 'house',
    block: { w: 60, h: 50 }, street: 'alley',
    fill: { size: 13, jitter: 3, floors: [2, 3] },
    path: [[126.6444, 37.6350], [126.6484, 37.6345], [126.6481, 37.6324], [126.6441, 37.6329]],
  },

  // ── 산업단지 ───────────────────────────────────────────────────
  {
    id: 'yangchon-ind-a', name: '양촌일반산업단지', kind: 'industrial',
    block: { w: 210, h: 150 }, street: 'local',
    fill: { minW: 60, maxW: 130, minH: 40, maxH: 78, floors: [1, 3] },
    path: [[126.5870, 37.6448], [126.6038, 37.6448], [126.6038, 37.6404],
      [126.5870, 37.6404]],
  },
  {
    id: 'yangchon-ind-b', name: '양촌일반산업단지', kind: 'industrial',
    block: { w: 205, h: 145 }, street: 'local',
    fill: { minW: 58, maxW: 125, minH: 40, maxH: 74, floors: [1, 3] },
    path: [[126.5870, 37.6398], [126.6038, 37.6398], [126.6038, 37.6360],
      [126.5870, 37.6360]],
  },
  {
    id: 'hagun2', name: '학운2일반산업단지', kind: 'industrial',
    block: { w: 200, h: 140 }, street: 'local',
    fill: { minW: 55, maxW: 118, minH: 38, maxH: 70, floors: [1, 3] },
    path: [[126.6054, 37.6418], [126.6148, 37.6418], [126.6148, 37.6364],
      [126.6054, 37.6364]],
  },
  {
    id: 'hagun5', name: '학운5일반산업단지', kind: 'industrial',
    block: { w: 205, h: 145 }, street: 'local',
    fill: { minW: 58, maxW: 125, minH: 40, maxH: 74, floors: [1, 3] },
    path: [[126.6054, 37.6326], [126.6165, 37.6326], [126.6165, 37.6260],
      [126.6054, 37.6260]],
  },
  {
    id: 'hagun3', name: '학운3일반산업단지', kind: 'industrial',
    block: { w: 205, h: 145 }, street: 'local',
    fill: { minW: 58, maxW: 125, minH: 40, maxH: 74, floors: [1, 3] },
    path: [[126.5914, 37.6326], [126.6031, 37.6326], [126.6031, 37.6256],
      [126.5914, 37.6256]],
  },
  {
    id: 'hagun7', name: '학운7일반산업단지', kind: 'industrial',
    block: { w: 160, h: 120 }, street: 'local',
    fill: { minW: 45, maxW: 90, minH: 32, maxH: 55, floors: [1, 2] },
    path: [[126.5868, 37.6491], [126.5919, 37.6491], [126.5919, 37.6465],
      [126.5868, 37.6465]],
  },

  // ── 농촌 마을 ──────────────────────────────────────────────────
  {
    id: 'hagun-ri', name: '학운리', kind: 'rural',
    block: { w: 150, h: 130 }, street: 'alley',
    fill: { size: 16, jitter: 8, floors: [1, 2], rate: 0.5 },
    path: [[126.5900, 37.6220], [126.6000, 37.6212], [126.5994, 37.6172],
      [126.5894, 37.6180]],
  },
  {
    id: 'daepo-ri', name: '대포리', kind: 'rural',
    block: { w: 150, h: 130 }, street: 'alley',
    fill: { size: 16, jitter: 8, floors: [1, 2], rate: 0.55 },
    path: [[126.6260, 37.6320], [126.6360, 37.6310], [126.6354, 37.6270],
      [126.6254, 37.6280]],
  },
  {
    id: 'nusan-ri', name: '누산리', kind: 'rural',
    block: { w: 150, h: 130 }, street: 'alley',
    fill: { size: 16, jitter: 8, floors: [1, 2], rate: 0.5 },
    path: [[126.6440, 37.6270], [126.6540, 37.6262], [126.6534, 37.6222],
      [126.6434, 37.6230]],
  },
  {
    id: 'gurae-neighborhood', name: '구래동 근린생활시설', kind: 'commercial',
    block: { w: 80, h: 62 }, street: 'alley',
    fill: { depth: 12, minW: 8, maxW: 15, floors: [2, 5] },
    path: [[126.6206, 37.6412], [126.6262, 37.6406], [126.6258, 37.6380],
      [126.6202, 37.6386]],
  },
  {
    id: 'masan-neighborhood', name: '마산동 근린생활시설', kind: 'commercial',
    block: { w: 80, h: 62 }, street: 'alley',
    fill: { depth: 12, minW: 8, maxW: 15, floors: [2, 5] },
    path: [[126.6404, 37.6452], [126.6462, 37.6446], [126.6458, 37.6424],
      [126.6400, 37.6430]],
  },
  {
    id: 'gurae-office', name: '구래동 오피스텔', kind: 'commercial',
    block: { w: 78, h: 60 }, street: 'alley',
    fill: { depth: 14, minW: 10, maxW: 18, floors: [8, 15] },
    path: [[126.6238, 37.6444], [126.6262, 37.6441], [126.6260, 37.6424],
      [126.6236, 37.6427]],
  },
];
