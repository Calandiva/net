/* ═══════════════════════════════════════════════════════════════════════════
   50-render.js — SVG 캔버스 · 포트 체계 · 조작(Max/MSP 방식) · 어시스트 툴팁

   포트 의미 (노드 상하좌우)
     상단 ▲ 업링크   — 상위망(외부·코어) 방향
     하단 ▼ 다운링크 — 하위망(서버·단말) 방향
     좌우 ◆ 피어     — 동일 계층(이중화 짝·스택·복제·교차연결)
   기본값은 두 노드의 위치에서 자동으로 정해지고, 사용자가 특정 포트에서
   끌어 연결하면 그 선택이 링크에 고정된다.
   ═══════════════════════════════════════════════════════════════════════════ */

const SVGNS = 'http://www.w3.org/2000/svg';
const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const el = (tag, attrs, kids) => {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in (attrs||{})) if (attrs[k]!==null && attrs[k]!==undefined) e.setAttribute(k, attrs[k]);
  (kids||[]).forEach(c=>e.appendChild(c));
  return e;
};
const h = (tag, attrs, html) => {
  const e = document.createElement(tag);
  for (const k in (attrs||{})){ if (k==='cls') e.className=attrs[k]; else if (k.startsWith('on')) e[k]=attrs[k]; else e.setAttribute(k, attrs[k]); }
  if (html!==undefined) e.innerHTML = html;
  return e;
};
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const txt = s => document.createTextNode(s==null?'':String(s));

const NW = n => (T[n.ty] && T[n.ty].w) || 116;
const NH = n => (T[n.ty] && T[n.ty].h) || 64;
const nodeRect = n => ({ x:n.x, y:n.y, w:NW(n), h:NH(n), cx:n.x+NW(n)/2, cy:n.y+NH(n)/2 });
const snap = v => Math.round(v/GRID)*GRID;

/* ── 포트 ──────────────────────────────────────────────────────────────── */
const ROLE = {
  t:{ n:'업링크',   s:'▲', d:'상위망(외부·코어) 방향으로 올라가는 포트', c:'var(--acc)' },
  b:{ n:'다운링크', s:'▼', d:'하위망(서버·단말) 방향으로 내려가는 포트', c:'var(--acc)' },
  l:{ n:'피어',     s:'◆', d:'동일 계층 연결 — 이중화 짝 · 스택 · 복제 · 교차연결', c:'var(--cu)' },
  r:{ n:'피어',     s:'◆', d:'동일 계층 연결 — 이중화 짝 · 스택 · 복제 · 교차연결', c:'var(--cu)' }
};
const OPP = { t:'b', b:'t', l:'r', r:'l' };

/* 망 계층 깊이 — 인터넷/WAN 에서 몇 홉 떨어져 있는가.
   포트는 이 깊이로 정해진다. 장비를 어디로 옮겨도 위=업링크, 아래=다운링크가 유지된다. */
const DEPTH = { map:new Map(), key:'' };
function depthMap(){
  const key = S.n.length + ':' + S.e.length + ':' + (S.n[0]?S.n[0].id:'') + ':' + (S.e[0]?S.e[0].id:'');
  if (DEPTH.key === key) return DEPTH.map;
  const d = new Map();
  let seeds = S.n.filter(n=>['internet','wan'].includes(n.ty)).map(n=>n.id);
  if (!seeds.length){
    const cand = S.n.filter(n=>['router','fw','vpn','proxy'].includes(n.ty));
    const pool = cand.length ? cand : S.n;
    if (pool.length) seeds = [pool.slice().sort((a,b)=>a.y-b.y)[0].id];
  }
  seeds.forEach(id=>d.set(id,0));
  let q = seeds.slice();
  while (q.length){
    const next = [];
    q.forEach(id=>{ const dv = d.get(id);
      edgesOf(id).forEach(e=>{ const o = otherEnd(e,id);
        if (!d.has(o)){ d.set(o, dv+1); next.push(o); } }); });
    q = next;
  }
  DEPTH.map = d; DEPTH.key = key;
  return d;
}
function derivePort(e, nid){
  const me = nodeById(nid), other = nodeById(otherEnd(e, nid));
  if (!me || !other) return 'b';
  const D = depthMap();
  const dm = D.get(me.id), doo = D.get(other.id);
  if (dm !== undefined && doo !== undefined && dm !== doo) return doo < dm ? 't' : 'b';
  /* 같은 계층(또는 판단 불가) → 좌우 피어. 위아래로 크게 벌어져 있으면 계층으로 본다 */
  const a = nodeRect(me), b = nodeRect(other);
  if (Math.abs(b.cy - a.cy) > Math.abs(b.cx - a.cx) * 1.6) return b.cy > a.cy ? 'b' : 't';
  return b.cx >= a.cx ? 'r' : 'l';
}
const portOf = (e, nid) => (endProps(e, nid).port) || derivePort(e, nid);
function setPort(e, nid, side){ endProps(e, nid).port = side; markLayout(); }
/* 노드 위에 놓았을 때 자동으로 고를 포트 */
function bestPortFor(target, fromX, fromY){
  const r = nodeRect(target);
  const dx = fromX - r.cx, dy = fromY - r.cy;
  if (Math.abs(dy) >= Math.abs(dx) * 0.85) return dy > 0 ? 'b' : 't';
  return dx > 0 ? 'r' : 'l';
}
/* 새 링크를 만든 뒤, 계층상 자연스러운 포트로 정리한다 */
function relaxPorts(e){
  DEPTH.key = '';
  const A = nodeById(e.a), B = nodeById(e.b); if (!A||!B) return;
  const pa = endProps(e, A.id).port, pb = endProps(e, B.id).port;
  if (pa && pb && OPP[pa] !== pb && !((pa==='l'||pa==='r') && (pb==='l'||pb==='r'))){
    delete endProps(e, B.id).port;      // 짝이 맞지 않으면 반대쪽은 자동으로
  }
  markLayout();
}

