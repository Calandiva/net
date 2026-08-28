// 도로 위의 차. 이름 있는 도로를 차선 삼아 차들이 오간다.
// 사람이 차도에 서 있으면 앞차가 선다 — 밟고 지나가지는 않는다.

import { SEED, TILE, TRAFFIC } from '../config.js';
import { makeRng } from '../util/rng.js';
import { ROADS } from './data/roads.js';
import { ROAD_CLASS } from '../config.js';

const S = TILE.size;

// 화면(+여유) 안에 있는가
function inView(car, view) {
  if (!view) return true;
  return car.x >= view.left && car.x <= view.right &&
    car.y >= view.top && car.y <= view.bottom;
}

// 도로 하나를 방향별 차선 두 개로 만든다
function makeLanes(road) {
  const spec = ROAD_CLASS[road.cls];
  if (!TRAFFIC.classes.includes(road.cls)) return [];
  const pts = road.tiles;
  // 누적 길이
  let total = 0;
  const nodes = pts.map((p, i) => {
    if (i > 0) total += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
    return { x: p[0], y: p[1], dist: total };
  });
  if (total < 20) return [];

  const offset = spec.width / 4;   // 중앙선에서 차선 중앙까지
  return [1, -1].map((sign) => ({
    road: road.name, nodes, length: total, sign, offset: offset * sign,
    speed: TRAFFIC.speed[road.cls] || 40,
  }));
}

export class Traffic {
  constructor(map) {
    this.map = map;
    this.lanes = [];
    for (const road of ROADS) this.lanes.push(...makeLanes(road));

    const rng = makeRng(SEED, 'traffic');
    this.cars = [];
    for (let i = 0; i < this.lanes.length; i++) {
      const lane = this.lanes[i];
      const count = Math.max(1, Math.round(lane.length / TRAFFIC.spacing));
      for (let c = 0; c < count; c++) {
        this.cars.push({
          lane: i,
          dist: (lane.length * (c + rng.range(0, 0.8))) / count,
          speed: lane.speed * rng.range(0.85, 1.15),
          color: rng.int(0, TRAFFIC.colors - 1),
          kind: rng.chance(0.16) ? 'truck' : rng.chance(0.1) ? 'bus' : 'car',
          x: 0, y: 0, angle: 0, stopped: false,
        });
      }
    }
    this.place();
  }

  // 차선 위 거리(dist)로부터 실제 위치와 방향을 구한다
  locate(lane, dist) {
    const nodes = lane.nodes;
    const d = ((dist % lane.length) + lane.length) % lane.length;
    let i = 1;
    while (i < nodes.length - 1 && nodes[i].dist < d) i++;
    const a = nodes[i - 1], b = nodes[i];
    const segLen = b.dist - a.dist || 1;
    const t = (d - a.dist) / segLen;
    const dx = (b.x - a.x) / segLen, dy = (b.y - a.y) / segLen;
    // 진행 방향과 직각으로 차선만큼 비켜 선다
    const nx = -dy, ny = dx;
    return {
      x: (a.x + (b.x - a.x) * t + nx * lane.offset) * S,
      y: (a.y + (b.y - a.y) * t + ny * lane.offset) * S,
      angle: Math.atan2(dy * lane.sign, dx * lane.sign),
    };
  }

  place() {
    for (const car of this.cars) {
      const lane = this.lanes[car.lane];
      const p = this.locate(lane, car.dist);
      car.x = p.x; car.y = p.y; car.angle = p.angle;
    }
  }

  // view 는 화면 범위(월드 픽셀). 그 밖의 차는 위치만 굴리고 검사는 건너뛴다 —
  // 안 그러면 차 천 대가 매 프레임 온 지도의 청크를 만들어 낸다.
  update(dt, player, view) {
    for (const car of this.cars) {
      const lane = this.lanes[car.lane];
      // 앞에 사람이 있으면 선다
      if (!inView(car, view)) {   // 화면 밖 차는 그냥 굴러간다
        car.dist += car.speed * dt * lane.sign;
        const far = this.locate(lane, car.dist);
        car.x = far.x; car.y = far.y; car.angle = far.angle;
        continue;
      }
      const ahead = TRAFFIC.stopDistance;
      const dx = player.x - car.x, dy = player.y - car.y;
      const forwardX = Math.cos(car.angle), forwardY = Math.sin(car.angle);
      const along = dx * forwardX + dy * forwardY;
      const side = Math.abs(dx * -forwardY + dy * forwardX);
      car.stopped = along > 0 && along < ahead && side < TRAFFIC.stopWidth;
      if (car.stopped) continue;

      car.dist += car.speed * dt * lane.sign;
      const p = this.locate(lane, car.dist);
      car.x = p.x; car.y = p.y; car.angle = p.angle;
      // 길이 건물을 스쳐 지나가는 구간에서는 차를 감춘다 (건물을 뚫고 가는 것처럼 보이지 않게).
      // 화면 근처, 그것도 이미 만들어 둔 청크에서만 확인한다.
      if (this.map && inView(car, view)) {
        const tx = Math.floor(car.x / S), ty = Math.floor(car.y / S);
        car.hidden = this.map.hasChunk(tx, ty) && this.map.isSolid(tx, ty);
      }
    }
  }

  // 사람을 친 차 (없으면 null).
  // 차는 앞에 선 사람을 보고 서지만, 옆에서 갑자기 뛰어들면 못 선다.
  hitting(player) {
    for (const car of this.cars) {
      if (car.stopped || car.hidden) continue;
      const d = Math.hypot(car.x - player.x, car.y - player.y);
      if (d < TRAFFIC.hitRadius && car.speed > TRAFFIC.hitSpeed) return car;
    }
    return null;
  }

  // 화면 안의 차만 넘겨준다
  *visible(left, top, right, bottom) {
    for (const car of this.cars) {
      if (car.x < left || car.x > right || car.y < top || car.y > bottom) continue;
      yield car;
    }
  }
}
