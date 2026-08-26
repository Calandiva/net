/* ═══════════════════════════════════════════════════════════════════════════
   55-context.js — 우클릭 컨텍스트 메뉴 · 복사/붙여넣기 · 정렬 · 빠른 추가 보조
   ═══════════════════════════════════════════════════════════════════════════ */

const CLIP = { nodes:[], edges:[] };

function closeCtx(){ $('#ctx').classList.remove('on'); }
function openCtx(title, icon, items, sx, sy){
  const c = $('#ctx');
  let k = 0; const acts = [];
  const tag = it => { if (it.sep||it.group) return it; it.i = k++; acts[it.i] = it.on; if (it.sub) it.sub.forEach(tag); return it; };
  items.forEach(tag);
  const row = it => {
    if (it.sep)   return '<div class="cs"></div>';
    if (it.group) return `<div class="cg">${esc(it.group)}</div>`;
    const inner = `<div class="ci${it.danger?' danger':''}" data-i="${it.i}">${esc(it.label)}${it.key?`<span class="k">${esc(it.key)}</span>`:''}</div>`;
    return it.sub ? `<div class="sub">${inner}<div class="subm">${it.sub.map(row).join('')}</div></div>` : inner;
  };
  c.innerHTML = (title ? `<div class="ch">${icon||''}<b>${esc(title)}</b></div>` : '') + items.map(row).join('');
  c.classList.add('on');
  const r = c.getBoundingClientRect();
  c.style.left = Math.max(6, Math.min(sx, innerWidth  - r.width  - 8)) + 'px';
  c.style.top  = Math.max(6, Math.min(sy, innerHeight - r.height - 8)) + 'px';
  c.querySelectorAll('.subm').forEach(m=>{
    if (m.getBoundingClientRect().right > innerWidth - 8) m.classList.add('flip');
  });
  c.querySelectorAll('.ci[data-i]').forEach(e=>{
    const fn = acts[+e.dataset.i]; if (!fn) return;
    e.addEventListener('click', ev=>{ ev.stopPropagation(); closeCtx(); fn(); });
  });
}
addEventListener('pointerdown', ev=>{
  if (!ev.target.closest('#ctx'))   closeCtx();
  if (!ev.target.closest('#quick')) closeQuick();
}, true);
addEventListener('keydown', ev=>{ if (ev.key==='Escape'){ closeCtx(); closeQuick(); } });

const ICO = ty => `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="${LAYERS[T[ty].ly].c}" stroke-width="1.7" stroke-linecap="round">${IC[T[ty].ic]}</svg>`;

function nodeMenu(n, sx, sy){
  if (UI.selSet && UI.selSet.size > 1 && UI.selSet.has(n.id)) return multiMenu(sx, sy);
  const items = [];
  items.push({ label:'속성 열기',      key:'클릭',      on:()=>{ select(n.id,'node'); switchTab('insp'); } });
  items.push({ label:'이름 바꾸기',     key:'F2',        on:()=>renameNode(n.id) });
  items.push({ label:'집중해서 보기',   key:'더블클릭',  on:()=>{ UI.focus = UI.focus===n.id?null:n.id; render(); renderLayerPane(); } });
  items.push({ sep:1 });
  items.push({ label:'여기서 연결 시작', sub:[
    { label:'▲ 업링크 (위)',     on:()=>startCord(n,'t') },
    { label:'▼ 다운링크 (아래)', on:()=>startCord(n,'b') },
    { label:'◆ 피어 (왼쪽)',     on:()=>startCord(n,'l') },
    { label:'◆ 피어 (오른쪽)',   on:()=>startCord(n,'r') }
  ]});
  const twins = S.n.filter(x=>x.id!==n.id && x.ty===n.ty);
  if (twins.length) items.push({ label:'이중화 짝으로 지정', sub: twins.slice(0,10).map(o=>({
    label:o.p.name,
    on:()=>{
      snapshot();
      n.p.peer = o.id; o.p.peer = n.id;
      if ((n.p.ha||'none')==='none') n.p.ha = (o.p.ha && o.p.ha!=='none') ? o.p.ha : 'as';
      o.p.ha = n.p.ha;
      if (!S.e.some(e=>(e.a===n.id&&e.b===o.id)||(e.b===n.id&&e.a===o.id))){
        const e = addEdge(n.id, o.id, 'hb');
        if (e){ setPort(e, n.id, n.x<=o.x?'r':'l'); setPort(e, o.id, n.x<=o.x?'l':'r'); }
      }
      afterEdit(); toast(`${n.p.name} ↔ ${o.p.name} 이중화 짝 지정`, 'good');
    } })) });
  const conn = edgesOf(n.id);
  if (conn.length) items.push({ label:`연결된 링크 (${conn.length})`, sub: conn.slice(0,12).map(e=>{
    const o = nodeById(otherEnd(e, n.id));
    return { label:`${ROLE[portOf(e,n.id)].s} ${o?o.p.name:'?'}`, on:()=>select(e.id,'edge') };
  })});
  items.push({ sep:1 });
  items.push({ label: n.p.down ? '장애 복구' : '장애 주입', key:'F', on:()=>{
    snapshot(); n.p.down = !n.p.down; afterEdit();
    toast(`${n.p.name} ${n.p.down?'다운':'복구'}`, n.p.down?'bad':'good'); } });
  items.push({ label:'복제', key:'Ctrl+D', on:()=>duplicateNodes([n.id]) });
  items.push({ label:'복사', key:'Ctrl+C', on:()=>{ UI.selSet = new Set([n.id]); copySel(); } });
  items.push({ sep:1 });
  items.push({ label:'삭제', key:'Del', danger:1, on:()=>{ snapshot(); delNode(n.id); select(null); afterEdit(); } });
  openCtx(n.p.name, ICO(n.ty), items, sx, sy);
}