/* ── 좌표 변환 ─────────────────────────────────────────────────────────── */
function screenToWorld(sx, sy){
  const r = $('#svg').getBoundingClientRect();
  return { x:(sx - r.left - UI.tx)/UI.zoom, y:(sy - r.top - UI.ty)/UI.zoom };
}
function applyView(){
  const tf = `translate(${UI.tx},${UI.ty}) scale(${UI.zoom})`;
  $('#world').setAttribute('transform', tf);
  $('#gridrect').setAttribute('transform', tf);
  const gr = $('#gridrect');
  gr.setAttribute('x', -UI.tx/UI.zoom - 6000); gr.setAttribute('y', -UI.ty/UI.zoom - 6000);
  gr.setAttribute('width', 12000/UI.zoom + 12000); gr.setAttribute('height', 12000/UI.zoom + 12000);
  $('#hudZoom').textContent = Math.round(UI.zoom*100)+'%';
}
function fitView(){
  if (!S.n.length){ UI.zoom=1; UI.tx=60; UI.ty=60; applyView(); return; }
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  S.n.forEach(n=>{ const r=nodeRect(n); x0=Math.min(x0,r.x); y0=Math.min(y0,r.y); x1=Math.max(x1,r.x+r.w); y1=Math.max(y1,r.y+r.h); });
  const pad=70, vw=$('#stage').clientWidth, vh=$('#stage').clientHeight;
  const z = Math.min((vw-pad*2)/Math.max(1,x1-x0), (vh-pad*2)/Math.max(1,y1-y0), 1.6);
  UI.zoom = Math.max(.14, Math.min(2.4, z));
  UI.tx = (vw - (x1-x0)*UI.zoom)/2 - x0*UI.zoom;
  UI.ty = (vh - (y1-y0)*UI.zoom)/2 - y0*UI.zoom;
  applyView(); scheduleUrl();
}

/* ── 패치 케이블 라우팅 ────────────────────────────────────────────────── */
const LAY = { anchors:new Map(), dirty:true };
const markLayout = () => { LAY.dirty = true; };

function computeAnchors(){
  LAY.anchors.clear();
  const slots = new Map();
  const need = id => { if (!slots.has(id)) slots.set(id,{t:[],r:[],b:[],l:[]}); return slots.get(id); };
  S.e.forEach(e=>{
    const A = nodeById(e.a), B = nodeById(e.b); if (!A||!B) return;
    const ra = nodeRect(A), rb = nodeRect(B);
    const sa = portOf(e, A.id), sb = portOf(e, B.id);
    need(A.id)[sa].push({ eid:e.id, end:'a', key:(sa==='t'||sa==='b') ? rb.cx : rb.cy });
    need(B.id)[sb].push({ eid:e.id, end:'b', key:(sb==='t'||sb==='b') ? ra.cx : ra.cy });
  });
  slots.forEach((sd, nid)=>{
    const n = nodeById(nid); if (!n) return;
    const r = nodeRect(n);
    ['t','r','b','l'].forEach(s=>{
      const list = sd[s]; if (!list.length) return;
      list.sort((x,y)=>x.key-y.key);
      const horiz = (s==='t'||s==='b');
      const span = horiz ? r.w : r.h;
      const usable = Math.max(8, span - 24);
      list.forEach((it,i)=>{
        const f = list.length===1 ? .5 : (i+.5)/list.length;
        const off = (span-usable)/2 + usable*f;
        const p = horiz ? { x:r.x+off, y:(s==='t'?r.y:r.y+r.h), s }
                        : { x:(s==='l'?r.x:r.x+r.w), y:r.y+off, s };
        const cur = LAY.anchors.get(it.eid) || {};
        cur[it.end] = p;
        LAY.anchors.set(it.eid, cur);
      });
    });
  });
  LAY.dirty = false;
}
function tidy(p){
  const o = [];
  p.forEach(q=>{ const l=o[o.length-1];
    if (!l || Math.abs(l[0]-q[0])>0.4 || Math.abs(l[1]-q[1])>0.4) o.push(q); });
  if (o.length<3) return o;
  const out = [o[0]];
  for (let i=1;i<o.length-1;i++){
    const a=out[out.length-1], b=o[i], c=o[i+1];
    if (Math.abs((b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0])) > 0.4) out.push(b);
  }
  out.push(o[o.length-1]);
  return out;
}
function linkPoints(e){
  if (LAY.dirty) computeAnchors();
  let an = LAY.anchors.get(e.id);
  if (!an || !an.a || !an.b){ computeAnchors(); an = LAY.anchors.get(e.id); }
  if (!an || !an.a || !an.b) return [];
  const pa = an.a, pb = an.b, ext = 22;
  const off = p => ({ x:p.x + (p.s==='l'?-ext:p.s==='r'?ext:0), y:p.y + (p.s==='t'?-ext:p.s==='b'?ext:0) });
  const a1 = off(pa), b1 = off(pb);
  const pts = [[pa.x,pa.y],[a1.x,a1.y]];
  const ha = (pa.s==='l'||pa.s==='r'), hb = (pb.s==='l'||pb.s==='r');
  if (ha && hb){ const mx=(a1.x+b1.x)/2; pts.push([mx,a1.y],[mx,b1.y]); }
  else if (!ha && !hb){ const my=(a1.y+b1.y)/2; pts.push([a1.x,my],[b1.x,my]); }
  else if (ha){ pts.push([b1.x,a1.y]); }
  else { pts.push([a1.x,b1.y]); }
  pts.push([b1.x,b1.y],[pb.x,pb.y]);
  return tidy(pts);
}
function ptsToPath(p, rad){
  if (!p || p.length<2) return '';
  const f = v => v.toFixed(1);
  if (p.length===2) return `M${f(p[0][0])} ${f(p[0][1])} L${f(p[1][0])} ${f(p[1][1])}`;
  const R0 = rad===undefined ? 11 : rad;
  let d = `M${f(p[0][0])} ${f(p[0][1])}`;
  for (let i=1;i<p.length-1;i++){
    const a=p[i-1], b=p[i], c=p[i+1];
    const d1=Math.hypot(b[0]-a[0],b[1]-a[1]), d2=Math.hypot(c[0]-b[0],c[1]-b[1]);
    if (d1<0.5 || d2<0.5) continue;
    const r = Math.min(R0, d1/2, d2/2);
    const q1 = [b[0]+(a[0]-b[0])*r/d1, b[1]+(a[1]-b[1])*r/d1];
    const q2 = [b[0]+(c[0]-b[0])*r/d2, b[1]+(c[1]-b[1])*r/d2];
    d += ` L${f(q1[0])} ${f(q1[1])} Q${f(b[0])} ${f(b[1])} ${f(q2[0])} ${f(q2[1])}`;
  }
  const z = p[p.length-1];
  return d + ` L${f(z[0])} ${f(z[1])}`;
}
function midOf(pts){
  let total=0; const seg=[];
  for (let i=1;i<pts.length;i++){ const L=Math.hypot(pts[i][0]-pts[i-1][0], pts[i][1]-pts[i-1][1]);
    seg.push({a:pts[i-1], b:pts[i], L, s:total}); total+=L; }
  if (!total) return pts[0];
  const half = total/2, s = seg.find(x=>half>=x.s && half<=x.s+x.L) || seg[0];
  const k = s.L ? (half-s.s)/s.L : 0;
  return [s.a[0]+(s.b[0]-s.a[0])*k, s.a[1]+(s.b[1]-s.a[1])*k];
}

