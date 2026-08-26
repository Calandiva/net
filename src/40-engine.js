/* ═══════════════════════════════════════════════════════════════════════════
   40-engine.js — 토폴로지 해석 · 포워딩 시뮬레이션 · 검증 · SPOF 분석
   ═══════════════════════════════════════════════════════════════════════════ */

const isUp     = o  => !!o && !o.p_down && !(o.p && o.p.down);
const nodeUp   = n  => !!n && !n.p.down;
const edgeUp   = e  => !!e && !e.down;
const isTrans  = n  => !!n && ( (T[n.ty]&&T[n.ty].tp) ||
                     (n.ty==='fw' && n.p.mode==='tp') || (n.ty==='waf' && n.p.dep==='bridge') );
const isRouter = n  => !!n && ( (T[n.ty]&&T[n.ty].rt) || n.ty==='lb' ) && !isTrans(n);
const isHost   = n  => !!n && (T[n.ty]&&T[n.ty].host);
const canFwd   = n  => isRouter(n) || (T[n.ty]&&T[n.ty].l3 && n.ty!=='lb' && (T[n.ty].rt||n.ty==='vpn'));

/* Active/Standby 쌍에서 서비스 링크가 끊긴 장비는 Active 자격을 잃는다
   (PAN-OS / FortiGate 의 link·path monitoring 과 같은 동작) */
function haLinkFailed(n){
  if (!n || (n.p.ha||'') !== 'as') return false;
  const peer = n.p.peer && nodeById(n.p.peer);
  if (!peer || peer.p.down) return false;
  const mine  = edgesOf(n.id).some(e=>e.down && e.k!=='hb');
  const yours = edgesOf(peer.id).some(e=>e.down && e.k!=='hb');
  return mine && !yours;
}
/* 실제로 트래픽을 처리할 수 있는 상태인가 */
const nodeActive = n => nodeUp(n) && !haLinkFailed(n);

/* 투과 장비가 트래픽을 통과시키는가 (다운 + fail-open 이면 통과) */
function transPass(n){
  if (nodeUp(n)) return true;
  if (['ips','ddos','waf'].includes(n.ty) && n.p.bypass) return true;   // 물리 바이패스
  return false;
}

/* ── 1. 토폴로지 해석 ──────────────────────────────────────────────────── */
function buildTopo(){
  const t = { segs:new Map(), ifs:[], byNode:new Map(), rtb:new Map(), owners:new Map(), haGroups:[], domOf:new Map() };

  /* 1-a. L2 도메인 (투과 장비를 건너 병합) */
  const par = {}; const find = x => par[x]===x ? x : (par[x]=find(par[x]));
  const uni = (a,b) => { a=find(a); b=find(b); if(a!==b) par[a]=b; };
  S.e.forEach(e=>par[e.id]=e.id);
  S.n.filter(isTrans).forEach(n=>{
    const es = edgesOf(n.id); for (let i=1;i<es.length;i++) uni(es[0].id, es[i].id);
  });
  S.e.forEach(e=>t.domOf.set(e.id, find(e.id)));

  /* 1-b. 인터페이스 산출 */
  const domVlan = {};
  S.n.filter(isTrans).forEach(n=>{
    if (!n.p.vlan) return;
    edgesOf(n.id).forEach(e=>{ const d=t.domOf.get(e.id); if (domVlan[d]===undefined) domVlan[d]=+n.p.vlan; });
  });
  const ifVlan = (e,nid,node) => { const ep = endProps(e,nid);
    if (ep.vlan) return +ep.vlan;
    if (node.p.vlan) return +node.p.vlan;
    const d = domVlan[t.domOf.get(e.id)];
    return d || 1; };
  const ifZone = (e,nid,node) => { const ep = endProps(e,nid); return (ep.zone || node.p.zone || '').trim(); };

  const addIf = (node, segKey, cidr, vlan, zone, eid, svi) => {
    const c = parseCidr(cidr);
    const f = { i:t.ifs.length, nid:node.id, seg:segKey, ip:c?c.ip:null, bits:c?c.bits:0,
                net:c?c.net:0, cidr:c?intToIp(c.net)+'/'+c.bits:'', str:c?c.str:'', vlan, zone, eid, svi:!!svi };
    t.ifs.push(f);
    if (!t.byNode.has(node.id)) t.byNode.set(node.id, []);
    t.byNode.get(node.id).push(f);
    if (!t.segs.has(segKey)) t.segs.set(segKey, { id:segKey, vlan, ifs:[], nodes:new Set(), edges:new Set() });
    const sg = t.segs.get(segKey);
    sg.ifs.push(f); sg.nodes.add(node.id);
    return f;
  };

  S.n.forEach(node=>{
    if (isTrans(node)) return;
    const es = edgesOf(node.id);
    const svis = node.ty==='l3sw' ? parseSVI(node.p.vlans) : [];
    es.forEach(e=>{
      if (e.k==='fc' || e.k==='hb') return;      // 스토리지 / 하트비트 전용 물리 링크
      const dom = t.domOf.get(e.id);
      const vlan = ifVlan(e, node.id, node);
      const ep = endProps(e, node.id);
      let cidr = ep.ip || '';
      if (!cidr && !svis.length){
        // 링크가 하나뿐인 호스트/장비는 노드의 대표 IP를 인터페이스 IP로 사용
        if (es.length===1 || !T[node.ty].rt) cidr = node.p.ip || '';
      }
      const seg = dom + '#' + vlan;
      addIf(node, seg, cidr, vlan, ifZone(e,node.id,node), e.id, false);
      t.segs.get(seg).edges.add(e.id);
    });
    /* L3SW의 SVI: 같은 VLAN이 존재하는 도메인에 가상 인터페이스로 붙는다 */
    svis.forEach(sv=>{
      const doms = new Set(es.map(e=>t.domOf.get(e.id)));
      let placed = false;
      doms.forEach(d=>{
        const seg = d + '#' + sv.vlan;
        if (t.segs.has(seg) || S.e.some(e=>t.domOf.get(e.id)===d && [e.a,e.b].some(x=>{
              const o=nodeById(x); return o && !isTrans(o) && o.id!==node.id && (+(o.p.vlan||1))===sv.vlan; }))){
          addIf(node, seg, sv.cidr, sv.vlan, sv.zone||node.p.zone||'', null, true);
          t.segs.get(seg).edges.add([...doms][0]);
          placed = true;
        }
      });
      if (!placed && doms.size===1) addIf(node, [...doms][0]+'#'+sv.vlan, sv.cidr, sv.vlan, sv.zone||'', null, true);
    });
  });

  /* 도메인의 모든 링크를 세그먼트에 귀속 */
  t.segs.forEach(sg=>{
    const dom = sg.id.split('#')[0];
    S.e.forEach(e=>{ if (t.domOf.get(e.id)===dom) sg.edges.add(e.id); });
  });

  /* 1-c. 세그먼트 서브넷 확정 */
  t.segs.forEach(sg=>{
    const tally = {};
    sg.ifs.forEach(f=>{ if (f.cidr) tally[f.cidr]=(tally[f.cidr]||0)+1; });
    let best='', bc=0; for (const k in tally) if (tally[k]>bc){ bc=tally[k]; best=k; }
    sg.cidr = best; const c = best?parseCidr(best):null;
    sg.net = c?c.net:0; sg.bits = c?c.bits:0;
    sg.name = best || ('VLAN'+sg.vlan);
    const zs = sg.ifs.map(f=>f.zone).filter(Boolean);
    sg.zone = zs.length ? zs.sort((a,b)=>zs.filter(z=>z===b).length-zs.filter(z=>z===a).length)[0] : '';
  });

  /* 1-d. IP 소유자 색인 (실주소 + VIP) */
  const own = (ipInt, nid, kind, extra) => {
    if (ipInt===null || ipInt===undefined) return;
    if (!t.owners.has(ipInt)) t.owners.set(ipInt, []);
    t.owners.get(ipInt).push(Object.assign({ nid, kind }, extra||{}));
  };
  t.ifs.forEach(f=>{ if (f.ip!==null) own(f.ip, f.nid, 'real', { seg:f.seg, if:f }); });
  S.n.forEach(n=>{
    const v = bareIp(n.p.vip);
    if (v){
      const seg = segOfNodeIp(t, n.id, ipToInt(v));
      own(ipToInt(v), n.id, n.ty==='lb'?'lbvip':'vip', { seg, prio:+(n.p.prio||100) });
    }
    if (n.ty==='l3sw') parseSVI(n.p.vlans).forEach(sv=>{
      const vi = ipToInt(bareIp(sv.vip)); if (vi===null) return;
      const f = (t.byNode.get(n.id)||[]).find(x=>x.svi && x.vlan===sv.vlan);
      own(vi, n.id, 'vip', { seg:f?f.seg:null, prio:+(n.p.prio||100) });
    });
  });

  /* 1-e. HA 그룹 */
  const seen = new Set();
  S.n.forEach(n=>{
    if (seen.has(n.id)) return;
    const peer = n.p.peer && nodeById(n.p.peer);
    if (!peer || (n.p.ha||'none')==='none') return;
    seen.add(n.id); seen.add(peer.id);
    t.haGroups.push({ mode:n.p.ha, members:[n,peer], vip:bareIp(n.p.vip)||bareIp(peer.p.vip)||'',
      proto:n.p.fhrp||(n.ty==='fw'?'ha-pair':''), sess:!!n.p.sess, preempt:n.p.preempt!==false });
  });

  /* 1-f. 라우팅 테이블 */
  S.n.forEach(n=>{ if (canFwd(n)||n.ty==='lb') t.rtb.set(n.id, buildRT(t, n)); });
  applyDynamicRouting(t);
  return t;
}

