// 〈구래〉 — 모든 조정 가능한 값은 이 파일에 모은다. 다른 파일에 숫자를 직접 적지 않는다.

// ── 시드 ────────────────────────────────────────────────────────────────
// 절차적 생성(스프라이트, 지면 변주, 건물 이름, 실내 배치)은 전부 이 시드에서 파생된다.
// 같은 시드면 언제나 같은 결과가 나온다.
export const SEED = 'gurae-2026';

// ── 좌표계 ──────────────────────────────────────────────────────────────
// 실제 위경도(WGS84)를 타일 좌표로 옮기는 기준. 지도 데이터를 갈아끼울 때 여기만 바꾼다.
export const GEO = {
  // 김포시 구래동 ~ 양촌읍(양곡·학운산업단지)을 감싸는 영역
  south: 37.6120,
  north: 37.6660,
  west: 126.5820,
  east: 126.6560,
  // 타일 하나가 실제 몇 미터인가
  metersPerTile: 2.5,
  // 위도 1도 / 경도 1도의 미터 환산 (중위도 근사)
  metersPerLat: 110990,
  metersPerLon: 88150, // 위도 37.64° 기준
};

// ── 타일 / 청크 ─────────────────────────────────────────────────────────
export const TILE = {
  size: 16,      // 타일 한 변의 픽셀 수
  chunk: 32,     // 청크 한 변의 타일 수
  chunkCacheMax: 40, // 캔버스로 구워 둘 청크 최대 개수 (메모리 상한)
};

// ── 지면 종류 ───────────────────────────────────────────────────────────
// 값은 청크 배열에 그대로 들어가므로 0~255 안에서 유지한다.
export const GROUND = {
  FIELD: 0,      // 논밭
  GRASS: 1,      // 풀밭
  DIRT: 2,       // 흙길
  ROAD: 3,       // 차도
  SIDEWALK: 4,   // 보도
  CROSSWALK: 5,  // 횡단보도
  PLAZA: 6,      // 광장 / 포장블럭
  WATER: 7,      // 물
  SAND: 8,       // 하천변 모래
  PARKING: 9,    // 주차장
  YARD: 10,      // 공단 포장 마당
  FLOOR: 11,     // 건물 바닥(외곽 데크)
  TRACK: 12,     // 공원 산책로
  ROAD_LINE: 13, // 차도 중앙선
};

// 통과할 수 없는 지면
export const GROUND_SOLID = [GROUND.WATER];

// ── 소품 ────────────────────────────────────────────────────────────────
export const PROP = {
  NONE: 0,
  TREE: 1,       // 가로수 / 숲
  BUSH: 2,
  LAMP: 3,       // 가로등
  BENCH: 4,
  SIGN: 5,       // 표지판
  HYDRANT: 6,
  PLANTER: 7,    // 화분
  FENCE: 8,      // 울타리
  ROCK: 9,
  FLOWER: 10,    // 꽃 (통과 가능)
  VENDING: 11,   // 자판기
};

// 통과할 수 없는 소품
export const PROP_SOLID = [PROP.TREE, PROP.LAMP, PROP.BENCH, PROP.SIGN,
  PROP.HYDRANT, PROP.PLANTER, PROP.FENCE, PROP.ROCK, PROP.VENDING];

// 지면별 소품 등장 확률과 후보 (절차적 채움)
export const PROP_RULES = {
  [GROUND.GRASS]: { rate: 0.05, pick: [PROP.TREE, PROP.BUSH, PROP.FLOWER, PROP.BUSH] },
  [GROUND.FIELD]: { rate: 0.004, pick: [PROP.ROCK, PROP.BUSH] },
  [GROUND.SIDEWALK]: { rate: 0.03, pick: [PROP.TREE, PROP.LAMP, PROP.PLANTER, PROP.SIGN, PROP.VENDING] },
  [GROUND.PLAZA]: { rate: 0.02, pick: [PROP.BENCH, PROP.PLANTER, PROP.LAMP] },
  [GROUND.TRACK]: { rate: 0.04, pick: [PROP.BENCH, PROP.LAMP, PROP.BUSH] },
  [GROUND.SAND]: { rate: 0.02, pick: [PROP.ROCK, PROP.BUSH] },
  [GROUND.DIRT]: { rate: 0.02, pick: [PROP.BUSH, PROP.ROCK] },
};