/* ── 렌더 ──────────────────────────────────────────────────────────────── */
const REF = { nodes:new Map(), links:new Map() };
const isSel = id => UI.selSet && UI.selSet.has(id);

function render(){
  computeAnchors();
  const gN=$('#gNodes'), gL=$('#gLinks'), gZ=$('#gZones'), gO=$('#gOverlay');
  gN.textContent=''; gL.textContent=''; gZ.textContent=''; gO.textContent='';
  REF.nodes.clear(); REF.links.clear();
  const vis = n => UI.layers[T[n.ty].ly] !== false;
  const focusSet = UI.focus ? new Set([UI.focus, ...edgesOf(UI.focus).map(e=>otherEnd(e,UI.focus))]) : null;

  if (UI.showSeg && UI.topo) drawZones(gZ, vis);

  S.e.forEach(e=>{
    const A=nodeById(e.a), B=nodeById(e.b); if(!A||!B) return;
    if (!vis(A) || !vis(B)) return;
    const pts = linkPoints(e), d = ptsToPath(pts);
    const kind = LINKKIND[e.k]||LINKKIND.cu;
    const down = !edgeUp(e) || !nodeUp(A) || !nodeUp(B);
    const dim = focusSet && !(focusSet.has(A.id)&&focusSet.has(B.id));
    const path = el('path',{ d, class:'link'+(isSel(e.id)?' sel':'')+(dim?' dim':''),
      stroke:down?'var(--down)':kind.c, 'stroke-dasharray': down ? '3 5' : kind.d, opacity: down?.8:1 });
    const hit = el('path',{ d, class:'linkhit', 'data-e':e.id });
    gL.appendChild(path); gL.appendChild(hit);
    let lbl = null;
    if (UI.showBw && UI.zoom>0.6 && !dim && pts.length){
      const mid = midOf(pts);
      lbl = el('text',{ x:mid[0], y:mid[1]-5, class:'badge-t', fill:kind.c, 'text-anchor':'middle' },
        [txt(e.k==='hb' ? 'HA' : kind.n.split(' ')[0])]);
      gL.appendChild(lbl);
    }
    REF.links.set(e.id, { path, hit, lbl });
  });

  if (UI.trace && UI.trace.pathE.length){
    const gF=$('#gFlow'); gF.textContent='';
    const seen=new Set();
    UI.trace.pathE.forEach(id=>{ if(seen.has(id))return; seen.add(id);
      const e=edgeById(id); if(!e) return;
      gF.appendChild(el('path',{ d:ptsToPath(linkPoints(e)), class:'flowpath' })); });
  } else $('#gFlow').textContent='';

  S.n.forEach(n=>{
    if (!vis(n)) return;
    const g = buildNode(n, focusSet);
    gN.appendChild(g);
    REF.nodes.set(n.id, g);
  });

  $('#hudCnt').textContent = `${S.n.length} 노드 / ${S.e.length} 링크`;
  const cnt = UI.selSet ? UI.selSet.size : 0;
  $('#hudSel').textContent = cnt>1 ? `${cnt}개 선택` :
    (UI.sel ? (nodeById(UI.sel) ? nodeById(UI.sel).p.name
      : (edgeById(UI.sel) ? nodeById(edgeById(UI.sel).a).p.name+' ↔ '+nodeById(edgeById(UI.sel).b).p.name : '')) : '');
}

function buildNode(n, focusSet){
  const def=T[n.ty], r=nodeRect(n), ly=LAYERS[def.ly];
  const dim = focusSet && !focusSet.has(n.id);
  const g = el('g',{ class:'node'+(isSel(n.id)?' sel':'')+(n.p.down?' down':'')+(dim?' dim':''),
    transform:`translate(${r.x},${r.y})`, 'data-n':n.id });
  if (isSel(n.id)) g.appendChild(el('rect',{ class:'nhalo', x:-4, y:-4, width:r.w+8, height:r.h+8, rx:10 }));
  g.appendChild(el('rect',{ class:'nbody', width:r.w, height:r.h, rx:7 }));
  g.appendChild(el('rect',{ class:'nhover', width:r.w, height:r.h, rx:7, fill:'var(--acc)' }));
  g.appendChild(el('rect',{ class:'nband', x:1.2, y:1.2, width:r.w-2.4, height:3.4, rx:2, fill:ly.c, opacity:n.p.down?.35:.95 }));

  const ic = el('g',{ transform:'translate(8,12) scale(0.86)', fill:'none', stroke:ly.c,
    'stroke-width':1.5, 'stroke-linecap':'round', 'stroke-linejoin':'round', opacity:n.p.down?.4:1 });
  ic.innerHTML = IC[def.ic]||IC.app;
  g.appendChild(ic);

  const tx = 34;
  g.appendChild(el('text',{ class:'ntitle', x:tx, y:20 }, [txt(clip(n.p.name, r.w-tx-8))]));
  g.appendChild(el('text',{ class:'nsub', x:tx, y:32 }, [txt(clip(subLine(n), r.w-tx-6, 5.6))]));
  const s3 = subLine2(n);
  if (s3) g.appendChild(el('text',{ class:'nsub', x:tx, y:43 }, [txt(clip(s3, r.w-tx-6, 5.6))]));

  const badges = [];
  const ha = n.p.ha||'none';
  if (ha!=='none') badges.push({ t:({as:'A/S',aa:'A/A',np1:'N+1',clu:'CLU'})[ha]||ha, c:'var(--up)' });
  if (n.p.vlan && ['l2sw','client','web','was','rdb','app','cache','k8s'].includes(n.ty)) badges.push({ t:'V'+n.p.vlan, c:'var(--ink-3)' });
  if (n.ty==='lb') badges.push({ t:(n.p.mode||'l4').toUpperCase(), c:'var(--acc)' });
  if (n.ty==='fw' && n.p.mode==='tp') badges.push({ t:'TP', c:'var(--ink-3)' });
  if (n.ty==='rdb' && n.p.dbha && n.p.dbha!=='none') badges.push({ t:n.p.dbha.toUpperCase(), c:'var(--info)' });
  if (n.p.zone) badges.push({ t:n.p.zone, c:'var(--cu)' });
  let bx = tx;
  badges.slice(0,3).forEach(b=>{
    const w = b.t.length*5.4+7; if (bx+w > r.w-6) return;
    g.appendChild(el('rect',{ x:bx, y:r.h-16, width:w, height:11, rx:3, fill:b.c, opacity:.14 }));
    g.appendChild(el('text',{ class:'badge-t', x:bx+w/2, y:r.h-7.6, 'text-anchor':'middle', fill:b.c }, [txt(b.t)]));
    bx += w+3;
  });

  g.appendChild(el('circle',{ cx:r.w-10, cy:13, r:3.6,
    fill:n.p.down?'var(--down)':(UI.issueNodes&&UI.issueNodes.has(n.id)?'var(--warn)':'var(--up)') }));

  /* 포트 — 상단▲업링크 / 하단▼다운링크 / 좌우◆피어 */
  const used = { t:0,b:0,l:0,r:0 };
  edgesOf(n.id).forEach(e=>used[portOf(e,n.id)]++);
  const P = [
    ['t', r.w/2, 0,     'M-5 3 L0 -3 L5 3 Z'],
    ['b', r.w/2, r.h,   'M-5 -3 L0 3 L5 -3 Z'],
    ['l', 0,     r.h/2, 'M0 -4 L4 0 L0 4 L-4 0 Z'],
    ['r', r.w,   r.h/2, 'M0 -4 L4 0 L0 4 L-4 0 Z']
  ];
  P.forEach(([s,px,py,dd])=>{
    const grp = el('g',{ class:'portg'+(used[s]?' has':''), transform:`translate(${px},${py})`,
      'data-port':s, 'data-n':n.id });
    grp.appendChild(el('circle',{ class:'porthit', r:11, fill:'transparent' }));
    grp.appendChild(el('circle',{ class:'porthalo', r:9, fill:ROLE[s].c }));
    grp.appendChild(el('path',{ class:'portmark', d:dd, fill:ROLE[s].c }));
    g.appendChild(grp);
  });
  return g;
}
function clip(s, px, cw){ s=String(s||''); const per=cw||6.3; const max=Math.max(3, Math.floor(px/per));
  return s.length>max ? s.slice(0,max-1)+'…' : s; }

