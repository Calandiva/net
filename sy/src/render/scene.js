// 화면 그리기. 청크는 캔버스에 한 번 구워 두고, 움직이는 것만 매 프레임 그린다.

import { TILE, RENDER, PROP, GROUND, IN, PLAYER, CAMERA } from '../config.js';
import { UI_COLOR, INTERIOR_COLOR, shade } from './palette.js';
import {
  makeCanvas, groundTile, groundVariantAt, propSprite, PROP_H,
  buildingSprite, wallHeight, doorMatSprite, playerSheet_, npcSheet, catSprite,
  interiorTile, gizmoSprite, carSprite, carDirIndex,
} from './sprites.js';

const S = TILE.size;
const CH = TILE.chunk;
const MARGIN = 16;      // 청크 위쪽 여백 — 나무처럼 위로 삐져나온 소품 자리
const CHUNK_PX = CH * S;

export class Scene {
  constructor(map, buildings) {
    this.map = map;
    this.buildings = buildings;
    this.cache = new Map();   // 구워 둔 청크 캔버스
    this.order = [];
    this.fade = new Map();    // 건물 id → 지금 투명도 (뒤에 서면 서서히 비친다)
    this.asphalt = null;      // 아스팔트·보도 패턴 (한 번만 만든다)
    this.pavement = null;
  }

  // 플레이어가 이 건물 뒤(북쪽)에 서서 지붕에 가려지는가
  occludes(b, player) {
    const wh = wallHeight(b);
    const left = b.x * S, right = (b.x + b.w) * S;
    const top = b.y * S - wh, bottom = (b.y + b.h) * S;
    // 플레이어가 건물 바닥선보다 위(북쪽)에 있어야 가려진다
    if (player.y >= bottom) return false;
    const pad = RENDER.occludePad;
    const px0 = player.x - PLAYER.drawWidth / 2 - pad;
    const px1 = player.x + PLAYER.drawWidth / 2 + pad;
    const py0 = player.y - PLAYER.drawHeight - pad;
    const py1 = player.y + pad;
    return px1 > left && px0 < right && py1 > top && py0 < bottom;
  }

  // 건물별 투명도를 부드럽게 따라가게 한다
  buildingAlpha(b, player, dt) {
    const target = this.occludes(b, player) ? RENDER.occludeAlpha : 1;
    const current = this.fade.get(b.id);
    if (current === undefined) {
      this.fade.set(b.id, target);
      return target;
    }
    const t = Math.min(1, dt * RENDER.occludeFadeSpeed);
    const next = current + (target - current) * t;
    // 다 돌아왔으면 지워서 Map 이 무한정 커지지 않게 한다
    if (target === 1 && next > 0.995) {
      this.fade.delete(b.id);
      return 1;
    }
    this.fade.set(b.id, next);
    return next;
  }

  // 청크 하나를 캔버스에 굽는다 (지면 + 소품)
  bake(cx, cy) {
    const key = cx * 100000 + cy;
    let hit = this.cache.get(key);
    if (hit) return hit;

    const chunk = this.map.chunk(cx, cy);
    const { canvas, ctx } = makeCanvas(CHUNK_PX, CHUNK_PX + MARGIN);
    const ox = cx * CH, oy = cy * CH;

    // 1) 지면 타일. 차도는 뒤에서 선으로 그리므로 여기서는 건너뛴다.
    for (let y = 0; y < CH; y++) {
      for (let x = 0; x < CH; x++) {
        const g = chunk.ground[y * CH + x];
        if (g === GROUND.ROAD || g === GROUND.ROAD_LINE || g === GROUND.CROSSWALK) continue;
        ctx.drawImage(groundTile(g, groundVariantAt(ox + x, oy + y)), x * S, y * S + MARGIN);
      }
    }

    // 2) 차도 — 타일로 칠하면 계단처럼 각지고 중앙선이 끊긴다. 선으로 그린다.
    this.strokeRoads(ctx, ox, oy);

    // 3) 횡단보도는 도로 위에 다시 얹는다
    for (let y = 0; y < CH; y++) {
      for (let x = 0; x < CH; x++) {
        if (chunk.ground[y * CH + x] !== GROUND.CROSSWALK) continue;
        ctx.drawImage(groundTile(GROUND.CROSSWALK, groundVariantAt(ox + x, oy + y)),
          x * S, y * S + MARGIN);
      }
    }
    for (let y = 0; y < CH; y++) {
      for (let x = 0; x < CH; x++) {
        const p = chunk.prop[y * CH + x];
        if (!p) continue;
        const v = (ox + x + (oy + y) * 3) % 4;
        ctx.drawImage(propSprite(p, v), x * S, y * S + MARGIN + S - PROP_H);
      }
    }

    hit = canvas;
    this.cache.set(key, hit);
    this.order.push(key);
    while (this.order.length > TILE.chunkCacheMax) {
      const old = this.order.shift();
      if (old !== key) this.cache.delete(old);
    }
    return hit;
  }