function linkMenu(e, sx, sy){
  const A = nodeById(e.a), B = nodeById(e.b);
  const items = [];
  items.push({ label:'속성 열기', on:()=>{ select(e.id,'edge'); switchTab('insp'); } });
  items.push({ label:'매체 종류', sub: LINKKIND_ORDER.map(k=>({
    label:(e.k===k?'● ':'　')+LINKKIND[k].n, on:()=>{ snapshot(); e.k=k; afterEdit(); } })) });
  items.push({ label:`${A.p.name} 쪽 포트`, sub:['t','b','l','r'].map(s=>({
    label:(portOf(e,A.id)===s?'● ':'　')+ROLE[s].s+' '+ROLE[s].n,
    on:()=>{ snapshot(); setPort(e, A.id, s); afterEdit(); } })) });
  items.push({ label:`${B.p.name} 쪽 포트`, sub:['t','b','l','r'].map(s=>({
    label:(portOf(e,B.id)===s?'● ':'　')+ROLE[s].s+' '+ROLE[s].n,
    on:()=>{ snapshot(); setPort(e, B.id, s); afterEdit(); } })) });
  items.push({ label:'포트 자동 배치로 되돌리기', on:()=>{ snapshot();
    delete endProps(e, A.id).port; delete endProps(e, B.id).port; markLayout(); afterEdit(); } });
  items.push({ sep:1 });
  items.push({ label: e.down ? '링크 복구' : '링크 절단', key:'F', on:()=>{ snapshot(); e.down = !e.down; afterEdit(); } });
  items.push({ label:'삭제', key:'Del', danger:1, on:()=>{ snapshot(); delEdge(e.id); select(null); afterEdit(); } });
  openCtx(`${A.p.name} ↔ ${B.p.name}`, '', items, sx, sy);
}

function multiMenu(sx, sy){
  const ids = [...UI.selSet].filter(id=>nodeById(id));
  const items = [];
  items.push({ group:`${ids.length}개 선택됨` });
  items.push({ label:'정렬', sub:[
    { label:'왼쪽 맞춤',   on:()=>alignSel('l')  },
    { label:'가로 가운데', on:()=>alignSel('cx') },
    { label:'오른쪽 맞춤', on:()=>alignSel('r')  },
    { label:'위쪽 맞춤',   on:()=>alignSel('t')  },
    { label:'세로 가운데', on:()=>alignSel('cy') },
    { label:'아래쪽 맞춤', on:()=>alignSel('b')  }
  ]});
  items.push({ label:'간격 균등', sub:[
    { label:'가로로 균등', on:()=>distributeSel('x') },
    { label:'세로로 균등', on:()=>distributeSel('y') }
  ]});
  items.push({ sep:1 });
  items.push({ label:'복사',   key:'Ctrl+C', on:copySel });
  items.push({ label:'복제',   key:'Ctrl+D', on:()=>duplicateNodes(ids) });
  items.push({ label:'모두 장애 주입', on:()=>{ snapshot(); ids.forEach(id=>nodeById(id).p.down=true);  afterEdit(); } });
  items.push({ label:'모두 복구',      on:()=>{ snapshot(); ids.forEach(id=>delete nodeById(id).p.down); afterEdit(); } });
  items.push({ sep:1 });
  items.push({ label:`${ids.length}개 삭제`, key:'Del', danger:1, on:()=>{
    snapshot(); ids.forEach(delNode); select(null); afterEdit(); } });
  openCtx(`${ids.length}개 장비`, '', items, sx, sy);
}

