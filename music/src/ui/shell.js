// 전체 껍데기. 위쪽 탭과 본문 자리를 만들고, 탭에 맞는 화면을 붙인다.

import { APP, TABS } from './../config.js';
import { el, clear } from './../util/dom.js';
import { LESSONS } from './../lesson/index.js';
import { mountLesson } from './lesson.js';
import { mountChordLab } from './chordlab.js';
import { mountTuner } from './tuner.js';
import { mountMetronome } from './metronome.js';

let current = null;

export function mountShell(root) {
  clear(root);
  const body = el('main.body');
  const tabs = el('nav.tabs');

  TABS.forEach((t) => {
    const b = el('button.tab', { type: 'button', 'data-id': t.id },
      [el('span.tab-icon', t.icon), el('span.tab-label', t.label)]);
    b.addEventListener('click', () => go(t.id));
    tabs.appendChild(b);
  });

  root.appendChild(el('header.top', [
    el('div.brand', [el('b', APP.title), el('span', APP.subtitle)]),
    tabs,
  ]));
  root.appendChild(body);
  root.appendChild(el('footer.foot', '학원 없이 혼자 보는 악기 교실 · 서버 없이 이 파일 하나로 돈다'));

  function go(id) {
    current = id;
    try { localStorage.setItem(APP.storageKey, id); } catch (e) { /* 막혀 있어도 상관없다 */ }
    if (location.hash.slice(1) !== id) location.hash = id;
    tabs.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.id === id));
    body.scrollTop = 0;
    render(body, id);
  }

  window.addEventListener('hashchange', () => {
    const id = location.hash.slice(1);
    if (id && id !== current && TABS.some((t) => t.id === id)) go(id);
  });

  let start = location.hash.slice(1);
  if (!start || !TABS.some((t) => t.id === start)) {
    try { start = localStorage.getItem(APP.storageKey); } catch (e) { start = null; }
  }
  go(TABS.some((t) => t.id === start) ? start : 'vocal');
}

function render(body, id) {
  clear(body);
  const page = el('div.page');
  body.appendChild(page);
  if (LESSONS[id]) mountLesson(page, LESSONS[id]);
  else if (id === 'chord') mountChordLab(page);
  else if (id === 'tuner') mountTuner(page);
  else if (id === 'metro') mountMetronome(page);
}