// ── 도로 ────────────────────────────────────────────────────────────────
// 등급별 차도 폭(타일)과 양쪽 보도 폭(타일)
export const ROAD_CLASS = {
  // width 는 차도 폭(타일). 타일 하나가 2.5m 이므로 8칸이면 20m — 왕복 6차선 정도다.
  expressway: { width: 10, sidewalk: 0, crossing: false },  // 자동차전용도로 (김포한강로)
  arterial:   { width: 8, sidewalk: 2, crossing: true },    // 6~8차선 (김포한강7로 등)
  main:       { width: 6, sidewalk: 2, crossing: true },    // 4차선
  local:      { width: 4, sidewalk: 1, crossing: true },    // 2차선 이면도로
  alley:      { width: 3, sidewalk: 0, crossing: false },   // 골목
  path:       { width: 2, sidewalk: 0, crossing: false, ground: GROUND.TRACK }, // 산책로
};

// ── 플레이어 ────────────────────────────────────────────────────────────
export const PLAYER = {
  walkSpeed: 78,     // 픽셀/초 (타일 16px 기준 약 4.9칸/초)
  runMultiplier: 2.1,
  width: 8,          // 충돌 상자 (픽셀)
  height: 6,         // 발밑 상자. 도트 게임 특유의 "발만 부딪히는" 감각
  drawWidth: 14,
  drawHeight: 20,
  animFps: 7,
  startPlace: '구래역',  // 이 건물 출입구 앞에서 시작한다
  startLon: 126.6285,    // 그 건물을 못 찾았을 때 쓰는 좌표
  startLat: 37.6437,
};

// ── 카메라 ──────────────────────────────────────────────────────────────
export const CAMERA = {
  zoom: 2,           // 기본 확대율 (정수 유지 — 도트가 뭉개지지 않게)
  zoomMin: 2,
  zoomMax: 5,
  lerp: 0.16,        // 따라가는 부드러움 (0~1)
  deadzone: 6,       // 이 픽셀 안에서는 카메라가 움직이지 않는다
};

// ── 렌더 ────────────────────────────────────────────────────────────────
export const RENDER = {
  maxDpr: 2,             // 고DPI 상한
  labelMaxDistance: 260, // 이름표를 그릴 최대 거리(월드 픽셀)
  labelMax: 14,          // 한 화면에 그릴 이름표 최대 개수
  nightless: true,       // 낮 고정 (시간대 연출 없음)
  shadowAlpha: 0.18,
};

// ── 건물 ────────────────────────────────────────────────────────────────
export const BUILDING = {
  minTiles: 3,           // 건물 한 변 최소 타일
  wallHeightPerFloor: 5, // 층당 벽 높이(픽셀) — 탑뷰지만 살짝 입체로 보이게
  wallHeightMax: 46,
  doorProbeRadius: 40,   // 출입구 방향을 정할 때 도로를 찾는 반경(타일)
  enterRadius: 27,       // 출입구에 이만큼(픽셀) 다가가면 진입 가능
};

// 건물 종류. 색·실내 구성·이름 규칙이 여기에 묶인다.
export const KIND = {
  APARTMENT: 'apartment',   // 아파트 동
  HOUSE: 'house',           // 단독·빌라
  SHOP: 'shop',             // 상가
  TOWER: 'tower',           // 주상복합 / 오피스텔
  MART: 'mart',             // 대형 상업시설
  SCHOOL: 'school',
  PUBLIC: 'public',         // 관공서
  STATION: 'station',       // 지하철역
  FACTORY: 'factory',       // 공장
  WAREHOUSE: 'warehouse',
  CHURCH: 'church',
  HOSPITAL: 'hospital',
  PARK_FACILITY: 'park',    // 공원 관리동·정자
  FARMHOUSE: 'farmhouse',   // 농가·창고
};

