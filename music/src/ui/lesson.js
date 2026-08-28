// 파트별 튜토리얼 화면. lesson/*.js 의 자료를 그대로 그린다.

import { el, clear } from './../util/dom.js';
import { renderScore } from './../render/staff.js';

export function mountLesson(host, lesson) {
  clear(host);

  host.appendChild(el('div.page-head', [
    el('h2', lesson.title),
    el('p.tagline', lesson.tagline),
    el('div.chips.static', lesson.gear.map((g) => el('span.chip.ghost', g))),
  ]));

  host.appendChild(el('div.steps', lesson.steps.map((s) => el('div.card.step', [
    el('div.step-no', String(s.n)),
    el('div.step-body', [
      el('h3', s.title),
      el('ul', s.body.map((b) => el('li', b))),
      s.tip ? el('p.tip', [el('b', '요령 '), s.tip]) : null,
    ]),
  ]))));

  host.appendChild(el('h3.section', '예시 악보'));
  lesson.scores.forEach((sc) => {
    const box = el('div.card.score-card', [el('div.score-title', sc.title)]);
    const wrap = el('div.score-scroll');
    wrap.appendChild(renderScore(sc.spec));
    box.appendChild(wrap);
    if (sc.note) box.appendChild(el('p.tip', sc.note));
    host.appendChild(box);
  });

  host.appendChild(el('h3.section', '오늘 할 것'));
  host.appendChild(el('div.card', [el('ul', lesson.practice.map((p) => el('li', p)))]));
}
