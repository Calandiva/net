// 만질 수 있는 것들. 이 배열이 곧 선택지다.
//
// 자리 정하기
//   { place: '건물 이름', floor: 층, slot: 실내 자리 번호 }  실내 (실제 건물 이름을 쓴다)
//   { lon, lat }                                            길 위
// effect 에서 상태에 플래그를 남기고, 그 조합이 endings.js 에서 결말이 된다.

export const GIZMOS = [
  // ── 길 위 ──────────────────────────────────────────────────────
  {
    id: 'vending', icon: 'vending', at: { lon: 126.6289, lat: 37.6433 },
    name: '자판기', once: true,
    text: '종이컵이 덜컹 떨어진다. 300원.',
    effect: (s) => s.set('coffee', '구래역 앞에서 자판기 커피를 뽑았다'),
  },
  {
    id: 'siren', icon: 'button', at: { lon: 126.6281, lat: 37.6441 },
    name: '역 앞 비상벨', once: true,
    text: '누르지 마시오, 라고 적혀 있다. 눌렀다.',
    effect: (s) => s.set('siren', '구래역 비상벨을 눌렀다'),
  },
  {
    id: 'hydrant', icon: 'valve', at: { lon: 126.6293, lat: 37.6424 },
    name: '소화전', once: true,
    text: '뚜껑이 생각보다 쉽게 돌아간다. 물이 솟는다.',
    effect: (s) => s.set('water', '중심상가 소화전을 열었다'),
  },
  {
    id: 'postbox', icon: 'note', at: { lon: 126.6274, lat: 37.6473 },
    name: '우체통', once: true,
    text: '주머니에 있던 봉투를 넣었다. 언제부터 있었는지는 모른다.',
    effect: (s) => s.set('letter', '우체통에 편지를 넣었다'),
  },
  {
    id: 'parcel-box', icon: 'panel', at: { lon: 126.6331, lat: 37.6441 },
    name: '무인택배함', once: true,
    text: '빈 칸에 소포를 넣고 번호를 눌렀다. 받는 사람은 나중에 정하기로.',
    effect: (s) => s.set('parcel', '무인택배함에 소포를 넣었다'),
  },
  {
    id: 'timetable', icon: 'note', at: { lon: 126.6278, lat: 37.6446 },
    name: '버스 노선도', once: true,
    text: '양촌산단 방면 첫차는 이미 지나갔다.',
    effect: (s) => s.set('timetable', '버스 노선도를 읽었다'),
  },
  {
    id: 'emergency-phone', icon: 'button', at: { lon: 126.6152, lat: 37.6344 },
    name: '김포한강로 비상전화', once: true,
    text: '수화기를 들자 바로 연결됐다. 아까 그 소화전 이야기를 했다.',
    effect: (s) => s.set('report', '김포한강로 비상전화로 신고했다'),
  },
  {
    id: 'telescope', icon: 'panel', at: { lon: 126.6166, lat: 37.6232 },
    name: '가현산 등산로 망원경', once: true,
    text: '북서쪽. 양촌산단 굴뚝에서 연기가 오른다.',
    effect: (s) => s.set('saw_smoke', '가현산에서 공단 연기를 봤다'),
  },
  {
    id: 'mountain-bell', icon: 'bell', at: { lon: 126.6177, lat: 37.6184 },
    name: '가현산 전망대의 종', once: true,
    text: '해발 215m. 한 번 치면 소리가 오래 남는다.',
    effect: (s) => s.set('mountain_bell', '가현산에서 종을 쳤다'),
  },
  {
    id: 'catbowl', icon: 'bowl', at: { lon: 126.6281, lat: 37.6470 },
    name: '고양이 밥그릇', once: true,
    text: '구래근린공원 화단 옆. 빈 그릇에 가진 것을 조금 덜어 놓았다.',
    effect: (s) => { s.set('cat_bowl', '고양이 밥그릇을 채웠다'); s.bump('cat'); },
  },
  {
    id: 'gate', icon: 'lever', at: { lon: 126.6046, lat: 37.6420 },
    name: '산업단지 진입 차단기', once: true,
    text: '수동 레버가 있다. 올린다.',
    effect: (s) => s.set('gate', '산업단지 차단기를 올렸다'),
  },

  // ── 구래역 ─────────────────────────────────────────────────────
  {
    id: 'ticket', icon: 'panel', at: { place: '구래역', floor: 1, slot: 2 },
    name: '발매기', once: true,
    text: '양촌역까지 한 장.',
    effect: (s) => s.set('ticket', '구래역에서 승차권을 샀다'),
  },
  {
    id: 'confess', icon: 'button', at: { place: '구래역', floor: 1, slot: 7 },
    name: '역무실 창구', once: true,
    text: '"저기요, 드릴 말씀이 있는데요."',
    effect: (s) => s.set('confess', '역무실에서 하지 않아도 될 말을 했다'),
  },
  {
    id: 'lost-found', icon: 'note', at: { place: '구래역', floor: -1, slot: 3 },
    name: '유실물 보관함', once: true,
    text: '열쇠 하나가 주인 없이 놓여 있다. 집었다.',
    effect: (s) => s.set('key', '구래역 유실물 열쇠를 챙겼다'),
  },
  {
    id: 'train-west', icon: 'button', at: { place: '구래역', floor: -2, slot: 1 },
    name: '양촌 방면 승강장', once: false,
    text: '열차가 들어온다. 서쪽, 양촌역 방면이다.',
    effect: (s, ctx) => { s.set('metro', '골드라인을 타고 양촌역까지 갔다'); ctx.rideTo('양촌역'); },
  },
  {
    id: 'train-east', icon: 'button', at: { place: '구래역', floor: -2, slot: 6 },
    name: '마산 방면 승강장', once: false,
    text: '열차가 들어온다. 반대쪽, 장기 방면이다.',
    effect: (s) => s.set('ride_east', '반대 방향 열차를 탔다'),
  },

  // ── 관공서 · 학교 ──────────────────────────────────────────────
  {
    id: 'civil', icon: 'panel', at: { place: '구래동 행정복지센터', floor: 1, slot: 4 },
    name: '민원 창구', once: true,
    text: '전입신고서를 내밀자 도장이 두 번 찍혔다.',
    effect: (s) => s.set('moved', '구래동 행정복지센터에서 전입신고를 했다'),
  },
  {
    id: 'book', icon: 'note', at: { place: '김포시 마산도서관', floor: 3, slot: 5 },
    name: '대출대', once: true,
    text: '김포 지명 유래집. 2주 뒤 반납.',
    effect: (s) => s.set('book', '마산도서관에서 책을 빌렸다'),
  },
  {
    id: 'schoolbell', icon: 'button', at: { place: '김포구래초등학교', floor: 1, slot: 3 },
    name: '수업 종 스위치', once: true,
    text: '복도 끝 스위치. 종이 울린다. 아직 방학이다.',
    effect: (s) => s.set('school_bell', '구래초등학교 종을 울렸다'),
  },
  {
    id: 'broadcast', icon: 'bell',
    at: { place: '한가람마을 우미린 관리사무소', floor: 1, slot: 2 },
    name: '단지 방송 마이크', once: true,
    text: '스위치를 올리자 스피커가 켜졌다. "아, 아."',
    effect: (s) => s.set('broadcast', '아파트 단지에 안내방송을 했다'),
  },

  // ── 상업 ───────────────────────────────────────────────────────
  {
    id: 'breaker', icon: 'panel', at: { place: '이마트 김포한강점', floor: -2, slot: 2 },
    name: '분전반', once: true,
    text: '지하 주차장 구석. 차단기 여섯 개를 전부 내렸다.',
    effect: (s) => s.set('blackout', '이마트 분전반을 내렸다'),
  },
  {
    id: 'freezer', icon: 'panel', at: { place: '이마트 김포한강점', floor: 1, slot: 6 },
    name: '냉동고', once: true,
    text: '문을 열고 한참 서 있었다. 만두를 하나 집었다.',
    effect: (s) => s.set('frozen', '이마트 냉동고를 열었다'),
  },
  {
    id: 'lunch', icon: 'bowl', at: { place: '이마트 김포한강점', floor: 2, slot: 3 },
    name: '도시락 매대', once: true,
    text: '제육. 아직 따뜻하다.',
    effect: (s) => s.set('lunch', '이마트에서 도시락을 샀다'),
  },
  {
    id: 'movie', icon: 'button', at: { place: '두원타워', floor: 8, slot: 2 },
    name: '메가박스 4관 입구', once: true,
    text: '조조. 불이 꺼진다.',
    effect: (s) => s.set('movie', '메가박스에서 조조를 봤다'),
  },
  {
    id: 'rooftop', icon: 'panel', at: { place: '두원타워', floor: 12, slot: 1 },
    name: '옥상 출입문', once: true,
    text: '문은 잠겨 있지 않았다. 서쪽으로 양촌산단이 보인다.',
    effect: (s) => s.set('rooftop', '두원타워 옥상에 올라갔다'),
  },

  // ── 산업단지 ───────────────────────────────────────────────────
  {
    id: 'pass', icon: 'panel',
    at: { place: '양촌일반산업단지 관리사무소', floor: 1, slot: 2 },
    name: '출입증 발급기', once: true,
    text: '사진이 이상하게 나왔지만 발급됐다.',
    effect: (s) => s.set('pass', '양촌산단 출입증을 받았다'),
  },
  {
    id: 'valve', icon: 'valve',
    at: { place: '학운2일반산업단지 폐수처리장', floor: 1, slot: 4 },
    name: '압력 밸브', once: true,
    text: '학운2단지 폐수처리장. 빨간 손잡이가 시계 방향으로 돌아간다.',
    effect: (s) => s.set('valve', '폐수처리장 압력 밸브를 돌렸다'),
  },
  {
    id: 'forklift', icon: 'lever',
    at: { place: '학운5일반산업단지 공동물류창고', floor: 1, slot: 3 },
    name: '지게차', once: true,
    text: '열쇠가 꽂혀 있다. 시동이 걸린다.',
    effect: (s) => s.set('forklift', '물류창고 지게차에 시동을 걸었다'),
  },
];

// 실내 물건을 건물 이름으로 묶어 둔다 (건물에 들어갈 때 꺼내 쓴다)
export function indexIndoorGizmos() {
  const byPlace = new Map();
  for (const g of GIZMOS) {
    if (!g.at.place) continue;
    const key = `${g.at.place}|${g.at.floor}`;
    let list = byPlace.get(key);
    if (!list) byPlace.set(key, (list = []));
    list.push(g);
  }
  return byPlace;
}

export function outdoorGizmos() {
  return GIZMOS.filter((g) => g.at.lon !== undefined);
}
