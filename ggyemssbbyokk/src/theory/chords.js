// 코드 사전과 코드 이름 해석기.
// 새 코드를 넣고 싶으면 CHORD_TYPES 에 한 줄, 부르는 이름은 ALIAS 에 적으면 된다.

import { parseNote, noteName } from './notes.js';

const d = (num, alter) => ({ num, alter: alter || 0 });

// id: 코드 종류. sym: 화면에 찍을 기호. degs: 들어가는 도수. hint: 한 줄 설명.
export const CHORD_TYPES = {
  maj:     { sym: '',       name: '메이저',        degs: [d(1), d(3), d(5)],                       hint: '가장 기본. 밝다.' },
  m:       { sym: 'm',      name: '마이너',        degs: [d(1), d(3, -1), d(5)],                   hint: '3음만 반음 내리면 어두워진다.' },
  five:    { sym: '5',      name: '파워코드',      degs: [d(1), d(5)],                             hint: '3음이 없어 밝지도 어둡지도 않다. 락 기타의 기본.' },
  dim:     { sym: 'dim',    name: '디미니시',      degs: [d(1), d(3, -1), d(5, -1)],               hint: '3음과 5음을 다 내렸다. 불안하다.' },
  aug:     { sym: 'aug',    name: '어그멘트',      degs: [d(1), d(3), d(5, 1)],                    hint: '5음을 올렸다. 붕 떠서 다음 코드로 밀린다.' },
  sus4:    { sym: 'sus4',   name: '서스포',        degs: [d(1), d(4), d(5)],                       hint: '3음 자리에 4음. 해결되기를 기다리는 소리.' },
  sus2:    { sym: 'sus2',   name: '서스투',        degs: [d(1), d(2), d(5)],                       hint: '3음 자리에 2음. 맑고 넓다.' },
  six:     { sym: '6',      name: '식스',          degs: [d(1), d(3), d(5), d(6)],                 hint: '7음 대신 6음. 편안하게 끝난다.' },
  m6:      { sym: 'm6',     name: '마이너 식스',   degs: [d(1), d(3, -1), d(5), d(6)],             hint: '어둡지만 축축하지 않다.' },
  sixnine: { sym: '6/9',    name: '식스나인',      degs: [d(1), d(3), d(5), d(6), d(9)],           hint: '마지막 마디에 자주 쓰는 넉넉한 소리.' },
  dom7:    { sym: '7',      name: '세븐스',        degs: [d(1), d(3), d(5), d(7, -1)],             hint: '어딘가로 가고 싶어 한다. 블루스의 기본.' },
  maj7:    { sym: 'maj7',   name: '메이저 세븐',   degs: [d(1), d(3), d(5), d(7)],                 hint: '몽글몽글하다. 발라드와 재즈.' },
  m7:      { sym: 'm7',     name: '마이너 세븐',   degs: [d(1), d(3, -1), d(5), d(7, -1)],         hint: '가장 무난한 어두운 코드.' },
  mmaj7:   { sym: 'mMaj7',  name: '마이너 메이저 세븐', degs: [d(1), d(3, -1), d(5), d(7)],        hint: '어두운데 위가 삐죽하다. 영화 음악.' },
  m7b5:    { sym: 'm7♭5',   name: '하프 디미니시', degs: [d(1), d(3, -1), d(5, -1), d(7, -1)],     hint: '마이너 2-5-1 의 첫 코드.' },
  dim7:    { sym: 'dim7',   name: '디미니시 세븐', degs: [d(1), d(3, -1), d(5, -1), d(7, -2)],     hint: '단3도 간격 네 개. 어디로든 이어진다.' },
  sus7:    { sym: '7sus4',  name: '세븐 서스포',   degs: [d(1), d(4), d(5), d(7, -1)],             hint: '7 코드인데 아직 3음을 안 낸다.' },
  add9:    { sym: 'add9',   name: '애드나인',      degs: [d(1), d(3), d(5), d(9)],                 hint: '7음 없이 9음만 얹는다. 기타 팝의 단골.' },
  madd9:   { sym: 'madd9',  name: '마이너 애드나인', degs: [d(1), d(3, -1), d(5), d(9)],           hint: '어두운데 맑다.' },
  dom9:    { sym: '9',      name: '나인',          degs: [d(1), d(3), d(5), d(7, -1), d(9)],       hint: '펑크와 소울의 그 소리.' },
  maj9:    { sym: 'maj9',   name: '메이저 나인',   degs: [d(1), d(3), d(5), d(7), d(9)],           hint: 'maj7 보다 한 겹 넓다.' },
  m9:      { sym: 'm9',     name: '마이너 나인',   degs: [d(1), d(3, -1), d(5), d(7, -1), d(9)],   hint: '시티팝의 그 코드.' },
  dom11:   { sym: '11',     name: '일레븐',        degs: [d(1), d(5), d(7, -1), d(9), d(11)],      hint: '3음은 11도와 반음으로 부딪혀서 아예 뺀다.' },
  m11:     { sym: 'm11',    name: '마이너 일레븐', degs: [d(1), d(3, -1), d(5), d(7, -1), d(9), d(11)], hint: '♭3 과 11 은 부딪히지 않는다.' },
  dom13:   { sym: '13',     name: '서틴',          degs: [d(1), d(3), d(5), d(7, -1), d(9), d(13)], hint: '실제로는 5음과 9음을 빼고 네 개만 잡는다.' },
  maj13:   { sym: 'maj13',  name: '메이저 서틴',   degs: [d(1), d(3), d(5), d(7), d(9), d(13)],    hint: '' },
  m13:     { sym: 'm13',    name: '마이너 서틴',   degs: [d(1), d(3, -1), d(5), d(7, -1), d(9), d(13)], hint: '' },
  dom7b9:  { sym: '7♭9',    name: '세븐 플랫나인', degs: [d(1), d(3), d(5), d(7, -1), d(9, -1)],   hint: '마이너로 가는 길목.' },
  dom7s9:  { sym: '7♯9',    name: '세븐 샵나인',   degs: [d(1), d(3), d(5), d(7, -1), d(9, 1)],    hint: '헨드릭스 코드.' },
  dom7s5:  { sym: '7♯5',    name: '세븐 샵파이브', degs: [d(1), d(3), d(5, 1), d(7, -1)],          hint: '' },
  dom7b5:  { sym: '7♭5',    name: '세븐 플랫파이브', degs: [d(1), d(3), d(5, -1), d(7, -1)],       hint: '' },
  dom7s11: { sym: '7♯11',   name: '세븐 샵일레븐', degs: [d(1), d(3), d(5), d(7, -1), d(11, 1)],   hint: '' },
  maj7s11: { sym: 'maj7♯11', name: '메이저 세븐 샵일레븐', degs: [d(1), d(3), d(5), d(7), d(11, 1)], hint: '리디안의 소리.' },
  alt:     { sym: '7alt',   name: '얼터드',        degs: [d(1), d(3), d(7, -1), d(9, 1), d(13, -1)], hint: '5음을 아예 안 잡는다. 가장 긴장된 도미넌트.' },
};