function subLine(n){
  if (n.ty==='lb')  return n.p.vip ? 'VIP '+n.p.vip : '(VIP 미설정)';
  if (n.ty==='internet') return n.p.ip || n.p.zone || 'untrust';
  if (n.p.ip) return n.p.ip;
  if (n.p.mip) return 'mgmt '+n.p.mip;
  const ifs = UI.topo ? (UI.topo.byNode.get(n.id)||[]).filter(f=>f.str) : [];
  if (ifs.length) return ifs.length>1 ? ifs[0].str+' +'+(ifs.length-1) : ifs[0].str;
  return T[n.ty].n;
}
function subLine2(n){
  if (n.ty==='lb')  return (ALGO_NAME[n.p.algo]||'').split(' (')[0];
  if (n.ty==='rdb') return (O_DBENG.find(x=>x[0]===n.p.eng)||['',''])[1].split(' ')[0] + (n.p.vip?' · '+n.p.vip:'');
  if (n.ty==='fw')  return (n.p.rules||[]).length ? `정책 ${(n.p.rules||[]).length}건` : '정책 없음';
  if (n.ty==='client') return `단말 ${n.p.cnt||0}대`;
  if (n.p.model) return n.p.model;
  return '';
}

function drawZones(g, vis){
  const t = UI.topo;
  t.segs.forEach(sg=>{
    const ns = [...sg.nodes].map(nodeById).filter(n=>n&&vis(n));
    const inner = S.n.filter(n=>isTrans(n) && vis(n) && edgesOf(n.id).some(e=>sg.edges.has(e.id)));
    const all = [...new Set([...ns, ...inner])];
    if (all.length<2) return;
    let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
    all.forEach(n=>{ const r=nodeRect(n); x0=Math.min(x0,r.x);y0=Math.min(y0,r.y);x1=Math.max(x1,r.x+r.w);y1=Math.max(y1,r.y+r.h); });
    const pad=17;
    g.appendChild(el('rect',{ class:'zonebox', x:x0-pad, y:y0-pad, width:x1-x0+pad*2, height:y1-y0+pad*2, rx:11 }));
    g.appendChild(el('text',{ class:'zonelbl', x:x0-pad+7, y:y0-pad-5 },
      [txt(`${sg.cidr||'VLAN '+sg.vlan}${sg.zone?'  ['+sg.zone+']':''}`)]));
  });
}

/* 드래그 중 빠른 갱신 — DOM 을 다시 만들지 않고 좌표만 고친다 */
function updateGeom(){
  computeAnchors();
  REF.nodes.forEach((g,id)=>{ const n=nodeById(id); if (n) g.setAttribute('transform',`translate(${n.x},${n.y})`); });
  REF.links.forEach((o,id)=>{
    const e = edgeById(id); if (!e) return;
    const pts = linkPoints(e); if (!pts.length) return;
    const d = ptsToPath(pts);
    o.path.setAttribute('d', d); o.hit.setAttribute('d', d);
    if (o.lbl){ const m = midOf(pts); o.lbl.setAttribute('x', m[0]); o.lbl.setAttribute('y', m[1]-5); }
  });
  if (UI.trace && UI.trace.pathE.length){
    const gF=$('#gFlow'); gF.textContent='';
    const seen=new Set();
    UI.trace.pathE.forEach(id=>{ if(seen.has(id))return; seen.add(id);
      const e=edgeById(id); if(!e) return;
      gF.appendChild(el('path',{ d:ptsToPath(linkPoints(e)), class:'flowpath' })); });
  }
}

/* ── 플로우 애니메이션 ─────────────────────────────────────────────────── */
let animReq = null;
function animateFlow(tr){
  cancelAnimationFrame(animReq);
  const gO = $('#gOverlay'); gO.textContent = '';
  if (!tr || !tr.pathE.length) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const pts = []; let cursor = null; const seen = new Set();
  tr.pathE.forEach(id=>{
    const e = edgeById(id); if (!e || seen.has(id)) return; seen.add(id);
    let p = linkPoints(e); if (!p.length) return;
    if (cursor){
      const dS = Math.hypot(p[0][0]-cursor[0], p[0][1]-cursor[1]);
      const dE = Math.hypot(p[p.length-1][0]-cursor[0], p[p.length-1][1]-cursor[1]);
      if (dE < dS) p = p.slice().reverse();
    }
    pts.push(...p); cursor = p[p.length-1];
  });
  if (pts.length<2) return;
  const segs=[]; let total=0;
  for (let i=1;i<pts.length;i++){ const L=Math.hypot(pts[i][0]-pts[i-1][0], pts[i][1]-pts[i-1][1]);
    segs.push({ a:pts[i-1], b:pts[i], L, s:total }); total+=L; }
  if (!total) return;
  const dots = [0,1,2].map(()=>el('circle',{ class:'pkt', r:4.6 }));
  dots.forEach(d=>gO.appendChild(d));
  const speed = 250, t0 = performance.now();
  const step = now => {
    const base = ((now-t0)/1000*speed) % total;
    dots.forEach((d,i)=>{
      const dist = (base + i*total/dots.length) % total;
      const sg = segs.find(s=>dist>=s.s && dist<=s.s+s.L) || segs[segs.length-1];
      const k = sg.L ? (dist-sg.s)/sg.L : 0;
      d.setAttribute('cx', sg.a[0] + (sg.b[0]-sg.a[0])*k);
      d.setAttribute('cy', sg.a[1] + (sg.b[1]-sg.a[1])*k);
    });
    animReq = requestAnimationFrame(step);
  };
  animReq = requestAnimationFrame(step);
}

