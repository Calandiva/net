/* ═══════════════════════════════════════════════════════════════════════════
   60-ui.js — 팔레트 · 속성 인스펙터 · 검증 · 플로우 · 레이어 · 이중화 · URL
   ═══════════════════════════════════════════════════════════════════════════ */

UI.showSeg = true; UI.showBw = true; UI.issueNodes = new Set();

/* ── 팔레트 ────────────────────────────────────────────────────────────── */
function renderPalette(){
  const p = $('#palette'); p.textContent='';
  PALETTE.forEach(([ly, types])=>{
    const g = h('div',{cls:'pgroup'});
    g.appendChild(h('h4',{}, esc(LAYERS[ly].n)));
    types.forEach(ty=>{
      const d = T[ty];
      const it = h('div',{cls:'pitem', draggable:'true',
        title:`${d.n} — ${DESC[ty]||''}\n\n캔버스로 끌어놓거나 클릭하면 추가됩니다.`});
      it.addEventListener('mouseenter', ev=>showTip(
        `<div class="th"><span class="tico">${ICO(ty)}</span><b>${esc(d.n)}</b></div>
         <div class="td">${esc(DESC[ty]||'')}</div>
         <div class="tfoot">캔버스로 끌어놓거나 클릭해 배치</div>`, ev.clientX, ev.clientY));
      it.addEventListener('mouseleave', hideTip);
      it.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="${LAYERS[ly].c}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${IC[d.ic]||IC.app}</svg><span class="pn">${esc(d.n)}</span>`;
      it.addEventListener('dragstart', ev=>ev.dataTransfer.setData('text/ntype', ty));
      it.addEventListener('click', ()=>{
        snapshot();
        const c = screenToWorld($('#stage').clientWidth/2 + (Math.random()*80-40), $('#stage').clientHeight/2 + (Math.random()*80-40));
        const n = addNode(ty, snap(c.x), snap(c.y));
        select(n.id,'node'); afterEdit();
      });
      g.appendChild(it);
    });
    p.appendChild(g);
  });
}

/* ── 공용 폼 헬퍼 ──────────────────────────────────────────────────────── */
function sec(title, open, kids){
  const d = h('details',{cls:'sec'}); if (open) d.setAttribute('open','');
  d.appendChild(h('summary',{}, esc(title)));
  const b = h('div',{cls:'body'});
  (kids||[]).forEach(k=>k&&b.appendChild(k));
  d.appendChild(b); return d;
}
function fld(label, ctrl, hint, col){
  const w = h('div',{cls:'fld'+(col?' col':'')});
  w.appendChild(h('label',{}, esc(label)));
  w.appendChild(ctrl);
  if (hint) w.appendChild(h('div',{cls:'hint'}, esc(hint)));
  return w;
}
function inp(val, on, opts){
  const o = opts||{};
  const i = h('input',{ type:o.num?'number':'text', cls:o.mono?'mono':'' });
  i.value = val===undefined||val===null ? '' : val;
  if (o.ph) i.placeholder = o.ph;
  i.addEventListener('change', ()=>on(o.num ? (i.value===''?'':+i.value) : i.value));
  return i;
}
function sel(val, options, on, mono){
  const s = h('select',{cls:mono?'mono':''});
  options.forEach(([v,l])=>{ const o=h('option',{value:v}, esc(l)); if (String(v)===String(val)) o.selected=true; s.appendChild(o); });
  s.addEventListener('change', ()=>on(s.value));
  return s;
}
function chk(val, label, on){
  const l = h('label',{cls:'ck'});
  const i = h('input',{type:'checkbox'}); i.checked = !!val;
  i.addEventListener('change', ()=>on(i.checked));
  l.appendChild(i); l.appendChild(h('span',{}, esc(label||'')));
  return l;
}
function ta(val, on, ph, rows){
  const t = h('textarea',{rows:rows||3}); t.value = val||''; if (ph) t.placeholder = ph;
  t.addEventListener('change', ()=>on(t.value));
  return t;
}
function btn(label, on, cls){ const b=h('button',{cls:'btn sm'+(cls?' '+cls:'')}, esc(label)); b.onclick=on; return b; }

/* ── 속성 인스펙터 ─────────────────────────────────────────────────────── */
function renderInspector(){
  const p = $('#pane-insp'); p.textContent='';
  if (!UI.sel){
    p.appendChild(h('div',{cls:'empty'},
      '장비를 선택하면 상세 설정이 열립니다.<br><br>캔버스를 <b>더블클릭</b>하면 장비를 바로 추가하고,<br><b>우클릭</b>하면 메뉴가 열립니다.'));
    p.appendChild(sec('포트 의미', true, [ h('div',{cls:'portlegend'},
      '<span><i>▲</i> 위 — 업링크(상위망·외부 방향)</span>' +
      '<span><i>▼</i> 아래 — 다운링크(하위망·서버 방향)</span>' +
      '<span><i class="pe">◆</i> 좌우 — 피어(이중화 짝·스택·복제)</span>') ]));
    p.appendChild(sec('조작', false, [ h('div',{cls:'muted', style:'line-height:1.8'},
      '드래그 — 이동 (다른 장비와 정렬되면 자동 스냅, <code>Alt</code> 로 해제)<br>' +
      '빈 곳 드래그 — 범위 선택 · <code>Shift</code>+클릭 — 추가 선택<br>' +
      '<code>Space</code>+드래그 / 가운데 버튼 — 화면 이동<br>' +
      '휠 — 확대·축소 · <code>Shift</code>+휠 — 좌우 이동<br>' +
      '방향키 — 1칸 이동 · <code>Shift</code>+방향키 — 4칸<br>' +
      '<code>Ctrl+C/V/D</code> — 복사·붙여넣기·복제') ]));
    return;
  }

  if (UI.selSet && UI.selSet.size > 1){ renderMultiInspector(p); return; }
  const e = edgeById(UI.sel);
  if (e){ renderEdgeInspector(p, e); return; }
  const n = nodeById(UI.sel); if (!n){ UI.sel=null; return; }
  const def = T[n.ty];
  const set = (k,v)=>{ snapshot(); n.p[k]=v; afterEdit(); };

  /* 헤더 */
  const head = h('div',{cls:'card'});
  head.innerHTML = `<h5><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="${LAYERS[def.ly].c}" stroke-width="1.6" stroke-linecap="round">${IC[def.ic]}</svg>
    ${esc(n.p.name||def.n)} <span class="pill n">${esc(def.n)}</span></h5>
    <div class="meta">${esc(n.id)} · ${esc(LAYERS[def.ly].n)} · 링크 ${edgesOf(n.id).length}개</div>`;
  const row = h('div',{cls:'row', style:'margin-top:6px'});
  row.appendChild(btn(n.p.down?'● 장애 해제':'○ 장애 주입', ()=>{ snapshot(); n.p.down=!n.p.down; afterEdit(); }, n.p.down?'pri':''));
  row.appendChild(btn('복제', ()=>{ snapshot();
    const c = addNode(n.ty, n.x+GRID*9, n.y+GRID*2, JSON.parse(JSON.stringify(n.p)));
    c.p.name = autoName(n.ty); delete c.p.down; select(c.id,'node'); afterEdit(); }));
  row.appendChild(btn('집중보기', ()=>{ UI.focus = UI.focus===n.id?null:n.id; render(); renderLayerPane(); }));
  row.appendChild(btn('삭제', ()=>{ snapshot(); delNode(n.id); UI.sel=null; afterEdit(); }, ''));
  head.appendChild(row);
  p.appendChild(head);

  /* 타입 필드 */
  const basics=[], advanced=[], haf=[];
  (def.f||[]).forEach(f=>{
    const target = ['ha','peer','vip','prio','preempt','sess','dbha','sync'].includes(f.k) ? haf
                 : ['rules','nat','routes','vlans','pool','mon','monint','monretry','snat','ssl','persist'].includes(f.k) ? advanced
                 : basics;
    const c = buildField(n, f, set);
    if (c) target.push(c);
  });

  p.appendChild(sec('기본 설정', true, basics));
  if (advanced.length) p.appendChild(sec(n.ty==='fw' ? '보안 정책 / NAT' : n.ty==='lb' ? '가상 서버 / 풀' : '상세 설정', true, advanced));
  if (haf.length) p.appendChild(sec('이중화 · 가용성', (n.p.ha&&n.p.ha!=='none')||n.p.dbha&&n.p.dbha!=='none', haf));

  /* 인터페이스 */
  if (T[n.ty].l3 || T[n.ty].rt || edgesOf(n.id).length>1) p.appendChild(renderIfSection(n));

  /* 진단 */
  p.appendChild(renderNodeDiag(n));
}

