// 카메라 — 플레이어를 부드럽게 따라가고 지도 밖을 비추지 않는다.

import { CAMERA, TILE } from '../config.js';
import { WORLD_PX_W, WORLD_PX_H } from '../world/geo.js';

export class Camera {
  constructor() {
    this.x = 0; this.y = 0;      // 화면 중앙이 보는 월드 좌표(픽셀)
    this.zoom = CAMERA.zoom;
    this.viewW = 0; this.viewH = 0; // 화면 크기(월드 픽셀 기준)
  }

  resize(cssW, cssH) {
    this.viewW = cssW / this.zoom;
    this.viewH = cssH / this.zoom;
  }

  setZoom(z, cssW, cssH) {
    this.zoom = Math.max(CAMERA.zoomMin, Math.min(CAMERA.zoomMax, Math.round(z)));
    this.resize(cssW, cssH);
  }

  // 목표를 따라간다. bounds 를 주면 그 안으로 가둔다 (실내는 실내 크기로).
  follow(tx, ty, dt, bounds) {
    const dx = tx - this.x, dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > CAMERA.deadzone) {
      const t = 1 - Math.pow(1 - CAMERA.lerp, dt * 60);
      this.x += dx * t;
      this.y += dy * t;
    }
    this.clamp(bounds);
  }

  snap(tx, ty, bounds) {
    this.x = tx; this.y = ty;
    this.clamp(bounds);
  }

  clamp(bounds) {
    const w = bounds ? bounds.w : WORLD_PX_W;
    const h = bounds ? bounds.h : WORLD_PX_H;
    const halfW = this.viewW / 2, halfH = this.viewH / 2;
    this.x = w <= this.viewW ? w / 2 : Math.max(halfW, Math.min(w - halfW, this.x));
    this.y = h <= this.viewH ? h / 2 : Math.max(halfH, Math.min(h - halfH, this.y));
  }

  // 화면 왼쪽 위가 보는 월드 좌표. 정수로 맞춰 도트가 흔들리지 않게 한다.
  get left() { return Math.round(this.x - this.viewW / 2); }
  get top() { return Math.round(this.y - this.viewH / 2); }

  worldToScreen(wx, wy) {
    return [(wx - this.left) * this.zoom, (wy - this.top) * this.zoom];
  }

  // 지금 보이는 타일 범위
  visibleTiles(pad = 1) {
    return {
      x0: Math.floor(this.left / TILE.size) - pad,
      y0: Math.floor(this.top / TILE.size) - pad,
      x1: Math.ceil((this.left + this.viewW) / TILE.size) + pad,
      y1: Math.ceil((this.top + this.viewH) / TILE.size) + pad,
    };
  }
}