// ── 실내 ────────────────────────────────────────────────────────────────
export const INTERIOR = {
  scale: 1.6,        // 외관 footprint 대비 실내 크기 배율 (안이 더 넓다)
  minW: 15, minH: 15,   // 복도 + 위아래 방 한 줄이 들어갈 최소 크기
  maxW: 44, maxH: 32,
  corridorWidth: 3,
  minRoom: 4,        // 방 한 변 최소 타일
  elevatorFrom: 6,   // 이 층수 이상이면 계단 대신 엘리베이터
  exitPause: 0.25,   // 나간 직후 다시 들어가지 않도록 두는 시간(초)
};

// 실내 타일
export const IN = {
  VOID: 0, FLOOR: 1, WALL: 2, EXIT: 3, STAIR_UP: 4, STAIR_DOWN: 5,
  ELEVATOR: 6, COUNTER: 7, SHELF: 8, DESK: 9, PLANT: 10, RUG: 11,
  WINDOW: 12, BED: 13, TABLE: 14, MACHINE: 15,
};
export const IN_SOLID = [IN.VOID, IN.WALL, IN.COUNTER, IN.SHELF, IN.DESK,
  IN.PLANT, IN.WINDOW, IN.BED, IN.TABLE, IN.MACHINE];

// ── NPC ────────────────────────────────────────────────────────────────
export const NPC = {
  perChunk: 2,       // 청크당 최대 인원
  speed: 26,
  wanderRadius: 90,  // 태어난 자리에서 이 픽셀 이상 벗어나지 않는다
  spawnGrounds: [GROUND.SIDEWALK, GROUND.PLAZA, GROUND.TRACK],
};

// ── UI ─────────────────────────────────────────────────────────────────
export const UI = {
  font: '"Galmuri11", "DungGeunMo", "NeoDunggeunmo", "Apple SD Gothic Neo", sans-serif',
  labelSize: 11,
  hudSize: 12,
  minimapSize: 148,   // 미니맵 한 변(px)
  minimapScale: 10,   // 미니맵 픽셀 1개가 담는 타일 수
  toastSeconds: 2.6,
};

// ── 조작 ────────────────────────────────────────────────────────────────
export const KEYS = {
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  run: ['ShiftLeft', 'ShiftRight'],
  interact: ['Space', 'Enter', 'KeyE'],
  fullscreen: ['KeyF'],
  map: ['KeyM'],
  help: ['KeyH', 'Slash'],
  zoomIn: ['Equal', 'NumpadAdd'],
  zoomOut: ['Minus', 'NumpadSubtract'],
};

// ── 게임 규칙 ───────────────────────────────────────────────────────────
// 구래동에서 출발해 양촌공단에 닿으면 끝난다. 도중에 무엇을 건드렸느냐로 결말이 갈린다.
export const GAME = {
  startClock: 8 * 3600 + 10 * 60,  // 시작 시각 08:10
  deadline: 9 * 3600,              // 이 시각을 넘기면 지각
  timeScale: 6,                    // 실제 1초 = 게임 6초
  // 여기에 발을 들이면 도착. 학운 단지들은 가는 길에 있으므로 목적지가 아니다.
  goalRegions: ['yangchon-ind'],
  goalName: '양촌산단',
  interactRadius: 27,              // 물건에 이만큼(픽셀) 다가가면 만질 수 있다
  petRadius: 28,                   // 고양이
};

// ── 저장 ────────────────────────────────────────────────────────────────
export const SAVE = {
  key: 'sy-gurae-save-v1',
  intervalSeconds: 5,
};
