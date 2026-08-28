// 도수(度). 코드는 "루트에서 몇 도 위인 음들" 의 모음이므로, 여기가 코드 이론의 뿌리다.
// 도수는 {num, alter} 로 적는다. num 은 1~13, alter 는 ♭(-1) ♮(0) ♯(+1) ♭♭(-2).

import { LETTER_PC, makeNote } from './notes.js';

// 장음계 기준 반음 수. 9·11·13 은 옥타브 위(2·4·6도)다.
export const DEGREE_SEMI = { 1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11, 9: 14, 11: 17, 13: 21 };

const SIGN = { '-2': '♭♭', '-1': '♭', 0: '', 1: '♯', 2: '♯♯' };

// 화면에 찍는 짧은 이름: R ♭3 5 ♭7 ♯11
export function degShort(d) {
  return d.num === 1 && !d.alter ? 'R' : SIGN[String(d.alter)] + d.num;
}

// 말로 풀어 쓴 이름: 1도(루트) · ♭3도 · 완전5도
export function degLabel(d) {
  if (d.num === 1 && !d.alter) return '1도 (루트)';
  if (d.num === 5 && !d.alter) return '완전5도';
  if (d.num === 3 && d.alter === 0) return '3도 (장3도)';
  if (d.num === 3 && d.alter === -1) return '♭3도 (단3도)';
  if (d.num === 7 && d.alter === 0) return '7도 (장7도)';
  if (d.num === 7 && d.alter === -1) return '♭7도 (단7도)';
  if (d.num === 7 && d.alter === -2) return '♭♭7도 (감7도)';
  return SIGN[String(d.alter)] + d.num + '도';
}

// 그 도수가 코드에서 맡는 일. 한 줄 설명은 화면에 그대로 뜬다.
export function degRole(d) {
  if (d.num === 1) return { key: 'R', text: '코드의 이름이 되는 음. 베이스가 맡는다.' };
  if (d.num === 3) return { key: '3', text: '밝은가 어두운가를 혼자 정한다. 메이저와 마이너를 가르는 음.' };
  if (d.num === 4 || d.num === 2) return { key: '3', text: '3음 대신 들어가 붕 뜬 소리를 만든다 (sus).' };
  if (d.num === 5) {
    if (d.alter) return { key: '5', text: '변형된 5도. 이 코드의 성격 자체라 뺄 수 없다.' };
    return { key: '5', text: '뼈대는 되지만 색은 없다. 자리가 모자라면 제일 먼저 뺀다.' };
  }
  if (d.num === 7 || d.num === 6) return { key: '7', text: '7 코드인지 아닌지를 정한다. 어지간하면 남긴다.' };
  return { key: 'T', text: '텐션. 코드의 색깔이다. 이름에 붙어 있으면 남기고, 아니면 뺀다.' };
}

// 자리가 모자랄 때 무엇부터 남길지. 숫자가 작을수록 먼저 남는다.
// 루트 → 3음 → 7음 → 텐션(낮은 것부터) → 완전5도 순서.
export function keepRank(d) {
  if (d.num === 1) return 0;
  if (d.num === 3 || d.num === 4 || d.num === 2) return 1;
  if (d.num === 5 && d.alter) return 2;          // ♭5 ♯5 는 성격이라 일찍 남긴다
  if (d.num === 7 || d.num === 6) return 3;
  if (d.num === 9) return 4;
  if (d.num === 11) return 5;
  if (d.num === 13) return 6;
  if (d.num === 5) return 9;                     // 완전5도가 마지막
  return 7;
}

// 루트 음에서 도수만큼 올라간 음을 정확한 철자로 만든다.
// (C 의 ♭3 은 E♭ 이지 D♯ 이 아니다 — 3도는 항상 세 번째 글자여야 한다)
export function degToNote(root, d) {
  const semi = DEGREE_SEMI[d.num] + (d.alter || 0);
  const abs = root.letter + (d.num - 1);
  const letter = ((abs % 7) + 7) % 7;
  const carry = Math.floor(abs / 7);
  const alter = LETTER_PC[root.letter] + root.alter + semi - carry * 12 - LETTER_PC[letter];
  return makeNote(letter, alter, root.oct + carry);
}

// 도수를 반음 수(0~23)로
export function degSemi(d) {
  return DEGREE_SEMI[d.num] + (d.alter || 0);
}

// 반음 수(0~11)를 도수로 되짚는다 — 지판 지도에서 "이 자리는 몇 도인가" 를 찍을 때 쓴다.
export function semiToDeg(semi, tones) {
  const s = ((semi % 12) + 12) % 12;
  for (const t of tones) if (((degSemi(t) % 12) + 12) % 12 === s) return t;
  return null;
}
