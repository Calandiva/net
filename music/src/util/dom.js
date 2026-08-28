// DOM 을 만드는 최소한의 도구. 프레임워크는 쓰지 않는다.

// el('div.card', {id:'x'}, ['글', el('b', '굵게')])
export function el(spec, attrs, kids) {
  const m = String(spec).split(/([.#])/);
  const node = document.createElement(m[0] || 'div');
  for (let i = 1; i < m.length; i += 2) {
    if (m[i] === '.') node.classList.add(m[i + 1]);
    else node.id = m[i + 1];
  }
  if (attrs && (typeof attrs === 'string' || attrs instanceof Node || Array.isArray(attrs))) {
    kids = attrs; attrs = null;
  }
  if (attrs) {
    for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), v);
      else if (k === 'html') node.innerHTML = v;
      else node.setAttribute(k, v === true ? '' : v);
    }
  }
  add(node, kids);
  return node;
}

export function add(node, kids) {
  if (kids == null) return node;
  if (Array.isArray(kids)) { kids.forEach((k) => add(node, k)); return node; }
  node.appendChild(kids instanceof Node ? kids : document.createTextNode(String(kids)));
  return node;
}

export function clear(node) {
  while (node && node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function qs(sel, root) {
  return (root || document).querySelector(sel);
}

// 라벨 붙은 한 줄짜리 조작부
export function field(label, control) {
  return el('label.field', [el('span.field-label', label), control]);
}

// 값이 바뀌면 알려 주는 버튼 묶음(라디오 대용)
export function chipGroup(items, value, onPick) {
  const box = el('div.chips');
  items.forEach((it) => {
    const b = el('button.chip', { type: 'button', 'data-v': it.value }, it.label);
    if (it.value === value) b.classList.add('on');
    if (it.title) b.title = it.title;
    b.addEventListener('click', () => {
      box.querySelectorAll('.chip').forEach((c) => c.classList.remove('on'));
      b.classList.add('on');
      onPick(it.value);
    });
    box.appendChild(b);
  });
  return box;
}
