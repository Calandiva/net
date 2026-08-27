// 지면 구역. 좌표는 [경도, 위도], 배열 뒤쪽이 앞쪽을 덮어쓴다.
// kind 는 render/palette.js 와 world/map.js 가 함께 해석한다.
//   city 시가지 · field 논밭 · industrial 공단 · park 공원 · forest 산 · water 물 · sand 하천변

import { GROUND } from '../../config.js';

export const REGIONS = [
  {
    id: 'gahyeon', name: '가현산', kind: 'forest', ground: GROUND.GRASS,
    propRate: 0.42, label: true,
    path: [[126.6130, 37.6700], [126.6560, 37.6700], [126.6540, 37.6600],
      [126.6350, 37.6558], [126.6180, 37.6600], [126.6120, 37.6655]],
  },
  {
    id: 'gurae', name: '구래동', kind: 'city', ground: GROUND.GRASS, label: true,
    path: [[126.6180, 37.6545], [126.6360, 37.6558], [126.6430, 37.6500],
      [126.6395, 37.6400], [126.6255, 37.6355], [126.6155, 37.6415],
      [126.6150, 37.6500]],
  },
  {
    id: 'masan', name: '마산동', kind: 'city', ground: GROUND.GRASS, label: true,
    path: [[126.6360, 37.6472], [126.6512, 37.6455], [126.6520, 37.6350],
      [126.6390, 37.6318], [126.6318, 37.6392]],
  },
  {
    id: 'yanggok', name: '양촌읍 양곡', kind: 'city', ground: GROUND.GRASS, label: true,
    path: [[126.5980, 37.6622], [126.6122, 37.6610], [126.6168, 37.6520],
      [126.6150, 37.6455], [126.5985, 37.6470]],
  },
  {
    id: 'yangchon-ind', name: '김포양촌일반산업단지', kind: 'industrial',
    ground: GROUND.YARD, label: true,
    path: [[126.5860, 37.6472], [126.6092, 37.6456], [126.6096, 37.6330],
      [126.5865, 37.6344]],
  },
  {
    id: 'hagun-ind', name: '학운산업단지', kind: 'industrial',
    ground: GROUND.YARD, label: true,
    path: [[126.5990, 37.6312], [126.6202, 37.6300], [126.6192, 37.6200],
      [126.5980, 37.6212]],
  },
  {
    id: 'gurae-park', name: '구래근린공원', kind: 'park', ground: GROUND.GRASS,
    propRate: 0.16, label: true,
    path: [[126.6252, 37.6486], [126.6312, 37.6482], [126.6314, 37.6438],
      [126.6254, 37.6442]],
  },
  {
    id: 'hosu-park', name: '한강신도시 호수공원', kind: 'park', ground: GROUND.GRASS,
    propRate: 0.14, label: true,
    path: [[126.6318, 37.6458], [126.6428, 37.6450], [126.6432, 37.6400],
      [126.6322, 37.6408]],
  },
  {
    id: 'masan-park', name: '마산근린공원', kind: 'park', ground: GROUND.GRASS,
    propRate: 0.18, label: true,
    path: [[126.6432, 37.6392], [126.6492, 37.6388], [126.6490, 37.6350],
      [126.6430, 37.6354]],
  },
  {
    id: 'hosu', name: '호수', kind: 'water', ground: GROUND.WATER, label: true,
    path: [[126.6344, 37.6442], [126.6406, 37.6436], [126.6409, 37.6414],
      [126.6347, 37.6420]],
  },
  {
    id: 'yangchon-res', name: '양촌저수지', kind: 'water', ground: GROUND.WATER,
    label: true,
    path: [[126.6038, 37.6392], [126.6092, 37.6388], [126.6090, 37.6358],
      [126.6036, 37.6362]],
  },
];

// 하천·수로. 폴리라인 + 폭(미터). 양쪽에 모래톱이 생긴다.
export const WATERWAYS = [
  {
    name: '나진포천', width: 26,
    path: [[126.5820, 37.6268], [126.6050, 37.6238], [126.6250, 37.6218],
      [126.6450, 37.6232], [126.6560, 37.6252]],
  },
  {
    name: '용수로', width: 8,
    path: [[126.6100, 37.6330], [126.6120, 37.6270], [126.6180, 37.6230]],
  },
  {
    name: '용수로', width: 8,
    path: [[126.6250, 37.6350], [126.6270, 37.6280], [126.6300, 37.6230]],
  },
  {
    name: '양촌천', width: 12,
    path: [[126.6060, 37.6480], [126.6040, 37.6400], [126.6060, 37.6330],
      [126.6110, 37.6270]],
  },
];