/* ── 어시스트 툴팁 ─────────────────────────────────────────────────────── */
let tipTimer = null;
function showTip(html, cx, cy, instant){
  clearTimeout(tipTimer);
  const go = ()=>{
    const t = $('#tip'); t.innerHTML = html; t.classList.add('on');
    const r = t.getBoundingClientRect(), vw = innerWidth, vh = innerHeight;
    let x = cx + 16, y = cy + 18;
    if (x + r.width  > vw - 8) x = cx - r.width - 14;
    if (y + r.height > vh - 8) y = cy - r.height - 14;
    t.style.left = Math.max(6,x)+'px'; t.style.top = Math.max(6,y)+'px';
  };
  instant ? go() : (tipTimer = setTimeout(go, 260));
}
function hideTip(){ clearTimeout(tipTimer); $('#tip').classList.remove('on'); }

function nodeTip(n){
  const def = T[n.ty], t = UI.topo;
  const ifs = t ? (t.byNode.get(n.id)||[]) : [];
  const kv = [];
  const add = (k,v)=>{ if (v!==undefined && v!==null && v!=='') kv.push(`<div class="tk"><span>${esc(k)}</span><b>${esc(v)}</b></div>`); };
  add('제품', n.p.model);
  if (n.p.ip)   add('IP', n.p.ip);
  if (n.p.mip)  add('관리 IP', n.p.mip);
  if (n.p.gw)   add('게이트웨이', n.p.gw);
  if (n.p.vip)  add(n.ty==='lb'?'VIP':'가상 IP', n.p.vip);
  if (n.p.vlan) add('VLAN', n.p.vlan);
  if (n.p.zone) add('보안존', n.p.zone);
  if (n.p.svc)  add('수신 포트', n.p.svc);
  if (n.ty==='lb'){ add('분산', (ALGO_NAME[n.p.algo]||n.p.algo)); add('풀 멤버', (n.p.pool||[]).length+'대'); }
  if (n.ty==='fw'){ add('모드', n.p.mode==='tp'?'투명':'라우팅'); add('정책', (n.p.rules||[]).length+'건'); }
  if (n.ty==='rdb'){ add('엔진', (O_DBENG.find(x=>x[0]===n.p.eng)||[,''])[1]);
    add('DB 이중화', (O_DBHA.find(x=>x[0]===n.p.dbha)||[,''])[1]); }
  const ha = n.p.ha||'none';
  if (ha!=='none') add('이중화', (O_HA.find(x=>x[0]===ha)||[,''])[1] + (n.p.peer&&nodeById(n.p.peer)?' · 짝 '+nodeById(n.p.peer).p.name:''));
  if (ifs.length) add('소속 구간', [...new Set(ifs.map(f=>segLabel(t,f.seg)))].join(', '));
  add('링크', edgesOf(n.id).length+'개');
  const state = !nodeUp(n) ? '<span class="pill down">DOWN</span>'
    : (typeof nodeActive==='function' && !nodeActive(n)) ? '<span class="pill warn">STANDBY</span>'
    : '<span class="pill up">UP</span>';
  const bad = (UI.issues||[]).filter(i=>i.ref&&i.ref.n===n.id&&i.lv!=='i');
  return `<div class="th"><span class="tico" style="color:${LAYERS[def.ly].c}">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">${IC[def.ic]}</svg>
    </span><b>${esc(n.p.name)}</b>${state}</div>
    <div class="td">${esc(def.n)} — ${esc(DESC[n.ty]||'')}</div>
    <div class="tkv">${kv.join('')}</div>
    ${bad.length?`<div class="tbad">⚠ ${esc(bad[0].t)}</div>`:''}
    <div class="tfoot">클릭 선택 · 더블클릭 집중보기 · 드래그 이동 · 가장자리 포트에서 끌면 연결</div>`;
}
function portTip(n, side){
  const cnt = edgesOf(n.id).filter(e=>portOf(e,n.id)===side).length;
  return `<div class="th"><b>${ROLE[side].s} ${ROLE[side].n}</b><span class="pill n">${esc(n.p.name)}</span></div>
    <div class="td">${ROLE[side].d}</div>
    <div class="tkv"><div class="tk"><span>이 포트의 링크</span><b>${cnt}개</b></div></div>
    <div class="tfoot">여기서 끌어 다른 장비에 놓으면 연결됩니다.</div>`;
}
function linkTip(e){
  const A=nodeById(e.a), B=nodeById(e.b), t=UI.topo;
  const k = LINKKIND[e.k]||LINKKIND.cu;
  const seg = t ? (t.byNode.get(A.id)||[]).find(f=>f.eid===e.id) : null;
  const pa = ROLE[portOf(e,A.id)], pb = ROLE[portOf(e,B.id)];
  return `<div class="th"><b>${esc(A.p.name)} ↔ ${esc(B.p.name)}</b>
    ${edgeUp(e)?'<span class="pill up">UP</span>':'<span class="pill down">DOWN</span>'}</div>
    <div class="td">${esc(k.n)}</div>
    <div class="tkv">
      <div class="tk"><span>${esc(A.p.name)} 포트</span><b>${pa.s} ${pa.n}</b></div>
      <div class="tk"><span>${esc(B.p.name)} 포트</span><b>${pb.s} ${pb.n}</b></div>
      ${seg?`<div class="tk"><span>구간</span><b>${esc(segLabel(t,seg.seg))} / VLAN ${seg.vlan}</b></div>`:''}
    </div>
    <div class="tfoot">클릭 선택 · 장애 모드에서 클릭하면 절단 · Del 삭제</div>`;
}

/* ── 조작 ──────────────────────────────────────────────────────────────── */
let drag = null, cord = null, pan = null, band = null, spaceDown = false;
const DRAG_MIN = 4;
const getCord = () => cord;
const setCord = v => { cord = v; };

function selectionNodes(){ return [...(UI.selSet||[])].map(nodeById).filter(Boolean); }
function setSel(ids, primary){
  UI.selSet = new Set(ids);
  UI.sel = primary !== undefined ? primary : (ids.length===1 ? ids[0] : (ids[ids.length-1]||null));
  render(); renderInspector();
}
function select(id, kind){
  if (!id){ UI.sel=null; UI.selSet=new Set(); render(); renderInspector(); return; }
  UI.sel = id; UI.selKind = kind || (nodeById(id)?'node':'edge');
  UI.selSet = new Set([id]);
  render(); renderInspector(); switchTab('insp');
}
function toggleSel(id){
  UI.selSet = UI.selSet || new Set();
  UI.selSet.has(id) ? UI.selSet.delete(id) : UI.selSet.add(id);
  UI.sel = UI.selSet.size ? [...UI.selSet][UI.selSet.size-1] : null;
  render(); renderInspector();
}

