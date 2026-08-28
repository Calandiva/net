// 결말. 위에 있는 것부터 검사해서 처음 맞는 하나가 그 판의 결말이 된다.
//
// when: 'any'  건드린 순간 바로 끝난다
//       'goal' 양촌공단에 닿았을 때 판정한다
// 새 결말을 넣고 싶으면 이 배열에 하나 더 얹으면 된다. 다른 파일은 건드릴 필요 없다.

export const ENDINGS = [
  // ── 즉시 끝나는 것들 ───────────────────────────────────────────
  {
    id: 'E01', title: '대폭발', tag: 'bad', when: 'any',
    hint: '전기를 끊어 놓고 폐수처리장 밸브를 돌리면',
    test: (s) => s.has('valve') && s.has('blackout'),
    lines: ['압력계 바늘이 오른쪽 끝까지 갔다.',
      '전기가 나간 학운2단지에서 경보는 울리지 않았다.',
      '양촌 하늘이 잠깐 아주 밝았다.'],
  },
  {
    id: 'E02', title: '자수', tag: 'odd', when: 'any',
    hint: '역무실에서 하지 않아도 될 말을 하면',
    test: (s) => s.has('confess'),
    lines: ['"제가 그랬습니다."',
      '역무원은 무엇을 그랬는지 세 번 물었다.',
      '유실물 대장에 결국 출근 시각만 적혔다.'],
  },
  {
    id: 'E03', title: '갇혔다', tag: 'bad', when: 'any',
    hint: '전기를 끊어 놓고 엘리베이터를 타면',
    test: (s) => s.has('stuck'),
    lines: ['버튼을 누르자 안내판이 꺼졌다.',
      '두원타워 엘리베이터는 층과 층 사이에서 멈췄다.',
      '비상벨을 누르는 데까지가 오늘의 출근길이었다.'],
  },
  {
    id: 'E04', title: '연행', tag: 'bad', when: 'any',
    hint: '사이렌을 울린 채로 차단기를 만지면',
    test: (s) => s.has('siren') && s.has('gate'),
    lines: ['비상벨 소리가 아직 귀에 남아 있었다.',
      '산업단지 차단기가 올라가는 순간 순찰차가 도착했다.',
      '앞자리에 앉아 본 것은 처음이었다.'],
  },
  {
    id: 'E05', title: '출근 포기', tag: 'odd', when: 'any',
    hint: '역에서 반대 방향 열차를 타면',
    test: (s) => s.has('ride_east'),
    lines: ['마산 방면 열차 문이 닫혔다.',
      '양촌은 반대쪽이었다.',
      '창밖으로 논이 지나갔고, 그냥 계속 앉아 있었다.'],
  },

  // ── 양촌공단에 닿았을 때 ───────────────────────────────────────
  {
    id: 'E06', title: '전부 만졌다', tag: 'true', when: 'goal',
    hint: '스무 가지 넘게 건드리고 도착하면',
    test: (s) => s.touched >= 20,
    lines: ['버튼, 레버, 밸브, 종, 냉동고, 분전반.',
      '구래에서 양촌까지 손대지 않은 것이 없었다.',
      '공단 정문 경비가 물었다. "무슨 일 하시는 분이세요?"',
      '아직 아무 일도 시작하지 않았다.'],
  },
  {
    id: 'E29', title: '소문난 아침', tag: 'good', when: 'goal',
    hint: '길에서 만난 사람들과 여덟 번 넘게 말을 섞으면',
    test: (s) => s.count('talked') >= 8,
    lines: ['구래역 앞 자판기부터 양촌 정문까지, 만나는 사람마다 말을 걸었다.',
      '누구는 길을 알려 줬고 누구는 자기 얘기를 했다.',
      '첫 출근인데 아는 얼굴이 벌써 여덟이다.'],
  },
  {
    id: 'E30', title: '목격자', tag: 'odd', when: 'goal',
    hint: '오늘 벌어진 일을 여섯 가지 넘게 보면',
    test: (s) => s.count('seen_event') >= 6,
    lines: ['이사, 도로 공사, 멈춘 라인, 시식 코너, 잃어버린 강아지 전단.',
      '하루치 사건을 다 보고 다녔다.',
      '공단에 도착하자 아무 일도 일어나지 않았다. 그게 제일 이상했다.'],
  },
  {
    id: 'E07', title: '아무것도 만지지 않았다', tag: 'true', when: 'goal',
    hint: '정말로 아무것도 건드리지 않고 제시간에 닿으면',
    test: (s) => s.touched === 0 && !s.late,
    lines: ['자판기도, 비상벨도, 남의 집 문도 그냥 지나쳤다.',
      '양촌일반산업단지 정문 앞에서 시계를 봤다.',
      '아무 일도 일어나지 않았다는 것이 오늘의 사건이었다.'],
  },
  {
    id: 'E08', title: '무결점 지각', tag: 'odd', when: 'goal',
    hint: '아무것도 안 건드렸는데 늦으면',
    test: (s) => s.touched === 0 && s.late,
    lines: ['한눈 한 번 팔지 않았는데 시계는 아홉 시를 넘겼다.',
      '구래에서 양촌은 원래 그만큼 멀다.',
      '아무도 그 말을 믿어 주지 않았다.'],
  },
  {
    id: 'E09', title: '출입증', tag: 'good', when: 'goal',
    hint: '관리사무소에 먼저 들르면',
    test: (s) => s.has('pass') && !s.late,
    lines: ['목에 건 카드가 정문에서 삑 하고 울렸다.',
      '경비는 고개만 끄덕였다.',
      '오늘부터 여기 사람이 되었다.'],
  },
  {
    id: 'E10', title: '정전 속의 첫 출근', tag: 'bad', when: 'goal',
    hint: '어딘가의 분전반을 열어 두고 도착하면',
    test: (s) => s.has('blackout'),
    lines: ['이마트도 중심상가도 절반이 어두웠다.',
      '양촌산단 사무실도 비상등만 켜져 있었다.',
      '"오늘 왜 이러지?" 아무도 나를 보지 않았다.'],
  },
  {
    id: 'E11', title: '무임승차', tag: 'bad', when: 'goal',
    hint: '표 없이 열차를 타면',
    test: (s) => s.has('metro') && !s.has('ticket'),
    lines: ['양촌역 개찰구에서 문이 열리지 않았다.',
      '역무원이 다가오는 동안 공단 굴뚝이 보였다.',
      '첫 출근 기록보다 부가운임 영수증이 먼저 생겼다.'],
  },
  {
    id: 'E12', title: '정기권', tag: 'good', when: 'goal',
    hint: '표를 끊고 열차로 가면',
    test: (s) => s.has('metro') && s.has('ticket'),
    lines: ['구래에서 양촌까지 두 정거장.',
      '걸었으면 한 시간, 앉아서 4분.',
      '내일부터는 이 시간에 이 자리에 앉기로 했다.'],
  },
  {
    id: 'E13', title: '산 넘어 출근', tag: 'odd', when: 'goal',
    hint: '가현산 정자의 종을 치고 도착하면',
    test: (s) => s.has('mountain_bell'),
    lines: ['정자에서 종을 한 번 쳤다. 아무도 없었다.',
      '능선을 따라 내려오니 신도시가 등 뒤로 사라졌다.',
      '구두에 흙이 묻은 채로 공단에 도착했다.'],
  },
  {
    id: 'E14', title: '고양이 대장', tag: 'good', when: 'goal',
    hint: '고양이를 셋 이상 만나면',
    test: (s) => s.count('cat') >= 3,
    lines: ['구래동 고양이 셋이 차례로 따라왔다.',
      '공단 정문에서 셋 다 멈춰 서서 앉았다.',
      '거기까지가 그들의 구역인 모양이었다.'],
  },
  {
    id: 'E15', title: '도시락', tag: 'good', when: 'goal',
    hint: '이마트에서 도시락을 사 가면',
    test: (s) => s.has('lunch'),
    lines: ['가방에서 도시락이 아직 따뜻했다.',
      '점심시간에 혼자 먹지 않아도 됐다.',
      '"이거 어디서 샀어요?" 구래역 이마트요.'],
  },
  {
    id: 'E16', title: '자판기 커피', tag: 'good', when: 'goal',
    hint: '역 앞 자판기를 누르고 늦지 않으면',
    test: (s) => s.has('coffee') && !s.late,
    lines: ['300원짜리 종이컵을 들고 걸었다.',
      '다 식을 때쯤 공단이 보였다.',
      '첫 출근에 손에 뭔가 들려 있으면 덜 어색하다.'],
  },
  {
    id: 'E17', title: '젖은 신발', tag: 'odd', when: 'goal',
    hint: '소화전을 열어 보면',
    test: (s) => s.has('water'),
    lines: ['소화전은 생각보다 세게 열렸다.',
      '양말까지 젖은 채로 4킬로미터를 걸었다.',
      '공단 화장실 핸드드라이어 앞에서 20분을 보냈다.'],
  },
  {
    id: 'E18', title: '연체', tag: 'odd', when: 'goal',
    hint: '도서관에서 책을 빌리면',
    test: (s) => s.has('book'),
    lines: ['가방 속 책은 2주 뒤에 반납해야 한다.',
      '양촌산단에서 마산도서관까지 다시 오는 일은 없었다.',
      '연체일이 쌓이는 동안 책은 사물함에 있었다.'],
  },
  {
    id: 'E19', title: '전입신고', tag: 'good', when: 'goal',
    hint: '행정복지센터 민원실에 들르면',
    test: (s) => s.has('moved'),
    lines: ['오늘부로 김포시민이 되었다.',
      '주소지와 직장이 같은 시에 있다.',
      '이런 걸 정착이라고 부르는 모양이다.'],
  },
  {
    id: 'E20', title: '조조', tag: 'odd', when: 'goal',
    hint: '출근길에 상영관에 들어가면',
    test: (s) => s.has('movie'),
    lines: ['두원타워 8층. 상영관에는 나 혼자였다.',
      '무슨 영화였는지는 끝까지 몰랐다.',
      '엔딩 크레딧을 보고 나오니 공단 갈 시간이 딱 맞았다. 아마도.'],
  },
  {
    id: 'E21', title: '지게차', tag: 'good', when: 'goal',
    hint: '물류센터에서 지게차를 건드리면',
    test: (s) => s.has('forklift'),
    lines: ['시동은 걸렸고, 팔레트 하나를 옮겼다.',
      '창고 반장이 물었다. "면허 있어요?"',
      '없다고 하니 명함을 줬다. 취업 제안이었다.'],
  },
  {
    id: 'E22', title: '소방차 뒤를 따라', tag: 'odd', when: 'goal',
    hint: '길가 비상전화로 신고하면',
    test: (s) => s.has('report'),
    lines: ['신고한 것은 별일이 아니었다.',
      '그래도 소방차는 왔고, 나는 그 뒤를 따라 걸었다.',
      '양촌까지 길이 전부 비켜 있었다.'],
  },
  {
    id: 'E23', title: '안내방송', tag: 'odd', when: 'goal',
    hint: '아파트 관리사무소 마이크를 켜면',
    test: (s) => s.has('broadcast'),
    lines: ['"아, 아. 잠시 안내 말씀 드리겠습니다."',
      '한가람마을 우미린 열두 개 동에 내 목소리가 나갔다.',
      '무슨 말을 했는지는 공단에 도착할 때까지 기억나지 않았다.'],
  },
  {
    id: 'E24', title: '굴뚝 연기', tag: 'true', when: 'goal',
    hint: '가현산에서 본 것을 두원타워 옥상에서 다시 보면',
    test: (s) => s.has('saw_smoke') && s.has('rooftop'),
    lines: ['가현산 망원경으로 본 연기가 두원타워 옥상에서도 보였다.',
      '방향이 조금 달랐다. 두 번 보면 알 수 있다.',
      '양촌산단에 도착해 물었더니, 오늘은 아무 공정도 돌리지 않았다고 했다.'],
  },
  {
    id: 'E25', title: '냉동식품', tag: 'odd', when: 'goal',
    hint: '마트 냉동고를 열어 보면',
    test: (s) => s.has('frozen'),
    lines: ['이마트 냉동고 문을 오래 열어 두었다.',
      '가방 속 만두는 양촌산단에 도착할 때쯤 다 녹았다.',
      '점심으로는 못 쓰게 됐다.'],
  },
  {
    id: 'E26', title: '등기우편', tag: 'good', when: 'goal',
    hint: '편지를 넣고 무인택배함에도 넣으면',
    test: (s) => s.has('letter') && s.has('parcel'),
    lines: ['우체통에 넣은 편지와 무인택배함에 넣은 소포.',
      '둘 다 오늘 안에 떠난다고 했다.',
      '나만 아직 도착하지 않았다. 이제 도착했다.'],
  },
  {
    id: 'E27', title: '지각', tag: 'bad', when: 'goal',
    hint: '아홉 시를 넘겨 도착하면',
    test: (s) => s.late,
    lines: ['정문을 지나며 시계를 봤다.',
      '첫날부터 늦는 사람은 대체로 계속 늦는다고 한다.',
      '아직 그 말을 믿지 않기로 했다.'],
  },
  {
    id: 'E28', title: '첫 출근', tag: 'good', when: 'goal',
    hint: '무사히 도착하면',
    test: () => true,
    lines: ['구래동에서 양촌산단까지 걸었다.',
      '아파트와 논과 공장이 차례로 지나갔다.',
      '이제 여기서 일한다.'],
  },
];

// 상태에 맞는 결말 하나 (없으면 null)
export function evaluateEnding(state, where) {
  for (const e of ENDINGS) {
    if (where !== 'goal' && e.when !== 'any') continue; // 도착 전에는 즉시 결말만 본다
    if (e.test(state)) return e;
  }
  return null;
}

export const ENDING_COUNT = ENDINGS.length;

// 태그별 색 (엔딩 화면·목록에서 쓴다)
export const TAG_COLOR = {
  good: '#8fc48a', bad: '#e2705f', odd: '#f2c14e', true: '#a8c8f0',
};
export const TAG_LABEL = {
  good: '무사히', bad: '사고', odd: '이상하게', true: '숨은',
};
