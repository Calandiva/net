// 균일 격자 공간 인덱스. 도로 · 건물 · 구역을 "이 근처에 뭐가 있나" 로 빠르게 찾는다.
// 청크를 그릴 때마다 전체 목록을 훑지 않기 위한 것.

export class GridIndex {
  constructor(cellTiles) {
    this.cell = cellTiles;
    this.map = new Map();
  }

  _key(cx, cy) { return cx * 100000 + cy; }

  // 경계 상자(타일 좌표)를 차지하는 모든 칸에 넣는다.
  insert(item, minX, minY, maxX, maxY) {
    const c = this.cell;
    const x0 = Math.floor(minX / c), x1 = Math.floor(maxX / c);
    const y0 = Math.floor(minY / c), y1 = Math.floor(maxY / c);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const k = this._key(cx, cy);
        let bucket = this.map.get(k);
        if (!bucket) this.map.set(k, (bucket = []));
        bucket.push(item);
      }
    }
  }

  // 경계 상자와 겹칠 수 있는 항목들 (중복 없이)
  query(minX, minY, maxX, maxY) {
    const c = this.cell;
    const x0 = Math.floor(minX / c), x1 = Math.floor(maxX / c);
    const y0 = Math.floor(minY / c), y1 = Math.floor(maxY / c);
    const seen = new Set();
    const out = [];
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const bucket = this.map.get(this._key(cx, cy));
        if (!bucket) continue;
        for (const item of bucket) {
          if (seen.has(item)) continue;
          seen.add(item);
          out.push(item);
        }
      }
    }
    return out;
  }

  queryPoint(x, y) { return this.query(x, y, x, y); }
}

// 두 사각형(타일 좌표, [x,y,w,h])이 margin 만큼 여유를 두고 겹치는가
export function rectsOverlap(a, b, margin = 0) {
  return !(a.x + a.w + margin <= b.x || b.x + b.w + margin <= a.x ||
           a.y + a.h + margin <= b.y || b.y + b.h + margin <= a.y);
}
