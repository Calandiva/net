// 모바일 조작. 터치 기기에서만 뜬다 (PC 는 지금 그대로 키보드로 논다).
//
// 왼쪽 절반: 손가락을 대면 그 자리에 조이스틱이 생기고, 끌면 그 방향으로 걷는다.
//            많이 밀면 달린다.
// 오른쪽: 상호작용 · 달리기 고정 · 지도 · 도움말 버튼.

import { UI_COLOR } from '../render/palette.js';
import { drawText } from './labels.js';

export function isTouchDevice() {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  return coarse || navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
}

const STICK_RADIUS = 62;   // 조이스틱 반경(px)
const KNOB_RADIUS = 26;
const RUN_THRESHOLD = 0.72; // 이만큼 밀면 달린다
const BUTTON = 58;

export class TouchControls {
  constructor(hooks) {
    this.hooks = hooks;            // { interact, worldmap, help, minimap }
    this.stick = null;             // { id, ox, oy, x, y }
    this.axis = { x: 0, y: 0 };
    this.pushed = 0;               // 0~1, 얼마나 밀었나
    this.runLock = false;          // 달리기 고정
    this.buttons = [];             // 그릴 때 자리 계산해 둔다
    this.pressed = new Map();      // 버튼 id → 눌린 포인터
  }

  get running() { return this.runLock || this.pushed > RUN_THRESHOLD; }

  // 화면 크기에 맞춰 버튼 자리를 잡는다
  layout(W, H) {
    const m = 22, gap = 12;
    const bx = W - m - BUTTON;
    const by = H - m - BUTTON;
    this.buttons = [
      { id: 'interact', label: '만지기', x: bx - BUTTON - gap, y: by - 20, r: BUTTON * 0.78 },
      { id: 'run', label: '달리기', x: bx, y: by - BUTTON - gap - 20, r: BUTTON * 0.55 },
      { id: 'worldmap', label: '지도', x: bx, y: by - 20, r: BUTTON * 0.55 },
      { id: 'help', label: '?', x: m + 34, y: m + 34, r: 26 },
    ];
  }

  // 화면 좌표로 눌린 버튼 찾기
  buttonAt(x, y) {
    for (const b of this.buttons) {
      if (Math.hypot(x - b.x, y - b.y) <= b.r + 8) return b;
    }
    return null;
  }

  onDown(id, x, y, W) {
    const button = this.buttonAt(x, y);
    if (button) {
      this.pressed.set(id, button.id);
      if (button.id === 'interact') this.hooks.interact();
      else if (button.id === 'run') this.runLock = !this.runLock;
      else if (button.id === 'worldmap') this.hooks.worldmap();
      else if (button.id === 'help') this.hooks.help();
      return true;
    }
    if (x < W * 0.55 && !this.stick) {
      this.stick = { id, ox: x, oy: y, x, y };
      return true;
    }
    return false;
  }

  onMove(id, x, y) {
    if (!this.stick || this.stick.id !== id) return false;
    this.stick.x = x; this.stick.y = y;
    const dx = x - this.stick.ox, dy = y - this.stick.oy;
    const len = Math.hypot(dx, dy);
    const clamped = Math.min(len, STICK_RADIUS);
    this.pushed = clamped / STICK_RADIUS;
    if (len < 8) { this.axis.x = 0; this.axis.y = 0; return true; }
    this.axis.x = dx / len;
    this.axis.y = dy / len;
    return true;
  }

  onUp(id) {
    this.pressed.delete(id);
    if (this.stick && this.stick.id === id) {
      this.stick = null;
      this.axis.x = 0; this.axis.y = 0;
      this.pushed = 0;
    }
  }

  draw(ctx, W, H) {
    this.layout(W, H);
    ctx.save();

    // 조이스틱
    if (this.stick) {
      const dx = this.stick.x - this.stick.ox, dy = this.stick.y - this.stick.oy;
      const len = Math.min(Math.hypot(dx, dy), STICK_RADIUS) || 0;
      const ang = Math.atan2(dy, dx);
      const kx = this.stick.ox + Math.cos(ang) * len;
      const ky = this.stick.oy + Math.sin(ang) * len;

      ctx.globalAlpha = 0.28;
      ctx.fillStyle = '#000000';
      circle(ctx, this.stick.ox, this.stick.oy, STICK_RADIUS, true);
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = UI_COLOR.text;
      ctx.lineWidth = 2;
      circle(ctx, this.stick.ox, this.stick.oy, STICK_RADIUS, false);
      ctx.globalAlpha = 0.62;
      ctx.fillStyle = this.running ? UI_COLOR.accent : UI_COLOR.text;
      circle(ctx, kx, ky, KNOB_RADIUS, true);
    } else {
      // 안내 — 처음 들어온 사람이 어디를 눌러야 하는지 알 수 있게
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = UI_COLOR.text;
      circle(ctx, 96, H - 96, STICK_RADIUS * 0.66, false, true);
      ctx.globalAlpha = 0.5;
      drawText(ctx, '왼쪽을 끌어 이동', 96, H - 22,
        { size: 11, align: 'center', color: UI_COLOR.textDim, shadow: false });
    }

    // 버튼
    for (const b of this.buttons) {
      const isRun = b.id === 'run';
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#000000';
      circle(ctx, b.x, b.y, b.r, true);
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = isRun && this.runLock ? UI_COLOR.accent : UI_COLOR.text;
      ctx.lineWidth = 2;
      circle(ctx, b.x, b.y, b.r, false);
      ctx.globalAlpha = 1;
      drawText(ctx, b.label, b.x, b.y + 4, {
        size: b.r > 30 ? 14 : 12, align: 'center',
        color: isRun && this.runLock ? UI_COLOR.accent : UI_COLOR.text,
      });
    }
    ctx.restore();
  }
}

function circle(ctx, x, y, r, fill, dashed) {
  ctx.beginPath();
  if (dashed) ctx.setLineDash([6, 6]);
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) ctx.fill(); else ctx.stroke();
  if (dashed) ctx.setLineDash([]);
}
