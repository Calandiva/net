// SVG 를 만드는 최소한의 도구. 악보 · 지판 · 건반이 전부 이걸로 그려진다.

const NS = 'http://www.w3.org/2000/svg';

export function sv(tag, attrs, kids) {
  const node = document.createElementNS(NS, tag);
  if (attrs) {
    for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      node.setAttribute(k, v === true ? '' : String(v));
    }
  }
  if (kids != null) {
    (Array.isArray(kids) ? kids : [kids]).forEach((k) => {
      if (k == null) return;
      node.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
    });
  }
  return node;
}

export function svgRoot(w, h, cls) {
  return sv('svg', {
    viewBox: '0 0 ' + w + ' ' + h,
    width: w, height: h, class: cls || '',
    xmlns: NS, 'shape-rendering': 'geometricPrecision',
  });
}

export function line(x1, y1, x2, y2, stroke, w) {
  return sv('line', { x1, y1, x2, y2, stroke, 'stroke-width': w == null ? 1 : w, 'stroke-linecap': 'round' });
}

export function rect(x, y, w, h, fill, more) {
  return sv('rect', Object.assign({ x, y, width: w, height: h, fill }, more || {}));
}

export function circle(cx, cy, r, fill, more) {
  return sv('circle', Object.assign({ cx, cy, r, fill }, more || {}));
}

export function path(d, more) {
  return sv('path', Object.assign({ d, fill: 'none' }, more || {}));
}

export function text(x, y, s, more) {
  return sv('text', Object.assign({
    x, y, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
    'font-family': 'ui-sans-serif, system-ui, sans-serif', 'font-size': 11,
  }, more || {}), String(s));
}

// 타원 음표 머리(살짝 기울어져 있어야 악보처럼 보인다)
export function ellipse(cx, cy, rx, ry, fill, rot, more) {
  return sv('ellipse', Object.assign({
    cx, cy, rx, ry, fill,
    transform: 'rotate(' + (rot || -18) + ' ' + cx + ' ' + cy + ')',
  }, more || {}));
}
