// 조정 가능한 값은 전부 여기에 둔다. 다른 파일에 숫자를 흩뿌리지 않는다.

export const APP = {
  name: 'GGYEMSSBBYOKK',
  subtitle: '코드 사전 · 튜너 · 메트로놈',
  storageKey: 'ggyemssbbyokk-v1',
};

// 위쪽 탭. inst 가 있으면 코드 사전 화면이고, 그 값이 어느 악기인지 정한다.
export const TABS = [
  { id: 'guitar',  label: '기타',     icon: '🎸', inst: 'guitar' },
  { id: 'bass',    label: '베이스',   icon: '🎻', inst: 'bass' },
  { id: 'keys',    label: '건반',     icon: '🎹', inst: 'keys' },
  { id: 'ukulele', label: '우쿨렐레', icon: '🪕', inst: 'ukulele' },
  { id: 'tuner',   label: '튜너',     icon: '📡' },
  { id: 'metro',   label: '메트로놈', icon: '⏱' },
];

// 도수별 색. 악보 · 지판 · 건반이 전부 이 색을 쓴다(같은 도수는 어디서나 같은 색).
export const DEG_COLOR = {
  R: '#e4572e',   // 1도 뿌리
  3: '#3d7dca',   // 3음 — 밝고 어두움
  5: '#5aa469',   // 5음 — 뼈대
  7: '#a45ec4',   // 7음 — 성격
  T: '#d9a441',   // 텐션 9 11 13
  X: '#8b8b8b',   // 생략된 음
};

export const COLOR = {
  bg: '#12141a', panel: '#191c24', panel2: '#20242e', line: '#2e3440',
  ink: '#e8e6e1', dim: '#9aa0ac', accent: '#e4572e', ok: '#5aa469', warn: '#d9a441',
  paper: '#f7f5f0',      // 악보 바탕
  paperInk: '#1a1a1a',   // 악보 잉크
};

// 악보 그리기 기준값(px). s = 줄 간격 하나.
export const STAFF_METRIC = {
  s: 10,             // 오선 줄 간격
  noteR: 5.6,        // 음표 머리 반지름(가로)
  stem: 30,          // 기둥 길이
  leftPad: 46,       // 클레프 자리
  measurePad: 18,
  noteGap: 34,       // 음표 하나가 차지하는 가로폭 기준
};

// 현악기 조율(개방현 MIDI 번호, 낮은 줄부터). 튜너와 지판이 함께 쓴다.
export const TUNINGS = {
  guitar:      { inst: 'guitar', short: '기타 표준', label: '기타 표준 EADGBE', strings: [40, 45, 50, 55, 59, 64], names: ['6E', '5A', '4D', '3G', '2B', '1E'] },
  guitarDrop:  { inst: 'guitar', short: '드롭 D',    label: '기타 드롭 D',      strings: [38, 45, 50, 55, 59, 64], names: ['6D', '5A', '4D', '3G', '2B', '1E'] },
  guitarHalf:  { inst: 'guitar', short: '반음 내림', label: '기타 반음 내림',   strings: [39, 44, 49, 54, 58, 63], names: ['6E♭', '5A♭', '4D♭', '3G♭', '2B♭', '1E♭'] },
  guitarDADGAD:{ inst: 'guitar', short: 'DADGAD',   label: '기타 DADGAD',      strings: [38, 45, 50, 55, 57, 62], names: ['6D', '5A', '4D', '3G', '2A', '1D'] },
  guitarOpenG: { inst: 'guitar', short: '오픈 G',   label: '기타 오픈 G DGDGBD', strings: [38, 43, 50, 55, 59, 62], names: ['6D', '5G', '4D', '3G', '2B', '1D'] },
  bass:        { inst: 'bass',   short: '베이스 4현', label: '베이스 4현 EADG',  strings: [28, 33, 38, 43],        names: ['4E', '3A', '2D', '1G'] },
  bass5:       { inst: 'bass',   short: '베이스 5현', label: '베이스 5현 BEADG', strings: [23, 28, 33, 38, 43],    names: ['5B', '4E', '3A', '2D', '1G'] },
  bass6:       { inst: 'bass',   short: '베이스 6현', label: '베이스 6현 BEADGC', strings: [23, 28, 33, 38, 43, 48], names: ['6B', '5E', '4A', '3D', '2G', '1C'] },
  // 하이G 는 4번 줄이 제일 높다(재진입 조율). 그래서 "베이스가 루트" 라는 규칙이 성립하지 않는다.
  ukulele:     { inst: 'ukulele', short: '우쿨렐레 하이G', label: '우쿨렐레 GCEA (하이 G)', reentrant: true, strings: [67, 60, 64, 69], names: ['4G', '3C', '2E', '1A'] },
  ukuleleLow:  { inst: 'ukulele', short: '우쿨렐레 로우G', label: '우쿨렐레 GCEA (로우 G)', strings: [55, 60, 64, 69], names: ['4G', '3C', '2E', '1A'] },
};