  // 청크 하나에 걸친 도로들을 이어서 그린다.
  // 아스팔트는 타일 무늬를 패턴으로 깔아 도트 질감을 유지하고, 가장자리는 선으로 매끈하게.
  strokeRoads(ctx, ox, oy) {
    const segs = this.buildings.roads.index.query(ox - 12, oy - 12, ox + CH + 12, oy + CH + 12);
    if (!segs.length) return;
    const roadIds = new Set();
    for (const seg of segs) roadIds.add(seg.roadIndex);
    const paths = this.buildings.roads.paths;

    if (!this.asphalt) {
      this.asphalt = ctx.createPattern(groundTile(GROUND.ROAD, 0), 'repeat');
      this.pavement = ctx.createPattern(groundTile(GROUND.SIDEWALK, 0), 'repeat');
    }

    ctx.save();
    ctx.translate(-ox * S, -oy * S + MARGIN);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const trace = (tiles) => {
      ctx.beginPath();
      ctx.moveTo(tiles[0][0] * S, tiles[0][1] * S);
      for (let i = 1; i < tiles.length; i++) ctx.lineTo(tiles[i][0] * S, tiles[i][1] * S);
    };

    // 보도 → 차도 → 차선 순서로 겹쳐 그린다
    for (const id of roadIds) {
      const road = paths[id];
      if (!road.spec.sidewalk) continue;
      trace(road.tiles);
      ctx.strokeStyle = this.pavement;
      ctx.lineWidth = (road.spec.width + road.spec.sidewalk * 2) * S;
      ctx.stroke();
    }
    for (const id of roadIds) {
      const road = paths[id];
      if (road.spec.ground !== undefined) continue;   // 산책로는 지면 타일 그대로
      trace(road.tiles);
      ctx.strokeStyle = this.asphalt;
      ctx.lineWidth = road.spec.width * S;
      ctx.stroke();
    }
    for (const id of roadIds) {
      const road = paths[id];
      const spec = road.spec;
      if (spec.ground !== undefined || spec.width < 4) continue;
      trace(road.tiles);
      // 중앙선 — 왕복 도로는 노란 실선, 좁은 길은 점선
      ctx.strokeStyle = RENDER.centerLine;
      ctx.lineWidth = spec.width >= 6 ? 2 : 1.5;
      ctx.setLineDash(spec.width >= 6 ? [] : [S * 0.9, S * 0.9]);
      ctx.stroke();
      // 차선 — 흰 점선
      if (spec.width >= 8) {
        ctx.setLineDash([S * 1.2, S * 1.1]);
        ctx.strokeStyle = RENDER.laneLine;
        ctx.lineWidth = 1.5;
        for (const off of [-spec.width / 4, spec.width / 4]) {
          traceOffset(ctx, road.tiles, off * S);
          ctx.stroke();
        }
      }
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  // 청크 캐시를 버린다 (지면이 바뀌었을 때)
  invalidate() { this.cache.clear(); this.order.length = 0; }

  // ── 바깥 ──────────────────────────────────────────────────────
  drawOutdoor(ctx, cam, state) {
    const view = cam.visibleTiles(1);
    const cx0 = Math.floor(view.x0 / CH), cx1 = Math.floor(view.x1 / CH);
    const cy0 = Math.floor(view.y0 / CH), cy1 = Math.floor(view.y1 / CH);

    ctx.save();
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.left, -cam.top);

    // 지면
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        if (cx < 0 || cy < 0) continue;
        ctx.drawImage(this.bake(cx, cy), cx * CHUNK_PX, cy * CHUNK_PX - MARGIN);
      }
    }

