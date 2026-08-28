// 음 하나를 다루는 곳. 이 프로젝트의 음은 언제나 {letter, alter, oct} 로 적는다.
//   letter : C=0 D=1 E=2 F=3 G=4 A=5 B=6   (오선 위 세로 위치를 정한다)
//   alter  : -2 ~ +2                        (♭♭ ♭ ♮ ♯ ♯♯)
//   oct    : 국제 표기(가온다 = C4)
// 이렇게 두는 이유: C♯ 과 D♭ 은 소리는 같아도 악보에서 자리가 다르다.
// 피치클래스(0~11) 하나만 들고 다니면 그 구별이 사라진다.

import { AUDIO } from './../config.js';

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
export const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
export const ALTER_SIGN = { '-2': '♭♭', '-1': '♭', 0: '', 1: '♯', 2: '♯♯' };

export function makeNote(letter, alter, oct) {
  return { letter: ((letter % 7) + 7) % 7, alter: alter || 0, oct: oct == null ? 4 : oct };
}

// 오선 위 세로 자리. C0 을 0 으로 두고 한 칸(줄↔칸)마다 1씩 는다.
export function noteStep(n) {
  return n.oct * 7 + n.letter;
}

export function noteMidi(n) {
  return (n.oct + 1) * 12 + LETTER_PC[n.letter] + n.alter;
}

export function notePc(n) {
  return ((LETTER_PC[n.letter] + n.alter) % 12 + 12) % 12;
}

export function noteName(n, withOct) {
  return LETTERS[n.letter] + ALTER_SIGN[String(n.alter)] + (withOct ? n.oct : '');
}

// step 을 되돌려 음으로. 조표가 없으므로 alter 는 따로 준다.
export function noteFromStep(step, alter) {
  return makeNote(((step % 7) + 7) % 7, alter || 0, Math.floor(step / 7));
}

// "C#4" "Bb2" "F##3" "Eb" 같은 글자를 음으로. 실패하면 null.
export function parseNote(s, defOct) {
  const m = /^\s*([A-Ga-g])([#b♯♭x]*)(-?\d+)?\s*$/.exec(String(s || ''));
  if (!m) return null;
  const letter = LETTERS.indexOf(m[1].toUpperCase());
  let alter = 0;
  for (const c of m[2]) {
    if (c === '#' || c === '♯') alter += 1;
    else if (c === 'x') alter += 2;
    else alter -= 1;
  }
  const oct = m[3] != null ? parseInt(m[3], 10) : (defOct == null ? 4 : defOct);
  return makeNote(letter, alter, oct);
}

export function midiToFreq(midi) {
  return AUDIO.a4 * Math.pow(2, (midi - 69) / 12);
}

export function freqToMidi(hz) {
  return 69 + 12 * Math.log2(hz / AUDIO.a4);
}

// 아무 MIDI 번호나 보기 좋은 이름으로(튜너 · 지판 지도용). 조성 정보가 없으면 ♯ 로 적는다.
const SHARP_SPELL = [[0,0],[0,1],[1,0],[1,-1],[2,0],[3,0],[3,1],[4,0],[4,1],[5,0],[5,-1],[6,0]];
const FLAT_SPELL  = [[0,0],[1,-1],[1,0],[2,-1],[2,0],[3,0],[4,-1],[4,0],[5,-1],[5,0],[6,-1],[6,0]];

export function midiToNote(midi, preferFlat) {
  const pc = ((midi % 12) + 12) % 12;
  const oct = Math.floor(midi / 12) - 1;
  const sp = (preferFlat ? FLAT_SPELL : SHARP_SPELL)[pc];
  // B♯ / C♭ 처럼 옥타브가 넘어가는 표기는 쓰지 않으므로 oct 보정이 필요 없다.
  return makeNote(sp[0], sp[1], oct);
}

// 같은 소리인가(이명동음 포함)
export function samePc(a, b) {
  return notePc(a) === notePc(b);
}

// 옥타브만 옮긴 사본
export function transposeOct(n, by) {
  return makeNote(n.letter, n.alter, n.oct + by);
}

// 두 음 사이 반음 수
export function semisBetween(a, b) {
  return noteMidi(b) - noteMidi(a);
}
