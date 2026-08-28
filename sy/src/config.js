// 〈구래〉 — 모든 조정 가능한 값은 이 파일에 모은다. 다른 파일에 숫자를 직접 적지 않는다.

// ── 시드 ────────────────────────────────────────────────────────────────
// 절차적 생성(스프라이트, 지면 변주, 건물 이름, 실내 배치)은 전부 이 시드에서 파생된다.
// 같은 시드면 언제나 같은 결과가 나온다.
export const SEED = 'gurae-2026';

// ── 좌표계 ──────────────────────────────────────────────────────────────
// 실제 위경도(WGS84)를 타일 좌표로 옮기는 기준. 지도 데이터를 갈아끼울 때 여기만 바꾼다.
export const GEO = {
  // 김포시 구래동(북) ~ 양촌읍 학운 산업단지(남) · 가현산(남동)을 감싸는 영역.
  // tools/bake_overture.py 의 값과 반드시 같아야 한다 (구운 좌표가 이 기준이다).
  south: 37.6020,
  north: 37.6620,
  west: 126.5980,
  east: 126.6620,
  // 타일 하나가 실제 몇 미터인가
  metersPerTile: 2.5,
  // 위도 1도 / 경도 1도의 미터 환산 (위도 37.63° 기준)
  metersPerLat: 111132,
  metersPerLon: 88162,
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
  ASPHALT: 14,   // 상가 블록 안 포장 마당 (차도가 아니다)
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
  [GROUND.GRASS]: { rate: 0.035, pick: [PROP.TREE, PROP.BUSH, PROP.FLOWER, PROP.BUSH] },
  [GROUND.FIELD]: { rate: 0.004, pick: [PROP.ROCK, PROP.BUSH] },
  [GROUND.SIDEWALK]: { rate: 0.026, pick: [PROP.TREE, PROP.LAMP, PROP.PLANTER, PROP.SIGN, PROP.VENDING] },
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
  local:      { width: 4, sidewalk: 1, crossing: false },   // 2차선 이면도로
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
  hurtSpeed: 0.52,       // 차에 치인 뒤 걷는 속도 배수
  stuckSeconds: 1.4,     // 움직이려는데 이만큼 제자리면 갇힌 것으로 본다
  stuckEpsilon: 18,      // 제자리 판정 기준(초당 픽셀) — 걷는 속도보다 한참 느리면 못 가는 것
  safeArea: 80,          // 갇힘 판정 — 이만큼(타일) 돌아다닐 수 있어야 안전하다
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
  // 건물 뒤(북쪽)에 섰을 때 그 건물을 이만큼 투명하게 만든다.
  // 탑뷰라 건물 북쪽 땅은 지붕에 가려 안 보이는데, 실제로는 걸어 다닐 수 있는 곳이다.
  occludeAlpha: 0.38,
  occludeFadeSpeed: 9,   // 초당 알파 변화 속도
  occludePad: 3,         // 가림 판정에 두는 여유(픽셀)
  centerLine: '#e0b63c', // 중앙선 (노란색)
  laneLine: 'rgba(240,240,232,0.8)', // 차선 (흰 점선)
};

// ── 건물 ────────────────────────────────────────────────────────────────
export const BUILDING = {
  minTiles: 3,           // 건물 한 변 최소 타일
  wallHeightPerFloor: 5, // 층당 벽 높이(픽셀) — 탑뷰지만 살짝 입체로 보이게
  wallHeightMax: 46,
  doorProbeRadius: 40,   // 출입구 방향을 정할 때 도로를 찾는 반경(타일)
  enterRadius: 27,       // 출입구에 이만큼(픽셀) 다가가면 진입 가능
  doorApron: 2,          // 문 앞 이만큼(타일)은 소품 없이 비운다 (갇힘 방지)
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
  scale: 2.4,        // 외관 footprint 대비 실내 크기 배율 (안이 더 넓다)
  minW: 19, minH: 17,   // 복도 + 위아래 방 한 줄이 들어갈 최소 크기
  maxW: 68, maxH: 48,
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
  CAR: 16, PILLAR: 17, SEAT: 18, SCREEN: 19, CART: 20,
  DOOR: 21, DOOR_OPEN: 22, LOCKER: 23,
  SMOKE: 24, BOX: 25, PUDDLE: 26, CONE: 27,
  // 건물마다 다른 살림살이
  SOFA: 28, FRIDGE: 29, SINK: 30, BOOKS: 31, BOARD: 32,
  VENDING: 33, RACK: 34, BENCH: 35, MAT: 36,
};
export const IN_SOLID = [IN.VOID, IN.WALL, IN.COUNTER, IN.SHELF, IN.DESK,
  IN.PLANT, IN.WINDOW, IN.BED, IN.TABLE, IN.MACHINE,
  IN.CAR, IN.PILLAR, IN.SEAT, IN.SCREEN, IN.CART, IN.DOOR, IN.LOCKER,
  IN.BOX, IN.CONE,
  IN.SOFA, IN.FRIDGE, IN.SINK, IN.BOOKS, IN.BOARD, IN.VENDING, IN.RACK, IN.BENCH];

// 건물 종류별 실내 분위기 (바닥·벽 색). render/palette.js 가 색을 정한다.
export const INTERIOR_THEMES = {
  home: ['apartment', 'house', 'farmhouse'],
  office: ['tower', 'public'],
  school: ['school'],
  mart: ['mart', 'shop'],
  factory: ['factory', 'warehouse'],
  hospital: ['hospital'],
  station: ['station'],
  church: ['church'],
  park: ['park'],
};

// 엘리베이터가 있는 건물 — 층수가 많거나, 사람이 많이 드나드는 곳
export const ELEVATOR_KINDS = ['mart', 'tower', 'public', 'station', 'hospital'];