    // 세로로 겹치는 것들을 발밑 높이 순으로 정렬해 그린다
    const items = [];
    const seen = new Set();
    let hidden = false;   // 플레이어가 어느 건물엔가 가려졌는가
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        for (const b of this.map.chunk(Math.max(0, cx), Math.max(0, cy)).buildings) {
          if (seen.has(b.id)) continue;
          seen.add(b.id);
          const alpha = this.buildingAlpha(b, state.player, state.dt || 0.016);
          if (alpha < 0.95) hidden = true;
          items.push({ base: (b.y + b.h) * S, draw: () => this.drawBuilding(ctx, b, alpha) });
        }
      }
    }
    for (const g of state.outdoorGizmos) {
      if (g.tx < view.x0 || g.tx > view.x1 || g.ty < view.y0 || g.ty > view.y1) continue;
      items.push({
        base: (g.ty + 1) * S,
        draw: () => ctx.drawImage(gizmoSprite(g.icon, state.game.used.has(g.id)), g.tx * S, g.ty * S),
      });
    }
    for (const a of state.actors.visible(cx0, cy0, cx1, cy1)) {
      items.push({ base: a.y, draw: () => this.drawActor(ctx, a) });
    }
    if (state.traffic) {
      const pad = 48;
      for (const car of state.traffic.visible(cam.left - pad, cam.top - pad,
          cam.left + cam.viewW + pad, cam.top + cam.viewH + pad)) {
        items.push({ base: car.y, draw: () => this.drawCar(ctx, car) });
      }
    }
    items.push({ base: state.player.y, draw: () => this.drawPlayer(ctx, state.player) });

    items.sort((a, b) => a.base - b.base);
    for (const it of items) it.draw();

    // 건물 뒤에 있으면 반투명 지붕 위로 한 번 더 그려 준다 — 자기 위치를 놓치지 않게
    if (hidden) {
      ctx.globalAlpha = 0.9;
      this.drawPlayer(ctx, state.player);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  drawBuilding(ctx, b, alpha = 1) {
    const sprite = buildingSprite(b);
    const wh = wallHeight(b);
    // 출입구 발판은 건물보다 먼저 (땅에 깔린 것)
    ctx.drawImage(doorMatSprite(), b.door.x * S, b.door.y * S);
    ctx.globalAlpha = RENDER.shadowAlpha * alpha;
    ctx.fillStyle = '#000000';
    ctx.fillRect(b.x * S + 2, (b.y + b.h) * S - 2, b.w * S, 4);
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprite, b.x * S, b.y * S - wh);
    // 반투명해진 건물은 윤곽선을 남겨 어디까지가 건물인지 알 수 있게 한다
    if (alpha < 0.95) {
      const edge = (1 - alpha);
      ctx.globalAlpha = edge * 0.9;
      ctx.strokeStyle = UI_COLOR.labelShadow;
      ctx.lineWidth = 1;
      ctx.strokeRect(b.x * S + 0.5, b.y * S - wh + 0.5, b.w * S - 1, b.h * S + wh - 1);
      ctx.globalAlpha = edge * 0.5;
      ctx.strokeStyle = UI_COLOR.label;
      ctx.strokeRect(b.x * S + 1.5, b.y * S - wh + 1.5, b.w * S - 3, b.h * S + wh - 3);
    }
    ctx.globalAlpha = 1;
  }

  drawCar(ctx, car) {
    if (car.hidden) return;                 // 건물이나 지붕 밑으로 들어간 차는 안 보인다
    const sprite = carSprite(car.kind, car.color, carDirIndex(car.angle));
    const half = sprite.width / 2;
    // 그림자는 차체 모양으로 (네모난 그림자는 어색하다)
    const len = car.kind === 'bus' ? 44 : car.kind === 'truck' ? 36 : 24;
    const wide = car.kind === 'car' ? 10 : 12;
    ctx.save();
    ctx.globalAlpha = RENDER.shadowAlpha;
    ctx.fillStyle = '#000000';
    ctx.translate(car.x + 1, car.y + 3);
    ctx.rotate(car.angle);
    ctx.beginPath();
    ctx.ellipse(0, 0, len / 2, wide / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.drawImage(sprite, Math.round(car.x - half), Math.round(car.y - half));
  }

  drawActor(ctx, a) {
    const sheet = a.kind === 'cat' ? null : npcSheet(a.seed);
    if (!sheet) {
      ctx.drawImage(catSprite(a.seed % 3), Math.round(a.x - 7), Math.round(a.y - 10));
      return;
    }
    drawFromSheet(ctx, sheet, a.x, a.y, a.dir, a.moving ? a.anim : 0);
  }

  drawPlayer(ctx, p) {
    drawFromSheet(ctx, playerSheet_(), p.x, p.y, p.dir, p.moving ? p.anim : 0);
  }

  // ── 실내 ──────────────────────────────────────────────────────
  drawInterior(ctx, cam, state) {
    const it = state.interior;
    ctx.save();
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.left, -cam.top);

    // 실내 바깥은 어둡게
    ctx.fillStyle = INTERIOR_COLOR[IN.VOID];
    ctx.fillRect(cam.left - S, cam.top - S, cam.viewW + S * 2, cam.viewH + S * 2);

    const x0 = Math.max(0, Math.floor(cam.left / S) - 1);
    const y0 = Math.max(0, Math.floor(cam.top / S) - 1);
    const x1 = Math.min(it.w - 1, Math.ceil((cam.left + cam.viewW) / S));
    const y1 = Math.min(it.h - 1, Math.ceil((cam.top + cam.viewH) / S));

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const t = it.tiles[y * it.w + x];
        if (t === IN.VOID) continue;
        // 문을 열지 않은 방은 어둡다 — 안이 안 보인다
        if (!it.visibleAt(x, y)) {
          ctx.fillStyle = INTERIOR_COLOR[IN.VOID];
          ctx.fillRect(x * S, y * S, S, S);
          continue;
        }
        // 벽·가구 아래에도 바닥을 먼저 깔아 둔다
        if (t !== IN.FLOOR && t !== IN.WALL) {
          ctx.drawImage(interiorTile(IN.FLOOR, (x + y) % 3), x * S, y * S);
        }
        ctx.drawImage(interiorTile(t, (x * 3 + y) % 3), x * S, y * S);
      }
    }

    for (const g of state.interiorGizmos) {
      if (!it.visibleAt(g.tx, g.ty)) continue;   // 어두운 방 안의 물건은 안 보인다
      ctx.drawImage(gizmoSprite(g.icon, state.game.used.has(g.id)), g.tx * S, g.ty * S - 4);
    }

    this.drawPlayer(ctx, state.player);

    // 방 이름 — 방 한가운데 옅게
    ctx.font = `${8}px ${'monospace'}`;
    ctx.restore();
  }
}

// 도로 중심선에서 옆으로 비켜 난 선 (차선용)
function traceOffset(ctx, tiles, offset) {
  ctx.beginPath();
  for (let i = 0; i < tiles.length; i++) {
    const a = tiles[Math.max(0, i - 1)], b = tiles[Math.min(tiles.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const x = tiles[i][0] * S + nx * offset;
    const y = tiles[i][1] * S + ny * offset;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
}

// 스프라이트 시트에서 한 칸 꺼내 그리기
function drawFromSheet(ctx, sheet, x, y, dir, animTime) {
  const d = Math.max(0, sheet.dirs.indexOf(dir));
  const frame = animTime > 0
    ? Math.floor(animTime * PLAYER.animFps) % sheet.frames
    : 0;
  ctx.drawImage(sheet.canvas,
    frame * sheet.w, d * sheet.h, sheet.w, sheet.h,
    Math.round(x - sheet.w / 2), Math.round(y - sheet.h + 3), sheet.w, sheet.h);
}