function parseSVI(text){
  const out = [];
  String(text||'').split(/\n+/).forEach(line=>{
    const tk = line.trim().split(/\s+/).filter(Boolean);
    if (!tk.length || !/^\d+$/.test(tk[0])) return;
    const vlan = +tk[0];
    let cidr='', zone='', vip='';
    for (let i=1;i<tk.length;i++){
      const w = tk[i];
      if (/^svi$/i.test(w)) continue;
      if (/^vip$/i.test(w)){ vip = tk[++i]||''; continue; }
      if (!cidr && /^[\d.]+\/\d+$/.test(w)){ cidr = w; continue; }
      if (!zone) zone = w;
    }
    if (cidr) out.push({ vlan, cidr, zone, vip });
  });
  return out;
}
function parseRoutes(text){
  const out = [];
  String(text||'').split(/\n+/).forEach(line=>{
    const m = line.trim().match(/^([\d.]+\/\d+|default|0\.0\.0\.0\/0)\s+(?:via\s+)?([\d.]+)/i);
    if (m){
      const d = (m[1]==='default') ? '0.0.0.0/0' : m[1];
      const c = parseCidr(d); if (c) out.push({ net:c.net, bits:c.bits, via:ipToInt(m[2]), src:'static' });
    }
  });
  return out;
}
function segOfNodeIp(t, nid, ipInt){
  const list = t.byNode.get(nid) || [];
  for (const f of list) if (f.bits && inNet(ipInt, f.net, f.bits)) return f.seg;
  return list.length ? list[0].seg : null;
}
function buildRT(t, n){
  const rt = [];
  (t.byNode.get(n.id)||[]).forEach(f=>{ if (f.bits) rt.push({ net:f.net, bits:f.bits, via:null, seg:f.seg, src:'connected' }); });
  parseRoutes(n.p.routes).forEach(r=>rt.push(r));
  const dg = bareIp(n.p.defgw);
  if (dg) rt.push({ net:0, bits:0, via:ipToInt(dg), src:'default' });
  return rt;
}
/* 동적 라우팅(OSPF/BGP/EIGRP/IS-IS): 같은 프로토콜 라우터끼리 최단경로로 연결 서브넷 학습 */
function applyDynamicRouting(t){
  const dyn = S.n.filter(n=>canFwd(n) && n.p.proto && n.p.proto!=='static');
  if (dyn.length<2) return;
  const groups = {};
  dyn.forEach(n=>{ (groups[n.p.proto]=groups[n.p.proto]||[]).push(n); });
  for (const proto in groups){
    const G = groups[proto], ids = new Set(G.map(n=>n.id));
    const adj = new Map(); G.forEach(n=>adj.set(n.id, []));
    for (let i=0;i<G.length;i++) for (let j=i+1;j<G.length;j++){
      const a=(t.byNode.get(G[i].id)||[]).map(f=>f.seg), b=new Set((t.byNode.get(G[j].id)||[]).map(f=>f.seg));
      const shared = a.find(s=>b.has(s));
      if (shared){ adj.get(G[i].id).push({to:G[j].id, seg:shared}); adj.get(G[j].id).push({to:G[i].id, seg:shared}); }
    }
    G.forEach(src=>{
      const prev = new Map([[src.id,null]]), q=[src.id];
      while(q.length){ const cur=q.shift();
        (adj.get(cur)||[]).forEach(l=>{ if(!prev.has(l.to)){ prev.set(l.to,{from:cur,seg:l.seg}); q.push(l.to); } }); }
      prev.forEach((p, nid)=>{
        if (nid===src.id) return;
        // src → nid 의 첫 홉 구하기
        let cur=nid, step=prev.get(cur);
        while (step && step.from!==src.id){ cur=step.from; step=prev.get(cur); }
        if (!step) return;
        const nh = (t.byNode.get(cur)||[]).find(f=>f.seg===step.seg && f.ip!==null);
        if (!nh) return;
        (t.byNode.get(nid)||[]).forEach(f=>{
          if (!f.bits) return;
          const rt = t.rtb.get(src.id); if (!rt) return;
          if (rt.some(r=>r.net===f.net && r.bits===f.bits)) return;
          rt.push({ net:f.net, bits:f.bits, via:nh.ip, src:proto });
        });
      });
    });
  }
}

/* ── 2. 보조: 세그먼트 내 물리 경로 ────────────────────────────────────── */
function segPath(t, segId, fromId, toId){
  const sg = t.segs.get(segId); if (!sg) return null;
  const allow = sg.edges;
  const prev = new Map([[fromId,null]]), q=[fromId];
  while(q.length){
    const cur = q.shift();
    if (cur===toId) break;
    for (const e of S.e){
      if (!allow.has(e.id) || !edgeUp(e)) continue;
      if (e.a!==cur && e.b!==cur) continue;
      const nx = otherEnd(e, cur);
      if (prev.has(nx)) continue;
      const nn = nodeById(nx);
      if (nx!==toId && !isTrans(nn)) continue;          // 투과 장비만 경유 가능
      if (nx!==toId && !transPass(nn)) continue;        // 다운 + 바이패스 없음 → 통과 불가
      prev.set(nx, { from:cur, eid:e.id }); q.push(nx);
    }
  }
  if (!prev.has(toId)) return null;
  const hops=[]; let cur=toId;
  while (prev.get(cur)){ const p=prev.get(cur); hops.unshift({ eid:p.eid, from:p.from, to:cur }); cur=p.from; }
  return hops;
}
/* 세그먼트 물리 단절 원인 추정 */
function segBreakReason(t, segId, fromId, toId){
  const sg = t.segs.get(segId); if (!sg) return '두 장비가 같은 네트워크 구간에 없습니다.';
  const downE = [...sg.edges].map(edgeById).filter(e=>e && !edgeUp(e));
  const downT = [...sg.nodes].map(nodeById).filter(n=>n&&isTrans(n)&&!transPass(n));
  const blockers = S.n.filter(n=>isTrans(n) && !transPass(n) && edgesOf(n.id).some(e=>sg.edges.has(e.id)));
  if (blockers.length) return `경유 장비 ${blockers.map(n=>n.p.name).join(', ')} 다운 — 바이패스(fail-open) 미설정으로 회선이 끊깁니다.`;
  if (downE.length)  return `구간 내 링크 ${downE.length}개 다운 (${downE.map(e=>nodeById(e.a).p.name+'↔'+nodeById(e.b).p.name).join(', ')}).`;
  if (downT.length)  return `경유 스위치 ${downT.map(n=>n.p.name).join(', ')} 다운.`;
  return '두 장비 사이에 물리 경로(케이블)가 없습니다.';
}

/* 같은 주소를 인수할 수 있는 이중화 짝 */
function haAlternate(t, node, ipInt){
  if (!node) return null;
  const peer = node.p.peer && nodeById(node.p.peer);
  if (!peer || !['as','aa'].includes(node.p.ha||'')) return null;
  if (!nodeActive(peer)) return null;
  const owns = (t.byNode.get(peer.id)||[]).some(f=>f.ip===ipInt) ||
               (bareIp(peer.p.vip) && ipToInt(bareIp(peer.p.vip))===ipInt) ||
               (bareIp(node.p.vip) && ipToInt(bareIp(node.p.vip))===ipInt);
  return owns ? peer : null;
}

