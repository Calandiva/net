// 화면 위에 얹히는 것들 — 시계, 안내문, 미니맵, 알림.

import { TILE, UI, GAME, GEO } from '../config.js';
import { ITEM_BY_ID } from '../game/data/items.js';
import { UI_COLOR, MAP_COLOR } from '../render/palette.js';
import { makeCanvas, itemSprite } from '../render/sprites.js';
import { drawText, textWidth, viewSize } from './labels.js';
import { WORLD_W, WORLD_H } from '../world/geo.js';

const S = TILE.size;

// 미니맵 바탕을 한 번만 굽는다
export function bakeOverview(overview) {
  const { canvas, ctx } = makeCanvas(overview.w, overview.h);
  const img = ctx.createImageData(overview.w, overview.h);
  for (let i = 0; i < overview.data.length; i++) {
    const hex = MAP_COLOR[overview.data[i]] || '#000000';
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
  const { w: W, h: H } = viewSize(ctx);
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
  if (state.showMinimap && state.minimap && state.mode === 'outdoor') drawMinimap(ctx, state, H, W);

  // ── 아래 가운데: 상호작용 안내 ────────────────────────────
  if (state.prompt && !state.dialogue) {   // 말하는 중에는 안내를 감춘다
    const text = state.isTouch ? state.prompt.replace('Space  ', '') : state.prompt;
    const w = textWidth(ctx, text, 14) + 36;
    const py = state.isTouch ? H - 240 : H - 76;   // 터치 버튼 위로 (버튼과 겹치지 않게)
    panel(ctx, (W - w) / 2, py, w, 34);
    drawText(ctx, text, W / 2, py + 22, { size: 14, align: 'center' });
  }

  // ── 왼쪽 위: 들고 있는 것 ─────────────────────────────────
  drawHeldItem(ctx, state, W, H);

  // ── 목적지 표시 ───────────────────────────────────────────
  drawWaypointMarker(ctx, state, W, H);

  // ── 알림 ─────────────────────────────────────────────────
  let y = state.isTouch ? H - 268 : H - 110;
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
    drawText(ctx, 'H 도움말 · Tab 전체지도(눌러서 자동 이동) · [ ] 축척 · M 미니맵 · F 전체화면 · L 엔딩',
      W - 58, H - 16,
      { size: 11, align: 'right', color: 'rgba(255,255,255,0.5)', shadow: false });
  }

  if (state.showHelp) drawHelp(ctx, W, H, state.isTouch);
}

// 손에 든 것 한 칸. 없으면 어디서 얻는지 알려 준다.
function drawHeldItem(ctx, state, W, H) {
  const id = state.game.item;
  const x = 12, y = state.isTouch ? 138 : 74;   // 터치에서는 도움말 버튼 아래
  const item = id ? ITEM_BY_ID.get(id) : null;
  const label = item ? item.name : '맨손';
  const w = Math.max(126, textWidth(ctx, label, 13) + 60);
  panel(ctx, x, y, w, 38);
  if (item) {
    const sprite = itemSprite(item.icon, ITEM_TINT[item.icon] || '#c8c4bc');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sprite, x + 8, y + 8, 22, 22);
  }
  drawText(ctx, label, x + 36, y + 18, { size: 13, color: item ? UI_COLOR.text : UI_COLOR.textDim });
  drawText(ctx, item ? `${item.tag} · ${state.isTouch ? '쓰기' : 'Q'}` : '사람에게 말을 걸어 보자',
    x + 36, y + 32, { size: 10, color: UI_COLOR.textDim });
}

// 아이템 그림 색 (종류마다 하나씩)
const ITEM_TINT = {
  cylinder: '#e2554a', cloth: '#d8c07a', stick: '#7a9fd0', device: '#8fc48a',
  food: '#c9a06a', plant: '#e28aa8', ball: '#e8e4dc', paper: '#f2c14e',
  card: '#a8c8f0', metal: '#b8bfc8',
};