function buildField(n, f, set){
  const v = n.p[f.k];
  switch(f.t){
    case 'text': return fld(f.l, inp(v, x=>set(f.k,x), {ph:f.ph}), f.help);
    case 'mono': return fld(f.l, inp(v, x=>set(f.k,x), {ph:f.ph, mono:1}), f.help);
    case 'num':  return fld(f.l, inp(v, x=>set(f.k,x), {ph:f.ph, num:1}), f.help);
    case 'chk':  return fld(f.l, chk(v, '', x=>set(f.k,x)), f.help);
    case 'ta':   return fld(f.l, ta(v, x=>set(f.k,x), f.ph, f.k==='rules'?5:3), f.help, true);
    case 'sel': {
      let opts = f.o;
      if (f.k==='model'){ opts = (T[n.ty].models||[]).map(m=>[m,m]); if (!opts.length) return null;
        if (v && !opts.some(o=>o[0]===v)) opts.unshift([v,v]); }
      return fld(f.l, sel(v===undefined?f.d:v, opts, x=>set(f.k,x)), f.help);
    }
    case 'nodesel': {
      let cand = S.n.filter(x=>x.id!==n.id);
      if (f.k==='peer')  cand = cand.filter(x=>x.ty===n.ty);
      if (f.k==='store') cand = cand.filter(x=>x.ty==='storage');
      if (f.k==='up')    cand = cand.filter(x=>T[x.ty].host);
      const opts = [['','(없음)'], ...cand.map(x=>[x.id, x.p.name+' · '+T[x.ty].n])];
      return fld(f.l, sel(v||'', opts, x=>set(f.k,x)), f.help);
    }
    case 'poolsel': return fld(f.l, poolPicker(n, set), f.help, true);
    case 'rules':   return fld(f.l, rulesTable(n, set), f.help, true);
    case 'nat':     return fld(f.l, natTable(n, set), f.help, true);
  }
  return null;
}

function poolPicker(n, set){
  const box = h('div',{});
  const pool = n.p.pool||[];
  const cand = S.n.filter(x=>T[x.ty].host && x.id!==n.id && !['internet','client'].includes(x.ty));
  if (!cand.length) return h('div',{cls:'muted'},'선택 가능한 서버가 없습니다.');
  cand.forEach(x=>{
    const on = pool.includes(x.id);
    const port = lbMemberPort(n, x);
    const ok = nodeUp(x) && portMatch(x.p.svc, port);
    const l = h('label',{cls:'ck', style:'padding:2px 0'});
    const i = h('input',{type:'checkbox'}); i.checked = on;
    i.addEventListener('change', ()=>{
      const cur = new Set(n.p.pool||[]);
      i.checked ? cur.add(x.id) : cur.delete(x.id);
      set('pool',[...cur]);
    });
    l.appendChild(i);
    l.appendChild(h('span',{}, `${esc(x.p.name)} <span class="muted">${esc(bareIp(x.p.ip)||'IP 없음')}:${port}</span> ${on?`<span class="pill ${ok?'up':'down'}">${ok?'UP':'DOWN'}</span>`:''}`));
    box.appendChild(l);
  });
  return box;
}

function rulesTable(n, set){
  const rules = Array.isArray(n.p.rules)? n.p.rules : (n.p.rules = []);
  const wrap = h('div',{style:'overflow-x:auto'});
  const tb = h('table',{cls:'rt'});
  tb.innerHTML = '<thead><tr><th>#</th><th>src존</th><th>dst존</th><th>출발지</th><th>목적지</th><th>서비스</th><th>동작</th><th></th></tr></thead>';
  const body = h('tbody');
  rules.forEach((r,i)=>{
    const tr = h('tr',{});
    const cell = c => { const td=h('td',{}); td.appendChild(c); return td; };
    const mk = (k,ph,w)=>{ const x=inp(r[k]===undefined?'':r[k], v=>{ snapshot(); r[k]=v; afterEdit(); }, {ph,mono:1});
      x.style.width=w||'62px'; return x; };
    tr.appendChild(h('td',{}, `<span class="muted">${i+1}</span>`));
    tr.appendChild(cell(mk('sz','any','54px')));
    tr.appendChild(cell(mk('dz','any','54px')));
    tr.appendChild(cell(mk('s','any','86px')));
    tr.appendChild(cell(mk('d','any','86px')));
    tr.appendChild(cell(mk('sv','any','62px')));
    tr.appendChild(cell(sel(r.act||'allow',[['allow','허용'],['deny','차단']], v=>{ snapshot(); r.act=v; afterEdit(); }, true)));
    const x = h('button',{cls:'xbtn', title:'삭제'},'×');
    x.onclick = ()=>{ snapshot(); rules.splice(i,1); afterEdit(); };
    const last = h('td',{}); last.appendChild(x); tr.appendChild(last);
    body.appendChild(tr);
  });
  tb.appendChild(body); wrap.appendChild(tb);
  const bar = h('div',{cls:'row', style:'margin-top:5px'});
  bar.appendChild(btn('+ 규칙', ()=>{ snapshot(); rules.push({sz:'any',dz:'any',s:'any',d:'any',sv:'any',act:'allow'}); afterEdit(); }));
  bar.appendChild(btn('경로 자동 허용', ()=>{ snapshot(); autoFwRules(n); afterEdit(); toast('플로우 경로에 필요한 정책을 생성했습니다.','good'); }, 'pri'));
  wrap.appendChild(bar);
  wrap.appendChild(h('div',{cls:'muted', style:'margin-top:4px;font-size:10.5px'},
    '위→아래 first-match. 미매칭 시 <b>같은 존=허용 / 다른 존=차단</b>(implicit deny). 주소는 CIDR·IP·any, 서비스는 <code>443</code> 또는 <code>80,443</code>·<code>8000-8100</code>.'));
  return wrap;
}