/* 정렬 가이드 */
function alignSnap(moved, dx, dy){
  const TH = 6 / UI.zoom;
  const others = S.n.filter(n=>!UI.selSet.has(n.id));
  let bx=null, by=null, gx=null, gy=null;
  moved.forEach(m=>{
    const r = { x:m.ox+dx, y:m.oy+dy, w:NW(m.n), h:NH(m.n) };
    const mv = [[r.x,'x'],[r.x+r.w/2,'c'],[r.x+r.w,'e']];
    const mh = [[r.y,'x'],[r.y+r.h/2,'c'],[r.y+r.h,'e']];
    others.forEach(o=>{
      const ro = nodeRect(o);
      [ro.x, ro.cx, ro.x+ro.w].forEach(v=>mv.forEach(([mvv])=>{
        const d=v-mvv; if (Math.abs(d)<TH && (bx===null||Math.abs(d)<Math.abs(bx))){ bx=d; gx=v; } }));
      [ro.y, ro.cy, ro.y+ro.h].forEach(v=>mh.forEach(([mvv])=>{
        const d=v-mvv; if (Math.abs(d)<TH && (by===null||Math.abs(d)<Math.abs(by))){ by=d; gy=v; } }));
    });
  });
  return { dx:dx+(bx||0), dy:dy+(by||0), gx, gy };
}
function drawGuides(gx, gy){
  const g = $('#gOverlay');
  [...g.querySelectorAll('.guide')].forEach(e=>e.remove());
  const span = 6000;
  if (gx!==null && gx!==undefined) g.appendChild(el('line',{ class:'guide', x1:gx, y1:-span, x2:gx, y2:span }));
  if (gy!==null && gy!==undefined) g.appendChild(el('line',{ class:'guide', x1:-span, y1:gy, x2:span, y2:gy }));
}
const clearGuides = () => [...$('#gOverlay').querySelectorAll('.guide')].forEach(e=>e.remove());

/* 월드 좌표로 노드 히트테스트 (elementFromPoint 보다 안정적) */
function nodeAt(wx, wy, pad){
  const p = pad||0;
  for (let i=S.n.length-1;i>=0;i--){
    const n = S.n[i];
    if (UI.layers[T[n.ty].ly]===false) continue;
    const r = nodeRect(n);
    if (wx>=r.x-p && wx<=r.x+r.w+p && wy>=r.y-p && wy<=r.y+r.h+p) return n;
  }
  return null;
}

