// 게임 진행 상태 — 시계, 플래그, 발견한 엔딩.
// "무엇을 건드렸는가" 가 전부다. 엔딩은 이 상태만 보고 결정된다.

import { GAME, SAVE } from '../config.js';

export class GameState {
  constructor() {
    this.clock = GAME.startClock;     // 게임 내 시각(초)
    this.flags = new Set();           // 건드린 것들
    this.counters = {};               // 횟수를 세는 것들 (고양이 등)
    this.log = [];                    // 무엇을 언제 건드렸는지 (엔딩 화면에 보여 준다)
    this.used = new Set();            // 한 번만 되는 물건
    this.ending = null;               // 결말이 나면 채워진다
    this.startedAt = Date.now();
    this.found = loadFound();         // 지금까지 본 엔딩 (localStorage)
  }

  tick(dt) {
    if (this.ending) return;
    this.clock += dt * GAME.timeScale;
  }

  has(flag) { return this.flags.has(flag); }
  count(key) { return this.counters[key] || 0; }

  set(flag, note) {
    if (!this.flags.has(flag)) {
      this.flags.add(flag);
      if (note) this.log.push({ t: this.clock, note });
    }
  }

  bump(key, n = 1) { this.counters[key] = (this.counters[key] || 0) + n; }

  get late() { return this.clock > GAME.deadline; }
  get touched() { return this.flags.size; }

  clockText() {
    const t = Math.floor(this.clock) % 86400;
    const hh = String(Math.floor(t / 3600)).padStart(2, '0');
    const mm = String(Math.floor((t % 3600) / 60)).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  discover(id) {
    this.found.add(id);
    saveFound(this.found);
  }
}

function loadFound() {
  try {
    const raw = localStorage.getItem(SAVE.key);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw).found || []);
  } catch (e) {
    return new Set(); // 저장이 막힌 환경에서도 게임은 돌아간다
  }
}

function saveFound(found) {
  try {
    localStorage.setItem(SAVE.key, JSON.stringify({ found: [...found] }));
  } catch (e) { /* 저장 못 해도 그만 */ }
}
