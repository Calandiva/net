// 건물 안팎에 사는 사람들. 역할과 대사.
//
// 지리만 실제이고 사람·사건은 전부 지어낸 것이다. 실제 인물이나 업체를 가리키지 않는다.
// 대사는 짧게. 한 사람이 두세 줄 하고 끝난다.
//
// where 는 어디에 세울지 힌트다.
//   counter 카운터 옆 · machine 기계 옆 · room 방 안 · corridor 복도 · any 아무 데나

import { KIND } from '../../config.js';
import { EXTRA_LINES, EXTRA_ROLES, EXTRA_OUTDOOR } from './npcs_extra.js';

// 건물 종류별 실내 인물
const INDOOR_ROLES_BASE = {
  [KIND.MART]: [
    { id: 'cashier', name: '캐셔', where: 'counter', lines: [
      '봉투 필요하세요?',
      '적립 카드 있으신가요?',
      '오늘은 이상하게 사람이 없네요.',
    ] },
    { id: 'clerk', name: '판매사원', where: 'any', lines: [
      '행사 상품은 저 안쪽 매대에 있습니다.',
      '재고 확인해 드릴까요?',
      '이거 오늘 들어온 겁니다.',
    ] },
    { id: 'sampler', many: true, name: '시식 코너 직원', where: 'any', lines: [
      '한번 드셔 보세요. 오늘 것 잘 나왔어요.',
      '두 개 사시면 하나 더 드립니다.',
    ] },
    { id: 'cartman', name: '카트 정리 직원', where: 'any', lines: [
      '카트는 저쪽에 두시면 됩니다.',
      '아침마다 카트가 어디론가 사라져요.',
    ] },
    { id: 'shopper', many: true, name: '장 보는 사람', where: 'any', lines: [
      '만두를 사러 왔는데 어디 있는지 모르겠네.',
      '이 시간에 장 보면 한산해서 좋아요.',
      '애 학원 보내고 잠깐 나왔어요.',
    ] },
  ],

  [KIND.APARTMENT]: [
    { id: 'gamer', name: '컴퓨터 하는 사람', where: 'room', lines: [
      '오늘은 재택이라 안 나가요.',
      '한 판만 더 하고 자려고요.',
    ] },
    { id: 'sleeper', name: '자는 사람', where: 'room', lines: [
      '...',
      '(깊이 잠들어 있다)',
      '으음... 다섯 시에 깨워 주세요...',
    ] },
    { id: 'cook', name: '밥 하는 사람', where: 'room', lines: [
      '국이 넘칠 것 같은데.',
      '점심 드시고 가실래요?',
    ] },
    { id: 'delivery', name: '택배 기사', where: 'corridor', lines: [
      '문 앞에 두고 갑니다.',
      '이 동은 엘리베이터가 느려요.',
    ] },
    { id: 'grandma', name: '어르신', where: 'corridor', lines: [
      '이 단지 생길 때부터 살았어요.',
      '여기 예전에는 다 논이었지.',
    ] },
  ],

  [KIND.HOUSE]: [
    { id: 'tv', name: 'TV 보는 사람', where: 'room', lines: [
      '뉴스에 우리 동네 나왔어요.',
      '조용히 좀 부탁해요.',
    ] },
    { id: 'student', name: '공부하는 학생', where: 'room', lines: [
      '내일 시험이라서요.',
      '집중이 안 되네.',
    ] },
    { id: 'landlord', name: '집주인', where: 'any', lines: [
      '방 보러 오셨어요?',
      '보일러는 작년에 갈았습니다.',
    ] },
  ],

  [KIND.SCHOOL]: [
    { id: 'guard', name: '수위 아저씨', where: 'corridor', lines: [
      '방학이라 안에는 아무도 없어요.',
      '들어오려면 명부에 적고 들어가세요.',
      '종 치는 스위치, 그거 함부로 만지면 안 됩니다.',
    ] },
    { id: 'teacher', name: '선생님', where: 'room', lines: [
      '방학인데도 일이 많네요.',
      '복도에서 뛰지 마세요.',
      '급식실은 1층 끝입니다.',
    ] },
    { id: 'pupil', many: true, name: '학생', where: 'any', lines: [
      '보충수업 왔어요.',
      '오늘 급식 뭐예요?',
      '아저씨 누구세요?',
    ] },
    { id: 'cook2', name: '조리원', where: 'room', lines: [
      '오늘은 백 명분만 합니다.',
      '국 냄비가 하나 부족해요.',
    ] },
  ],

  [KIND.FACTORY]: [
    { id: 'worker', name: '근로자', where: 'machine', lines: [
      '여기 안전모 없이 들어오시면 안 됩니다.',
      '오전 물량은 다 뺐어요.',
      '기계가 아침부터 이상한 소리를 내요.',
    ] },
    { id: 'foreman', name: '반장', where: 'any', lines: [
      '어디서 오셨습니까?',
      '오늘 라인 두 개만 돌립니다.',
      '출입증 보여 주세요.',
    ] },
    { id: 'inspector', name: '검사원', where: 'any', lines: [
      '치수가 0.2 밀리 나갔어요.',
      '이 로트는 다시 봐야 합니다.',
    ] },
  ],

  [KIND.WAREHOUSE]: [
    { id: 'forklift', name: '지게차 기사', where: 'machine', lines: [
      '뒤로 좀 물러나 주세요.',
      '이 파렛트만 옮기고 쉬려고요.',
    ] },
    { id: 'picker', name: '피킹 담당', where: 'any', lines: [
      '오늘 나갈 물량이 삼백 건입니다.',
      '스캐너 배터리가 또 나갔네.',
    ] },
  ],

  [KIND.PUBLIC]: [
    { id: 'officer', name: '주무관', where: 'counter', lines: [
      '무슨 일로 오셨어요?',
      '전입신고는 이쪽에서 하시면 됩니다.',
      '번호표 뽑고 기다려 주세요.',
    ] },
    { id: 'visitor', many: true, name: '민원인', where: 'any', lines: [
      '서류 하나 떼러 왔는데 한참 기다리네요.',
      '아침에 오면 빨리 끝나요.',
    ] },
    { id: 'helper', name: '안내 도우미', where: 'corridor', lines: [
      '민원실은 1층입니다.',
      '무인발급기는 저쪽에 있어요.',
    ] },
  ],

  [KIND.STATION]: [
    { id: 'staff', name: '역무원', where: 'counter', lines: [
      '표는 발매기에서 뽑으시면 됩니다.',
      '양촌 방면은 반대쪽 승강장이에요.',
      '유실물은 하루 지나면 본사로 갑니다.',
    ] },
    { id: 'commuter', many: true, name: '출근하는 사람', where: 'any', lines: [
      '이 시간 열차가 제일 붐벼요.',
      '지각인데 열차가 안 와요.',
    ] },
    { id: 'cleaner', name: '청소 담당', where: 'any', lines: [
      '방금 닦았으니 조심하세요.',
      '아침마다 이 정도는 나와요.',
    ] },
  ],

  [KIND.TOWER]: [
    { id: 'tutor', name: '학원 강사', where: 'room', lines: [
      '수업 십 분 뒤에 시작합니다.',
      '여기 층마다 학원이 하나씩 있어요.',
    ] },
    { id: 'officeworker', name: '사무직', where: 'room', lines: [
      '엘리베이터가 아침엔 정말 안 와요.',
      '점심 뭐 드실지 정하셨어요?',
    ] },
    { id: 'usher', name: '영화관 직원', where: 'any', lines: [
      '상영관은 저쪽입니다.',
      '조조는 사람이 거의 없어요.',
    ] },
  ],

  [KIND.SHOP]: [
    { id: 'owner', name: '가게 주인', where: 'counter', lines: [
      '아직 준비 중이에요.',
      '점심때 오시면 자리 없어요.',
      '이 건물은 오래됐지만 튼튼합니다.',
    ] },
    { id: 'parttime', name: '아르바이트생', where: 'any', lines: [
      '사장님 잠깐 나가셨어요.',
      '오늘 첫 손님이세요.',
    ] },
    { id: 'customer', many: true, name: '손님', where: 'any', lines: [
      '여기 김밥이 괜찮아요.',
      '이 골목은 저녁에 사람이 많아요.',
    ] },
  ],

  [KIND.HOSPITAL]: [
    { id: 'nurse', name: '간호사', where: 'counter', lines: [
      '접수 도와드릴까요?',
      '진료는 아홉 시부터입니다.',
    ] },
    { id: 'patient', many: true, name: '환자', where: 'any', lines: [
      '어제부터 목이 아파서요.',
      '조금만 기다리면 부른대요.',
    ] },
  ],

  [KIND.CHURCH]: [
    { id: 'keeper', name: '관리 집사', where: 'any', lines: [
      '예배는 주말에 있습니다.',
      '종은 정오에 한 번 칩니다.',
    ] },
  ],

  [KIND.PARK_FACILITY]: [
    { id: 'manager', name: '관리소 직원', where: 'counter', lines: [
      '단지 방송은 여기서 나갑니다.',
      '분리수거는 화요일입니다.',
    ] },
  ],

  [KIND.FARMHOUSE]: [
    { id: 'farmer', name: '농부', where: 'any', lines: [
      '이맘때가 제일 바빠요.',
      '올해는 비가 잦네.',
    ] },
  ],
};

