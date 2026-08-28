// 출발점(구래역)에서 목적지(양촌공단)까지 정말 걸어갈 수 있는지 확인한다.
// 물길·건물에 막혀 길이 끊기면 여기서 걸린다.
//
//   sy 폴더에서:  node tools/check_path.mjs

import { buildBuildings, doorOutside } from '../src/world/buildings.js';
import { WorldMap } from '../src/world/map.js';
import { project } from '../src/world/geo.js';
import { GAME, PLAYER, GEO } from '../src/config.js';

const t0 = Date.now();
const buildings = buildBuildings();
const map = new WorldMap(buildings);
map.cacheMax = 40000;   // 넓게 훑으므로 청크를 버리지 않는다 (안 그러면 계속 다시 만든다)

const startBuilding = buildings.list.find((b) => b.name === PLAYER.startPlace);
const start = doorOutside(startBuilding);

const [gx, gy] = project([GAME.goal.lon, GAME.goal.lat]).map(Math.round);
const goalR = GAME.goal.radius / GEO.metersPerTile;

// 탐색 범위 — 출발점과 목적지를 넉넉히 감싸는 사각형
const pad = 260;
const minX = Math.floor(Math.min(start.x, gx) - pad);
const maxX = Math.ceil(Math.max(start.x, gx) + pad);
const minY = Math.floor(Math.min(start.y, gy) - pad);
const maxY = Math.ceil(Math.max(start.y, gy) + pad);
const W = maxX - minX, H = maxY - minY;

const seen = new Uint8Array(W * H);
const queue = new Int32Array(W * H);
let head = 0, tail = 0;
const push = (x, y) => {
  const i = (y - minY) * W + (x - minX);
  if (seen[i]) return;
  seen[i] = 1;
  queue[tail++] = i;
};
push(start.x, start.y);

let reached = null, visited = 0;
while (head < tail && !reached) {
  const i = queue[head++];
  const x = (i % W) + minX, y = Math.floor(i / W) + minY;
  visited++;
  if (Math.hypot(x - gx, y - gy) <= goalR) {
    reached = { x, y };
    break;
  }
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx, ny = y + dy;
    if (nx < minX || ny < minY || nx >= maxX || ny >= maxY) continue;
    if (map.isSolid(nx, ny)) continue;
    push(nx, ny);
  }
}

const dist = reached ? Math.hypot(reached.x - start.x, reached.y - start.y) : 0;
console.log(`출발 (${start.x}, ${start.y}) → 목적지 ${GAME.goalName} (${gx}, ${gy})`);
console.log(`탐색 범위 ${W}×${H} 타일 · 방문 ${visited.toLocaleString()}칸 · ${Date.now() - t0}ms`);
if (reached) {
  const km = (dist * GEO.metersPerTile) / 1000;
  console.log(`도달 가능 ✓  (${reached.x}, ${reached.y}) · 직선거리 ${km.toFixed(2)}km`);
} else {
  console.log('도달 불가 ✗ — 물길이나 건물에 막혀 길이 끊겼다');
  process.exitCode = 1;
}