function drawMinimap(ctx, state, H, W) {
  const size = state.isTouch ? Math.round(UI.minimapSize * 0.8) : UI.minimapSize;
  // 터치 화면에서는 조이스틱·버튼 자리를 비켜 오른쪽 위에 붙인다
  const x = state.isTouch ? W - size - 12 : 12;
  const y = state.isTouch ? 52 : H - size - 30;
  state.minimapRect = { x, y, w: size, h: size };   // 눌러서 전체지도를 열 수 있게
  panel(ctx, x - 4, y - 4, size + 8, size + 8);

  const mm = state.minimap;
  const scale = UI.minimapScale;
  const zoom = state.minimapZoom || UI.minimapZoomDefault;
  // 플레이어 주변만 잘라서 보여 준다 (배율이 클수록 좁게 = 가깝게)
  const pxT = state.player.x / S / scale, pyT = state.player.y / S / scale;
  const half = size / 2 / zoom;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(mm, pxT - half, pyT - half, half * 2, half * 2, x, y, size, size);

  const cxp = x + size / 2, cyp = y + size / 2;
  // 목적지 방향 표시
  const wp = state.waypoint;
  const gx = wp ? wp.tx / scale : pxT, gy = wp ? wp.ty / scale : pyT;
  const dx = gx - pxT, dy = gy - pyT;
  const inView = Math.abs(dx) < half && Math.abs(dy) < half;
  ctx.fillStyle = UI_COLOR.accent;
  if (inView) {
    ctx.fillRect(cxp + dx * zoom - 3, cyp + dy * zoom - 3, 6, 6);
  } else {
    const ang = Math.atan2(dy, dx);
    ctx.fillRect(cxp + Math.cos(ang) * (size / 2 - 8) - 3,
      cyp + Math.sin(ang) * (size / 2 - 8) - 3, 6, 6);
  }
  // 자동 이동 중이면 남은 길을 점으로 흘려 준다
  if (state.autoPath) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    for (let i = state.autoPath.index; i < state.autoPath.tiles.length; i += 6) {
      const t = state.autoPath.tiles[i];
      ctx.fillRect(cxp + (t.x / scale - pxT) * zoom - 1,
        cyp + (t.y / scale - pyT) * zoom - 1, 2, 2);
    }
  }
  // 나
  ctx.fillStyle = UI_COLOR.player;
  ctx.fillRect(cxp - 2, cyp - 2, 4, 4);
  ctx.restore();

  ctx.strokeStyle = UI_COLOR.minimapEdge;
  ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);

  // 축척 버튼 (＋ 가깝게 · － 멀리). 눌린 자리를 남겨 두고 main.js 가 받는다.
  const bs = state.isTouch ? 26 : 20;
  const bx = x + size - bs - 3, byTop = y + 3;
  state.minimapZoomRects = {
    in: { x: bx, y: byTop, w: bs, h: bs },
    out: { x: bx, y: byTop + bs + 4, w: bs, h: bs },
  };
  for (const [label, r] of [['+', state.minimapZoomRects.in], ['−', state.minimapZoomRects.out]]) {
    ctx.fillStyle = 'rgba(16, 15, 20, 0.72)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = UI_COLOR.panelEdge;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    drawText(ctx, label, r.x + r.w / 2, r.y + r.h / 2 + 5,
      { size: 14, align: 'center', color: UI_COLOR.text });
  }

  // 지금 보고 있는 범위 (축척) — 지도 밑에 한 줄로
  const spanM = (size / zoom) * scale * GEO.metersPerTile;
  const spanText = spanM >= 1000 ? `${(spanM / 1000).toFixed(1)}km` : `${Math.round(spanM / 10) * 10}m`;
  drawText(ctx, state.isTouch ? `가로 ${spanText}` : `가로 ${spanText} · 클릭 지도 · [ ] 축척`,
    x + size / 2, y + size + 14,
    { size: 10, align: 'center', color: UI_COLOR.textDim });
}