function initCanvas(){
  const svg = $('#svg'), stage = $('#stage');

  const setCursor = ()=>{
    stage.classList.toggle('grab', spaceDown && !pan);
    stage.classList.toggle('panning', !!pan);
    stage.classList.toggle('linking', UI.mode==='link' || !!cord);
  };

  svg.addEventListener('pointerdown', ev=>{
    if (ev.button===2) return;
    hideTip();
    const w = screenToWorld(ev.clientX, ev.clientY);
    const portEl = ev.target.closest('.portg');
    const nodeEl = ev.target.closest('.node');
    const linkEl = ev.target.closest('.linkhit');
    svg.setPointerCapture(ev.pointerId);

    /* 화면 이동: 스페이스 + 드래그 / 가운데 버튼 */
    if (spaceDown || ev.button===1){
      pan = { x:ev.clientX, y:ev.clientY, tx:UI.tx, ty:UI.ty }; setCursor(); ev.preventDefault(); return;
    }
    /* 포트에서 케이블 뽑기 */
    if (portEl && UI.mode!=='fault'){
      const nid = portEl.getAttribute('data-n'), side = portEl.getAttribute('data-port');
      const n = nodeById(nid); if (!n) return;
      const r = nodeRect(n);
      const from = side==='t' ? {x:r.cx,y:r.y} : side==='b' ? {x:r.cx,y:r.y+r.h}
                 : side==='l' ? {x:r.x,y:r.cy} : {x:r.x+r.w,y:r.cy};
      cord = { a:nid, side, from, to:w, target:null, tport:null };
      drawCord(); ev.preventDefault(); return;
    }
    if (nodeEl){
      const nid = nodeEl.getAttribute('data-n'), n = nodeById(nid);
      if (UI.mode==='fault'){ snapshot(); n.p.down = !n.p.down; afterEdit();
        toast(`${n.p.name} ${n.p.down?'다운':'복구'}`, n.p.down?'bad':'good'); return; }
      if (UI.mode==='link'){
        const side = bestPortFor(n, w.x, w.y);
        const r = nodeRect(n);
        const from = side==='t' ? {x:r.cx,y:r.y} : side==='b' ? {x:r.cx,y:r.y+r.h}
                   : side==='l' ? {x:r.x,y:r.cy} : {x:r.x+r.w,y:r.cy};
        cord = { a:nid, side, from, to:w, target:null, tport:null };
        drawCord(); ev.preventDefault(); return;
      }
      if (ev.shiftKey || ev.metaKey || ev.ctrlKey) toggleSel(nid);
      else if (!UI.selSet || !UI.selSet.has(nid)) select(nid,'node');
      drag = { sx:ev.clientX, sy:ev.clientY, moved:false,
        items:selectionNodes().map(x=>({ n:x, ox:x.x, oy:x.y })) };
      return;
    }
    if (linkEl){
      const eid = linkEl.getAttribute('data-e');
      if (UI.mode==='fault'){ const e=edgeById(eid); snapshot(); e.down=!e.down; afterEdit();
        toast(`링크 ${e.down?'절단':'복구'}`, e.down?'bad':'good'); return; }
      (ev.shiftKey ? toggleSel : select)(eid, 'edge');
      return;
    }
    /* 빈 곳: 사각형 선택 */
    if (!ev.shiftKey) select(null);
    band = { x0:w.x, y0:w.y, x1:w.x, y1:w.y, add:ev.shiftKey };
  });

  svg.addEventListener('pointermove', ev=>{
    const w = screenToWorld(ev.clientX, ev.clientY);
    if (pan){ UI.tx = pan.tx + (ev.clientX-pan.x); UI.ty = pan.ty + (ev.clientY-pan.y); applyView(); return; }
    if (cord){
      cord.to = w;
      const tgt = nodeAt(w.x, w.y, 10);
      cord.target = (tgt && tgt.id!==cord.a) ? tgt : null;
      cord.tport  = cord.target ? bestPortFor(cord.target, w.x, w.y) : null;
      drawCord(); return;
    }
    if (band){ band.x1=w.x; band.y1=w.y; drawBand(); return; }
    if (drag){
      const ddx = (ev.clientX-drag.sx)/UI.zoom, ddy = (ev.clientY-drag.sy)/UI.zoom;
      if (!drag.moved){
        if (Math.hypot(ev.clientX-drag.sx, ev.clientY-drag.sy) < DRAG_MIN) return;
        snapshot(); drag.moved = true; hideTip();
      }
      let dx = ddx, dy = ddy, gx=null, gy=null;
      if (!ev.altKey){                      // Alt = 자유 이동(스냅 해제)
        const sn = alignSnap(drag.items, ddx, ddy);
        if (sn.gx!==null || sn.gy!==null){ dx=sn.dx; dy=sn.dy; gx=sn.gx; gy=sn.gy; }
        else { dx = snap(ddx); dy = snap(ddy); }
      }
      drag.items.forEach(it=>{ it.n.x = Math.round(it.ox+dx); it.n.y = Math.round(it.oy+dy); });
      markLayout(); updateGeom(); drawGuides(gx, gy);
      return;
    }
    /* 호버 어시스트 */
    const portEl = ev.target.closest('.portg');
    const nodeEl = ev.target.closest('.node');
    const linkEl = ev.target.closest('.linkhit');
    if (portEl){ const n=nodeById(portEl.getAttribute('data-n'));
      if (n) showTip(portTip(n, portEl.getAttribute('data-port')), ev.clientX, ev.clientY); return; }
    if (nodeEl){ const n=nodeById(nodeEl.getAttribute('data-n'));
      if (n) showTip(nodeTip(n), ev.clientX, ev.clientY); return; }
    if (linkEl){ const e=edgeById(linkEl.getAttribute('data-e'));
      if (e) showTip(linkTip(e), ev.clientX, ev.clientY); return; }
    hideTip();
  });

  svg.addEventListener('pointerup', ev=>{
    try { svg.releasePointerCapture(ev.pointerId); } catch(_){}
    if (cord){
      const w = screenToWorld(ev.clientX, ev.clientY);
      const tgt = nodeAt(w.x, w.y, 10);
      if (tgt && tgt.id!==cord.a){
        snapshot();
        const e = addEdge(cord.a, tgt.id);
        if (e){
          setPort(e, cord.a, cord.side);
          setPort(e, tgt.id, OPP[cord.side]==='l'||OPP[cord.side]==='r'
            ? bestPortFor(tgt, w.x, w.y) : OPP[cord.side]);
          relaxPorts(e);
          select(e.id,'edge');
          toast(`${nodeById(e.a).p.name} ↔ ${nodeById(e.b).p.name} 연결 (${LINKKIND[e.k].n})`,'good');
          cord=null; clearCord(); afterEdit(); return;
        }
        toast('이미 연결되어 있습니다.','bad');
      }
      cord=null; clearCord(); render(); return;
    }
    if (band){
      const b = band; band = null; clearBand();
      if (Math.abs(b.x1-b.x0)>5 || Math.abs(b.y1-b.y0)>5){
        const hits = bandHits(b).map(n=>n.id);
        setSel(b.add ? [...new Set([...(UI.selSet||[]), ...hits])] : hits);
        toast(hits.length ? `${hits.length}개 선택` : '범위 안에 완전히 들어온 장비가 없습니다');
      }
    }
    if (drag && drag.moved){ clearGuides(); afterEdit(); }
    drag=null; pan=null; setCursor();
  });
  svg.addEventListener('pointercancel', ()=>{ cord=null; drag=null; pan=null; band=null;
    clearCord(); clearBand(); clearGuides(); render(); });
  svg.addEventListener('pointerleave', hideTip);

  svg.addEventListener('wheel', ev=>{
    ev.preventDefault(); hideTip();
    if (ev.shiftKey && !ev.ctrlKey){ UI.tx -= ev.deltaY; applyView(); scheduleUrl(); return; }
    const r = svg.getBoundingClientRect();
    const mx = ev.clientX-r.left, my = ev.clientY-r.top;
    const wx = (mx-UI.tx)/UI.zoom, wy = (my-UI.ty)/UI.zoom;
    const f = Math.pow(1.0016, -ev.deltaY);
    UI.zoom = Math.max(.14, Math.min(3, UI.zoom*f));
    UI.tx = mx - wx*UI.zoom; UI.ty = my - wy*UI.zoom;
    applyView(); scheduleUrl();
  }, { passive:false });

  svg.addEventListener('dblclick', ev=>{
    const nodeEl = ev.target.closest('.node');
    if (nodeEl){ const id=nodeEl.getAttribute('data-n');
      UI.focus = UI.focus===id ? null : id; render(); renderLayerPane();
      toast(UI.focus ? `${nodeById(id).p.name} 집중보기 (다시 더블클릭하면 해제)` : '집중보기 해제');
      return; }
    if (ev.target.closest('.linkhit')) return;
    const w = screenToWorld(ev.clientX, ev.clientY);
    openQuickAdd(w.x, w.y, ev.clientX, ev.clientY);
  });
  svg.addEventListener('contextmenu', ev=>{
    ev.preventDefault(); hideTip(); closeQuick();
    const w = screenToWorld(ev.clientX, ev.clientY);
    const nodeEl = ev.target.closest('.node'), linkEl = ev.target.closest('.linkhit');
    if (nodeEl){
      const n = nodeById(nodeEl.getAttribute('data-n'));
      if (n){ if (!UI.selSet || !UI.selSet.has(n.id)) select(n.id,'node'); nodeMenu(n, ev.clientX, ev.clientY); }
      return;
    }
    if (linkEl){
      const e = edgeById(linkEl.getAttribute('data-e'));
      if (e){ select(e.id,'edge'); linkMenu(e, ev.clientX, ev.clientY); }
      return;
    }
    if (UI.selSet && UI.selSet.size>1) return multiMenu(ev.clientX, ev.clientY);
    canvasMenu(w.x, w.y, ev.clientX, ev.clientY);
  });

  /* 팔레트 → 캔버스 (포인터 기반 드래그) */
  stage.addEventListener('dragover', ev=>ev.preventDefault());
  stage.addEventListener('drop', ev=>{
    ev.preventDefault();
    const ty = ev.dataTransfer.getData('text/ntype'); if (!T[ty]) return;
    const w = screenToWorld(ev.clientX, ev.clientY);
    snapshot();
    const n = addNode(ty, snap(w.x-NW({ty})/2), snap(w.y-NH({ty})/2));
    select(n.id,'node'); afterEdit();
    toast(`${T[ty].n} 추가`,'good');
  });

  addEventListener('keydown', ev=>{
    if (ev.code==='Space' && !['input','textarea','select'].includes((ev.target.tagName||'').toLowerCase())){
      if (!spaceDown){ spaceDown = true; setCursor(); } ev.preventDefault();
    }
    if (ev.key==='Escape'){ if (cord){ cord=null; clearCord(); render(); }
      if (band){ band=null; clearBand(); } }
  });
  addEventListener('keyup', ev=>{ if (ev.code==='Space'){ spaceDown=false; setCursor(); } });
  addEventListener('blur', ()=>{ spaceDown=false; setCursor(); });
}