function canvasMenu(wx, wy, sx, sy){
  const items = [];
  items.push({ label:'장비 추가…', key:'더블클릭', on:()=>openQuickAdd(wx, wy, sx, sy) });
  items.push({ label:'자주 쓰는 장비', sub:['l2sw','l3sw','fw','lb','web','was','rdb','client'].map(ty=>({
    label:T[ty].n, on:()=>{ snapshot();
      const n = addNode(ty, snap(wx-NW({ty})/2), snap(wy-NH({ty})/2));
      select(n.id,'node'); afterEdit(); } })) });
  if (CLIP.nodes.length) items.push({ label:`붙여넣기 (${CLIP.nodes.length}개)`, key:'Ctrl+V', on:()=>pasteAt(wx, wy) });
  items.push({ sep:1 });
  items.push({ label:'전체 선택', key:'Ctrl+A', on:()=>setSel(S.n.map(n=>n.id)) });
  items.push({ label:'화면 맞춤', key:'0',      on:fitView });
  items.push({ label:'표시', sub:[
    { label:(UI.showSeg?'● ':'　')+'네트워크 구간 테두리', on:()=>{ UI.showSeg=!UI.showSeg; render(); renderLayerPane(); } },
    { label:(UI.showBw?'● ':'　')+'링크 매체 라벨',        on:()=>{ UI.showBw =!UI.showBw;  render(); renderLayerPane(); } },
    { label:'집중보기 해제',                                on:()=>{ UI.focus=null; render(); renderLayerPane(); } }
  ]});
  items.push({ sep:1 });
  items.push({ label:'검증 실행',    key:'Enter', on:()=>{ runValidate(true); switchTab('val'); } });
  items.push({ label:'랜덤 구성도…', key:'R',     on:openRandom });
  openCtx('', '', items, sx, sy);
}

/* 메뉴에서 시작하는 연결 — 다음 클릭으로 대상 지정 */
function startCord(n, side){
  const r = nodeRect(n);
  const from = side==='t' ? {x:r.cx,y:r.y} : side==='b' ? {x:r.cx,y:r.y+r.h}
             : side==='l' ? {x:r.x,y:r.cy} : {x:r.x+r.w,y:r.cy};
  setCord({ a:n.id, side, from, to:{x:from.x, y:from.y}, target:null, tport:null });
  toast(`${ROLE[side].s} ${ROLE[side].n} 포트에서 연결 — 대상 장비를 클릭하세요 (Esc 취소)`);
  const move = ev=>{
    const c = getCord(); if (!c) return;
    const w = screenToWorld(ev.clientX, ev.clientY);
    c.to = w; const t = nodeAt(w.x, w.y, 10);
    c.target = (t && t.id!==c.a) ? t : null;
    c.tport  = c.target ? bestPortFor(c.target, w.x, w.y) : null;
    drawCord();
  };
  const done = ev=>{
    const c = getCord();
    removeEventListener('pointermove', move, true);
    removeEventListener('pointerdown', done, true);
    if (!c){ return; }
    const w = screenToWorld(ev.clientX, ev.clientY);
    const t = nodeAt(w.x, w.y, 10);
    if (t && t.id!==c.a){
      snapshot();
      const e = addEdge(c.a, t.id);
      if (e){ setPort(e, c.a, c.side); setPort(e, t.id, bestPortFor(t, w.x, w.y));
        setCord(null); clearCord(); select(e.id,'edge'); afterEdit();
        toast(`${nodeById(e.a).p.name} ↔ ${nodeById(e.b).p.name} 연결`,'good');
        ev.preventDefault(); ev.stopPropagation(); return; }
      toast('이미 연결되어 있습니다.','bad');
    }
    setCord(null); clearCord(); render();
    ev.preventDefault(); ev.stopPropagation();
  };
  addEventListener('pointermove', move, true);
  setTimeout(()=>addEventListener('pointerdown', done, true), 80);
}

