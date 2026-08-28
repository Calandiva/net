// 드럼은 음 높이가 없으므로 오선의 자리를 악기마다 미리 정해 둔다.
// pos = 맨 아래 줄이 0, 한 칸(줄↔칸)마다 1. up 은 기둥 방향(손은 위, 발은 아래).

export const DRUM_MAP = {
  CR: { pos: 10, head: 'x', up: true,  name: '크래시' },
  HH: { pos: 9,  head: 'x', up: true,  name: '하이햇' },
  RD: { pos: 8,  head: 'x', up: true,  name: '라이드' },
  T1: { pos: 7,  head: 'normal', up: true, name: '하이탐' },
  T2: { pos: 6,  head: 'normal', up: true, name: '미드탐' },
  SN: { pos: 5,  head: 'normal', up: true, name: '스네어' },
  FT: { pos: 3,  head: 'normal', up: true, name: '플로어탐' },
  BD: { pos: 1,  head: 'normal', up: false, name: '베이스드럼(킥)' },
  HF: { pos: -1, head: 'x', up: false, name: '하이햇 페달' },
};

export const LESSON_DRUMS = {
  id: 'drums',
  title: '드럼',
  tagline: '음정이 없다. 대신 시간을 정확히 나누는 일을 한다.',
  gear: ['드럼 또는 연습패드', '스틱 5A', '메트로놈'],
  steps: [
    { n: 1, title: '스틱 잡기', body: ['엄지와 검지로 받침점을 만들고 나머지 세 손가락은 가볍게 감싼다.', '받침점은 스틱 끝에서 1/3 지점.'], tip: '꽉 쥐면 튕김이 죽는다. 스틱이 알아서 튀어 오르게 둔다.' },
    { n: 2, title: '악보 읽기', body: ['오선에 자리를 정해 놓고 쓴다. ✕ 는 심벌, ● 는 북.', '위 칸이 하이햇, 가운데가 스네어, 아래 칸이 킥.'], tip: '기둥이 위로 붙은 것은 손, 아래로 붙은 것은 발이다.' },
    { n: 3, title: '8비트', body: ['하이햇을 8분음표로 쉬지 않고, 2·4박에 스네어, 1·3박에 킥.', '이 한 줄이 대중음악의 절반이다.'], tip: '하이햇만 먼저 → 킥 추가 → 스네어 추가. 한 번에 셋을 하지 않는다.' },
    { n: 4, title: '박 세기', body: ['"하나 둘 셋 넷" 을 소리 내어 세면서 친다.', '8분음표는 "하나 앤 둘 앤".'], tip: '' },
    { n: 5, title: '필인', body: ['네 마디마다 마지막 한 마디를 탐으로 채워 다음으로 넘긴다.', '처음에는 스네어만으로도 된다.'], tip: '' },
  ],
  scores: [
    {
      title: '8비트 기본 — 하이햇 8분 · 2·4박 스네어 · 1·3박 킥',
      spec: { clef: 'perc', time: [4, 4], percMap: DRUM_MAP, measures: [
        [{ p: ['HH', 'BD'], d: 8, text: '1' }, { p: 'HH', d: 8, text: '앤' },
         { p: ['HH', 'SN'], d: 8, text: '2' }, { p: 'HH', d: 8, text: '앤' },
         { p: ['HH', 'BD'], d: 8, text: '3' }, { p: 'HH', d: 8, text: '앤' },
         { p: ['HH', 'SN'], d: 8, text: '4' }, { p: 'HH', d: 8, text: '앤' }],
      ] },
    },
    {
      title: '간단한 필인 — 스네어에서 탐으로 내려간다',
      spec: { clef: 'perc', time: [4, 4], percMap: DRUM_MAP, measures: [
        [{ p: 'SN', d: 8 }, { p: 'SN', d: 8 }, { p: 'T1', d: 8 }, { p: 'T1', d: 8 },
         { p: 'T2', d: 8 }, { p: 'T2', d: 8 }, { p: 'FT', d: 8 }, { p: 'FT', d: 8 }],
        [{ p: ['CR', 'BD'], d: 4 }, { p: null, d: 4 }, { p: null, d: 2 }],
      ] },
    },
  ],
  practice: ['메트로놈 70 에 8비트 4분간 끊지 않고.', '왼손만 · 오른손만 따로 연습패드에서 5분씩.'],
};
