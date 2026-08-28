// 전체지도. 미니맵과 같은 저해상도 그림을 화면 가득 펼치고,
// 주요 랜드마크와 구역 이름, 내 위치와 목적지를 얹는다.

import { TILE, UI, GAME, GEO, KIND } from '../config.js';
import { UI_COLOR, GROUND_COLOR } from '../render/palette.js';
import { WORLD_W, WORLD_H, pathBounds } from '../world/geo.js';
import { drawText, textWidth, viewSize } from './labels.js';
import { panel } from './hud.js';

const S = TILE.size;

// 지도에 이름까지 찍을 종류 (나머지는 점만)
const NAMED_KINDS = new Set([KIND.STATION, KIND.MART, KIND.TOWER, KIND.PUBLIC, KIND.SCHOOL]);

// 종류별 표시 색
const MARK_COLOR = {
  [KIND.STATION]: '#f2c14e',
  [KIND.MART]: '#e2705f',
  [KIND.TOWER]: '#7fb0d8',
  [KIND.PUBLIC]: '#8fb8f0',
  [KIND.SCHOOL]: '#8fc48a',
  [KIND.FACTORY]: '#b8c4cc',
  [KIND.WAREHOUSE]: '#b8c4cc',
  [KIND.PARK_FACILITY]: '#a8d8a0',
};