/* IP 소유자 조회 — HA VIP는 우선순위가 가장 높은 정상 노드가 응답 */
function resolveOwner(t, ipInt, segId){
  const list = (t.owners.get(ipInt)||[]).filter(o=>!segId || !o.seg || o.seg===segId);
  if (!list.length) return null;
  const real = list.filter(o=>o.kind==='real')
    .sort((a,b)=>(+(nodeById(b.nid).p.prio||100))-(+(nodeById(a.nid).p.prio||100)));
  for (const o of real) if (nodeActive(nodeById(o.nid))) return o;
  for (const o of real){                       // A/S 쌍이 동일 인터페이스 IP 를 공유하는 경우
    const n = nodeById(o.nid), peer = n && n.p.peer && nodeById(n.p.peer);
    if (peer && nodeActive(peer) && ['as','aa'].includes(n.p.ha))
      return { nid:peer.id, kind:'real', seg:segOfNodeIp(t, peer.id, ipInt)||o.seg, takeover:n.p.name };
  }
  const vips = list.filter(o=>o.kind!=='real').sort((a,b)=>(b.prio||100)-(a.prio||100));
  for (const o of vips){
    const n = nodeById(o.nid);
    if (nodeActive(n)) return o;
    const peer = n.p.peer && nodeById(n.p.peer);
    if (peer && nodeActive(peer) && bareIp(peer.p.vip)===bareIp(n.p.vip))
      return { nid:peer.id, kind:o.kind, seg:segOfNodeIp(t, peer.id, ipInt), takeover:n.p.name };
    // 짝 노드가 vip를 안 적었어도 ha peer 관계면 인수
    if (peer && nodeActive(peer) && (n.p.ha==='as'||n.p.ha==='aa'))
      return { nid:peer.id, kind:o.kind, seg:segOfNodeIp(t, peer.id, ipInt)||o.seg, takeover:n.p.name, weak:!bareIp(peer.p.vip) };
  }
  return list[0] ? Object.assign({}, list[0], { dead:true }) : null;
}

/* 최장 프리픽스 매칭 */
function lookup(rt, dstInt){
  let best=null;
  (rt||[]).forEach(r=>{ if (inNet(dstInt, r.net, r.bits)) if (!best || r.bits>best.bits) best=r; });
  return best;
}
const zoneOfIf = (f, t) => f && (f.zone || (t.segs.get(f.seg)||{}).zone || f.seg) || '';

/* ── 3. 방화벽 정책 평가 (PAN-OS 방식: top-down first-match) ───────────── */
function fwEval(node, pkt, srcZone, dstZone){
  const rules = Array.isArray(node.p.rules) ? node.p.rules : [];
  const mAddr = (spec, ipInt) => {
    if (!spec || spec==='any' || spec==='*') return true;
    return String(spec).split(/[,\s]+/).filter(Boolean).some(one=>{
      const c = parseCidr(one.includes('/')?one:one+'/32');
      return c && inNet(ipInt, c.net, c.bits);
    });
  };
  const mZone = (spec, z) => !spec || spec==='any' || spec==='*' || String(spec).split(/[,\s]+/).includes(z);
  for (let i=0;i<rules.length;i++){
    const r = rules[i]; if (r.off) continue;
    if (!mZone(r.sz, srcZone)) continue;
    if (!mZone(r.dz, dstZone)) continue;
    if (!mAddr(r.s, pkt.src)) continue;
    if (!mAddr(r.d, pkt.dst)) continue;
    if (r.pr && r.pr!=='any' && r.pr!==pkt.proto) continue;
    if (!portMatch(r.sv, pkt.dport)) continue;
    return { act:r.act||'allow', idx:i, rule:r };
  }
  if (srcZone && dstZone && srcZone===dstZone) return { act:'allow', implicit:'intrazone' };
  return { act:'deny', implicit:'interzone' };
}
function natEval(node, pkt, kind){
  const rules = Array.isArray(node.p.nat) ? node.p.nat : [];
  const mAddr = (spec, ipInt) => { if (!spec||spec==='any') return true;
    return String(spec).split(/[,\s]+/).filter(Boolean).some(one=>{
      const c=parseCidr(one.includes('/')?one:one+'/32'); return c && inNet(ipInt,c.net,c.bits); }); };
  for (const r of rules){
    if ((r.kind||'dnat')!==kind) continue;
    if (!mAddr(r.s, pkt.src)) continue;
    if (!mAddr(r.d, pkt.dst)) continue;
    if (!portMatch(r.sv, pkt.dport)) continue;
    return r;
  }
  return null;
}

/* ── 4. 로드밸런서 멤버 선택 ───────────────────────────────────────────── */
const ALGO_NAME = Object.fromEntries(O_LBALGO);
function lbPick(t, lb, pkt, seed){
  const pool = (lb.p.pool||[]).map(nodeById).filter(Boolean);
  if (!pool.length) return { err:'풀 멤버가 지정되지 않았습니다.' };
  const health = pool.map(m=>{
    const ip = bareIp(m.p.ip) || ((t.byNode.get(m.id)||[]).find(f=>f.str)||{}).str;
    const port = lbMemberPort(lb, m);
    let ok = nodeActive(m), why = '';
    if (!ok) why = '노드 다운';
    else if (!ip){ ok=false; why='IP 미설정'; }
    else if (lb.p.mon!=='none' && lb.p.mon!=='icmp' && !portMatch(m.p.svc, port)){ ok=false; why=`${port} 포트 미개방`; }
    else if (!segReachable(t, lb.id, m.id) && !lookup(t.rtb.get(lb.id), ipToInt(ip))){ ok=false; why='LB에서 경로 없음'; }
    return { m, ip, port, ok, why };
  });
  const live = health.filter(h=>h.ok);
  if (!live.length) return { err:'풀 멤버 전원 헬스체크 실패', health };
  const algo = lb.p.algo||'rr';
  let pick;
  if (algo==='srchash')       pick = live[(pkt.src>>>0) % live.length];
  else if (algo==='urihash')  pick = live[(seed||0) % live.length];
  else if (algo==='wrr')      pick = live.reduce((a,b)=>(+(b.m.p.weight||1) > +(a.m.p.weight||1) ? b : a));
  else                        pick = live[(seed||0) % live.length];
  return { pick, live, health, algo };
}
function lbMemberPort(lb, m){
  const vp = parseInt(String(lb.p.vport||'').split(',')[0],10);
  if (vp && portMatch(m.p.svc, vp)) return vp;
  const first = parseInt(String(m.p.svc||'').split(/[,-]/)[0],10);
  return first || vp || 80;
}
function segReachable(t, aId, bId){
  const A = t.byNode.get(aId)||[], B = new Set((t.byNode.get(bId)||[]).map(f=>f.seg));
  for (const f of A) if (B.has(f.seg) && segPath(t, f.seg, aId, bId)) return true;
  // 라우팅을 통한 도달은 trace 가 판단하므로 여기서는 직접 인접만 확인
  return A.some(f=>B.has(f.seg));
}

/* ═══════════════════════════════════════════════════════════════════════
   5. 패킷 트레이스
   ═══════════════════════════════════════════════════════════════════════ */
