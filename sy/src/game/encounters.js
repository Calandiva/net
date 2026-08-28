// 사건(encounter) — 무엇을 들고 마주쳤느냐로 하루가 갈리는 자리들.
//
// 내용은 data/encounters_*.js 에 있다. 여기서는 세 묶음을 합치고,
// 지도 위에 놓을 수 있는 형태로 바꾸고, 결과를 고르는 일만 한다.
//
// 사건 하나의 결과(outcome) 하나가 그대로 엔딩 하나가 된다.

import { ENCOUNTERS_CITY } from './data/encounters_city.js';
import { ENCOUNTERS_NATURE } from './data/encounters_nature.js';
import { ENCOUNTERS_DEEP } from './data/encounters_deep.js';
import { ITEM_BY_ID } from './data/items.js';

export const ENCOUNTERS = [
  ...ENCOUNTERS_CITY, ...ENCOUNTERS_NATURE, ...ENCOUNTERS_DEEP,
];

// 사건에 붙는 플래그 이름 — 엔딩 판정이 이 값을 본다
export function encounterFlag(encId, itemId) {
  return `enc:${encId}:${itemId || 'none'}`;
}

// 들고 있는 것에 맞는 결과. 맞는 게 없으면 맨손 결과.
export function pickOutcome(enc, itemId) {
  return enc.outcomes.find((o) => o.item === itemId)
    || enc.outcomes.find((o) => o.item === null || o.item === undefined)
    || enc.outcomes[enc.outcomes.length - 1];
}

// 사건을 만질 수 있는 물건처럼 만들어 준다 (game/gizmos.js 와 같은 모양)
export function encounterGizmos() {
  return ENCOUNTERS.map((enc) => ({
    id: `enc-${enc.id}`,
    icon: enc.icon,
    at: enc.at,
    name: enc.name,
    once: false,          // 결과가 곧 엔딩이라 어차피 한 번이다
    encounter: enc,
  }));
}

// 사건 하나가 만들어 내는 엔딩들
export function encounterEndings() {
  const out = [];
  for (const enc of ENCOUNTERS) {
    for (const o of enc.outcomes) {
      const item = o.item ? ITEM_BY_ID.get(o.item) : null;
      out.push({
        id: `X-${enc.id}-${o.item || 'none'}`,
        title: o.title,
        tag: o.tag || 'odd',
        when: 'any',
        group: enc.name,
        hint: item
          ? `${enc.name} 앞에서 ${item.name}을(를) 쓰면 (${item.from}에게 받는다)`
          : `${enc.name}을(를) 맨손으로 마주하면`,
        test: (s) => s.has(encounterFlag(enc.id, o.item)),
        lines: o.lines,
      });
    }
  }
  return out;
}