function drawCord(){
  const g = $('#gOverlay'); clearCord();
  if (!cord) return;
  let to = cord.to;
  if (cord.target){
    const r = nodeRect(cord.target), s = cord.tport;
    to = s==='t' ? {x:r.cx,y:r.y} : s==='b' ? {x:r.cx,y:r.y+r.h} : s==='l' ? {x:r.x,y:r.cy} : {x:r.x+r.w,y:r.cy};
    g.appendChild(el('rect',{ class:'droptgt', x:r.x-5, y:r.y-5, width:r.w+10, height:r.h+10, rx:11 }));
    g.appendChild(el('circle',{ class:'dropport', cx:to.x, cy:to.y, r:7 }));
  }
  const bend = Math.abs(to.x-cord.from.x) > Math.abs(to.y-cord.from.y)
    ? [[cord.from.x,cord.from.y],[(cord.from.x+to.x)/2,cord.from.y],[(cord.from.x+to.x)/2,to.y],[to.x,to.y]]
    : [[cord.from.x,cord.from.y],[cord.from.x,(cord.from.y+to.y)/2],[to.x,(cord.from.y+to.y)/2],[to.x,to.y]];
  g.appendChild(el('path',{ class:'ghost', d:ptsToPath(tidy(bend)) }));
}
const clearCord = () => [...$('#gOverlay').querySelectorAll('.ghost,.droptgt,.dropport')].forEach(e=>e.remove());
/* 사각형 안에 "완전히 들어온" 노드만 고른다 — 화면에 그려진 범위와 정확히 일치 */
function bandHits(b){
  if (!b) return [];
  const x0=Math.min(b.x0,b.x1), x1=Math.max(b.x0,b.x1);
  const y0=Math.min(b.y0,b.y1), y1=Math.max(b.y0,b.y1);
  return S.n.filter(n=>{
    if (UI.layers[T[n.ty].ly]===false) return false;
    const r = nodeRect(n);
    return r.x >= x0 && r.x + r.w <= x1 && r.y >= y0 && r.y + r.h <= y1;
  });
}
function drawBand(){
  const g = $('#gOverlay'); clearBand();
  if (!band) return;
  const x0=Math.min(band.x0,band.x1), x1=Math.max(band.x0,band.x1);
  const y0=Math.min(band.y0,band.y1), y1=Math.max(band.y0,band.y1);
  g.appendChild(el('rect',{ class:'band', x:x0, y:y0, width:x1-x0, height:y1-y0 }));
  const hit = new Set(bandHits(band).map(n=>n.id));
  REF.nodes.forEach((node,id)=>node.classList.toggle('willsel', hit.has(id)));
  $('#hudSel').textContent = hit.size ? `${hit.size}개 선택 예정` : '범위 안에 들어온 장비만 선택';
}
function clearBand(){
  [...$('#gOverlay').querySelectorAll('.band')].forEach(e=>e.remove());
  REF.nodes.forEach(node=>node.classList.remove('willsel'));
}

/* ── 빠른 추가 (캔버스 더블클릭) ───────────────────────────────────────── */
function openQuickAdd(wx, wy, sx, sy){
  const box = $('#quick');
  box.classList.add('on');
  box.style.left = Math.min(innerWidth-250, sx)+'px';
  box.style.top  = Math.min(innerHeight-300, sy)+'px';
  const inp = $('#quickInput'), list = $('#quickList');
  inp.value=''; let idx=0;
  const all = PALETTE.flatMap(([ly,ts])=>ts.map(ty=>({ ty, ly, n:T[ty].n, d:DESC[ty]||'' })));
  const fill = ()=>{
    const q = inp.value.trim().toLowerCase();
    const hits = all.filter(x=>!q || x.n.toLowerCase().includes(q) || x.ty.includes(q) || x.d.toLowerCase().includes(q)).slice(0,9);
    idx = Math.min(idx, Math.max(0,hits.length-1));
    list.innerHTML = hits.map((x,i)=>`<div class="qi${i===idx?' on':''}" data-ty="${x.ty}">
      <svg viewBox="0 0 24 24" fill="none" stroke="${LAYERS[x.ly].c}" stroke-width="1.6" stroke-linecap="round">${IC[T[x.ty].ic]}</svg>
      <span><b>${esc(x.n)}</b><em>${esc(x.d)}</em></span></div>`).join('') ||
      '<div class="qi"><span><b>결과 없음</b></span></div>';
    list.querySelectorAll('.qi[data-ty]').forEach(e=>e.onclick=()=>place(e.dataset.ty));
    return hits;
  };
  const place = ty=>{
    if (!T[ty]) return;
    snapshot();
    const n = addNode(ty, snap(wx-NW({ty})/2), snap(wy-NH({ty})/2));
    closeQuick(); select(n.id,'node'); afterEdit(); toast(`${T[ty].n} 추가`,'good');
  };
  inp.oninput = ()=>{ idx=0; fill(); };
  inp.onkeydown = ev=>{
    const hits = fill();
    if (ev.key==='ArrowDown'){ idx=Math.min(hits.length-1, idx+1); fill(); ev.preventDefault(); }
    else if (ev.key==='ArrowUp'){ idx=Math.max(0, idx-1); fill(); ev.preventDefault(); }
    else if (ev.key==='Enter'){ if (hits[idx]) place(hits[idx].ty); ev.preventDefault(); }
    else if (ev.key==='Escape'){ closeQuick(); ev.preventDefault(); }
  };
  fill(); setTimeout(()=>inp.focus(), 10);
}
const closeQuick = () => $('#quick').classList.remove('on');

function focusNode(id){
  const n = nodeById(id); if (!n) return;
  const r = nodeRect(n), vw=$('#stage').clientWidth, vh=$('#stage').clientHeight;
  UI.zoom = Math.max(UI.zoom, .8);
  UI.tx = vw/2 - r.cx*UI.zoom; UI.ty = vh/2 - r.cy*UI.zoom;
  applyView(); select(id,'node');
}
function toast(msg, kind){
  const t = h('div',{cls:'tmsg'+(kind?' '+kind:'')}, esc(msg));
  $('#toast').appendChild(t);
  setTimeout(()=>{ t.style.transition='opacity .3s'; t.style.opacity=0; setTimeout(()=>t.remove(),300); }, 2000);
}