// 사람이 치는 온갖 표기 → 위의 id
const ALIAS = {
  '': 'maj', 'maj': 'maj', 'major': 'maj',
  'm': 'm', 'min': 'm', 'minor': 'm', '-': 'm',
  '5': 'five', 'no3': 'five',
  'dim': 'dim', 'o': 'dim',
  'aug': 'aug', '+': 'aug', 'maj#5': 'aug',
  'sus4': 'sus4', 'sus': 'sus4', 'sus2': 'sus2',
  '6': 'six', 'm6': 'm6', 'min6': 'm6', '6/9': 'sixnine', '69': 'sixnine', '6add9': 'sixnine',
  '7': 'dom7', 'dom7': 'dom7',
  'maj7': 'maj7', 'ma7': 'maj7', 'major7': 'maj7',
  'm7': 'm7', 'min7': 'm7', '-7': 'm7',
  'mmaj7': 'mmaj7', 'minmaj7': 'mmaj7', '-maj7': 'mmaj7',
  'm7b5': 'm7b5', 'min7b5': 'm7b5', 'halfdim': 'm7b5', 'o7b5': 'm7b5',
  'dim7': 'dim7', 'o7': 'dim7',
  '7sus4': 'sus7', '7sus': 'sus7', 'sus47': 'sus7',
  'add9': 'add9', 'add2': 'add9', 'madd9': 'madd9', 'madd2': 'madd9', 'minadd9': 'madd9',
  '9': 'dom9', 'maj9': 'maj9', 'ma9': 'maj9', 'm9': 'm9', 'min9': 'm9', '-9': 'm9',
  '11': 'dom11', 'm11': 'm11', 'min11': 'm11',
  '13': 'dom13', 'maj13': 'maj13', 'm13': 'm13', 'min13': 'm13',
  '7b9': 'dom7b9', '7#9': 'dom7s9', '7+9': 'dom7s9',
  '7#5': 'dom7s5', '7+5': 'dom7s5', '7aug5': 'dom7s5',
  '7b5': 'dom7b5', '7#11': 'dom7s11', 'maj7#11': 'maj7s11',
  'alt': 'alt', '7alt': 'alt',
};