// 악기별 기본값. 코드 사전 화면이 이걸 보고 자기 모습을 정한다.
export const INSTRUMENTS = {
  guitar:  { label: '기타',     icon: '🎸', kind: 'fret', tunings: ['guitar', 'guitarDrop', 'guitarHalf', 'guitarDADGAD', 'guitarOpenG'], clef: 'treble', octaveShift: 12 },
  bass:    { label: '베이스',   icon: '🎻', kind: 'bass', tunings: ['bass', 'bass5', 'bass6'], clef: 'bass', octaveShift: 12 },
  ukulele: { label: '우쿨렐레', icon: '🪕', kind: 'fret', tunings: ['ukulele', 'ukuleleLow'], clef: 'treble', octaveShift: 0 },
  keys:    { label: '건반',     icon: '🎹', kind: 'keys', tunings: [], clef: 'grand', octaveShift: 0 },
};

// 지판 그림 크기
export const FRET_METRIC = {
  stringGap: 20,
  fretGap: 30,
  dotR: 7,
  pad: 26,
  windowFrets: 5,     // 코드 다이어그램에 보여 줄 프렛 수
  mapFrets: 12,       // 지판 전체 지도에 보여 줄 프렛 수
};

// 건반 그림 크기
export const KEY_METRIC = {
  whiteW: 22, whiteH: 104, blackW: 13, blackH: 66,
  lowMidi: 36,        // C2 부터
  octaves: 4,
};

export const AUDIO = {
  a4: 440,            // 기준음. 튜너에서 바꿀 수 있다(415~466)
  master: 0.22,
  noteDur: 1.1,
  strumGap: 0.045,    // 기타 스트로크 간격(초)
  arpGap: 0.16,       // 아르페지오 간격(초)
};

export const METRO = {
  bpmMin: 30, bpmMax: 260, bpmDefault: 90,
  lookahead: 0.1,     // 스케줄러가 미리 잡아 두는 시간(초)
  tick: 25,           // 스케줄러 주기(ms)
  // 소리 종류: [강세, 박, 쪼갠 것] 주파수
  voices: {
    click: { label: '클릭', hz: [1560, 900, 640], type: 'square', dur: 0.055 },
    wood:  { label: '우드블록', hz: [1200, 760, 560], type: 'triangle', dur: 0.075 },
    beep:  { label: '전자음', hz: [1800, 1200, 880], type: 'sine', dur: 0.06 },
    tick:  { label: '메트로놈', hz: [2400, 1500, 1100], type: 'square', dur: 0.03 },
  },
  trainerBars: 4,     // 자동 증속: 몇 마디마다 올릴지
  trainerStep: 5,     // 몇 BPM 씩 올릴지
};

export const TUNER = {
  fftSize: 8192,      // 낮은 음(5현 베이스 B0)까지 잡으려면 이만큼 필요하다
  minHz: 28,          // B0(30.9Hz) 아래로 여유
  maxHz: 1300,
  clarityMin: 0.72,   // 이보다 흐린 신호는 무시. 배음이 센 악기는 1.0 이 안 나온다
  inTuneCents: 5,     // 이 안이면 맞은 것으로 본다
  smooth: 0.25,       // 표시값 부드럽게
  periodMs: 45,       // 음정 재는 주기(ms). 매 프레임 재면 무겁다
  historyLen: 140,    // 센트 그래프에 남길 점 개수
  a4Min: 415, a4Max: 466,
};