export function drawWorldMap(ctx, state) {
  const { w: W, h: H } = viewSize(ctx);
  ctx.fillStyle = 'rgba(10, 9, 13, 0.94)';
  ctx.fillRect(0, 0, W, H);

  // 지도 그림을 화면에 맞춰 정수 배율로 키운다 (도트가 뭉개지지 않게)
  const mm = state.minimap;
  const marginTop = 64, marginBottom = 54, marginX = 28;
  const scale = Math.min((W - marginX * 2) / mm.width,
    (H - marginTop - marginBottom) / mm.height);
  const mw = mm.width * scale, mh = mm.height * scale;
  const ox = Math.round((W - mw) / 2);
  const oy = Math.round(marginTop + (H - marginTop - marginBottom - mh) / 2);

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(mm, ox, oy, mw, mh);
  ctx.strokeStyle = UI_COLOR.minimapEdge;
  ctx.strokeRect(ox + 0.5, oy + 0.5, mw - 1, mh - 1);

  // 타일 좌표 → 화면 좌표. 클릭을 되돌리기 위해 변환값을 남겨 둔다.
  const px = (tx) => ox + (tx / UI.minimapScale) * scale;
  const py = (ty) => oy + (ty / UI.minimapScale) * scale;
  state.mapView = { ox, oy, scale, w: mw, h: mh };

  // 이름표는 겹치지 않게 놓는다. 중요한 것부터 자리를 잡는다.
  const placed = [];
  const tryLabel = (text, x, y, opts) => {
    const size = opts.size || 11;
    const w = textWidth(ctx, text, size);
    const box = { x: x - w / 2 - 3, y: y - size - 2, w: w + 6, h: size + 6 };
    if (placed.some((p) => !(box.x + box.w < p.x || p.x + p.w < box.x ||
        box.y + box.h < p.y || p.y + p.h < box.y))) return false;
    placed.push(box);
    if (opts.chip !== false) {
      ctx.fillStyle = 'rgba(16, 15, 20, 0.66)';
      ctx.fillRect(box.x, box.y, box.w, box.h);
    }
    drawText(ctx, text, x, y, { size, align: 'center', color: opts.color });
    return true;
  };

  // 목적지 구역을 테두리로 강조
  for (const r of state.mapRegions) {
    if (!GAME.goalRegions.includes(r.id)) continue;
    ctx.strokeStyle = UI_COLOR.accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(px(r.minX), py(r.minY), px(r.maxX) - px(r.minX), py(r.maxY) - py(r.minY));
    ctx.lineWidth = 1;
    drawText(ctx, `${GAME.goalName} · 도착지`, px(r.cx), py(r.minY) - 6,
      { size: 12, align: 'center', color: UI_COLOR.accent });
  }

  // 랜드마크 점 — 이름표보다 먼저 전부 찍는다
  for (const m of state.landmarks) {
    const x = px(m.tx), y = py(m.ty);
    ctx.fillStyle = MARK_COLOR[m.kind] || '#d8d4c8';
    ctx.fillRect(x - 3, y - 3, 6, 6);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeRect(x - 3.5, y - 3.5, 7, 7);
  }
  // 이름표: 역 · 대형시설 → 관공서 · 학교 → 구역 이름 순으로 자리를 잡는다
  const rank = (kind) => (kind === KIND.STATION ? 0 : kind === KIND.MART || kind === KIND.TOWER
    ? 1 : kind === KIND.PUBLIC ? 2 : 3);
  const named = state.landmarks
    .filter((m) => NAMED_KINDS.has(m.kind))
    .sort((a, b) => rank(a.kind) - rank(b.kind));
  for (const m of named) {
    tryLabel(m.name, px(m.tx), py(m.ty) - 6,
      { size: 11, color: MARK_COLOR[m.kind] || UI_COLOR.label });
  }
  for (const r of state.mapRegions) {
    if (!r.label) continue;
    tryLabel(r.name, px(r.cx), py(r.cy),
      { size: 11, color: 'rgba(255,255,255,0.78)', chip: false });
  }

  // 찍어 둔 목적지
  if (state.waypoint) {
    const wx = px(state.waypoint.tx), wy = py(state.waypoint.ty);
    ctx.strokeStyle = UI_COLOR.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(wx, wy, 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = UI_COLOR.accent;
    ctx.fillRect(wx - 1, wy - 12, 2, 8);
    ctx.lineWidth = 1;
    tryLabel(state.waypoint.label, wx, wy + 20, { size: 11, color: UI_COLOR.accent });
  }

  // 내 위치
  const mx = px(state.player.x / S), my = py(state.player.y / S);
  ctx.fillStyle = UI_COLOR.player;
  ctx.fillRect(mx - 3, my - 3, 6, 6);
  ctx.strokeStyle = '#ffffff';
  ctx.strokeRect(mx - 4.5, my - 4.5, 9, 9);
  drawText(ctx, '나', mx, my - 10, { size: 11, align: 'center', color: '#ffffff' });

  // 머리말과 축척
  drawText(ctx, '김포시 구래동 ~ 양촌읍', W / 2, 34,
    { size: 18, align: 'center', bold: true });
  const km = Math.hypot(state.goalPoint.x - state.player.x, state.goalPoint.y - state.player.y)
    / S * GEO.metersPerTile / 1000;
  drawText(ctx, `${GAME.goalName}까지 직선 ${km.toFixed(1)}km`, W / 2, 52,
    { size: 12, align: 'center', color: UI_COLOR.accent });

  // 축척 막대 (1km)
  const barTiles = 1000 / GEO.metersPerTile;
  const barPx = (barTiles / UI.minimapScale) * scale;
  const bx = ox + 10, by = oy + mh - 16;
  panel(ctx, bx - 6, by - 12, barPx + 12, 24);
  ctx.fillStyle = UI_COLOR.text;
  ctx.fillRect(bx, by, barPx, 2);
  ctx.fillRect(bx, by - 3, 1, 8);
  ctx.fillRect(bx + barPx - 1, by - 3, 1, 8);
  drawText(ctx, '1km', bx + barPx / 2, by - 5,
    { size: 10, align: 'center', color: UI_COLOR.textDim });

  drawText(ctx, '지도를 눌러 목적지 표시 · Tab 또는 M 으로 닫기', W / 2, H - 22,
    { size: 12, align: 'center', color: UI_COLOR.textDim });
}

// 지도에서 찍은 화면 좌표를 타일 좌표로 되돌리고, 그 자리의 이름을 찾는다
export function pickOnMap(state, sx, sy) {
  const v = state.mapView;
  if (!v) return null;
  if (sx < v.ox || sy < v.oy || sx > v.ox + v.w || sy > v.oy + v.h) return null;
  const tx = ((sx - v.ox) / v.scale) * UI.minimapScale;
  const ty = ((sy - v.oy) / v.scale) * UI.minimapScale;

  // 가까운 랜드마크가 있으면 그 이름을 쓴다
  let best = null, bestD = 60 * UI.minimapScale / v.scale;
  for (const m of state.landmarks) {
    const d = Math.hypot(m.tx - tx, m.ty - ty);
    if (d < bestD) { bestD = d; best = m; }
  }
  if (best) return { tx: best.tx, ty: best.ty, label: best.name };

  // 아니면 구역 이름
  for (const r of state.mapRegions) {
    if (!r.label) continue;
    if (tx >= r.minX && tx <= r.maxX && ty >= r.minY && ty <= r.maxY) {
      return { tx, ty, label: r.name };
    }
  }
  return { tx, ty, label: '표시한 곳' };
}

// 지도에 쓸 구역·랜드마크 목록을 한 번만 만들어 둔다
export function buildMapMarks(map, buildings) {
  const regions = map.regions.map((r) => {
    const b = pathBounds(r.path);
    return { id: r.id, name: r.name, label: r.label, kind: r.kind,
      cx: (b.minX + b.maxX) / 2, cy: (b.minY + b.maxY) / 2,
      minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY };
  });
  const landmarks = buildings.list
    .filter((b) => b.landmark)
    .map((b) => ({ name: b.name, kind: b.kind,
      tx: b.x + b.w / 2, ty: b.y + b.h / 2 }));
  return { regions, landmarks };
}
