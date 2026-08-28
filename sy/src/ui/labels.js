// 건물 이름표. 가까운 것부터, 화면당 정해진 개수만 그린다.

import { TILE, RENDER, UI } from '../config.js';
import { UI_COLOR } from '../render/palette.js';
import { wallHeight } from '../render/sprites.js';

const S = TILE.size;

// 공용 글자 그리기 (그림자 있는 도트 느낌)
export function drawText(ctx, text, x, y, opts = {}) {
  const size = opts.size || UI.hudSize;
  ctx.font = `${opts.bold ? 'bold ' : ''}${size}px ${UI.font}`;
  ctx.textAlign = opts.align || 'left';
  ctx.textBaseline = opts.baseline || 'alphabetic';
  if (opts.shadow !== false) {
    ctx.fillStyle = opts.shadowColor || UI_COLOR.labelShadow;
    ctx.fillText(text, x + 1, y + 1);
    ctx.fillText(text, x - 1, y + 1);
    ctx.fillText(text, x + 1, y - 1);
    ctx.fillText(text, x - 1, y - 1);
  }
  ctx.fillStyle = opts.color || UI_COLOR.text;
  ctx.fillText(text, x, y);
}

// 캔버스는 DPR 배율로 그려지므로, UI 위치는 CSS 픽셀 기준으로 계산해야 한다.
// (고해상도 폰에서 HUD 가 화면 밖으로 나가던 문제)
export function viewSize(ctx) {
  const m = ctx.getTransform();
  return { w: ctx.canvas.width / (m.a || 1), h: ctx.canvas.height / (m.d || 1) };
}

export function textWidth(ctx, text, size) {
  ctx.font = `${size || UI.hudSize}px ${UI.font}`;
  return ctx.measureText(text).width;
}

// 바깥 — 건물 이름
export function drawBuildingLabels(ctx, cam, map, player) {
  const view = cam.visibleTiles(0);
  const cx0 = Math.floor(view.x0 / TILE.chunk), cx1 = Math.floor(view.x1 / TILE.chunk);
  const cy0 = Math.floor(view.y0 / TILE.chunk), cy1 = Math.floor(view.y1 / TILE.chunk);

  const seen = new Set();
  const cands = [];
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      if (cx < 0 || cy < 0) continue;
      for (const b of map.chunk(cx, cy).buildings) {
        if (seen.has(b.id)) continue;
        seen.add(b.id);
        const bx = (b.x + b.w / 2) * S, by = b.y * S;
        const d = Math.hypot(bx - player.x, by - player.y);
        if (d > RENDER.labelMaxDistance && !b.landmark) continue;
        cands.push({ b, d, bx, by });
      }
    }
  }
  // 랜드마크 먼저, 그다음 가까운 순
  cands.sort((a, b) => (b.b.landmark - a.b.landmark) || (a.d - b.d));

  for (const c of cands.slice(0, RENDER.labelMax)) {
    const [sx, sy] = cam.worldToScreen(c.bx, c.by - wallHeight(c.b) - 4);
    if (sx < -80 || sy < -20) continue;
    // 글자 뒤에 옅은 칩을 깔아 배경과 섞이지 않게 한다
    const w = textWidth(ctx, c.b.name, UI.labelSize) + 10;
    ctx.fillStyle = 'rgba(24, 22, 30, 0.42)';
    ctx.fillRect(sx - w / 2, sy - UI.labelSize - 1, w, UI.labelSize + 6);
    drawText(ctx, c.b.name, sx, sy, {
      size: UI.labelSize,
      align: 'center',
      color: c.b.landmark ? UI_COLOR.labelLandmark : UI_COLOR.label,
    });
  }
}

// 실내 — 방 이름
export function drawRoomLabels(ctx, cam, interior) {
  for (const room of interior.rooms) {
    const wx = (room.x + room.w / 2) * S, wy = (room.y + 1) * S;
    const [sx, sy] = cam.worldToScreen(wx, wy);
    const view = viewSize(ctx);
    if (sx < -60 || sy < -20 || sx > view.w + 60 || sy > view.h + 20) continue;
    drawText(ctx, room.name, sx, sy, {
      size: UI.labelSize, align: 'center', color: UI_COLOR.label,
    });
  }
}