// 길에서 만나는 사람들 — 어느 동네냐에 따라 말이 다르다
const OUTDOOR_ROLES_BASE = {
  city: [
    { id: 'resident', name: '주민', lines: [
      '구래역까지는 이 길로 쭉 가시면 돼요.',
      '이 동네는 밤에도 밝아요.',
      '상가가 많아서 없는 게 없어요.',
    ] },
    { id: 'rider', name: '배달 기사', lines: [
      '지금 세 건 밀렸어요.',
      '이 골목은 일방통행이라 돌아가야 해요.',
    ] },
    { id: 'student2', name: '학생', lines: [
      '학원 가는 길이에요.',
      '버스가 방금 갔어요.',
    ] },
    { id: 'walker', name: '산책하는 사람', lines: [
      '아침 공기가 좋네요.',
      '저쪽 공원까지 한 바퀴 돌고 옵니다.',
    ] },
  ],
  industrial: [
    { id: 'shift', name: '교대 근무자', lines: [
      '야간 끝나고 집에 가는 길입니다.',
      '정문은 저쪽으로 돌아가야 해요.',
    ] },
    { id: 'driver', name: '화물차 기사', lines: [
      '여기 주차할 데가 없어요.',
      '상차 기다리는 중입니다.',
    ] },
  ],
  field: [
    { id: 'elder', name: '동네 어르신', lines: [
      '여기는 예전 그대로예요.',
      '저 앞 수로 따라가면 큰길 나와요.',
    ] },
    { id: 'farmer2', name: '농부', lines: [
      '물 대러 나왔어요.',
      '올해 모는 잘 자랐습니다.',
    ] },
  ],
  forest: [
    { id: 'hiker', name: '등산객', lines: [
      '정상까지 이십 분이면 갑니다.',
      '여기서 보면 신도시가 다 보여요.',
    ] },
  ],
};

// 대사를 더 붙이고, 역할도 더 얹는다 (npcs_extra.js)
function merge(base, extra) {
  const out = {};
  for (const key of new Set([...Object.keys(base), ...Object.keys(extra || {})])) {
    const roles = (base[key] || []).map((r) => (EXTRA_LINES[r.id]
      ? { ...r, lines: r.lines.concat(EXTRA_LINES[r.id]) }
      : r));
    out[key] = roles.concat((extra && extra[key]) || []);
  }
  return out;
}

export const INDOOR_ROLES = merge(INDOOR_ROLES_BASE, EXTRA_ROLES);
export const OUTDOOR_ROLES = merge(OUTDOOR_ROLES_BASE, EXTRA_OUTDOOR);