function drawHelp(ctx, W, H, touch) {
  ctx.fillStyle = 'rgba(12, 11, 16, 0.86)';
  ctx.fillRect(0, 0, W, H);

  const lines = touch ? [
    ['이동', '왼쪽 화면을 끌기'],
    ['달리기', '많이 밀거나 달리기 버튼'],
    ['들어가기 · 만지기 · 말 걸기', '만지기 버튼'],
    ['층 이동', '계단·엘리베이터 위에서 만지기'],
    ['전체지도 열기', '오른쪽 위 미니맵 누르기 · 지도 버튼'],
    ['자동 이동', '지도에서 갈 곳 누르기'],
    ['자동 이동 멈추기', '조이스틱을 한 번 끌기'],
    ['미니맵 축척', '미니맵의 ＋ － 버튼'],
    ['전체화면', '오른쪽 아래 ⛶'],
    ['닫기 · 다시 시작', '화면 아무 곳이나 누르기'],
  ] : [
    ['이동', '방향키 · WASD'],
    ['달리기', 'Shift'],
    ['들어가기 · 만지기 · 말 걸기', 'Space · Enter · E'],
    ['층 이동', '계단이나 엘리베이터 위에서 Space'],
    ['전체화면', 'F'],
    ['미니맵', 'M'],
    ['전체지도', 'Tab'],
    ['자동 이동', '전체지도나 미니맵에서 갈 곳 클릭'],
    ['자동 이동 멈추기', '방향키를 누르거나 Space'],
    ['미니맵 축척', '[ 멀리 · ] 가깝게'],
    ['엔딩 목록', 'L'],
    ['목적지 되돌리기', 'G'],
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
  drawText(ctx, touch ? '화면을 눌러 시작' : '아무 키나 눌러 시작 · H 도움말', x + boxW / 2, ly + 16,
    { size: 12, align: 'center', color: UI_COLOR.textDim });
}

// 목적지가 화면 밖에 있으면 가장자리에, 안에 있으면 그 자리에 표시한다.
// 위치는 부드럽게 따라간다.
function drawWaypointMarker(ctx, state, W, H) {
  const wp = state.waypoint;
  if (!wp || state.mode !== 'outdoor') return;

  const [sx, sy] = state.cameraRef.worldToScreen(wp.tx * S, wp.ty * S);
  const margin = 54;
  const inside = sx > margin && sx < W - margin && sy > margin && sy < H - margin;

  let tx = sx, ty = sy;
  if (!inside) {
    // 화면 중앙에서 목적지 방향으로 선을 그어 테두리와 만나는 점을 찾는다
    const cx = W / 2, cy = H / 2;
    const dx = sx - cx, dy = sy - cy;
    const scale = Math.min(
      Math.abs(dx) > 0.001 ? (W / 2 - margin) / Math.abs(dx) : Infinity,
      Math.abs(dy) > 0.001 ? (H / 2 - margin) / Math.abs(dy) : Infinity);
    tx = cx + dx * scale;
    ty = cy + dy * scale;
  }

  // 부드럽게 따라가기
  if (!state.markerPos) state.markerPos = { x: tx, y: ty };
  const t = Math.min(1, (state.dt || 0.016) * 12);
  state.markerPos.x += (tx - state.markerPos.x) * t;
  state.markerPos.y += (ty - state.markerPos.y) * t;
  const mx = state.markerPos.x, my = state.markerPos.y;

  const dist = Math.hypot(wp.tx * S - state.player.x, wp.ty * S - state.player.y);
  const km = (dist / S) * GEO.metersPerTile / 1000;
  const distText = km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;

  ctx.save();
  ctx.globalAlpha = 0.92;
  if (inside) {
    // 목표 위에 핀
    ctx.strokeStyle = UI_COLOR.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx, my, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = UI_COLOR.accent;
    ctx.fillRect(mx - 1.5, my - 22, 3, 12);
  } else {
    // 가장자리 화살표
    const ang = Math.atan2(my - H / 2, mx - W / 2);
    ctx.translate(mx, my);
    ctx.rotate(ang);
    ctx.fillStyle = UI_COLOR.accent;
    ctx.beginPath();
    ctx.moveTo(11, 0);
    ctx.lineTo(-7, -8);
    ctx.lineTo(-7, 8);
    ctx.closePath();
    ctx.fill();
    ctx.rotate(-ang);
    ctx.translate(-mx, -my);
  }
  ctx.restore();

  const text = `${wp.label} ${distText}`;
  const tw = textWidth(ctx, text, 11) + 14;
  const bx = Math.max(6, Math.min(W - tw - 6, mx - tw / 2));
  const by = Math.max(20, Math.min(H - 26, my + (inside ? 26 : 22)));
  ctx.fillStyle = 'rgba(16, 15, 20, 0.72)';
  ctx.fillRect(bx, by - 13, tw, 18);
  drawText(ctx, text, bx + tw / 2, by, { size: 11, align: 'center', color: UI_COLOR.accent });
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