function trace(t, flow){
  const src = nodeById(flow.s);
  const R = { hops:[], ok:false, reason:'', pathN:[], pathE:[], flow };
  const push = (o)=>{ R.hops.push(o); return o; };
  if (!src) { R.reason='출발지 노드가 없습니다.'; return R; }
  if (!nodeActive(src)) { R.reason=`출발지 ${src.p.name} 이(가) 다운 상태입니다.`;
    push({k:'fail', nid:src.id, t1:src.p.name, t3:R.reason}); return R; }

  /* 목적지 해석 */
  let dstIp = null, dstNode = null, dstLabel = '';
  if (flow.d && nodeById(flow.d)){
    dstNode = nodeById(flow.d);
    dstIp = ipToInt(bareIp(dstNode.p.vip) || bareIp(dstNode.p.ip) ||
      (((t.byNode.get(dstNode.id)||[]).find(f=>f.str)||{}).str || ''));
    dstLabel = dstNode.p.name;
    if (dstIp===null){ R.reason=`목적지 ${dstNode.p.name} 에 IP가 없습니다.`;
      push({k:'fail', nid:dstNode.id, t1:dstNode.p.name, t3:R.reason}); return R; }
  } else {
    dstIp = ipToInt(bareIp(flow.d)); dstLabel = flow.d;
    if (dstIp===null){ R.reason='목적지 IP 형식이 올바르지 않습니다.'; return R; }
  }

  const srcIfs = (t.byNode.get(src.id)||[]).filter(f=>f.ip!==null);
  if (!srcIfs.length){ R.reason=`출발지 ${src.p.name} 에 IP가 설정되지 않았습니다.`;
    push({k:'fail', nid:src.id, t1:src.p.name, t3:R.reason, fix:'속성 탭에서 IP/CIDR 을 입력하세요.'}); return R; }

  const pkt = { src:srcIfs[0].ip, dst:dstIp, dport:+flow.pt||443, proto:flow.pr||'tcp' };
  const origSrc = pkt.src, origDst = pkt.dst;
  let curNode = src, curIf = srcIfs[0], entrySeg = null;
  R.pathN.push(src.id);

  push({ k:'src', nid:src.id, t1:`${src.p.name} (출발)`,
    t2:`${intToIp(pkt.src)} → ${intToIp(pkt.dst)}:${pkt.dport}/${pkt.proto}`,
    t3:`세그먼트 ${segLabel(t,curIf.seg)}${curIf.zone?' · 존 '+curIf.zone:''}` });

  /* 같은 세그먼트에 목적지가 있으면 L2 직접 전달, 아니면 게이트웨이로 */
  let guard = 0;
  while (guard++ < 32){
    const myIfs = (t.byNode.get(curNode.id)||[]);
    // 방화벽은 목적지 판정 전에 DNAT 를 먼저 적용한다 (공인 IP -> 내부 서버)
    if (curNode.ty==='fw' && curNode.p.mode!=='tp'){
      const d0 = natEval(curNode, pkt, 'dnat');
      if (d0 && d0.ti){
        const ni = ipToInt(bareIp(d0.ti));
        if (ni!==null && ni!==pkt.dst){
          push({ k:'nat', nid:curNode.id, t1:`${curNode.p.name} · DNAT`,
            t2:`목적지 ${intToIp(pkt.dst)} → ${intToIp(ni)}${d0.tp?':'+d0.tp:''}` });
          pkt.dst = ni; if (d0.tp) pkt.dport = +d0.tp;
        }
      }
    }
    // 목적지가 나 자신인가?
    if (myIfs.some(f=>f.ip===pkt.dst) || (bareIp(curNode.p.vip) && ipToInt(bareIp(curNode.p.vip))===pkt.dst && curNode.ty!=='lb')){
      return finish(t, R, curNode, pkt, dstLabel);
    }
    // LB VIP 도착?
    if (curNode.ty==='lb' && bareIp(curNode.p.vip) && ipToInt(bareIp(curNode.p.vip))===pkt.dst){
      const res = handleLB(t, R, curNode, pkt);
      if (res.stop) return R;
      dstNode = res.member; dstLabel = res.member.p.name;
      continue;
    }

    /* 이번 홉에서 나갈 인터페이스 결정 */
    let outIf = null, nextIp = null, sameSeg = false;
    const localHit = myIfs.find(f=>f.bits && inNet(pkt.dst, f.net, f.bits));
    if (localHit){ outIf = localHit; nextIp = pkt.dst; sameSeg = true; }
    else if (canFwd(curNode) || curNode.ty==='lb'){
      /* 라우팅 */
      const r = lookup(t.rtb.get(curNode.id), pkt.dst);
      if (!r){
        R.reason = `${curNode.p.name} 에 ${intToIp(pkt.dst)} 로 가는 경로가 없습니다.`;
        push({ k:'fail', nid:curNode.id, t1:`${curNode.p.name} · 라우팅 실패`, t3:R.reason,
          fix:'Default via 를 지정하거나 정적 라우팅에 "<목적지CIDR> via <넥스트홉IP>" 를 추가하세요.' });
        return R;
      }
      if (r.via===null || r.via===undefined){ outIf = myIfs.find(f=>f.seg===r.seg); nextIp = pkt.dst; sameSeg = true; }
      else {
        nextIp = r.via;
        outIf = myIfs.find(f=>f.bits && inNet(r.via, f.net, f.bits));
        if (!outIf){
          R.reason = `${curNode.p.name} 의 넥스트홉 ${intToIp(r.via)} 이(가) 어느 인터페이스 서브넷에도 속하지 않습니다.`;
          push({ k:'fail', nid:curNode.id, t1:`${curNode.p.name} · 넥스트홉 불일치`, t3:R.reason,
            fix:'인터페이스 IP 대역 또는 넥스트홉 주소를 맞추세요.' });
          return R;
        }
      }
    } else {
      /* 일반 호스트: 기본 게이트웨이 사용 */
      const gw = bareIp(curNode.p.gw);
      if (!gw){
        R.reason = `${curNode.p.name} 은(는) 다른 대역인 ${intToIp(pkt.dst)} 로 갈 기본 게이트웨이가 없습니다.`;
        push({ k:'fail', nid:curNode.id, t1:`${curNode.p.name} · 게이트웨이 없음`, t3:R.reason,
          fix:'속성 탭의 게이트웨이에 같은 대역의 L3 장비 IP(또는 VIP)를 입력하세요.' });
        return R;
      }
      const gi = ipToInt(gw);
      outIf = myIfs.find(f=>f.bits && inNet(gi, f.net, f.bits)) || myIfs[0];
      if (!outIf || !outIf.bits || !inNet(gi, outIf.net, outIf.bits)){
        R.reason = `${curNode.p.name} 의 게이트웨이 ${gw} 가 자신의 서브넷 ${outIf?outIf.cidr:'?'} 밖에 있습니다.`;
        push({ k:'fail', nid:curNode.id, t1:`${curNode.p.name} · 게이트웨이 대역 불일치`, t3:R.reason,
          fix:'게이트웨이를 같은 서브넷 주소로 바꾸거나 서버 IP 대역을 조정하세요.' });
        return R;
      }
      nextIp = gi;
    }

    if (!outIf){
      R.reason = `${curNode.p.name} 에서 나갈 인터페이스를 찾지 못했습니다.`;
      push({ k:'fail', nid:curNode.id, t1:curNode.p.name, t3:R.reason }); return R;
    }

    /* 방화벽 정책 (경유 시) */
    if (curNode.ty==='fw' && curNode.p.mode!=='tp' && entrySeg!==null){
      const inIf = myIfs.find(f=>f.seg===entrySeg);
      const sz = zoneOfIf(inIf,t) || '(미지정)', dz = zoneOfIf(outIf,t) || '(미지정)';
      const v = fwEval(curNode, pkt, sz, dz);
      if (v.act!=='allow'){
        R.reason = v.implicit==='interzone'
          ? `${curNode.p.name}: ${sz} → ${dz} 를 허용하는 정책이 없어 implicit deny 로 차단되었습니다.`
          : `${curNode.p.name}: 정책 #${v.idx+1} (${v.rule.sz}→${v.rule.dz} ${v.rule.sv||'any'}) 에 의해 차단되었습니다.`;
        push({ k:'fail', nid:curNode.id, t1:`${curNode.p.name} · 정책 차단`, sz, dz, port:pkt.dport,
          t2:`${sz} → ${dz} / ${intToIp(pkt.dst)}:${pkt.dport}`, t3:R.reason,
          fix:v.implicit ? `보안 정책에 "${sz} → ${dz}, ${portName(pkt.dport)} allow" 규칙을 추가하세요.`
                         : `정책 #${v.idx+1} 을 수정하거나 위쪽에 허용 규칙을 추가하세요 (위→아래 first-match).` });
        return R;
      }
      push({ k:'fw', nid:curNode.id, t1:`${curNode.p.name} · 정책 허용`,
        t2:`${sz} → ${dz} · ${portName(pkt.dport)}`,
        t3: v.implicit==='intrazone' ? '동일 존 트래픽 (implicit allow)' : `정책 #${v.idx+1} 매칭` });
      const sn = natEval(curNode, pkt, 'snat');
      if (sn){ const ni = ipToInt(bareIp(sn.ti)) ?? outIf.ip;
        if (ni!==null){ push({ k:'nat', nid:curNode.id, t1:`${curNode.p.name} · SNAT`,
          t2:`출발지 ${intToIp(pkt.src)} → ${intToIp(ni)}` }); pkt.src = ni; } }
    }
    if (curNode.ty==='fw' && curNode.p.mode==='tp' && entrySeg===null){ /* 투과 모드는 세그먼트 내부에서 처리 */ }

    /* 넥스트홉 소유자 찾기 */
    const owner = resolveOwner(t, nextIp, outIf.seg);
    if (!owner || owner.dead){
      const guess = owner && owner.dead ? `${nodeById(owner.nid).p.name} 이(가) 다운 상태이고 인수할 이중화 짝이 없습니다.`
                                        : `${intToIp(nextIp)} 주소를 가진 장비가 ${segLabel(t,outIf.seg)} 구간에 없습니다.`;
      R.reason = `${curNode.p.name} → ${intToIp(nextIp)} 도달 불가: ${guess}`;
      push({ k:'fail', nid:curNode.id, t1:`${curNode.p.name} · 넥스트홉 없음`, t3:R.reason,
        fix: owner && owner.dead ? '이중화 짝과 공유 VIP(VRRP/HSRP)를 설정하면 자동 절체됩니다.'
                                 : '해당 대역의 게이트웨이 장비를 배치하고 IP를 부여하세요.' });
      return R;
    }
    let nextNode = nodeById(owner.nid);
    if (owner.takeover){
      push({ k:'ha', nid:nextNode.id, t1:`이중화 절체 · ${owner.takeover} → ${nextNode.p.name}`,
        t2:`VIP ${intToIp(nextIp)} 인수`,
        t3: owner.weak ? '※ 짝 장비에 동일 VIP가 명시되어 있지 않습니다. 실장비에서는 VRRP/HSRP 그룹 설정이 필요합니다.' : '' });
    }

    /* 세그먼트 내부 물리 경로 */
    let useSeg = outIf.seg;
    if (owner.seg && owner.seg!==useSeg && (t.byNode.get(curNode.id)||[]).some(f=>f.seg===owner.seg))
      useSeg = owner.seg;
    let path = segPath(t, useSeg, curNode.id, nextNode.id);
    if (!path){
      const alt = haAlternate(t, nextNode, nextIp);
      if (alt){
        const seg2 = (t.byNode.get(alt.id)||[]).map(f=>f.seg)
          .find(sg => (t.byNode.get(curNode.id)||[]).some(f=>f.seg===sg) && segPath(t, sg, curNode.id, alt.id));
        if (seg2){
          push({ k:'ha', nid:alt.id, t1:`이중화 절체 · ${nextNode.p.name} → ${alt.p.name}`,
            t2:`${intToIp(nextIp)} 경로 장애 감지`, t3:'링크 다운으로 Active 가 넘어갔습니다 (interface/link monitoring).' });
          nextNode = alt; useSeg = seg2; path = segPath(t, useSeg, curNode.id, alt.id);
        }
      }
    }
    if (!path){
      R.reason = `${curNode.p.name} → ${nextNode.p.name} 물리 단절: ${segBreakReason(t, useSeg, curNode.id, nextNode.id)}`;
      push({ k:'fail', nid:curNode.id, t1:'L2 구간 단절', t2:segLabel(t,useSeg), t3:R.reason,
        fix:'장애 모드에서 해당 링크/장비를 복구하거나 우회 경로(이중 스위치)를 추가하세요.' });
      return R;
    }
    path.forEach(h=>{
      R.pathE.push(h.eid);
      if (h.to!==nextNode.id) R.pathN.push(h.to);
    });
    const via = path.filter(h=>h.to!==nextNode.id).map(h=>nodeById(h.to));
    if (via.length){
      const blocked = via.find(v=>v.ty==='ips' && v.p.dep==='inline' && v.p.act==='block' && v.p.drop);
      push({ k:'l2', nid:via[0].id, t1:`L2 경유 · ${via.map(v=>v.p.name).join(' → ')}`,
        t2:`${segLabel(t,useSeg)} / VLAN ${(t.segs.get(useSeg)||{}).vlan}`,
        t3: via.map(v=>`${v.p.name}(${T[v.ty].n}${v.ty==='ips'?', '+(v.p.dep==='inline'?'inline':'tap'):''})`).join(', ') });
      if (blocked){ R.reason = `${blocked.p.name} 이(가) 트래픽을 차단했습니다.`;
        push({k:'fail', nid:blocked.id, t1:'IPS 차단', t3:R.reason}); return R; }
    }
    R.pathN.push(nextNode.id);
    entrySeg = ((t.byNode.get(nextNode.id)||[]).find(f=>f.seg===useSeg)||{}).seg || null;
    if (!nodeActive(nextNode) && !isTrans(nextNode)){
      const lm = !nodeUp(nextNode) ? '' : ' (서비스 링크 장애로 Standby 로 내려감)';
      R.reason = `${nextNode.p.name} 이(가) 다운 상태입니다${lm}.`;
      push({ k:'fail', nid:nextNode.id, t1:`${nextNode.p.name} 다운`, t3:R.reason,
        fix:'이중화 짝과 공유 VIP(또는 동일 인터페이스 IP)를 설정하면 이 장애를 흡수할 수 있습니다.' });
      return R;
    }
    const willNat = nextNode.ty==='fw' && nextNode.p.mode!=='tp' && !!natEval(nextNode, pkt, 'dnat');
    if (sameSeg && !willNat && nextNode.id!==curNode.id && (t.byNode.get(nextNode.id)||[]).some(f=>f.ip===pkt.dst)){
      curNode = nextNode;
      return finish(t, R, nextNode, pkt, dstLabel);
    }
    push({ k:'hop', nid:nextNode.id, t1:`${nextNode.p.name} 수신`,
      t2:`in ${segLabel(t,useSeg)}`, t3:T[nextNode.ty].n });
    curNode = nextNode;
  }
  R.reason = '홉 수 초과 — 라우팅 루프가 의심됩니다.';
  push({ k:'fail', t1:'루프 감지', t3:R.reason, fix:'정적 라우팅의 넥스트홉이 서로를 가리키고 있는지 확인하세요.' });
  return R;
}

