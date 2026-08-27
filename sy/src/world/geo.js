// 위경도(WGS84) ↔ 타일 좌표 변환만 담당한다.
// 지역 데이터는 전부 실제 좌표로 적고, 게임 안에서 쓰는 순간 여기를 통과한다.
// 지도 API에서 받은 데이터를 그대로 얹어도 이 파일만 통하면 된다.

import { GEO, TILE } from '../config.js';

// 영역 전체 크기 (타일)
export const WORLD_W = Math.round(
  ((GEO.east - GEO.west) * GEO.metersPerLon) / GEO.metersPerTile);
export const WORLD_H = Math.round(
  ((GEO.north - GEO.south) * GEO.metersPerLat) / GEO.metersPerTile);

// 영역 전체 크기 (픽셀)
export const WORLD_PX_W = WORLD_W * TILE.size;
export const WORLD_PX_H = WORLD_H * TILE.size;

// 경도 → 타일 x
export function lonToTx(lon) {
  return ((lon - GEO.west) * GEO.metersPerLon) / GEO.metersPerTile;
}
// 위도 → 타일 y (화면은 위쪽이 북쪽)
export function latToTy(lat) {
  return ((GEO.north - lat) * GEO.metersPerLat) / GEO.metersPerTile;
}
// [경도, 위도] → [타일x, 타일y]
export function project([lon, lat]) {
  return [lonToTx(lon), latToTy(lat)];
}
// 폴리곤/폴리라인 통째로 변환
export function projectPath(path) {
  return path.map(project);
}
// 타일 → 위경도 (디버그·좌표 표시용)
export function tileToLonLat(tx, ty) {
  return [
    GEO.west + (tx * GEO.metersPerTile) / GEO.metersPerLon,
    GEO.north - (ty * GEO.metersPerTile) / GEO.metersPerLat,
  ];
}
// 미터 → 타일
export function metersToTiles(m) { return m / GEO.metersPerTile; }

// 폴리곤(타일 좌표)의 경계 상자
export function pathBounds(path) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of path) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

// 점이 폴리곤 안에 있는가 (ray casting)
export function pointInPath(px, py, path) {
  let inside = false;
  for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
    const [xi, yi] = path[i], [xj, yj] = path[j];
    if ((yi > py) !== (yj > py) &&
        px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-12) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// 점과 선분 사이 거리 (도로 폭 계산에 쓴다)
export function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}