function renameNode(id){
  select(id,'node'); switchTab('insp');
  setTimeout(()=>{ const i = $('#pane-insp input[type=text]'); if (i){ i.focus(); i.select(); } }, 60);
}
function duplicateNodes(ids){
  snapshot();
  const map = {}, made = [];
  ids.forEach(id=>{ const n = nodeById(id); if (!n) return;
    const c = addNode(n.ty, n.x+GRID*3, n.y+GRID*3, JSON.parse(JSON.stringify(n.p)));
    c.p.name = autoName(n.ty); delete c.p.down; delete c.p.peer;
    map[id] = c.id; made.push(c.id); });
  S.e.slice().forEach(e=>{ if (map[e.a] && map[e.b]){
    const ne = addEdge(map[e.a], map[e.b], e.k);
    if (ne){ ne.pa = JSON.parse(JSON.stringify(e.pa||{})); ne.pb = JSON.parse(JSON.stringify(e.pb||{})); } } });
  setSel(made); afterEdit(); toast(`${made.length}개 복제`, 'good');
}
function copySel(){
  const ids = [...(UI.selSet||[])].filter(id=>nodeById(id));
  if (!ids.length){ toast('복사할 장비를 먼저 선택하세요.','bad'); return; }
  const set = new Set(ids);
  CLIP.nodes = ids.map(id=>{ const n = nodeById(id);
    return { ty:n.ty, x:n.x, y:n.y, p:JSON.parse(JSON.stringify(n.p)) }; });
  CLIP.edges = S.e.filter(e=>set.has(e.a) && set.has(e.b)).map(e=>({
    a:ids.indexOf(e.a), b:ids.indexOf(e.b), k:e.k,
    pa:JSON.parse(JSON.stringify(e.pa||{})), pb:JSON.parse(JSON.stringify(e.pb||{})) }));
  toast(`${ids.length}개 복사`, 'good');
}
function pasteAt(wx, wy){
  if (!CLIP.nodes.length){ toast('복사한 장비가 없습니다.','bad'); return; }
  snapshot();
  let x0=1e9, y0=1e9;
  CLIP.nodes.forEach(c=>{ x0=Math.min(x0,c.x); y0=Math.min(y0,c.y); });
  const made = CLIP.nodes.map(c=>{
    const p = JSON.parse(JSON.stringify(c.p));
    delete p.peer; delete p.up; delete p.store; delete p.pool; delete p.down;
    const n = addNode(c.ty, snap(wx + (c.x-x0)), snap(wy + (c.y-y0)), p);
    n.p.name = autoName(c.ty);
    return n;
  });
  CLIP.edges.forEach(c=>{
    const e = addEdge(made[c.a].id, made[c.b].id, c.k);
    if (e){ e.pa = JSON.parse(JSON.stringify(c.pa)); e.pb = JSON.parse(JSON.stringify(c.pb)); }
  });
  setSel(made.map(n=>n.id)); afterEdit(); toast(`${made.length}개 붙여넣기`, 'good');
}
function alignSel(mode){
  const ns = selectionNodes(); if (ns.length<2){ toast('2개 이상 선택하세요.','bad'); return; }
  snapshot();
  const rs = ns.map(nodeRect);
  const L=Math.min(...rs.map(r=>r.x)), R=Math.max(...rs.map(r=>r.x+r.w));
  const Tp=Math.min(...rs.map(r=>r.y)), B=Math.max(...rs.map(r=>r.y+r.h));
  const CX=(L+R)/2, CY=(Tp+B)/2;
  ns.forEach(n=>{ const r = nodeRect(n);
    if (mode==='l')  n.x = snap(L);
    if (mode==='r')  n.x = snap(R - r.w);
    if (mode==='cx') n.x = snap(CX - r.w/2);
    if (mode==='t')  n.y = snap(Tp);
    if (mode==='b')  n.y = snap(B - r.h);
    if (mode==='cy') n.y = snap(CY - r.h/2);
  });
  markLayout(); afterEdit();
}
function distributeSel(axis){
  const ns = selectionNodes();
  if (ns.length<3){ toast('3개 이상 선택하세요.','bad'); return; }
  snapshot();
  const key = axis==='x' ? 'x' : 'y';
  ns.sort((a,b)=>a[key]-b[key]);
  const first = ns[0][key], last = ns[ns.length-1][key];
  const step = (last-first)/(ns.length-1);
  ns.forEach((n,i)=>{ n[key] = snap(first + step*i); });
  markLayout(); afterEdit();
}
