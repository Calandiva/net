// 화면 위에 얹히는 것들 — 시계, 안내문, 미니맵, 알림.

import { TILE, UI, GAME, GEO } from '../config.js';
import { UI_COLOR, GROUND_COLOR } from '../render/palette.js';
import { makeCanvas } from '../render/sprites.js';
import { drawText, textWidth } from './labels.js';
import { WORLD_W, WORLD_H } from '../world/geo.js';

const S = TILE.size;

// 미니맵 바탕을 한 번만 굽는다
export function bakeOverview(overview) {
  const { canvas, ctx } = makeCanvas(overview.w, overview.h);
  const img = ctx.createImageData(overview.w, overview.h);
  for (let i = 0; i < overview.data.length; i++) {
    const hex = GROUND_COLOR[overview.data[i]] || '#000000';
    const v = parseInt(hex.slice(1), 16);
    img.data[i * 4] = (v >> 16) & 255;
    img.data[i * 4 + 1] = (v >> 8) & 255;
    img.data[i * 4 + 2] = v & 255;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export function drawHud(ctx, state) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const g = state.game;

  // ── 왼쪽 위: 시계와 목적지 ──────────────────────────────────
  panel(ctx, 12, 12, 186, 54);
  const late = g.late;
  drawText(ctx, g.clockText(), 22, 40, { size: 24, bold: true,
    color: late ? '#e2705f' : UI_COLOR.text });
  drawText(ctx, late ? '지각' : `출근 ${fmt(GAME.deadline - g.clock)} 전`, 92, 32,
    { size: 12, color: late ? '#e2705f' : UI_COLOR.textDim });
  // 남은 거리 — 어느 쪽으로 얼마나 가야 하는지 감을 준다
  const dist = state.goalPoint
    ? Math.hypot(state.goalPoint.x - state.player.x, state.goalPoint.y - state.player.y)
    : 0;
  const km = (dist / TILE.size) * GEO.metersPerTile / 1000;
  drawText(ctx, `→ ${GAME.goalName} ${km < 0.15 ? '도착' : km.toFixed(1) + 'km'}`, 92, 50,
    { size: 12, color: UI_COLOR.accent });

  // ── 오른쪽 위: 지금 있는 곳 ────────────────────────────────
  const place = state.placeName || '';
  if (place) {
    const w = textWidth(ctx, place, 14) + 28;
    panel(ctx, W - w - 12, 12, w, 32);
    drawText(ctx, place, W - 24, 33, { size: 14, align: 'right' });
  }

  // ── 왼쪽 아래: 미니맵 ─────────────────────────────────────
  // 미니맵은 바깥에서만 (실내 좌표로는 의미가 없다)
  if (state.showMinimap && state.minimap && state.mode === 'outdoor') drawMinimap(ctx, state, H);

  // ── 아래 가운데: 상호작용 안내 ────────────────────────────
  if (state.prompt) {
    const text = state.prompt;
    const w = textWidth(ctx, text, 14) + 36;
    panel(ctx, (W - w) / 2, H - 76, w, 34);
    drawText(ctx, text, W / 2, H - 54, { size: 14, align: 'center' });
  }

  // ── 알림 ─────────────────────────────────────────────────
  let y = H - 110;
  for (const t of state.toasts) {
    const alpha = Math.min(1, t.life / 0.5);
    ctx.globalAlpha = alpha;
    const w = textWidth(ctx, t.text, 13) + 32;
    panel(ctx, (W - w) / 2, y - 24, w, 30);
    drawText(ctx, t.text, W / 2, y - 4, { size: 13, align: 'center', color: UI_COLOR.accent });
    ctx.globalAlpha = 1;
    y -= 36;
  }

  // ── 오른쪽 아래: 조작 힌트 ────────────────────────────────
  if (W >= 640) {
    drawText(ctx, 'H 도움말 · M 지도 · F 전체화면 · L 엔딩 목록', W - 58, H - 16,
      { size: 11, align: 'right', color: 'rgba(255,255,255,0.5)', shadow: false });
  }

  if (state.showHelp) drawHelp(ctx, W, H);
}

function drawMinimap(ctx, state, H) {
  const size = UI.minimapSize;
  const x = 12, y = H - size - 12;
  panel(ctx, x - 4, y - 4, size + 8, size + 8);

  const mm = state.minimap;
  const scale = UI.minimapScale;
  // 플레이어 주변만 잘라서 보여 준다
  const pxT = state.player.x / S / scale, pyT = state.player.y / S / scale;
  const half = size / 2 / 2; // 2배 확대
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(mm, pxT - half, pyT - half, half * 2, half * 2, x, y, size, size);

  // 목적지 방향 표시
  const gx = state.goalPoint.x / S / scale, gy = state.goalPoint.y / S / scale;
  const dx = gx - pxT, dy = gy - pyT;
  const inView = Math.abs(dx) < half && Math.abs(dy) < half;
  const cxp = x + size / 2, cyp = y + size / 2;
  ctx.fillStyle = UI_COLOR.accent;
  if (inView) {
    ctx.fillRect(cxp + dx * 2 - 3, cyp + dy * 2 - 3, 6, 6);
  } else {
    const ang = Math.atan2(dy, dx);
    ctx.fillRect(cxp + Math.cos(ang) * (size / 2 - 8) - 3,
      cyp + Math.sin(ang) * (size / 2 - 8) - 3, 6, 6);
  }
  // 나
  ctx.fillStyle = UI_COLOR.player;
  ctx.fillRect(cxp - 2, cyp - 2, 4, 4);
  ctx.restore();

  ctx.strokeStyle = UI_COLOR.minimapEdge;
  ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
  drawText(ctx, '← 양촌  ·  구래 →', x + size / 2, y + size + 14,
    { size: 10, align: 'center', color: UI_COLOR.textDim });
}

function drawHelp(ctx, W, H) {
  ctx.fillStyle = 'rgba(12, 11, 16, 0.86)';
  ctx.fillRect(0, 0, W, H);

  const lines = [
    ['이동', '방향키 · WASD'],
    ['달리기', 'Shift'],
    ['들어가기 · 만지기', 'Space · Enter · E'],
    ['층 이동', '계단이나 엘리베이터 위에서 Space'],
    ['전체화면', 'F'],
    ['미니맵', 'M'],
    ['엔딩 목록', 'L'],
    ['확대 · 축소', '+ · -'],
    ['다시 시작', 'R (결말 화면에서)'],
  ];
  const boxW = Math.min(420, W - 48);
  const boxH = lines.length * 26 + 150;
  const x = (W - boxW) / 2;
  const y = Math.max(20, (H - boxH) / 2);
  panel(ctx, x, y, boxW, boxH);

  drawText(ctx, '〈구래〉', x + boxW / 2, y + 52, { size: 28, align: 'center', bold: true });
  drawText(ctx, '구래동에서 양촌공단까지, 걸어서 출근하기.', x + boxW / 2, y + 78,
    { size: 13, align: 'center', color: UI_COLOR.textDim });
  drawText(ctx, '무엇을 건드리느냐로 결말이 갈린다.', x + boxW / 2, y + 98,
    { size: 13, align: 'center', color: UI_COLOR.accent });

  let ly = y + 134;
  for (const [k, v] of lines) {
    drawText(ctx, k, x + 26, ly, { size: 13, color: UI_COLOR.accent });
    drawText(ctx, v, x + boxW - 26, ly, { size: 13, align: 'right' });
    ly += 26;
  }
  drawText(ctx, '아무 키나 눌러 시작 · H 도움말', x + boxW / 2, ly + 16,
    { size: 12, align: 'center', color: UI_COLOR.textDim });
}

// 반투명 판
export function panel(ctx, x, y, w, h) {
  ctx.fillStyle = UI_COLOR.panel;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = UI_COLOR.panelEdge;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function fmt(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`;
}