// 표기를 사전 열쇠 꼴로 다듬는다. 대문자 M 과 소문자 m 이 다른 뜻이라 순서가 중요하다.
function normSuffix(raw) {
  let s = String(raw || '').trim();
  s = s.replace(/[♯]/g, '#').replace(/[♭]/g, 'b').replace(/[△Δ]/g, 'maj7');
  s = s.replace(/[øØ]/g, 'm7b5').replace(/[°º]/g, 'dim').replace(/\s+/g, '');
  s = s.replace(/^(m|min|-)(M|Maj|MAJ|maj)7/, 'mmaj7');   // mM7 = 마이너 메이저 세븐
  s = s.replace(/^(Maj|MAJ|Ma|M)(?=7|9|11|13|#|$)/, 'maj'); // 대문자 M 은 메이저
  return s.toLowerCase();
}

// "Cmaj7/E" → { root, type, degs, bass, sym, text } · 못 읽으면 null
export function parseChord(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;
  const slash = raw.split('/');
  // 6/9 처럼 기호 안에 빗금이 있는 경우를 먼저 걸러 낸다
  let head = raw, bassStr = null;
  if (slash.length === 2 && !/^\d/.test(slash[1])) { head = slash[0]; bassStr = slash[1]; }

  const m = /^([A-Ga-g])([#b♯♭]*)(.*)$/.exec(head.trim());
  if (!m) return null;
  const root = parseNote(m[1] + m[2].replace(/♯/g, '#').replace(/♭/g, 'b'), 4);
  if (!root) return null;

  const id = ALIAS[normSuffix(m[3])];
  if (!id) return null;
  const type = CHORD_TYPES[id];

  let bass = null;
  if (bassStr) {
    bass = parseNote(bassStr.replace(/♯/g, '#').replace(/♭/g, 'b'), 3);
    if (!bass) return null;
  }

  const sym = noteName(root) + type.sym + (bass ? '/' + noteName(bass) : '');
  return { id, root, type, degs: type.degs.slice(), bass, sym, name: type.name, hint: type.hint };
}

// 자동완성 · 예시용 코드 목록
export function chordExamples(rootName) {
  const r = rootName || 'C';
  return ['', 'm', '7', 'maj7', 'm7', 'sus4', 'm7♭5', 'dim7', 'add9', '9', 'm9', '13']
    .map((s) => r + s);
}
