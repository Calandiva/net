// 화면 그리기. 청크는 캔버스에 한 번 구워 두고, 움직이는 것만 매 프레임 그린다.

import { TILE, RENDER, PROP, GROUND, IN, PLAYER, CAMERA } from '../config.js';
import { UI_COLOR, INTERIOR_COLOR, shade } from './palette.js';
import {
  makeCanvas, groundTile, groundVariantAt, propSprite, PROP_H,
  buildingSprite, wallHeight, doorMatSprite, playerSheet_, npcSheet, catSprite,
  interiorTile, gizmoSprite,
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
  }

  // 청크 하나를 캔버스에 굽는다 (지면 + 소품)
  bake(cx, cy) {
    const key = cx * 100000 + cy;
    let hit = this.cache.get(key);
    if (hit) return hit;

    const chunk = this.map.chunk(cx, cy);
    const { canvas, ctx } = makeCanvas(CHUNK_PX, CHUNK_PX + MARGIN);
    const ox = cx * CH, oy = cy * CH;

    for (let y = 0; y < CH; y++) {
      for (let x = 0; x < CH; x++) {
        const g = chunk.ground[y * CH + x];
        ctx.drawImage(groundTile(g, groundVariantAt(ox + x, oy + y)), x * S, y * S + MARGIN);
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
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        for (const b of this.map.chunk(Math.max(0, cx), Math.max(0, cy)).buildings) {
          if (seen.has(b.id)) continue;
          seen.add(b.id);
          items.push({ base: (b.y + b.h) * S, draw: () => this.drawBuilding(ctx, b) });
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
    items.push({ base: state.player.y, draw: () => this.drawPlayer(ctx, state.player) });

    items.sort((a, b) => a.base - b.base);
    for (const it of items) it.draw();

    ctx.restore();
  }

  drawBuilding(ctx, b) {
    const sprite = buildingSprite(b);
    const wh = wallHeight(b);
    // 출입구 발판은 건물보다 먼저 (땅에 깔린 것)
    ctx.drawImage(doorMatSprite(), b.door.x * S, b.door.y * S);
    ctx.globalAlpha = RENDER.shadowAlpha;
    ctx.fillStyle = '#000000';
    ctx.fillRect(b.x * S + 2, (b.y + b.h) * S - 2, b.w * S, 4);
    ctx.globalAlpha = 1;
    ctx.drawImage(sprite, b.x * S, b.y * S - wh);
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
        // 벽·가구 아래에도 바닥을 먼저 깔아 둔다
        if (t !== IN.FLOOR && t !== IN.WALL) {
          ctx.drawImage(interiorTile(IN.FLOOR, (x + y) % 3), x * S, y * S);
        }
        ctx.drawImage(interiorTile(t, (x * 3 + y) % 3), x * S, y * S);
      }
    }

    for (const g of state.interiorGizmos) {
      ctx.drawImage(gizmoSprite(g.icon, state.game.used.has(g.id)), g.tx * S, g.ty * S - 4);
    }

    this.drawPlayer(ctx, state.player);

    // 방 이름 — 방 한가운데 옅게
    ctx.font = `${8}px ${'monospace'}`;
    ctx.restore();
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
