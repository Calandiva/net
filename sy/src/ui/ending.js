// 결말 화면과 엔딩 목록.

import { UI } from '../config.js';
import { UI_COLOR } from '../render/palette.js';
import { ENDINGS, ENDING_COUNT, TAG_COLOR, TAG_LABEL } from '../game/endings.js';
import { drawText, textWidth, viewSize } from './labels.js';
import { panel } from './hud.js';

// 결말 한 판
export function drawEnding(ctx, state) {
  const { w: W, h: H } = viewSize(ctx);
  const e = state.game.ending;
  const g = state.game;

  ctx.fillStyle = 'rgba(10, 9, 13, 0.92)';
  ctx.fillRect(0, 0, W, H);

  const cx = W / 2;
  let y = Math.max(90, H / 2 - 150);

  drawText(ctx, `${TAG_LABEL[e.tag]} 끝났다`, cx, y - 40,
    { size: 13, align: 'center', color: UI_COLOR.textDim });
  drawText(ctx, e.title, cx, y, { size: 34, align: 'center', bold: true, color: TAG_COLOR[e.tag] });
  drawText(ctx, `${e.id} · ${g.clockText()}`, cx, y + 26,
    { size: 12, align: 'center', color: UI_COLOR.textDim });

  y += 66;
  for (const line of e.lines) {
    drawText(ctx, line, cx, y, { size: 15, align: 'center' });
    y += 26;
  }

  // 이 판에 건드린 것들
  y += 16;
  if (g.log.length) {
    drawText(ctx, `건드린 것 ${g.log.length}가지`, cx, y,
      { size: 12, align: 'center', color: UI_COLOR.accent });
    y += 20;
    const notes = g.log.slice(-6).map((l) => l.note);
    for (const note of notes) {
      drawText(ctx, `· ${note}`, cx, y, { size: 12, align: 'center', color: UI_COLOR.textDim });
      y += 18;
    }
  } else {
    drawText(ctx, '아무것도 건드리지 않았다', cx, y,
      { size: 12, align: 'center', color: UI_COLOR.textDim });
    y += 20;
  }

  y += 14;
  drawText(ctx, `찾은 결말 ${g.found.size} / ${ENDING_COUNT}`, cx, y,
    { size: 14, align: 'center', color: UI_COLOR.accent });
  drawText(ctx, 'R 다시 시작 · L 엔딩 목록', cx, y + 30,
    { size: 13, align: 'center', color: UI_COLOR.textDim });
}

// 지금까지 본 결말 목록
export function drawGallery(ctx, state) {
  const { w: W, h: H } = viewSize(ctx);
  const found = state.game.found;

  ctx.fillStyle = 'rgba(10, 9, 13, 0.94)';
  ctx.fillRect(0, 0, W, H);
  drawText(ctx, `엔딩 ${found.size} / ${ENDING_COUNT}`, W / 2, 46,
    { size: 22, align: 'center', bold: true });
  drawText(ctx, '못 본 결말에는 힌트가 붙어 있다', W / 2, 68,
    { size: 12, align: 'center', color: UI_COLOR.textDim });

  const cols = W >= 1000 ? 3 : W >= 680 ? 2 : 1;
  const cardW = Math.min(320, (W - 60) / cols - 12);
  const cardH = 54;
  const startX = (W - (cardW * cols + 12 * (cols - 1))) / 2;
  let top = 92;
  const rows = Math.ceil(ENDINGS.length / cols);
  const maxRows = Math.floor((H - top - 60) / (cardH + 8));
  const scale = rows > maxRows ? (H - top - 60) / (rows * (cardH + 8)) : 1;

  ENDINGS.forEach((e, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = startX + col * (cardW + 12);
    const y = top + row * (cardH + 8) * scale;
    const h = cardH * scale;
    const got = found.has(e.id);
    ctx.fillStyle = got ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)';
    ctx.fillRect(x, y, cardW, h);
    ctx.fillStyle = got ? TAG_COLOR[e.tag] : 'rgba(255,255,255,0.12)';
    ctx.fillRect(x, y, 3, h);
    drawText(ctx, e.id, x + 12, y + 20 * scale,
      { size: 11 * scale, color: UI_COLOR.textDim, shadow: false });
    drawText(ctx, got ? e.title : '？？？', x + 44, y + 21 * scale,
      { size: 14 * scale, color: got ? UI_COLOR.text : UI_COLOR.textDim, shadow: false });
    drawText(ctx, got ? e.lines[0] : e.hint, x + 12, y + 40 * scale,
      { size: 11 * scale, color: got ? UI_COLOR.textDim : 'rgba(255,255,255,0.32)', shadow: false });
  });

  drawText(ctx, 'L 로 닫기', W / 2, H - 24,
    { size: 12, align: 'center', color: UI_COLOR.textDim });
}