function handleLB(t, R, lb, pkt){
  if (!nodeActive(lb)){
    const peer = lb.p.peer && nodeById(lb.p.peer);
    if (!(peer && nodeActive(peer))){
      R.reason = `${lb.p.name} 다운 — VIP ${intToIp(pkt.dst)} 응답 불가.`;
      R.hops.push({ k:'fail', nid:lb.id, t1:'LB 다운', t3:R.reason, fix:'Active/Standby 짝과 세션 동기화를 설정하세요.' });
      return { stop:true };
    }
  }
  if (!portMatch(lb.p.vport, pkt.dport)){
    R.reason = `${lb.p.name} 의 가상 서버는 ${lb.p.vport} 포트만 서비스합니다 (요청 ${pkt.dport}).`;
    R.hops.push({ k:'fail', nid:lb.id, t1:'가상 서버 포트 불일치', t3:R.reason,
      fix:`LB 서비스 포트에 ${pkt.dport} 를 추가하세요.` });
    return { stop:true };
  }
  const sel = lbPick(t, lb, pkt, (R.hops.length + pkt.dport));
  if (sel.err){
    R.reason = `${lb.p.name}: ${sel.err}`;
    const why = (sel.health||[]).filter(h=>!h.ok).map(h=>`${h.m.p.name}(${h.why})`).join(', ');
    R.hops.push({ k:'fail', nid:lb.id, t1:'로드밸런싱 실패', t2:why, t3:R.reason,
      fix:'풀 멤버를 지정하고, 멤버가 서비스 포트를 열고 있는지 확인하세요.' });
    return { stop:true };
  }
  const m = sel.pick;
  R.hops.push({ k:'lb', nid:lb.id, t1:`${lb.p.name} · 부하분산`,
    t2:`VIP ${intToIp(pkt.dst)}:${pkt.dport} → ${m.m.p.name} ${m.ip}:${m.port}`,
    t3:`${ALGO_NAME[sel.algo]||sel.algo} · 활성 ${sel.live.length}/${sel.health.length}대` +
       (lb.p.persist&&lb.p.persist!=='none' ? ` · 지속성 ${(O_PERSIST.find(x=>x[0]===lb.p.persist)||[])[1]}` : '') +
       (lb.p.ssl ? ' · SSL 오프로드' : '') });
  pkt.dst = ipToInt(m.ip); pkt.dport = m.port;
  if (lb.p.snat){
    const out = (t.byNode.get(lb.id)||[]).find(f=>f.bits && inNet(pkt.dst, f.net, f.bits));
    if (out && out.ip!==null){
      R.hops.push({ k:'nat', nid:lb.id, t1:`${lb.p.name} · SNAT AutoMap`, t2:`출발지 → ${intToIp(out.ip)}` });
      pkt.src = out.ip;
    }
  }
  return { stop:false, member:m.m };
}