// ── 사람과 사건 ─────────────────────────────────────────────────────────
export const LIFE = {
  giftChance: 0.34,        // 사람이 아이템을 하나 들고 있을 확률
  encounterRadius: 46,     // 사건에 이만큼(픽셀) 다가가면 마주친다
  indoorPerRoom: 0.42,     // 방 하나에 사람이 있을 확률
  indoorMax: 10,           // 한 층에 최대 몇 명
  eventChance: 0.78,       // 건물 한 층에 사건이 있을 확률 (없으면 '평소와 같음')
  outdoorEventChance: 0.3, // 청크마다 길 위에 사건이 있을 확률
  talkRadius: 30,          // 말 걸 수 있는 거리(픽셀)
  noticeRadius: 120,       // 길 위 사건이 눈에 들어오는 거리(픽셀)
};

// ── NPC ────────────────────────────────────────────────────────────────
export const NPC = {
  perChunk: 2,       // 청크당 최대 인원
  speed: 26,
  wanderRadius: 90,  // 태어난 자리에서 이 픽셀 이상 벗어나지 않는다
  spawnGrounds: [GROUND.SIDEWALK, GROUND.PLAZA, GROUND.TRACK],
};

// ── 도로 위의 차 ────────────────────────────────────────────────────────
export const TRAFFIC = {
  classes: ['expressway', 'arterial', 'main', 'local'], // 차가 다니는 도로 등급
  // 픽셀/초. 걷기 78, 달리기 164 이므로 차가 조금 빠른 정도로 맞춘다.
  speed: { expressway: 125, arterial: 88, main: 68, local: 46 },
  spacing: 34,        // 차 한 대당 차선 길이(타일). 작을수록 차가 많다
  colors: 8,          // 차 색 가짓수
  stopDistance: 34,
  hitRadius: 12,           // 이만큼 가까우면 치인다(픽셀)
  hitSpeed: 30,            // 이보다 느린 차는 치지 않는다   // 앞에 사람이 이만큼(픽셀) 안에 있으면 선다
  stopWidth: 12,      // 차선 폭 기준 좌우 판정
};

// ── UI ─────────────────────────────────────────────────────────────────
export const UI = {
  font: '"Galmuri11", "DungGeunMo", "NeoDunggeunmo", "Apple SD Gothic Neo", sans-serif',
  labelSize: 11,
  hudSize: 12,
  minimapSize: 148,   // 미니맵 한 변(px)
  minimapScale: 10,   // 미니맵 픽셀 1개가 담는 타일 수
  minimapZooms: [1, 2, 4, 8],  // 미니맵 확대 배율 (축척 조절)
  minimapZoomDefault: 2,       // 처음 배율 — minimapZooms 의 값
  toastSeconds: 2.6,
};

// ── 자동 이동(길찾기) ───────────────────────────────────────────────────
// 지도를 눌러 목적지를 찍으면 이만큼씩 끊어서 걸어간다.
export const PATHING = {
  window: 90,            // 한 번에 살펴보는 반경(타일)
  maxNodes: 12000,       // A* 가 펼쳐 보는 칸 수 상한 (프레임이 끊기지 않게)
  heuristicWeight: 1.15, // 1보다 크면 조금 빨리, 조금 덜 최적으로 찾는다
  arriveTiles: 1.2,      // 목적지에 이만큼 가까우면 도착
  stepTiles: 0.42,       // 다음 지점에 이만큼 가까우면 그 다음으로
  replanSeconds: 2.2,    // 이 시간마다 길을 다시 찾는다
  stuckSeconds: 1.2,     // 자동 이동 중 제자리면 다시 찾는다
  maxRetries: 4,         // 이만큼 다시 찾아도 못 가면 포기한다
  groundCost: {          // 지면별 가산 비용 (길로 다니게)
    0: 1.2,              // 논밭
    1: 0.5,              // 풀밭
    8: 0.8,              // 모래
  },
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
  worldmap: ['Tab'],
  help: ['KeyH', 'Slash'],
  zoomIn: ['Equal', 'NumpadAdd'],
  zoomOut: ['Minus', 'NumpadSubtract'],
  useItem: ['KeyQ'],                        // 들고 있는 것을 쓴다
  minimapIn: ['BracketRight', 'Period'],    // 미니맵 축척 — 가깝게
  minimapOut: ['BracketLeft', 'Comma'],     // 미니맵 축척 — 멀리
};

// ── 게임 규칙 ───────────────────────────────────────────────────────────
// 구래동에서 출발해 양촌공단에 닿으면 끝난다. 도중에 무엇을 건드렸느냐로 결말이 갈린다.
export const GAME = {
  noticeEncounter: 220,             // 사건이 이만큼(픽셀) 가까우면 귀띔한다
  startClock: 8 * 3600 + 10 * 60,  // 시작 시각 08:10
  deadline: 9 * 3600,              // 이 시각을 넘기면 지각
  timeScale: 6,                    // 실제 1초 = 게임 6초
  // 여기에 발을 들이면 도착. 학운 단지들은 가는 길에 있으므로 목적지가 아니다.
  // 목적지 — 양촌읍 학운리 산업단지 (실제 좌표). 이 반경 안에 들면 도착이다.
  goal: { lon: 126.6157, lat: 37.6116, radius: 150 },   // radius 는 미터
  goalName: '양촌산단',
  interactRadius: 27,              // 물건에 이만큼(픽셀) 다가가면 만질 수 있다
  petRadius: 28,                   // 고양이
};

// ── 저장 ────────────────────────────────────────────────────────────────
export const SAVE = {
  key: 'sy-gurae-save-v1',
  intervalSeconds: 5,
};
