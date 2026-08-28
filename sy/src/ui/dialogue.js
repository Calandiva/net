// 대화창. 사람에게 말을 걸면 아래에 뜬다. Space 로 다음 줄, 끝나면 닫힌다.

import { UI } from '../config.js';
import { UI_COLOR } from '../render/palette.js';
import { drawText, textWidth, viewSize } from './labels.js';
import { panel } from './hud.js';

export function drawDialogue(ctx, state) {
  const d = state.dialogue;
  if (!d) return;
  const { w: W, h: H } = viewSize(ctx);

  const boxW = Math.min(560, W - 40);
  const boxH = 96;
  const x = (W - boxW) / 2;
  const y = H - boxH - (state.isTouch ? 120 : 60);

  panel(ctx, x, y, boxW, boxH);
  // 말하는 사람
  ctx.fillStyle = UI_COLOR.accent;
  ctx.fillRect(x, y, 3, boxH);
  drawText(ctx, d.name, x + 16, y + 26, { size: 13, color: UI_COLOR.accent });

  // 말줄임 없이 두 줄까지 접어 준다
  const line = d.lines[d.index] || '';
  const maxW = boxW - 32;
  const rows = wrap(ctx, line, maxW, 14);
  rows.slice(0, 2).forEach((row, i) => {
    drawText(ctx, row, x + 16, y + 52 + i * 20, { size: 14 });
  });

  const more = d.index < d.lines.length - 1;
  drawText(ctx, more ? (state.isTouch ? '탭 ▶' : 'Space ▶') : (state.isTouch ? '탭 닫기' : 'Space 닫기'),
    x + boxW - 16, y + boxH - 12, { size: 11, align: 'right', color: UI_COLOR.textDim });
}

// 글자 폭에 맞춰 줄바꿈
function wrap(ctx, text, maxW, size) {
  if (textWidth(ctx, text, size) <= maxW) return [text];
  const rows = [];
  let cur = '';
  for (const ch of text) {
    if (textWidth(ctx, cur + ch, size) > maxW) { rows.push(cur); cur = ''; }
    cur += ch;
  }
  if (cur) rows.push(cur);
  return rows;
}

// 대화 시작
export function startDialogue(state, name, lines) {
  const list = (lines && lines.length) ? lines : ['...'];
  state.dialogue = { name, lines: list, index: 0 };
}

// 다음 줄로. 끝이면 닫는다.
export function advanceDialogue(state) {
  if (!state.dialogue) return false;
  if (state.dialogue.index < state.dialogue.lines.length - 1) {
    state.dialogue.index++;
    return true;
  }
  state.dialogue = null;
  return false;
}