function finish(t, R, node, pkt, dstLabel){
  const svc = node.p.svc;
  const listens = (T[node.ty].host || node.ty==='lb') ? (svc===undefined ? true : portMatch(svc, pkt.dport)) : true;
  if (!nodeActive(node)){
    R.reason = `${node.p.name} 이(가) 다운 상태입니다.`;
    R.hops.push({ k:'fail', nid:node.id, t1:`${node.p.name} 다운`, t3:R.reason }); return R;
  }
  if (!listens){
    R.reason = `${node.p.name} 은(는) ${portName(pkt.dport)} 포트를 열고 있지 않습니다 (개방: ${svc||'없음'}).`;
    R.hops.push({ k:'fail', nid:node.id, t1:'포트 미개방', t2:`요청 ${pkt.dport} / 개방 ${svc||'-'}`, t3:R.reason,
      fix:`${node.p.name} 의 수신 포트에 ${pkt.dport} 를 추가하거나 플로우 포트를 바꾸세요.` });
    return R;
  }
  R.ok = true;
  R.hops.push({ k:'end', nid:node.id, t1:`${node.p.name} 도착 · 정상`,
    t2:`${intToIp(pkt.src)} → ${intToIp(pkt.dst)}:${pkt.dport}/${pkt.proto}`,
    t3:`${T[node.ty].n}${node.p.model?' · '+node.p.model:''} 응답` });
  if (!R.pathN.includes(node.id)) R.pathN.push(node.id);
  return R;
}
const segLabel = (t,id) => { const s=t.segs.get(id); return s ? (s.cidr||('VLAN'+s.vlan)) : '?'; };

/* ── 6. 플로우 자동 생성 ───────────────────────────────────────────────── */
function autoFlows(){
  const out = [];
  const pick = ty => S.n.filter(n=>n.ty===ty);
  const users = [...pick('client'), ...pick('internet')];
  const lbs   = pick('lb'), webs = pick('web'), wass = pick('was'), dbs = pick('rdb'), caches = pick('cache');
  const first = a => a.length ? a[0] : null;
  const add = (n,s,d,pt,pr)=>{ if (s&&d) out.push({ id:'f'+(S.seq++), n, s:s.id, d:d.id||d, pt, pr:pr||'tcp', on:true }); };
  const entry = first(lbs) || first(webs) || first(wass);
  users.forEach((u,i)=>{ if (entry) add(`${u.p.name} → 서비스 진입`, u, entry, entry.ty==='lb' ? (parseInt(entry.p.vport)||443) : 443); });
  if (first(webs) && first(wass)) add('WEB → WAS', first(webs), first(wass), parseInt(String(first(wass).p.svc).split(',')[0])||8080);
  if (first(wass) && first(dbs))  add('WAS → DB', first(wass), first(dbs), parseInt(first(dbs).p.svc)||1521);
  if (first(wass) && first(caches)) add('WAS → 캐시', first(wass), first(caches), parseInt(first(caches).p.svc)||6379);
  const bas = first(pick('bastion'));
  if (bas && first(wass)) add('배스천 → 서버 SSH', bas, first(wass), 22);
  return out;
}

