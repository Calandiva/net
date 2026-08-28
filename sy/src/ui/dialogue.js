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
  // 고를 게 있으면 그 높이만큼 위로 올린다 (화면 밖으로 나가지 않게)
  const last = d.index >= d.lines.length - 1;
  const extra = (d.choices && last) ? d.choices.length * 30 + 10 : 0;
  const y = H - boxH - extra - (state.isTouch ? 210 : 60);

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

  const more = !last;

  // 마지막 줄에서 고를 것이 있으면 아래에 붙여 보여 준다
  if (!more && d.choices) {
    const rowH = 26;
    const cy = y + boxH + 6;
    d.rects = [];
    d.choices.forEach((c, i) => {
      const ry = cy + i * (rowH + 4);
      const on = i === d.choice;
      ctx.fillStyle = on ? 'rgba(242, 193, 78, 0.18)' : UI_COLOR.panel;
      ctx.fillRect(x, ry, boxW, rowH);
      ctx.strokeStyle = on ? UI_COLOR.accent : UI_COLOR.panelEdge;
      ctx.strokeRect(x + 0.5, ry + 0.5, boxW - 1, rowH - 1);
      drawText(ctx, `${on ? '▶ ' : '   '}${c.label}`, x + 14, ry + 18,
        { size: 13, color: on ? UI_COLOR.accent : UI_COLOR.text });
      d.rects.push({ x, y: ry, w: boxW, h: rowH });
    });
    drawText(ctx, state.isTouch ? '눌러서 고르기' : '↑↓ 고르고 Space',
      x + boxW - 16, y + boxH - 12, { size: 11, align: 'right', color: UI_COLOR.textDim });
    return;
  }

  drawText(ctx, more ? (state.isTouch ? '탭 ▶' : 'Space ▶') : (state.isTouch ? '탭 닫기' : 'Space 닫기'),
    x + boxW - 16, y + boxH - 12, { size: 11, align: 'right', color: UI_COLOR.textDim });
}

// 화면에서 고른 줄 번호 (없으면 -1)
export function choiceRowAt(state, sx, sy) {
  const d = state.dialogue;
  if (!d || !d.rects) return -1;
  return d.rects.findIndex((r) => sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h);
}

// 선택지 위아래로 옮기기
export function moveChoice(state, delta) {
  const d = state.dialogue;
  if (!d || !d.choices) return;
  d.choice = Math.max(0, Math.min(d.choices.length - 1, d.choice + delta));
}

// 지금 고른 것을 고른다
export function pickChoice(state, index) {
  const d = state.dialogue;
  if (!d || !d.choices) return false;
  const c = d.choices[index === undefined ? d.choice : index];
  state.dialogue = null;
  if (c && c.run) c.run();
  return true;
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

// 대화 시작.
// opts.choices  [{ label, run }]  마지막 줄에서 고르게 한다
// opts.onEnd    선택지 없이 끝났을 때 부를 것
export function startDialogue(state, name, lines, opts) {
  const list = (lines && lines.length) ? lines : ['...'];
  state.dialogue = {
    name, lines: list, index: 0,
    choices: (opts && opts.choices) || null,
    choice: 0,
    onEnd: (opts && opts.onEnd) || null,
    rects: null,
  };
}

// 다음 줄로. 끝이면 닫는다 (고를 게 있으면 고르는 것으로).
export function advanceDialogue(state) {
  const d = state.dialogue;
  if (!d) return false;
  if (d.index < d.lines.length - 1) {
    d.index++;
    return true;
  }
  if (d.choices) return pickChoice(state);
  state.dialogue = null;
  if (d.onEnd) d.onEnd();
  return false;
}
