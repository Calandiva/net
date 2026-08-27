// 길에 사는 것들 — 지나가는 사람과 고양이.
// 청크 단위로 시드에서 태어나고, 화면에서 멀어지면 사라진다.

import { SEED, NPC, TILE, GROUND } from '../config.js';
import { makeRng } from '../util/rng.js';

const CH = TILE.chunk;
const CAT_CHANCE = 0.22;      // 청크마다 고양이가 있을 확률
const DESPAWN_CHUNKS = 3;     // 이 거리(청크)를 넘으면 정리한다

export class Actors {
  constructor(map) {
    this.map = map;
    this.chunks = new Map();   // 청크키 → 액터 배열
  }

  // 보이는 범위의 청크에 사는 것들을 준비한다
  ensure(cx0, cy0, cx1, cy1) {
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const key = cx * 100000 + cy;
        if (this.chunks.has(key)) continue;
        this.chunks.set(key, this._spawn(cx, cy));
      }
    }
    // 멀어진 청크 정리
    for (const key of [...this.chunks.keys()]) {
      const cx = Math.round(key / 100000), cy = key - cx * 100000;
      if (cx < cx0 - DESPAWN_CHUNKS || cx > cx1 + DESPAWN_CHUNKS ||
          cy < cy0 - DESPAWN_CHUNKS || cy > cy1 + DESPAWN_CHUNKS) {
        this.chunks.delete(key);
      }
    }
  }

  _spawn(cx, cy) {
    const rng = makeRng(SEED, 'actors', cx, cy);
    const chunk = this.map.chunk(cx, cy);
    const spots = [];
    for (let i = 0; i < CH * CH; i++) {
      if (chunk.solid[i]) continue;
      if (NPC.spawnGrounds.includes(chunk.ground[i])) spots.push(i);
    }
    if (!spots.length) return [];

    const out = [];
    const count = Math.min(NPC.perChunk, Math.floor(spots.length / 40));
    for (let i = 0; i < count; i++) {
      const idx = rng.pick(spots);
      out.push(this._make(cx, cy, idx, rng, 'npc'));
    }
    if (rng.chance(CAT_CHANCE)) {
      out.push(this._make(cx, cy, rng.pick(spots), rng, 'cat'));
    }
    return out;
  }

  _make(cx, cy, idx, rng, kind) {
    const tx = cx * CH + (idx % CH), ty = cy * CH + Math.floor(idx / CH);
    const x = tx * TILE.size + TILE.size / 2, y = ty * TILE.size + TILE.size / 2;
    return {
      kind, x, y, homeX: x, homeY: y,
      dir: 'down', anim: rng.range(0, 4), moving: false,
      seed: rng.int(0, 9999), speed: NPC.speed * rng.range(0.7, 1.25),
      targetX: x, targetY: y, wait: rng.range(0, 2.5),
      id: `${cx}:${cy}:${idx}:${kind}`,
    };
  }

  // 눈에 보이는 것들만 훑는다
  *visible(cx0, cy0, cx1, cy1) {
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const list = this.chunks.get(cx * 100000 + cy);
        if (list) for (const a of list) yield a;
      }
    }
  }

  update(dt, cx0, cy0, cx1, cy1) {
    for (const a of this.visible(cx0, cy0, cx1, cy1)) {
      a.anim += dt;
      if (a.wait > 0) { a.wait -= dt; a.moving = false; continue; }

      const dx = a.targetX - a.x, dy = a.targetY - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 2) {
        // 새 목적지 — 태어난 자리 근처로만
        const rng = makeRng(SEED, 'wander', a.id, Math.floor(a.anim));
        const r = NPC.wanderRadius * (a.kind === 'cat' ? 0.5 : 1);
        a.targetX = a.homeX + rng.range(-r, r);
        a.targetY = a.homeY + rng.range(-r, r);
        a.wait = rng.range(0.4, a.kind === 'cat' ? 4 : 2);
        a.moving = false;
        continue;
      }

      const speed = a.speed * (a.kind === 'cat' ? 0.55 : 1);
      const nx = a.x + (dx / dist) * speed * dt;
      const ny = a.y + (dy / dist) * speed * dt;
      const tx = Math.floor(nx / TILE.size), ty = Math.floor(ny / TILE.size);
      if (this.map.isSolid(tx, ty)) {
        a.targetX = a.x; a.targetY = a.y; a.wait = 0.3;
        continue;
      }
      a.x = nx; a.y = ny; a.moving = true;
      a.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    }
  }

  // 플레이어 근처의 고양이 (쓰다듬기용)
  nearestCat(x, y, radius) {
    let best = null, bestD = radius;
    for (const list of this.chunks.values()) {
      for (const a of list) {
        if (a.kind !== 'cat') continue;
        const d = Math.hypot(a.x - x, a.y - y);
        if (d < bestD) { bestD = d; best = a; }
      }
    }
    return best;
  }
}
