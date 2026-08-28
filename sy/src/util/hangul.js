// 조사 붙이기. "장바구니을(를)" 같은 말이 나오지 않게 한다.
//
//   josa('장바구니', '을/를') → '를'
//   josa('소화기', '으로/로')  → '로'

export function josa(word, pair) {
  const [withJong, withoutJong] = pair.split('/');
  const last = String(word || '').trim().slice(-1);
  const code = last.charCodeAt(0);
  if (!(code >= 0xac00 && code <= 0xd7a3)) return withoutJong;  // 한글이 아니면 받침 없는 쪽
  const jong = (code - 0xac00) % 28;
  // '으로/로' 는 ㄹ 받침도 받침 없는 쪽을 쓴다
  if (jong === 8 && pair.startsWith('으로')) return withoutJong;
  return jong ? withJong : withoutJong;
}

// 이름 + 조사
export function withJosa(word, pair) {
  return `${word}${josa(word, pair)}`;
}