/* ── 7. 전체 검증 ──────────────────────────────────────────────────────── */
function validateAll(){
  const t = buildTopo();
  const I = [];
  const E=(t1,d,fix,ref)=>I.push({ lv:'e', t:t1, d, fix, ref });
  const W=(t1,d,fix,ref)=>I.push({ lv:'w', t:t1, d, fix, ref });
  const N=(t1,d,fix,ref)=>I.push({ lv:'i', t:t1, d, fix, ref });

  if (!S.n.length){ return { t, issues:[{ lv:'i', t:'구성도가 비어 있습니다', d:'좌측 팔레트에서 장비를 끌어다 놓거나 상단의 “랜덤 구성도” 를 눌러 보세요.' }], flows:[] }; }

  /* 물리 연결 */
  S.n.forEach(n=>{ if (!edgesOf(n.id).length)
    E(`${n.p.name} 미연결`, `${T[n.ty].n} 이(가) 어떤 장비와도 연결되어 있지 않습니다.`, '노드 가장자리의 점을 끌어 다른 장비와 연결하세요.', {n:n.id}); });

  /* IP */
  S.n.forEach(n=>{
    if (!T[n.ty].host || n.ty==='internet' || isTrans(n)) return;
    if (!bareIp(n.p.ip)) E(`${n.p.name} IP 미설정`, '통신에 필요한 IP 주소가 없습니다.', '속성 탭 → IP/CIDR 입력, 또는 상단 “IP 자동할당”.', {n:n.id});
    else if (!bareIp(n.p.gw) && !isRouter(n))
      W(`${n.p.name} 게이트웨이 없음`, '같은 대역 밖으로는 통신할 수 없습니다.', '같은 서브넷의 L3 장비 IP(또는 VIP)를 게이트웨이로 지정하세요.', {n:n.id});
  });
  S.n.filter(n=>canFwd(n)).forEach(n=>{
    const ifs = (t.byNode.get(n.id)||[]);
    const noip = ifs.filter(f=>f.eid && f.ip===null);
    if (noip.length) W(`${n.p.name} 인터페이스 IP 누락`, `${noip.length}개 포트에 IP가 없어 그 방향으로는 라우팅되지 않습니다.`, '속성 탭의 인터페이스 목록에서 각 포트에 IP/CIDR 을 넣으세요.', {n:n.id});
  });

  /* 중복 IP */
  const ipmap = new Map();
  t.ifs.forEach(f=>{ if (f.ip===null) return; (ipmap.get(f.ip)||ipmap.set(f.ip,[]).get(f.ip)).push(f); });
  ipmap.forEach((list, ip)=>{
    const uniq = [...new Set(list.map(f=>f.nid))];
    if (uniq.length===2){
      const a=nodeById(uniq[0]), b=nodeById(uniq[1]);
      if (a&&b&&a.p.peer===b.id&&b.p.peer===a.id&&['as','aa'].includes(a.p.ha||'')) return;
    }
    if (uniq.length>1) E(`IP 충돌 ${intToIp(ip)}`, `${uniq.map(id=>nodeById(id).p.name).join(', ')} 이(가) 같은 주소를 사용합니다.`, '한 쪽 주소를 변경하세요. (VIP는 별도 항목에 입력)', {n:uniq[0]});
  });

  /* 세그먼트 서브넷 정합 */
  t.segs.forEach(sg=>{
    if (!sg.cidr) return;
    const bad = sg.ifs.filter(f=>f.cidr && f.cidr!==sg.cidr);
    if (bad.length) E(`${sg.cidr} 구간 서브넷 불일치`,
      `같은 L2 구간에 다른 대역이 섞여 있습니다: ${bad.map(f=>nodeById(f.nid).p.name+'('+f.str+')').join(', ')}`,
      '같은 스위치에 물린 장비는 동일 서브넷이어야 합니다. 다르게 두려면 VLAN 을 분리하세요.', {n:bad[0].nid});
  });

  /* 게이트웨이 유효성 */
  S.n.filter(n=>T[n.ty].host && !isTrans(n) && bareIp(n.p.gw)).forEach(n=>{
    const gi = ipToInt(bareIp(n.p.gw));
    const ifs = (t.byNode.get(n.id)||[]).filter(f=>f.bits);
    const onNet = ifs.find(f=>inNet(gi, f.net, f.bits));
    if (!onNet){ E(`${n.p.name} 게이트웨이 대역 오류`, `게이트웨이 ${bareIp(n.p.gw)} 가 자신의 서브넷(${ifs.map(f=>f.cidr).join(', ')||'없음'}) 밖입니다.`, '같은 서브넷 주소로 고치세요.', {n:n.id}); return; }
    const own = resolveOwner(t, gi, onNet.seg);
    if (!own) E(`${n.p.name} 게이트웨이 응답 없음`, `${bareIp(n.p.gw)} 주소를 가진 장비가 같은 구간에 없습니다.`, 'L3 스위치/방화벽의 인터페이스 IP 또는 FHRP VIP 와 일치시키세요.', {n:n.id});
  });

  /* 방화벽 */
  S.n.filter(n=>n.ty==='fw').forEach(n=>{
    const rules = Array.isArray(n.p.rules)?n.p.rules:[];
    if (!rules.length) W(`${n.p.name} 정책 없음`, '보안 정책이 비어 있어 존이 다른 트래픽은 모두 implicit deny 로 차단됩니다.', '최소한 서비스 경로에 대한 allow 규칙을 추가하세요.', {n:n.id});
    rules.forEach((r,i)=>{ if ((r.act||'allow')==='allow' && (!r.s||r.s==='any') && (!r.d||r.d==='any') && (!r.sv||r.sv==='any'))
      W(`${n.p.name} 정책 #${i+1} 전체 허용`, 'any → any / any 허용 규칙이 있습니다. 사실상 방화벽이 무력화됩니다.', '출발지·목적지·포트를 필요한 범위로 좁히세요.', {n:n.id}); });
    const ifs = (t.byNode.get(n.id)||[]);
    const nz = ifs.filter(f=>f.eid && !f.zone);
    if (nz.length) W(`${n.p.name} 존 미지정 인터페이스 ${nz.length}개`, '존이 없으면 정책 매칭이 모호해집니다.', '각 인터페이스에 trust / dmz / untrust 등 존 이름을 부여하세요.', {n:n.id});
  });

  /* 인터넷 직결 검사 */
  S.n.filter(n=>n.ty==='internet'||n.ty==='wan').forEach(n=>{
    edgesOf(n.id).forEach(e=>{
      const o = nodeById(otherEnd(e, n.id));
      if (o && ['web','was','rdb','client','nosql','cache','app'].includes(o.ty))
        E(`${o.p.name} 인터넷 직결`, `${n.p.name} 과(와) 방화벽 없이 바로 연결되어 있습니다.`, '사이에 방화벽(또는 라우터+방화벽)을 배치하세요.', {n:o.id});
    });
  });

  /* 사설 IP 로 인터넷 나갈 때 NAT 유무 */
  const inet = S.n.find(n=>n.ty==='internet');
  if (inet){
    const fws = S.n.filter(n=>n.ty==='fw');
    const anySnat = fws.some(f=>Array.isArray(f.p.nat) && f.p.nat.some(r=>r.kind==='snat'));
    const hasPriv = S.n.some(n=>T[n.ty].host && bareIp(n.p.ip) && isPrivate(bareIp(n.p.ip)));
    if (hasPriv && fws.length && !anySnat)
      W('아웃바운드 NAT 미설정', '사설 IP 대역이 인터넷으로 나가려면 SNAT(PAT)가 필요합니다.', '방화벽 NAT 정책에 SNAT 규칙을 추가하세요.', {n:fws[0].id});
  }

  /* 로드밸런서 */
  S.n.filter(n=>n.ty==='lb').forEach(n=>{
    if (!bareIp(n.p.vip)) E(`${n.p.name} VIP 없음`, '가상 서버 주소가 없어 서비스 진입점이 만들어지지 않습니다.', 'VIP 를 서비스 대역 안의 주소로 지정하세요.', {n:n.id});
    const pool = (n.p.pool||[]).map(nodeById).filter(Boolean);
    if (!pool.length) E(`${n.p.name} 풀 비어 있음`, '분산할 실서버가 없습니다.', '속성 탭 → 풀 멤버에서 서버를 선택하세요.', {n:n.id});
    pool.forEach(m=>{
      const port = lbMemberPort(n, m);
      if (n.p.mon!=='none' && n.p.mon!=='icmp' && !portMatch(m.p.svc, port))
        W(`${n.p.name} 풀 멤버 포트 불일치`, `${m.p.name} 이(가) ${port} 포트를 열고 있지 않아 헬스체크에서 제외됩니다.`, `${m.p.name} 수신 포트에 ${port} 를 추가하세요.`, {n:m.id});
      if (!segReachable(t, n.id, m.id) && !lookupPathExists(t, n, m))
        W(`${n.p.name} → ${m.p.name} 경로 확인 필요`, 'LB 와 풀 멤버가 같은 구간에 없고 라우팅도 불명확합니다.', '동일 서비스 VLAN 에 두거나 LB 에 경로를 추가하세요.', {n:m.id});
    });
    if (pool.length===1) W(`${n.p.name} 단일 멤버`, '풀에 서버가 1대뿐이라 부하분산·이중화 효과가 없습니다.', '동일 역할 서버를 1대 이상 추가하세요.', {n:n.id});
    if (!n.p.snat && pool.length){
      const bad = pool.filter(m=>{ const g=bareIp(m.p.gw); const lip=(t.byNode.get(n.id)||[]).map(f=>f.str);
        return g && !lip.includes(g); });
      if (bad.length) W(`${n.p.name} SNAT 미사용 + 게이트웨이 불일치`, `${bad.map(m=>m.p.name).join(', ')} 의 기본 게이트웨이가 LB 가 아니어서 응답이 비대칭 경로로 빠집니다.`, 'SNAT AutoMap 을 켜거나 서버 게이트웨이를 LB 로 지정하세요.', {n:n.id});
    }
    if (n.p.mode==='l4' && n.p.persist==='cookie') W(`${n.p.name} 지속성 방식 부적합`, 'Cookie Insert 는 L7(HTTP)에서만 동작합니다.', '동작 계층을 L7 로 바꾸거나 Source Address 지속성을 쓰세요.', {n:n.id});
  });

  /* WAS 세션 처리 */
  S.n.filter(n=>n.ty==='was').forEach(n=>{
    const lbs = S.n.filter(x=>x.ty==='lb' && (x.p.pool||[]).includes(n.id));
    lbs.forEach(l=>{ if (!n.p.sessrep && (l.p.persist==='none'||!l.p.persist))
      W(`${n.p.name} 세션 유실 위험`, `${l.p.name} 에 세션 지속성이 없고 WAS 세션 클러스터링도 꺼져 있습니다. 절체 시 로그인이 풀립니다.`, 'LB 지속성(Source/Cookie) 또는 WAS 세션 복제, 혹은 외부 세션 스토어(Redis)를 쓰세요.', {n:n.id}); });
  });

  /* DB */
  S.n.filter(n=>n.ty==='rdb').forEach(n=>{
    if ((n.p.dbha||'none')==='none')
      W(`${n.p.name} DB 이중화 없음`, '단일 인스턴스라 장애 시 서비스가 멈추고 데이터 손실 위험이 있습니다.', `${dbHaSuggest(n.p.eng)} 구성을 검토하세요.`, {n:n.id});
    else if (!n.p.peer && !['rac','tac','fci'].includes(n.p.dbha))
      W(`${n.p.name} 복제 대상 미지정`, `${(O_DBHA.find(x=>x[0]===n.p.dbha)||[])[1]} 로 설정했지만 상대 노드가 없습니다.`, '상대 노드를 지정하고 두 노드를 링크로 연결하세요.', {n:n.id});
    if (n.p.dbha==='async' || (n.p.sync==='async' && n.p.dbha!=='none'))
      N(`${n.p.name} 비동기 복제`, '장애 시 마지막 트랜잭션이 유실될 수 있습니다 (RPO > 0).', '무손실이 필요하면 동기/반동기로 전환하세요. 다만 커밋 지연이 늘어납니다.', {n:n.id});
    if (['rac','fci','tac'].includes(n.p.dbha) && !n.p.store)
      W(`${n.p.name} 공유 스토리지 미지정`, `${(O_DBHA.find(x=>x[0]===n.p.dbha)||[])[1]} 는 공유 스토리지가 필수입니다.`, '스토리지 노드를 배치하고 “스토리지 연결”에 지정하세요.', {n:n.id});
    if (n.p.peer && !S.e.some(e=>(e.a===n.id&&e.b===n.p.peer)||(e.b===n.id&&e.a===n.p.peer)))
      N(`${n.p.name} 복제 전용선 없음`, '복제 트래픽이 서비스망을 함께 쓰게 됩니다.', 'DB 간 하트비트/복제 링크를 별도로 연결하는 것을 권장합니다.', {n:n.id});
  });

  /* 스토리지 */
  S.n.filter(n=>n.ty==='storage').forEach(n=>{
    if (!n.p.mpio) W(`${n.p.name} 멀티패스 미사용`, '경로가 하나면 HBA/케이블 하나만 끊겨도 볼륨이 내려갑니다.', 'MPIO 를 켜고 경로를 2개 이상 연결하세요.', {n:n.id});
    if (edgesOf(n.id).length<2) W(`${n.p.name} 단일 경로`, '스토리지 연결이 1개뿐입니다.', '컨트롤러 A/B 를 서로 다른 스위치에 연결하세요.', {n:n.id});
  });

  /* 이중화 일반 */
  S.n.forEach(n=>{
    const ha = n.p.ha||'none';
    const sameKind = S.n.filter(x=>x.ty===n.ty && x.id!==n.id).length;
    const peerExempt = ha==='clu' || n.ty==='storage' || (ha==='aa' && sameKind>0);
    if (ha!=='none' && !n.p.peer && !peerExempt)
      W(`${n.p.name} 이중화 짝 없음`, `${(O_HA.find(x=>x[0]===ha)||[])[1]} 로 설정했지만 상대 장비가 지정되지 않았습니다.`, '동일 기종을 하나 더 배치하고 “이중화 짝”에 지정하세요.', {n:n.id});
    const shareIf = (()=>{ if (!n.p.peer) return false;
      const mine=new Set((t.byNode.get(n.id)||[]).filter(f=>f.ip!==null).map(f=>f.ip));
      return (t.byNode.get(n.p.peer)||[]).some(f=>f.ip!==null && mine.has(f.ip)); })();
    if (ha!=='none' && n.p.peer && !bareIp(n.p.vip) && !shareIf && ['fw','lb','router','l3sw','vpn'].includes(n.ty))
      E(`${n.p.name} VIP 없는 이중화`, '짝은 있지만 공유 VIP 가 없습니다. 실제로는 절체해도 하위 장비의 게이트웨이 주소가 옮겨가지 않아 통신이 끊깁니다.', 'VRRP/HSRP 가상 IP 를 두 장비에 동일하게 지정하세요.', {n:n.id});
    if (ha==='as' && n.p.peer && !S.e.some(e=>e.k==='hb' && ((e.a===n.id&&e.b===n.p.peer)||(e.b===n.id&&e.a===n.p.peer))))
      N(`${n.p.name} 하트비트 링크 없음`, 'A/S 구성은 상태 동기화·생존 확인용 전용 링크를 권장합니다.', '두 장비를 연결하고 링크 종류를 “HA 하트비트”로 바꾸세요.', {n:n.id});
    if (ha!=='none' && n.p.peer){
      const mine = new Set(edgesOf(n.id).map(e=>otherEnd(e,n.id)));
      const peer = nodeById(n.p.peer);
      if (peer){
        const theirs = new Set(edgesOf(peer.id).map(e=>otherEnd(e,peer.id)));
        const up = [...mine].filter(x=>theirs.has(x) && nodeById(x) && ['l2sw','l3sw','router','fw'].includes(nodeById(x).ty));
        if (up.length===1 && (edgesOf(nodeById(up[0]).id).length>1) && !nodeById(up[0]).p.peer)
          W(`${nodeById(up[0]).p.name} 단일 상단 스위치`, `${n.p.name} / ${peer.p.name} 이중화가 스위치 1대에만 물려 있어 그 스위치가 SPOF 입니다.`, '상단 스위치도 2대로 나누어 교차 연결하세요.', {n:up[0]});
      }
    }
  });

  /* STP / 루프 */
  const loopy = detectL2Loops(t);
  loopy.forEach(g=>{
    const noStp = [...g.nodes].map(nodeById).filter(n=>n&&n.p.stp==='off');
    if (noStp.length) E('L2 루프 + STP 미사용', `${[...g.nodes].map(id=>nodeById(id).p.name).join(', ')} 구간에 폐회로가 있는데 STP 가 꺼져 있습니다. 브로드캐스트 스톰이 발생합니다.`, 'STP(RSTP/MSTP)를 켜거나 MLAG/포트채널로 묶으세요.', {n:noStp[0].id});
  });

  /* 관리/운영 */
  if (!S.n.some(n=>n.ty==='nms')) N('모니터링 없음', '장애를 자동으로 인지할 수단이 없습니다.', 'NMS 노드를 배치하고 관리망에 연결하세요.');
  if (!S.n.some(n=>n.ty==='backup') && S.n.some(n=>n.ty==='rdb')) N('백업 없음', 'DB 가 있는데 백업 장비가 없습니다.', '백업 노드를 추가하고 RPO 를 정의하세요.');
  if (!S.n.some(n=>n.ty==='bastion') && S.n.some(n=>n.ty==='was')) N('서버 접근 통제 없음', '운영 서버로 직접 SSH 하는 구조입니다.', '점프/배스천 서버를 두고 관리 접근을 단일화하세요.');

  /* 플로우 실행 */
  const flows = (S.f||[]).filter(f=>f.on!==false).map(f=>({ f, r:trace(t, f) }));
  flows.forEach(({f,r})=>{ if (!r.ok)
    E(`플로우 실패 · ${f.n}`, r.reason || '경로를 완성하지 못했습니다.', '플로우 탭에서 홉별 상세를 확인하세요.', { flow:f.id }); });

  I.sort((a,b)=>({e:0,w:1,i:2})[a.lv]-({e:0,w:1,i:2})[b.lv]);
  return { t, issues:I, flows };
}
function lookupPathExists(t, from, to){
  const rt = t.rtb.get(from.id); if (!rt) return false;
  const ip = ipToInt(bareIp(to.p.ip)); if (ip===null) return false;
  return !!lookup(rt, ip);
}
function dbHaSuggest(eng){
  return ({ oracle:'Oracle RAC(A/A) 또는 Data Guard(Primary/Standby)', tibero:'Tibero TAC',
    mssql:'Always On 가용성 그룹', mysql:'반동기 복제 또는 InnoDB Cluster',
    mariadb:'Galera Cluster 또는 반동기 복제', pgsql:'스트리밍 복제 + Patroni', db2:'HADR' })[eng] || 'Active/Standby 복제';
}
function detectL2Loops(t){
  const groups = [];
  const doms = new Map();
  S.e.forEach(e=>{ const d=t.domOf.get(e.id); if(!doms.has(d)) doms.set(d,{edges:[],nodes:new Set()});
    const g=doms.get(d); g.edges.push(e); g.nodes.add(e.a); g.nodes.add(e.b); });
  doms.forEach(g=>{
    const sw = [...g.nodes].filter(id=>{ const n=nodeById(id); return n && (T[n.ty].sw||isTrans(n)); });
    if (sw.length>=2 && g.edges.length >= g.nodes.size) groups.push(g);
  });
  return groups;
}