function natTable(n, set){
  const nat = Array.isArray(n.p.nat)? n.p.nat : (n.p.nat = []);
  const wrap = h('div',{style:'overflow-x:auto'});
  const tb = h('table',{cls:'rt'});
  tb.innerHTML = '<thead><tr><th>종류</th><th>출발지</th><th>목적지</th><th>서비스</th><th>변환주소</th><th>포트</th><th></th></tr></thead>';
  const body = h('tbody');
  nat.forEach((r,i)=>{
    const tr = h('tr',{});
    const cell = c=>{ const td=h('td',{}); td.appendChild(c); return td; };
    const mk = (k,ph,w)=>{ const x=inp(r[k]===undefined?'':r[k], v=>{ snapshot(); r[k]=v; afterEdit(); }, {ph,mono:1}); x.style.width=w||'74px'; return x; };
    tr.appendChild(cell(sel(r.kind||'dnat',[['dnat','DNAT'],['snat','SNAT']], v=>{ snapshot(); r.kind=v; afterEdit(); }, true)));
    tr.appendChild(cell(mk('s','any')));
    tr.appendChild(cell(mk('d','any')));
    tr.appendChild(cell(mk('sv','any','54px')));
    tr.appendChild(cell(mk('ti','10.0.0.10')));
    tr.appendChild(cell(mk('tp','','44px')));
    const x = h('button',{cls:'xbtn'},'×'); x.onclick=()=>{ snapshot(); nat.splice(i,1); afterEdit(); };
    const td = h('td',{}); td.appendChild(x); tr.appendChild(td);
    body.appendChild(tr);
  });
  tb.appendChild(body); wrap.appendChild(tb);
  const bar = h('div',{cls:'row', style:'margin-top:5px'});
  bar.appendChild(btn('+ NAT', ()=>{ snapshot(); nat.push({kind:'dnat',s:'any',d:'any',sv:'any',ti:''}); afterEdit(); }));
  wrap.appendChild(bar);
  return wrap;
}

/* 인터페이스 편집 */
function renderIfSection(n){
  const t = UI.topo || buildTopo();
  const kids = [];
  const es = edgesOf(n.id);
  if (!es.length) kids.push(h('div',{cls:'muted'},'연결된 링크가 없습니다.'));
  es.forEach((e,i)=>{
    const o = nodeById(otherEnd(e,n.id));
    const ep = endProps(e, n.id);
    const f = (t.byNode.get(n.id)||[]).find(x=>x.eid===e.id);
    const card = h('div',{cls:'card'});
    const side = portOf(e, n.id);
    card.innerHTML = `<h5><span style="color:${ROLE[side].c}">${ROLE[side].s}</span> ${esc(ROLE[side].n)} → ${esc(o?o.p.name:'?')}
      <span class="pill ${edgeUp(e)?'up':'down'}">${edgeUp(e)?'UP':'DOWN'}</span></h5>
      <div class="meta">${f? esc(segLabel(t,f.seg)) : '-'} · VLAN ${f?f.vlan:'-'} · ${esc((LINKKIND[e.k]||{}).n||'')}</div>`;
    const pr = h('div',{cls:'row', style:'margin-top:5px'});
    pr.appendChild(h('span',{cls:'muted', style:'flex:0 0 52px'},'포트'));
    pr.appendChild(sel(side, [['t','▲ 업링크 (위)'],['b','▼ 다운링크 (아래)'],['l','◆ 피어 (왼쪽)'],['r','◆ 피어 (오른쪽)']],
      v=>{ snapshot(); setPort(e, n.id, v); afterEdit(); }));
    pr.appendChild(btn('자동', ()=>{ snapshot(); delete endProps(e,n.id).port; markLayout(); afterEdit(); }));
    card.appendChild(pr);
    const g = h('div',{cls:'grid3', style:'margin-top:5px'});
    g.appendChild(inp(ep.ip||'', v=>{ snapshot(); ep.ip=v; afterEdit(); }, {ph:'IP/CIDR', mono:1}));
    g.appendChild(inp(ep.vlan||'', v=>{ snapshot(); ep.vlan=v; afterEdit(); }, {ph:'VLAN', num:1}));
    g.appendChild(inp(ep.zone||'', v=>{ snapshot(); ep.zone=v; afterEdit(); }, {ph:'존'}));
    card.appendChild(g);
    kids.push(card);
  });
  const rt = (UI.topo&&UI.topo.rtb.get(n.id))||[];
  if (rt.length){
    const box = h('div',{cls:'urlbox'});
    box.innerHTML = rt.slice().sort((a,b)=>b.bits-a.bits).map(r=>
      `${intToIp(r.net)}/${r.bits}  ${r.via!==null&&r.via!==undefined?'via '+intToIp(r.via):'connected'}  <span style="opacity:.6">[${r.src}]</span>`).join('<br>');
    kids.push(h('div',{cls:'muted'},'라우팅 테이블'));
    kids.push(box);
  }
  return sec('인터페이스 · 라우팅', true, kids);
}

/* 노드 진단 */
function renderNodeDiag(n){
  const mine = UI.issues.filter(i=>i.ref && i.ref.n===n.id);
  const kids = [];
  if (!mine.length) kids.push(h('div',{cls:'muted'},'이 장비에서 발견된 문제가 없습니다.'));
  mine.forEach(i=>kids.push(issueEl(i)));
  if (n.ty==='rdb'){
    const d = dbProfile(n);
    const box = h('div',{});
    box.innerHTML = `<div class="kv"><span>복제 방식</span><b>${esc(d.mode)}</b></div>
      <div class="kv"><span>예상 RPO</span><b>${esc(d.rpo)}</b></div>
      <div class="kv"><span>예상 RTO</span><b>${esc(d.rto)}</b></div>
      <div class="kv"><span>쓰기 지연</span><b>${esc(d.lat)}</b></div>`;
    kids.push(box);
  }
  if (n.ty==='lb'){
    const t = UI.topo||buildTopo();
    const sel = lbPick(t, n, {src:0,dst:0,dport:parseInt(n.p.vport)||443}, 0);
    const box = h('div',{});
    box.innerHTML = (sel.health||[]).map(x=>
      `<div class="kv"><span>${esc(x.m.p.name)}</span><b class="pill ${x.ok?'up':'down'}">${x.ok?'UP':esc(x.why)}</b></div>`).join('')
      || '<div class="muted">풀 멤버 없음</div>';
    kids.push(h('div',{cls:'muted'},'풀 멤버 헬스체크'));
    kids.push(box);
  }
  return sec('진단', true, kids);
}
function dbProfile(n){
  const M = { rac:['Oracle RAC (공유 스토리지 Active/Active)','0 (공유 스토리지)','수 초 ~ 30초 (인스턴스 재연결)','거의 없음'],
    dg:['Oracle Data Guard','sync 0 / async 수 초','30초 ~ 수 분 (수동/FSFO)','sync 시 왕복지연 +'],
    tac:['Tibero TAC (Active/Active)','0','수 초','거의 없음'],
    alwayson:['SQL Server Always On AG','동기 0 / 비동기 수 초','10 ~ 60초 (자동 장애조치)','동기 시 커밋 지연 +'],
    fci:['SQL Server FCI (공유 디스크)','0','1 ~ 5분 (인스턴스 기동)','없음'],
    semisync:['MySQL 반동기 복제','0 (ACK 수신 보장)','수동 승격 시 분 단위','ACK 왕복지연 +'],
    async:['비동기 복제','수 초 ~ 수 분 (지연만큼 유실)','수동 승격 시 분 단위','없음'],
    group:['MySQL Group Replication','0','수 초 (자동 선출)','합의 지연 +'],
    stream:['PostgreSQL 스트리밍 복제','sync 0 / async 수 초','수동 승격 시 분 단위','sync 시 2×RTT + fsync'],
    patroni:['Patroni + etcd 자동 failover','sync 0 / async 수 초','10 ~ 30초 (자동)','sync 시 2×RTT'],
    none:['단일 인스턴스','마지막 백업 시점까지 유실','복구 시간 전체 (시간 단위)','없음'] };
  const k = n.p.dbha||'none'; const a = M[k]||M.none;
  let rpo = a[1];
  if (n.p.sync==='async' && /sync 0/.test(rpo)) rpo = rpo.replace(/^.*\//,'').trim() + ' (async 선택)';
  if (n.p.sync==='sync' && /\//.test(a[1])) rpo = '0 (sync 선택)';
  return { mode:a[0], rpo, rto:a[2], lat:a[3] };
}

/* 링크 인스펙터 */
function renderEdgeInspector(p, e){
  const A=nodeById(e.a), B=nodeById(e.b);
  const head = h('div',{cls:'card'});
  head.innerHTML = `<h5>${esc(A.p.name)} ↔ ${esc(B.p.name)} <span class="pill ${edgeUp(e)?'up':'down'}">${edgeUp(e)?'UP':'DOWN'}</span></h5>
    <div class="meta">${esc(e.id)} · ${esc((LINKKIND[e.k]||{}).n||'')}</div>`;
  const row = h('div',{cls:'row', style:'margin-top:6px'});
  row.appendChild(btn(e.down?'링크 복구':'링크 절단', ()=>{ snapshot(); e.down=!e.down; afterEdit(); }, e.down?'pri':''));
  row.appendChild(btn('삭제', ()=>{ snapshot(); delEdge(e.id); UI.sel=null; afterEdit(); }));
  head.appendChild(row);
  p.appendChild(head);

  const kids = [ fld('매체 종류', sel(e.k, LINKKIND_ORDER.map(k=>[k,LINKKIND[k].n]), v=>{ snapshot(); e.k=v; afterEdit(); })) ];
  [[A,'pa'],[B,'pb']].forEach(([nd,key])=>{
    const ep = e[key] || (e[key]={});
    const sd = portOf(e, nd.id);
    kids.push(h('div',{cls:'muted', style:'margin-top:2px'},
      `${esc(nd.p.name)} 쪽 — <span style="color:${ROLE[sd].c}">${ROLE[sd].s} ${esc(ROLE[sd].n)}</span>`));
    kids.push(fld('포트 위치', sel(sd, [['t','▲ 업링크 (위)'],['b','▼ 다운링크 (아래)'],['l','◆ 피어 (왼쪽)'],['r','◆ 피어 (오른쪽)']],
      v=>{ snapshot(); setPort(e, nd.id, v); afterEdit(); })));
    const g = h('div',{cls:'grid3'});
    g.appendChild(inp(ep.ip||'', v=>{ snapshot(); ep.ip=v; afterEdit(); }, {ph:'IP/CIDR', mono:1}));
    g.appendChild(inp(ep.vlan||'', v=>{ snapshot(); ep.vlan=v; afterEdit(); }, {ph:'VLAN', num:1}));
    g.appendChild(inp(ep.zone||'', v=>{ snapshot(); ep.zone=v; afterEdit(); }, {ph:'존'}));
    kids.push(g);
  });
  p.appendChild(sec('링크 설정', true, kids));
}

/* 다중 선택 */
function renderMultiInspector(p){
  const ids = [...UI.selSet].filter(id=>nodeById(id));
  const head = h('div',{cls:'card'});
  head.innerHTML = `<h5>${ids.length}개 장비 선택됨</h5>
    <div class="meta">우클릭하면 정렬·간격·일괄 작업 메뉴가 열립니다.</div>`;
  const chips = h('div',{cls:'multi'});
  ids.slice(0,40).forEach(id=>{ const n=nodeById(id);
    const c = h('span',{cls:'chipx'}, esc(n.p.name));
    c.onclick = ()=>select(id,'node');
    chips.appendChild(c); });
  head.appendChild(chips);
  p.appendChild(head);

  const g1 = h('div',{cls:'grid3'});
  [['왼쪽','l'],['가로 가운데','cx'],['오른쪽','r'],['위쪽','t'],['세로 가운데','cy'],['아래쪽','b']]
    .forEach(([l,m])=>g1.appendChild(btn(l, ()=>alignSel(m))));
  const g2 = h('div',{cls:'grid2'});
  g2.appendChild(btn('가로 균등', ()=>distributeSel('x')));
  g2.appendChild(btn('세로 균등', ()=>distributeSel('y')));
  p.appendChild(sec('정렬 / 배치', true, [g1, g2]));

  const g3 = h('div',{cls:'grid2'});
  g3.appendChild(btn('복사', copySel));
  g3.appendChild(btn('복제', ()=>duplicateNodes(ids)));
  g3.appendChild(btn('모두 장애 주입', ()=>{ snapshot(); ids.forEach(id=>nodeById(id).p.down=true); afterEdit(); }));
  g3.appendChild(btn('모두 복구', ()=>{ snapshot(); ids.forEach(id=>delete nodeById(id).p.down); afterEdit(); }));
  const del = btn(`${ids.length}개 삭제`, ()=>{ snapshot(); ids.forEach(delNode); select(null); afterEdit(); });
  p.appendChild(sec('일괄 작업', true, [g3, del]));

  const byType = {};
  ids.forEach(id=>{ const n=nodeById(id); byType[T[n.ty].n] = (byType[T[n.ty].n]||0)+1; });
  const box = h('div',{});
  box.innerHTML = Object.entries(byType).map(([k,v])=>`<div class="kv"><span>${esc(k)}</span><b>${v}대</b></div>`).join('');
  p.appendChild(sec('구성', true, [box]));
}

/* ── 검증 패널 ─────────────────────────────────────────────────────────── */
function issueEl(i){
  const d = h('div',{cls:'iss '+i.lv});
  d.innerHTML = `<div style="flex:1"><div class="t">${esc(i.t)}</div><div class="d">${i.d}</div>${i.fix?`<div class="fix">→ ${i.fix}</div>`:''}</div>`;
  d.onclick = ()=>{ if (i.ref&&i.ref.n) focusNode(i.ref.n); else if (i.ref&&i.ref.flow){ switchTab('flow'); runFlow(i.ref.flow); } };
  return d;
}
function runValidate(loud){
  const res = validateAll();
  UI.topo = res.t; UI.issues = res.issues; UI.flowResults = res.flows;
  UI.issueNodes = new Set(res.issues.filter(i=>i.lv!=='i'&&i.ref&&i.ref.n).map(i=>i.ref.n));
  renderValPane(); renderFlowPane(); renderHaPane(); renderLayerPane();
  const err = res.issues.filter(i=>i.lv==='e').length, wrn = res.issues.filter(i=>i.lv==='w').length;
  const c = $('#cntVal'); c.textContent = err+wrn; c.className = 'cnt'+(err?' bad':wrn?' warn':'');
  $('#cntFlow').textContent = (S.f||[]).length;
  if (loud) toast(err ? `오류 ${err}건 · 경고 ${wrn}건` : wrn ? `경고 ${wrn}건 — 통신은 가능합니다` : '검증 통과 — 모든 플로우 정상', err?'bad':wrn?'':'good');
  render();
  return res;
}
function renderValPane(){
  const p = $('#pane-val'); p.textContent='';
  const I = UI.issues||[];
  const err=I.filter(i=>i.lv==='e'), wrn=I.filter(i=>i.lv==='w'), inf=I.filter(i=>i.lv==='i');
  const fl = UI.flowResults||[]; const okF = fl.filter(x=>x.r.ok).length;

  const sum = h('div',{cls:'card'});
  const score = fl.length ? Math.round(okF/fl.length*100) : (err.length?0:100);
  sum.innerHTML = `<h5>구성 상태 <span class="pill ${err.length?'down':wrn.length?'warn':'up'}">${err.length?'오류':wrn.length?'주의':'정상'}</span></h5>
    <div class="kv"><span>서비스 플로우 통과</span><b>${okF} / ${fl.length}</b></div>
    <div class="bar"><i class="${score<60?'bad':score<100?'warn':''}" style="width:${score}%"></i></div>
    <div class="kv" style="margin-top:6px"><span>오류 / 경고 / 참고</span><b>${err.length} / ${wrn.length} / ${inf.length}</b></div>
    <div class="kv"><span>네트워크 구간(세그먼트)</span><b>${UI.topo?UI.topo.segs.size:0}개</b></div>`;
  const row = h('div',{cls:'row', style:'margin-top:7px'});
  row.appendChild(btn('재검증', ()=>runValidate(true), 'pri'));
  row.appendChild(btn('SPOF 분석', ()=>runSpof()));
  row.appendChild(btn('모든 장애 복구', ()=>{ snapshot(); S.n.forEach(n=>delete n.p.down); S.e.forEach(e=>delete e.down); afterEdit(); toast('장애 상태를 모두 해제했습니다.','good'); }));
  sum.appendChild(row);
  p.appendChild(sum);

  if (UI.spof) p.appendChild(spofCard());

  const group = (list, title, cls)=>{
    if (!list.length) return;
    p.appendChild(h('div',{cls:'muted', style:'margin:10px 0 5px'}, `${title} ${list.length}`));
    list.forEach(i=>p.appendChild(issueEl(i)));
  };
  group(err,'오류 — 통신이 되지 않습니다');
  group(wrn,'경고 — 장애·보안 위험');
  group(inf,'참고 — 개선 권고');
  if (!I.length) p.appendChild(h('div',{cls:'empty'},'문제가 발견되지 않았습니다.'));
}
function runSpof(){
  toast('SPOF 분석 중…');
  setTimeout(()=>{ UI.spof = spofScan(); renderValPane();
    toast(UI.spof.items.length ? `단일 장애점 ${UI.spof.items.length}개 발견` : '단일 장애점 없음 — 완전 이중화', UI.spof.items.length?'bad':'good'); }, 30);
}
function spofCard(){
  const s = UI.spof;
  const c = h('div',{cls:'card'});
  c.innerHTML = `<h5>SPOF 분석 <span class="pill ${s.items.length?'warn':'up'}">${s.items.length}개</span></h5>
    <div class="meta">각 장비·링크를 하나씩 다운시켜 ${s.total||0}개 플로우를 재계산한 결과입니다.</div>`;
  s.items.slice(0,14).forEach(it=>{
    const d = h('div',{cls:'iss w', style:'margin-top:6px'});
    d.innerHTML = `<div style="flex:1"><div class="t">${esc(it.label)}</div>
      <div class="d">다운 시 <b>${it.broken.length}개</b> 플로우 중단: ${esc(it.broken.join(', '))}</div>
      <div class="fix">→ ${esc(it.hint)}</div></div>`;
    d.onclick = ()=>{ if (it.kind==='node') focusNode(it.id); else select(it.id,'edge'); };
    c.appendChild(d);
  });
  if (!s.items.length) c.appendChild(h('div',{cls:'muted', style:'margin-top:6px'},'모든 장비·링크가 이중화되어 있습니다.'));
  return c;
}

/* ── 플로우 패널 ───────────────────────────────────────────────────────── */
function renderFlowPane(){
  const p = $('#pane-flow'); p.textContent='';
  const bar = h('div',{cls:'row', style:'margin-bottom:8px;flex-wrap:wrap'});
  bar.appendChild(btn('+ 플로우', ()=>{ snapshot();
    const hosts = S.n.filter(n=>T[n.ty].host);
    S.f.push({ id:'f'+(S.seq++), n:'새 플로우', s:hosts[0]?hosts[0].id:'', d:hosts[1]?hosts[1].id:'', pt:443, pr:'tcp', on:true });
    afterEdit(); }));
  bar.appendChild(btn('자동 생성', ()=>{ snapshot(); S.f = autoFlows(); afterEdit(); toast(`${S.f.length}개 플로우를 만들었습니다.`,'good'); }, 'pri'));
  bar.appendChild(btn('전체 실행', ()=>{ runValidate(true); switchTab('flow'); }));
  p.appendChild(bar);

  if (!(S.f||[]).length){ p.appendChild(h('div',{cls:'empty'},
    '검증할 통신 경로를 정의합니다.<br><br><b>자동 생성</b> 을 누르면 사용자 → LB → WEB → WAS → DB 처럼<br>표준 3-Tier 경로를 만들어 줍니다.')); return; }

  const hostOpts = [['','(선택)'], ...S.n.filter(n=>T[n.ty].host||n.ty==='lb').map(n=>[n.id, n.p.name+' · '+T[n.ty].n])];
  S.f.forEach(f=>{
    const res = (UI.flowResults||[]).find(x=>x.f.id===f.id);
    const card = h('div',{cls:'card'+(UI.traceId===f.id?' on':'')});
    const head = h('h5',{});
    head.innerHTML = `<span class="dot ${res? (res.r.ok?'up':'down') : 'warn'}"></span>
      <span style="flex:1">${esc(f.n)}</span>`;
    const runB = btn('실행', ()=>runFlow(f.id), 'pri'); runB.classList.add('sm');
    head.appendChild(runB);
    const x = h('button',{cls:'xbtn'},'×'); x.onclick=()=>{ snapshot(); S.f=S.f.filter(y=>y.id!==f.id); afterEdit(); };
    head.appendChild(x);
    card.appendChild(head);

    const g1 = h('div',{cls:'grid2', style:'margin-top:5px'});
    g1.appendChild(inp(f.n, v=>{ snapshot(); f.n=v; afterEdit(); }, {ph:'플로우 이름'}));
    const g1b = h('div',{cls:'row'});
    g1b.appendChild(sel(f.pr||'tcp',[['tcp','TCP'],['udp','UDP'],['icmp','ICMP']], v=>{ snapshot(); f.pr=v; afterEdit(); }));
    g1b.appendChild(inp(f.pt, v=>{ snapshot(); f.pt=v; afterEdit(); }, {num:1, ph:'포트'}));
    g1.appendChild(g1b);
    card.appendChild(g1);

    const g2 = h('div',{cls:'grid2', style:'margin-top:5px'});
    g2.appendChild(sel(f.s, hostOpts, v=>{ snapshot(); f.s=v; afterEdit(); }));
    const dstOpts = [...hostOpts];
    if (f.d && !nodeById(f.d)) dstOpts.push([f.d, f.d+' (직접 입력)']);
    g2.appendChild(sel(f.d, dstOpts, v=>{ snapshot(); f.d=v; afterEdit(); }));
    card.appendChild(g2);

    if (res){
      const box = h('div',{style:'margin-top:7px;border-top:1px dashed var(--line);padding-top:6px'});
      if (!res.r.ok) box.appendChild(h('div',{cls:'iss e', style:'cursor:default'},
        `<div style="flex:1"><div class="t">단절</div><div class="d">${esc(res.r.reason)}</div></div>`));
      res.r.hops.forEach((hp,i)=>{
        const d = h('div',{cls:'hop'+(hp.k==='fail'?' bad':hp.k==='end'?' okend':'')});
        d.innerHTML = `<div class="n">${hp.k==='fail'?'!':hp.k==='end'?'✓':i+1}</div>
          <div style="flex:1"><div class="h1">${esc(hp.t1||'')}</div>
          ${hp.t2?`<div class="h2">${esc(hp.t2)}</div>`:''}
          ${hp.t3?`<div class="h3">${esc(hp.t3)}</div>`:''}
          ${hp.fix?`<div class="fix" style="font-size:11px;color:var(--acc)">→ ${esc(hp.fix)}</div>`:''}</div>`;
        if (hp.nid) d.onclick = ()=>focusNode(hp.nid);
        box.appendChild(d);
      });
      card.appendChild(box);
    }
    p.appendChild(card);
  });
}
function runFlow(id){
  const f = (S.f||[]).find(x=>x.id===id); if (!f) return;
  const t = UI.topo || buildTopo();
  const r = trace(t, f);
  UI.trace = r; UI.traceId = id;
  UI.flowResults = (UI.flowResults||[]).filter(x=>x.f.id!==id).concat([{f, r}]);
  render(); animateFlow(r); renderFlowPane(); switchTab('flow');
  toast(r.ok ? `${f.n} — 통신 정상` : `${f.n} — ${r.reason}`, r.ok?'good':'bad');
}

/* ── 레이어 패널 ───────────────────────────────────────────────────────── */
function renderLayerPane(){
  const p = $('#pane-layer'); p.textContent='';
  const kids = [];
  Object.keys(LAYERS).forEach(k=>{
    const cnt = S.n.filter(n=>T[n.ty].ly===k).length;
    const on = UI.layers[k]!==false;
    const d = h('div',{cls:'lay'+(on?' on':'')});
    d.innerHTML = `<span class="swatch" style="background:${LAYERS[k].c}"></span><span class="sw"></span>
      <span class="nm">${esc(LAYERS[k].n)}</span><span class="ct">${cnt}</span>`;
    d.onclick = ()=>{ UI.layers[k]=!on; render(); renderLayerPane(); };
    kids.push(d);
  });
  const row = h('div',{cls:'row', style:'margin-top:6px'});
  row.appendChild(btn('모두 켜기', ()=>{ Object.keys(LAYERS).forEach(k=>UI.layers[k]=true); render(); renderLayerPane(); }));
  row.appendChild(btn('네트워크만', ()=>{ Object.keys(LAYERS).forEach(k=>UI.layers[k]=['net','sec','edge'].includes(k)); render(); renderLayerPane(); }));
  row.appendChild(btn('서버/데이터만', ()=>{ Object.keys(LAYERS).forEach(k=>UI.layers[k]=['srv','data'].includes(k)); render(); renderLayerPane(); }));
  kids.push(row);
  p.appendChild(sec('레이어 표시', true, kids));

  /* 노드 단독 보기 */
  const f = [];
  const cur = UI.focus ? nodeById(UI.focus) : null;
  f.push(fld('집중 노드', sel(UI.focus||'', [['','(전체 보기)'], ...S.n.map(n=>[n.id, n.p.name+' · '+T[n.ty].n])],
    v=>{ UI.focus=v||null; render(); renderLayerPane(); })));
  if (cur){
    const nb = edgesOf(cur.id).map(e=>nodeById(otherEnd(e,cur.id)));
    const box = h('div',{});
    box.innerHTML = `<div class="kv"><span>직접 연결</span><b>${nb.length}대</b></div>` +
      nb.map(x=>`<div class="kv"><span>${esc(x.p.name)}</span><b>${esc(T[x.ty].n)}</b></div>`).join('');
    f.push(box);
    const t = UI.topo||buildTopo();
    const ifs = t.byNode.get(cur.id)||[];
    if (ifs.length){
      const b2 = h('div',{});
      b2.innerHTML = '<div class="muted" style="margin-top:6px">소속 구간</div>' +
        ifs.map(x=>`<div class="kv"><span>${esc(segLabel(t,x.seg))} / VLAN ${x.vlan}</span><b>${esc(x.str||'IP 없음')}</b></div>`).join('');
      f.push(b2);
    }
  }
  p.appendChild(sec('노드 단독 보기', true, f));

  /* 표시 옵션 */
  p.appendChild(sec('표시 옵션', true, [
    chk(UI.showSeg,'네트워크 구간(서브넷) 테두리', v=>{ UI.showSeg=v; render(); }),
    chk(UI.showBw,'링크 매체 라벨', v=>{ UI.showBw=v; render(); }),
    fld('구간 목록', segListEl(), null, true)
  ]));
  p.appendChild(sec('포트 의미', true, [ h('div',{cls:'portlegend'},
    '<span><i>▲</i> 위 — 업링크(상위망·외부 방향)</span>' +
    '<span><i>▼</i> 아래 — 다운링크(하위망·서버 방향)</span>' +
    '<span><i class="pe">◆</i> 좌우 — 피어(이중화 짝·스택·복제)</span>') ]));
}
function segListEl(){
  const t = UI.topo||buildTopo();
  const box = h('div',{});
  if (!t.segs.size) return h('div',{cls:'muted'},'구간이 없습니다.');
  [...t.segs.values()].sort((a,b)=>(a.cidr||'').localeCompare(b.cidr||'')).forEach(sg=>{
    const line = h('div',{cls:'kv'});
    line.innerHTML = `<span>${esc(sg.cidr||'VLAN '+sg.vlan)}${sg.zone?` <span class="pill acc">${esc(sg.zone)}</span>`:''}</span><b>${sg.nodes.size}대</b>`;
    box.appendChild(line);
  });
  return box;
}

/* ── 이중화 패널 ───────────────────────────────────────────────────────── */
function renderHaPane(){
  const p = $('#pane-ha'); p.textContent='';
  const t = UI.topo||buildTopo();
  const groups = t.haGroups;
  const single = S.n.filter(n=>(n.p.ha||'none')==='none' && ['fw','lb','router','l3sw','rdb','storage','vpn','was','web'].includes(n.ty));

  const sum = h('div',{cls:'card'});
  const cover = S.n.length ? Math.round((S.n.length-single.length)/S.n.length*100) : 0;
  sum.innerHTML = `<h5>이중화 현황 <span class="pill ${cover>=80?'up':cover>=50?'warn':'down'}">${cover}%</span></h5>
    <div class="kv"><span>이중화 그룹</span><b>${groups.length}조</b></div>
    <div class="kv"><span>단일 구성 핵심 장비</span><b>${single.length}대</b></div>
    <div class="bar"><i class="${cover<50?'bad':cover<80?'warn':''}" style="width:${cover}%"></i></div>`;
  p.appendChild(sum);

  if (groups.length){
    const kids = groups.map(g=>{
      const c = h('div',{cls:'card'});
      const nm = g.members.map(m=>m.p.name).join(' ↔ ');
      const alive = g.members.filter(nodeActive);
      c.innerHTML = `<h5>${esc(nm)} <span class="pill ${alive.length===g.members.length?'up':alive.length?'warn':'down'}">${alive.length}/${g.members.length} UP</span></h5>
        <div class="kv"><span>방식</span><b>${esc((O_HA.find(x=>x[0]===g.mode)||['',''])[1])}</b></div>
        <div class="kv"><span>프로토콜</span><b>${esc(g.proto? (O_FHRP.find(x=>x[0]===g.proto)||[,g.proto])[1] : '장비 HA')}</b></div>
        <div class="kv"><span>가상 IP</span><b>${esc(g.vip||'미설정')}</b></div>
        <div class="kv"><span>우선순위</span><b>${g.members.map(m=>m.p.name+':'+(m.p.prio||100)).join(' / ')}</b></div>
        <div class="kv"><span>Preempt / 세션동기화</span><b>${g.preempt?'ON':'OFF'} / ${g.sess?'ON':'OFF'}</b></div>
        <div class="kv"><span>현재 Active</span><b>${esc(activeOf(g))}</b></div>`;
      const r = h('div',{cls:'row', style:'margin-top:6px'});
      g.members.forEach(m=>r.appendChild(btn((m.p.down?'복구 ':'다운 ')+m.p.name, ()=>{ snapshot(); m.p.down=!m.p.down; afterEdit(); switchTab('ha'); }, m.p.down?'pri':'')));
      c.appendChild(r);
      if (!g.vip) c.appendChild(h('div',{cls:'iss e', style:'margin-top:6px;cursor:default'},
        '<div style="flex:1"><div class="t">VIP 미설정</div><div class="d">절체해도 하위 장비의 게이트웨이 주소가 옮겨가지 않아 통신이 끊깁니다.</div></div>'));
      return c;
    });
    p.appendChild(sec('이중화 그룹', true, kids));
  }
  if (single.length){
    const kids = single.map(n=>{
      const c = h('div',{cls:'iss w'});
      c.innerHTML = `<div style="flex:1"><div class="t">${esc(n.p.name)} · ${esc(T[n.ty].n)}</div>
        <div class="d">이중화 설정이 없습니다. 이 장비 하나가 멈추면 관련 서비스가 중단됩니다.</div>
        <div class="fix">→ 동일 기종을 추가 배치하고 속성 탭에서 이중화 방식·짝·VIP 를 지정하세요.</div></div>`;
      c.onclick = ()=>focusNode(n.id);
      return c;
    });
    p.appendChild(sec('단일 구성 (SPOF 후보)', true, kids));
  }

  const downs = [...S.n.filter(n=>n.p.down).map(n=>({t:'노드', nm:n.p.name, fn:()=>{ snapshot(); delete n.p.down; afterEdit(); }})),
                 ...S.e.filter(e=>e.down).map(e=>({t:'링크', nm:nodeById(e.a).p.name+' ↔ '+nodeById(e.b).p.name, fn:()=>{ snapshot(); delete e.down; afterEdit(); }}))];
  const fk = downs.map(d=>{ const c=h('div',{cls:'kv'});
    c.innerHTML = `<span><span class="pill down">${d.t}</span> ${esc(d.nm)}</span>`;
    c.appendChild(btn('복구', ()=>{ d.fn(); switchTab('ha'); }));
    return c; });
  if (!downs.length) fk.push(h('div',{cls:'muted'},'현재 장애 상태인 장비·링크가 없습니다. 상단 “장애” 모드에서 노드나 링크를 클릭하면 다운시킬 수 있습니다.'));
  p.appendChild(sec('장애 주입 현황', true, fk));
}
function activeOf(g){
  const up = g.members.filter(nodeActive);
  if (!up.length) return '없음 (전체 다운)';
  if (g.mode==='aa') return up.map(m=>m.p.name).join(' + ') + ' (동시 활성)';
  const a = up.slice().sort((x,y)=>(+(y.p.prio||100))-(+(x.p.prio||100)))[0];
  const taken = g.members.some(m=>m.p.down);
  return a.p.name + (taken ? ' (절체됨)' : '');
}

/* ── URL 패널 ──────────────────────────────────────────────────────────── */
async function renderUrlPane(){
  const p = $('#pane-url'); if (!p) return;
  const url = await currentUrl();
  const raw = JSON.stringify(normalize(S));
  const rawLen = new TextEncoder().encode(raw).length;
  const hashLen = url.split('#')[1] ? url.split('#')[1].length : 0;
  const ratio = rawLen ? Math.round(hashLen/rawLen*100) : 0;
  p.textContent='';

  const c = h('div',{cls:'card'});
  c.innerHTML = `<h5>현재 구성 URL <span class="pill ${hashLen>7000?'warn':'up'}" id="urlLen">${hashLen.toLocaleString()}자</span></h5>
    <div class="kv"><span>원본 JSON</span><b>${rawLen.toLocaleString()} B</b></div>
    <div class="kv"><span>DEFLATE + base64url</span><b>${hashLen.toLocaleString()} B (${ratio}%)</b></div>
    <div class="kv"><span>인코더</span><b>${hasCS?'CompressionStream deflate-raw':'평문 base64 (폴백)'}</b></div>
    <div class="bar"><i class="${hashLen>7000?'warn':''}" style="width:${Math.min(100,hashLen/80)}%"></i></div>
    <div class="muted" style="margin-top:4px">브라우저 주소창 한계(약 8,000자)의 ${Math.round(hashLen/80)}% 사용</div>`;
  const r = h('div',{cls:'row', style:'margin-top:7px'});
  r.appendChild(btn('URL 복사', ()=>copyUrl(), 'pri'));
  r.appendChild(btn('새 탭에서 열기', async ()=>window.open(await currentUrl(),'_blank')));
  c.appendChild(r);
  p.appendChild(c);

  const box = h('div',{cls:'urlbox'}); box.textContent = url;
  p.appendChild(sec('URL 원문', false, [box]));

  p.appendChild(sec('불러오기', false, [
    h('div',{cls:'muted'},'다른 곳에서 복사한 URL 또는 JSON 을 붙여넣고 불러올 수 있습니다.'),
    (()=>{ const t = ta('', ()=>{}, 'https://…#N1.… 또는 {"v":1,…}', 4); t.id='importBox'; return t; })(),
    (()=>{ const r=h('div',{cls:'row'});
      r.appendChild(btn('불러오기', ()=>importText($('#importBox').value), 'pri'));
      r.appendChild(btn('현재 JSON 넣기', ()=>{ $('#importBox').value = JSON.stringify(normalize(S)); }));
      return r; })()
  ]));

  p.appendChild(sec('인코딩 규칙', false, [ h('div',{}, `
    <div class="muted" style="line-height:1.7">
    ① 문서를 <b>배열 표현</b>으로 정규화 — 키 이름을 없애고 노드는 <code>[타입번호, x, y, 속성]</code>,
       링크는 <code>[a인덱스, b인덱스, 매체]</code>, 노드 참조는 배열 인덱스로 치환합니다.<br>
    ② 타입 기본값과 같은 속성은 <b>생략</b>합니다.<br>
    ③ <code>JSON → UTF-8 → DEFLATE(raw) → base64url</code><br>
    ④ <code>location.hash = "#N1." + payload</code> — <b>N1</b>=압축, <b>N0</b>=평문 폴백.<br>
    해시(#)는 서버로 전송되지 않으므로 구성 정보는 브라우저 밖으로 나가지 않습니다.
    </div>`) ]));
}
async function copyUrl(){
  const url = await currentUrl();
  try { await navigator.clipboard.writeText(url); toast('URL 을 복사했습니다.','good'); }
  catch(_){ const t=h('textarea',{}); t.value=url; document.body.appendChild(t); t.select();
    document.execCommand('copy'); t.remove(); toast('URL 을 복사했습니다.','good'); }
}
async function importText(v){
  v = (v||'').trim(); if (!v) return;
  try{
    let doc;
    if (v.includes('#')) doc = await decodeDoc(v.split('#')[1]);
    else if (v.startsWith('N0.')||v.startsWith('N1.')) doc = await decodeDoc(v);
    else doc = denormalize(JSON.parse(v));
    if (!doc) throw new Error('해석 실패');
    snapshot(); S = doc; $('#docname').value = S.t;
    UI.trace=null; UI.spof=null; UI.sel=null; UI.focus=null;
    afterEdit(); fitView(); toast('구성도를 불러왔습니다.','good');
  }catch(err){ toast('불러오기 실패: '+err.message,'bad'); }
}

/* ── 탭 ────────────────────────────────────────────────────────────────── */
function switchTab(id){
  $$('#tabs button').forEach(b=>b.classList.toggle('on', b.dataset.pane===id));
  $$('.pane').forEach(p=>p.classList.toggle('on', p.id==='pane-'+id));
  if (id==='url') renderUrlPane();
  if (id==='tut') renderTutorialPane();
}

/* ── 편집 후 공통 처리 ─────────────────────────────────────────────────── */
function afterEdit(){
  UI.topo = buildTopo();
  const res = validateAll();
  UI.topo = res.t; UI.issues = res.issues; UI.flowResults = res.flows;
  UI.issueNodes = new Set(res.issues.filter(i=>i.lv!=='i'&&i.ref&&i.ref.n).map(i=>i.ref.n));
  if (UI.traceId){ const f=(S.f||[]).find(x=>x.id===UI.traceId); UI.trace = f ? trace(UI.topo, f) : null; }
  const err = res.issues.filter(i=>i.lv==='e').length, wrn = res.issues.filter(i=>i.lv==='w').length;
  const c = $('#cntVal'); c.textContent = err+wrn; c.className='cnt'+(err?' bad':wrn?' warn':'');
  $('#cntFlow').textContent = (S.f||[]).length;
  render(); renderInspector(); renderValPane(); renderFlowPane(); renderLayerPane(); renderHaPane();
  if ($('#pane-url').classList.contains('on')) renderUrlPane();
  if (typeof tutRefreshSoon==='function') tutRefreshSoon();
  if (typeof tutStats==='function'){ const s=tutStats(); const el=$('#cntTut');
    if (el){ el.textContent = s.done; el.className = 'cnt' + (s.done===s.total ? ' warn' : ''); } }
  if (UI.trace) animateFlow(UI.trace);
  scheduleUrl();
}