/* ── 8. SPOF 분석 ──────────────────────────────────────────────────────── */
function spofScan(){
  const base = buildTopo();
  const flows = (S.f||[]).filter(f=>f.on!==false);
  if (!flows.length) return { baseline:0, items:[], flows:0 };
  const okBase = flows.filter(f=>trace(base, f).ok).length;
  const items = [];
  /* 플로우의 출발지·목적지 자신은 SPOF 로 세지 않는다 (자기 자신이 끊기는 건 당연) */
  const test = (setter, unsetter, label, kind, id, hint, skipEnds)=>{
    setter();
    const t2 = buildTopo();
    const scope = skipEnds ? flows.filter(f=>f.s!==skipEnds && f.d!==skipEnds) : flows;
    const broken = scope.filter(f=>!trace(t2, f).ok);
    unsetter();
    if (broken.length) items.push({ label, kind, id, broken:broken.map(f=>f.n), hint });
  };
  S.n.forEach(n=>{
    if (n.p.down) return;
    test(()=>n.p.down=true, ()=>delete n.p.down, n.p.name, 'node', n.id,
      n.p.peer ? '이중화 짝이 있지만 절체 경로가 완성되지 않았습니다 (VIP/케이블 확인).'
               : `${T[n.ty].n} 이중화가 없습니다.`, n.id);
  });
  S.e.forEach(e=>{
    if (e.down) return;
    const A=nodeById(e.a), B=nodeById(e.b); if(!A||!B) return;
    test(()=>e.down=true, ()=>delete e.down, `${A.p.name} ↔ ${B.p.name} 링크`, 'edge', e.id, '경로가 하나뿐입니다. 교차(cross) 연결을 추가하세요.');
  });
  items.sort((a,b)=>b.broken.length-a.broken.length);
  return { baseline:okBase, total:flows.length, items };
}
