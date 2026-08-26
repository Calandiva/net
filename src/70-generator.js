/* ═══════════════════════════════════════════════════════════════════════════
   70-generator.js — 레퍼런스 아키텍처 자동 생성 · IP 자동할당 · 정책 자동생성
   생성되는 구성은 실제 데이터센터 표준 설계를 따른다:
   · 인터넷 ─ (DDoS) ─ 방화벽 A/S ─ (IPS) ─ DMZ L2 ─ (WAF bridge) ─ LB ─ WEB
   · WEB ─ 내부 방화벽 ─ 서버 액세스 L2 ─ 코어 L3(VRRP) ─ WAS ─ DB(RAC/AG/Patroni)
   · 관리망 VLAN 분리 + 배스천/NMS/SIEM/백업
   ═══════════════════════════════════════════════════════════════════════════ */

const rnd  = a => a[Math.floor(Math.random()*a.length)];
const rint = (a,b) => a + Math.floor(Math.random()*(b-a+1));
const pick = (p) => Math.random() < p;

const PROFILES = [
  { key:'dmz3tier', name:'표준 3-Tier DMZ (이중화)',
    desc:'인터넷 ─ 방화벽 A/S ─ DMZ(LB+WEB) ─ 내부 방화벽 ─ 코어 L3(VRRP) ─ WAS ─ DB',
    tiers:1, dualFw:1, lb:1, waf:1, ips:1, ddos:0, k8s:0, cache:1, web:2, was:2 },
  { key:'finance', name:'금융/공공형 다계층 보안망',
    desc:'DDoS ─ 방화벽 ─ IPS ─ WAF ─ L4 ─ 3-Tier ─ 망분리 관리망, DB 이중화 필수',
    tiers:1, dualFw:1, lb:1, waf:1, ips:1, ddos:1, k8s:0, cache:1, web:3, was:3, strict:1 },
  { key:'collapsed', name:'중소규모 통합 서버망',
    desc:'UTM 방화벽 A/S ─ L2 이중화 ─ WEB/WAS 통합 서버 ─ DB 복제 ─ NAS',
    tiers:0, dualFw:0, lb:1, waf:0, ips:0, ddos:0, k8s:0, cache:0, web:2, was:0, small:1 },
  { key:'k8s', name:'컨테이너 플랫폼 (K8s)',
    desc:'L7 로드밸런서 ─ Ingress ─ Worker 노드 ─ PostgreSQL Patroni ─ Redis Sentinel',
    tiers:1, dualFw:1, lb:1, waf:0, ips:0, ddos:0, k8s:1, cache:1, web:0, was:3 }
];

function genRandom(profileKey){
  const P = profileKey ? PROFILES.find(p=>p.key===profileKey) : rnd(PROFILES);
  const a = rint(10,99);
  const NET = {
    ext:  rnd(['203.0.113','198.51.100','192.0.2']),
    dmz:  `172.16.${rnd([10,20,30,40])}`,
    core: `10.${a}.1`,   was:`10.${a}.20`, db:`10.${a}.30`,
    user: `10.${a}.40`,  mgmt:`10.${a}.99`
  };
  const V = { dmz:10, core:1, was:20, db:30, user:40, mgmt:99 };

  const doc = blankDoc();
  doc.t = P.name + ' — ' + ['서울','판교','대전','부산','과천'][rint(0,4)] + ' 센터';
  const prev = S; S = doc;   // 빌더가 addNode/addEdge 를 쓰도록 잠시 교체
  try {
    build(P, NET, V);
  } finally { /* keep doc */ }

  const built = S; S = prev;
  return built;
}

const dmzGwOf = (P, NET) => NET.dmz + (P.dualFw ? '.4' : '.1');

function build(P, NET, V){
  /* 세로 흐름: c = 계층 깊이(위→아래, 인터넷이 맨 위), r = 같은 계층 안의 좌우 위치.
     이렇게 두면 노드의 ▲위=업링크 / ▼아래=다운링크 가 화면과도 일치한다. */
  const X0=560, Y0=70, LAT=140, DEP=100;
  const at = (c,r)=>({ x:snap(X0 + r*LAT), y:snap(Y0 + c*DEP) });
  const N = (ty,c,r,p)=>{ const q=at(c,r); return addNode(ty,q.x,q.y,p); };
  const L = (a,b,k)=>addEdge(a.id,b.id,k);
  const FO='fo', CU='cu', FC='fc', HB='hb', WANK='wan';

  const vendorFw  = rnd(T.fw.models), vendorLb = rnd(T.lb.models);
  const vendorL3  = rnd(T.l3sw.models), vendorL2 = rnd(T.l2sw.models);
  const osPick    = rnd(['rhel','ubuntu','rhel','rhel']);

  /* ── 외부 구간 ── */
  const inet = N('internet', 0, 0, { name:'INTERNET', ip:NET.ext+'.1/29', zone:'untrust', gw:NET.ext+'.2' });
  let  edgeIn = inet;

  if (P.ddos){
    const dd = N('ddos', 1.0, 0, { name:'DDoS-01', model:rnd(T.ddos.models), bypass:true, mip:NET.mgmt+'.31/24', th:'2Gbps / 200kpps' });
    L(inet, dd, WANK); edgeIn = dd;
  }

  /* ── 외부 방화벽 A/S (플로팅 인터페이스 IP) ── */
  const fwe = [1,2].map(i=>N('fw', 2.0, i===1?-1.1:1.1, {
    name:'FW-EXT-0'+i, model:vendorFw, mode:'route', ha:'as', prio:i===1?110:100, preempt:false, sess:true, log:true,
    defgw:NET.ext+'.1',
    routes:`10.0.0.0/8 via ${NET.dmz}.${P.dualFw?'4':'7'}`,
    rules:[
      { sz:'untrust', dz:'dmz',     s:'any', d:'any', sv:'80,443',        act:'allow' },
      { sz:'dmz',     dz:'untrust', s:'any', d:'any', sv:'53,80,123,443',  act:'allow' },
      { sz:'untrust', dz:'dmz',     s:'any', d:'any', sv:'any',            act:'deny'  }
    ],
    nat:[
      { kind:'dnat', s:'any', d:NET.ext+'.2', sv:'443', ti:NET.dmz+'.100', tp:'443' },
      { kind:'dnat', s:'any', d:NET.ext+'.2', sv:'80',  ti:NET.dmz+'.100', tp:'80'  },
      { kind:'snat', s:'10.0.0.0/8 172.16.0.0/12', d:'any', sv:'any', ti:NET.ext+'.2' }
    ]
  }));
  fwe[0].p.peer = fwe[1].id; fwe[1].p.peer = fwe[0].id;
  const peerLinkPorts = (e)=>{ if(!e) return;
    const A=nodeById(e.a), B=nodeById(e.b);
    endProps(e,A.id).port = A.x<=B.x ? 'r' : 'l';
    endProps(e,B.id).port = A.x<=B.x ? 'l' : 'r'; };
  fwe.forEach(f=>{ const e = L(edgeIn, f, WANK);
    if (e) endProps(e, f.id).ip = NET.ext+'.2/29', endProps(e, f.id).zone='untrust'; });
  peerLinkPorts(L(fwe[0], fwe[1], HB));

  /* ── DMZ 액세스 스위치 ── */
  const dsw = [1,2].map(i=>N('l2sw', 4.0, i===1?-1.1:1.1, {
    name:'L2SW-DMZ-0'+i, model:vendorL2, vlan:V.dmz, trunk:String(V.dmz), stp:'rstp', lacp:true,
    mip:NET.mgmt+'.'+(10+i)+'/24' }));
  peerLinkPorts(L(dsw[0], dsw[1], FO));

  let dmzIn = dsw;
  if (P.ips){
    const ips = N('ips', 3.0, 0, { name:'IPS-01', model:rnd(T.ips.models), dep:'inline', act:'block', bypass:true, vlan:V.dmz, mip:NET.mgmt+'.21/24' });
    fwe.forEach(f=>{ const e=L(f, ips, FO); if(e) Object.assign(endProps(e,f.id), { ip:NET.dmz+'.1/24', zone:'dmz', vlan:V.dmz }); });
    dsw.forEach(s=>L(ips, s, FO));
  } else {
    fwe.forEach(f=>dsw.forEach(s=>{ const e=L(f, s, FO);
      if(e) Object.assign(endProps(e,f.id), { ip:NET.dmz+'.1/24', zone:'dmz', vlan:V.dmz }); }));
  }

  /* ── WAF (투명 브리지) ── */
  let waf = null;
  if (P.waf){
    waf = N('waf', 6.3, -2.7, { name:'WAF-01', model:rnd(T.waf.models), dep:'bridge', act:'block', bypass:true,
      zone:'dmz', ip:NET.dmz+'.9/24', gw:dmzGwOf(P,NET), vlan:V.dmz });
    dsw.forEach(s=>L(s, waf, FO));
  }

  /* ── 로드밸런서 ── */
  const VIP = NET.dmz+'.100';
  const lbMode = P.k8s ? 'l7' : rnd(['l4','l4','l7']);
  const lbAlgo = rnd(['rr','lc','wlc','observed','srchash']);
  const lbPersist = (()=>{ const p = rnd(['srcip','srcip','cookie','none']);
    return (lbMode==='l4' && p==='cookie') ? 'srcip' : p; })();
  const lbSsl = pick(.6);
  const lbs = P.lb ? [1,2].map(i=>N('lb', 5.2, i===1?-3.3:-2.2, {
    name:'LB-0'+i, model:vendorLb, mode:lbMode,
    ip:NET.dmz+'.'+(10+i)+'/24', gw:NET.dmz+'.1', defgw:NET.dmz+'.1', vlan:V.dmz, zone:'dmz',
    vip:VIP, vport:'443,80', algo:lbAlgo, persist:lbPersist, mon:'http', monint:5, monretry:3,
    snat:true, ssl:lbSsl, ha:'as', prio:i===1?110:100, preempt:true, sess:true
  })) : [];
  if (lbs.length){
    lbs[0].p.peer = lbs[1].id; lbs[1].p.peer = lbs[0].id;
    lbs.forEach(l=>dsw.forEach(s=>L(s, l, FO)));
    peerLinkPorts(L(lbs[0], lbs[1], HB));
  }

  /* ── 웹 계층 ── */
  const webN = P.web||0;
  const webs = [];
  const dmzGw = dmzGwOf(P, NET);
  for (let i=1;i<=webN;i++){
    const w = N('web', 7.4, -3.35 + (i-1)*0.95, {
      name:'WEB-0'+i, model:rnd(T.web.models), os:osPick,
      ip:NET.dmz+'.'+(20+i)+'/24', gw:dmzGw, vlan:V.dmz, zone:'dmz',
      svc:'80,443', health:'/healthz', ha:'aa', peer:'' });
    webs.push(w);
    if (waf) L(waf, w, FO); else dsw.forEach(s=>L(s, w, CU));
  }
  if (webs.length>1){ webs[0].p.peer = webs[1].id; webs[1].p.peer = webs[0].id; }
  if (lbs.length) lbs.forEach(l=>l.p.pool = webs.map(w=>w.id));

  /* ── 내부 방화벽 ── */
  let fwi = [];
  if (P.dualFw){
    fwi = [1,2].map(i=>N('fw', 5.6, i===1?-1.1:1.1, {
      name:'FW-INT-0'+i, model:rnd(T.fw.models), mode:'route', ha:'as', prio:i===1?110:100, preempt:false, sess:true,
      defgw:NET.dmz+'.1',
      routes:`10.0.0.0/8 via ${NET.core}.10`,
      rules:[
        { sz:'dmz',   dz:'trust', s:'any', d:'any', sv:'8080,8443',       act:'allow' },
        { sz:'trust', dz:'dmz',   s:'any', d:'any', sv:'53,80,443,8080',  act:'allow' },
        { sz:'dmz',   dz:'trust', s:'any', d:'any', sv:'any',             act:'deny'  }
      ] }));
    fwi[0].p.peer = fwi[1].id; fwi[1].p.peer = fwi[0].id;
    fwi.forEach(f=>dsw.forEach(s=>{ const e=L(s, f, FO);
      if(e) Object.assign(endProps(e,f.id), { ip:NET.dmz+'.4/24', zone:'dmz', vlan:V.dmz }); }));
    peerLinkPorts(L(fwi[0], fwi[1], HB));
  }

  /* ── 서버 액세스 스위치 (VLAN 다중) ── */
  const ssw = [1,2].map(i=>N('l2sw', 6.8, i===1?-1.1:1.1, {
    name:'L2SW-SRV-0'+i, model:vendorL2, vlan:V.core,
    trunk:`${V.core},${V.was},${V.db},${V.user},${V.mgmt}`, stp:'rstp', lacp:true,
    mip:NET.mgmt+'.'+(12+i)+'/24' }));
  peerLinkPorts(L(ssw[0], ssw[1], FO));
  if (fwi.length) fwi.forEach(f=>ssw.forEach(s=>{ const e=L(f, s, FO);
    if(e) Object.assign(endProps(e,f.id), { ip:NET.core+'.1/24', zone:'trust', vlan:V.core }); }));
  else dsw.forEach((s,i)=>L(s, ssw[i], FO));

  /* ── 코어 L3 스위치 (VRRP) ── */
  const l3 = [1,2].map(i=>N('l3sw', 8.0, i===1?-1.1:1.1, {
    name:'L3SW-CORE-0'+i, model:vendorL3, proto:'static', stp:'rstp', mlag:true,
    fhrp:'vrrp', ha:'aa', prio:i===1?120:110, preempt:true, vip:NET.core+'.10', zone:'trust',
    defgw: P.dualFw ? NET.core+'.1' : NET.dmz+'.1',
    vlans:[
      `${V.was} SVI ${NET.was}.1${i}/24 trust vip ${NET.was}.1`,
      `${V.db} SVI ${NET.db}.1${i}/24 trust vip ${NET.db}.1`,
      `${V.user} SVI ${NET.user}.1${i}/24 trust vip ${NET.user}.1`,
      `${V.mgmt} SVI ${NET.mgmt}.1${i}/24 mgmt vip ${NET.mgmt}.1`
    ].concat(P.dualFw ? [] : [`${V.dmz} SVI ${NET.dmz}.${4+i}/24 dmz vip ${NET.dmz}.7`]).join('\n')
  }));
  l3[0].p.peer = l3[1].id; l3[1].p.peer = l3[0].id;
  l3.forEach((sw,i)=>ssw.forEach(s=>{ const e=L(s, sw, FO);
    if(e) Object.assign(endProps(e,sw.id), { ip:NET.core+'.1'+(i+1)+'/24', zone:'trust', vlan:V.core }); }));
  const peerLink = L(l3[0], l3[1], FO);
  if (peerLink){
    Object.assign(endProps(peerLink, l3[0].id), { ip:NET.core+'.253/30', zone:'trust', vlan:4094 });
    Object.assign(endProps(peerLink, l3[1].id), { ip:NET.core+'.254/30', zone:'trust', vlan:4094 });
  }

  /* ── 애플리케이션 계층 ── */
  const wasN = P.was||0, wass = [];
  for (let i=1;i<=wasN;i++){
    const ty = P.k8s ? 'k8s' : 'was';
    const w = N(ty, 9.2, -1.7 + (i-1)*1.05, P.k8s ? {
      name:'K8S-WK-0'+i, model:rnd(T.k8s.models), role:'worker', cni:rnd(['calico','cilium']),
      ip:NET.was+'.'+(20+i)+'/24', gw:NET.was+'.1', vlan:V.was, zone:'trust',
      svc:'30080,30443,6443,22', pods:`10.244.${i}.0/24`, ha:'clu'
    } : {
      name:'WAS-0'+i, model:rnd(T.was.models), os:osPick,
      ip:NET.was+'.'+(20+i)+'/24', gw:NET.was+'.1', vlan:V.was, zone:'trust',
      svc:'8080,8443', health:'/actuator/health', sessrep:pick(.5), ha:'aa'
    });
    wass.push(w); ssw.forEach(s=>L(s, w, CU));
  }
  if (wass.length>1){ wass[0].p.peer = wass[1].id; wass[1].p.peer = wass[0].id; }
  if (!webs.length && lbs.length) lbs.forEach(l=>l.p.pool = wass.map(w=>w.id));
  if (webs.length && wass.length) webs.forEach(w=>w.p.up = wass[0].id);

  /* ── DB 계층 ── */
  const dbProfileSet = P.k8s
    ? { eng:'pgsql',  dbha:'patroni',  sync:'sync', model:'PostgreSQL 16', port:'5432', store:0 }
    : rnd([
        { eng:'oracle', dbha:'rac',      sync:'sync', model:'Oracle DB 19c on RHEL', port:'1521', store:1 },
        { eng:'oracle', dbha:'dg',       sync:'sync', model:'Oracle DB 19c on RHEL', port:'1521', store:1 },
        { eng:'mssql',  dbha:'alwayson', sync:'sync', model:'SQL Server 2022',       port:'1433', store:0 },
        { eng:'mysql',  dbha:'semisync', sync:'semi', model:'MySQL 8.4',             port:'3306', store:0 },
        { eng:'tibero', dbha:'tac',      sync:'sync', model:'Tibero 7',              port:'8629', store:1 },
        { eng:'pgsql',  dbha:'patroni',  sync:'sync', model:'PostgreSQL 16',         port:'5432', store:0 }
      ]);
  const SCAN = NET.db+'.100';
  const dbs = [1,2].map(i=>N('rdb', 10.4, i===1?-0.7:0.7, {
    name:'DB-0'+i, eng:dbProfileSet.eng, model:dbProfileSet.model,
    ip:NET.db+'.'+(20+i)+'/24', gw:NET.db+'.1', vlan:V.db, zone:'trust',
    svc:dbProfileSet.port, dbha:dbProfileSet.dbha, sync:dbProfileSet.sync,
    vip:SCAN, role: (i===1?'pri':(['rac','tac'].includes(dbProfileSet.dbha)?'both':'sec')),
    ha: ['rac','tac'].includes(dbProfileSet.dbha)?'aa':'as', prio:i===1?110:100 }));
  dbs[0].p.peer = dbs[1].id; dbs[1].p.peer = dbs[0].id;
  dbs.forEach(d=>ssw.forEach(s=>L(s, d, CU)));
  peerLinkPorts(L(dbs[0], dbs[1], HB));
  if (wass.length) wass.forEach(w=>w.p.up = dbs[0].id);

  if (dbProfileSet.store){
    const stg = N('storage', 11.6, 0.6, { name:'STG-01', model:rnd(T.storage.models), proto:'fc',
      raid:rnd(['6','10','dp']), cap:rnd(['60TB','120TB','240TB']), mpio:true, ha:'aa',
      ip:NET.mgmt+'.50/24', gw:NET.mgmt+'.1', vlan:V.mgmt, zone:'mgmt' });
    dbs.forEach(d=>{ L(d, stg, FC); d.p.store = stg.id; });
    ssw.forEach(s=>L(s, stg, CU));
  }

  /* ── 캐시 ── */
  if (P.cache){
    const ch = [1,2].map(i=>N('cache', 9.2, 2.3 + (i-1)*0.95, {
      name:'REDIS-0'+i, model:rnd(T.cache.models), ip:NET.was+'.'+(40+i)+'/24', gw:NET.was+'.1',
      vlan:V.was, zone:'trust', svc:'6379', ha:'as', prio:i===1?110:100, vip:NET.was+'.140', persist:true }));
    ch[0].p.peer = ch[1].id; ch[1].p.peer = ch[0].id;
    ch.forEach(c=>ssw.forEach(s=>L(s, c, CU)));
    peerLinkPorts(L(ch[0], ch[1], HB));
  }

  /* ── 사용자망 ── */
  const user = N('client', 8.0, 4.3, { name:'USER-LAN', model:'사무실 PC 대역',
    ip:NET.user+'.50/24', gw:NET.user+'.1', vlan:V.user, zone:'trust', cnt:rint(30,400) });
  ssw.forEach(s=>L(s, user, CU));

  /* ── 관리망 ── */
  const mg = [
    ['bastion','BAS-01', 20, { svc:'22,3389', mfa:true, rec:true }],
    ['nms','NMS-01',     21, { svc:'161,443' }],
    ['siem','SIEM-01',   22, { svc:'514,9200', ret:'6개월' }],
    ['backup','BKP-01',  23, { sched:'일 1회 전체 + 4시간 증분', rpo:'4시간', offsite:pick(.5) }]
  ].map(([ty,name,host,extra],i)=>{
    const n = N(ty, 9.4 + i*1.15, 4.3, Object.assign({
      name, model:rnd(T[ty].models), ip:NET.mgmt+'.'+host+'/24', gw:NET.mgmt+'.1',
      vlan:V.mgmt, zone:'mgmt' }, extra));
    ssw.forEach(s=>L(s, n, CU));
    return n;
  });

  /* ── 관리망 정책 보강 ── */
  if (fwi.length) fwi.forEach(f=>f.p.rules.splice(2,0,
    { sz:'mgmt',  dz:'trust', s:'any', d:'any', sv:'22,3389,161',  act:'allow' },
    { sz:'trust', dz:'mgmt',  s:'any', d:'any', sv:'161,514,9200', act:'allow' }));

  /* ── 검증 플로우 ── */
  const svcPort = 443;
  const entry = lbs.length ? VIP : (webs[0] ? bareIp(webs[0].p.ip) : bareIp(wass[0].p.ip));
  S.f = [];
  const F = (n,s,d,pt)=>S.f.push({ id:'f'+(S.seq++), n, s:s.id, d:(typeof d==='string'?d:d.id), pt, pr:'tcp', on:true });
  F('인터넷 → 서비스 (DNAT→VIP)', inet, NET.ext+'.2', svcPort);
  F('사용자망 → 서비스 VIP', user, entry, svcPort);
  if (webs.length && wass.length) F('WEB → WAS', webs[0], wass[0], parseInt(String(wass[0].p.svc).split(',')[0])||8080);
  if (wass.length) F('WAS → DB', wass[0], dbs[0], parseInt(dbProfileSet.port));
  if (P.cache && wass.length) F('WAS → 캐시', wass[0], NET.was+'.140', 6379);
  F('배스천 → 서버 SSH', mg[0], wass[0]||webs[0]||dbs[0], 22);
  F('사용자망 → 인터넷', user, NET.ext+'.1', 443);

  /* SSH 를 위해 서버 포트 개방 */
  [...webs, ...wass, ...dbs].forEach(n=>{ if (!portMatch(n.p.svc,22)) n.p.svc = (n.p.svc||'')+',22'; });

  /* 정책 자동 보정 — 생성된 플로우가 전부 통과할 때까지 */
  S.n.filter(n=>n.ty==='fw').forEach(f=>autoFwRules(f));
}

/* ── 방화벽 정책 자동 생성 ─────────────────────────────────────────────── */
function autoFwRules(fw){
  for (let round=0; round<24; round++){
    const t = buildTopo();
    let changed = false;
    for (const f of (S.f||[]).filter(x=>x.on!==false)){
      const r = trace(t, f);
      if (r.ok) continue;
      const bad = r.hops.find(hp=>hp.k==='fail' && hp.nid===fw.id && hp.sz);
      if (!bad) continue;
      fw.p.rules = Array.isArray(fw.p.rules) ? fw.p.rules : [];
      const nr = { sz:bad.sz, dz:bad.dz, s:'any', d:'any', sv:String(bad.port), act:'allow' };
      if (fw.p.rules.some(x=>x.sz===nr.sz&&x.dz===nr.dz&&x.sv===nr.sv&&x.act==='allow')) continue;
      const denyAt = fw.p.rules.findIndex(x=>x.act==='deny');
      if (denyAt>=0) fw.p.rules.splice(denyAt, 0, nr); else fw.p.rules.push(nr);
      changed = true; break;
    }
    if (!changed) break;
  }
}

/* ── IP 자동 할당 ──────────────────────────────────────────────────────── */
function autoAssignIP(){
  const t = buildTopo();
  let base = 10, assigned = 0;
  const used = new Set(t.ifs.filter(f=>f.cidr).map(f=>f.cidr));
  [...t.segs.values()].forEach(sg=>{
    let cidr = sg.cidr;
    if (!cidr){
      let n; do { n = `10.${base}.${sg.vlan%250}.0/24`; base++; } while (used.has(n) && base<200);
      cidr = n; used.add(n);
    }
    const c = parseCidr(cidr); if (!c) return;
    const netBase = c.net;
    /* .1 은 게이트웨이(L3 장비) 몫으로 남긴다 */
    let host = 20;
    const taken = new Set(sg.ifs.filter(f=>f.ip!==null).map(f=>f.ip));
    const l3 = sg.ifs.filter(f=>{ const n=nodeById(f.nid); return n && canFwd(n); });
    l3.forEach((f,i)=>{
      const n = nodeById(f.nid);
      if (f.ip!==null) return;
      const ip = (netBase + 1 + i)>>>0;
      if (f.svi){ return; }
      const e = f.eid && edgeById(f.eid);
      if (e) endProps(e, n.id).ip = intToIp(ip)+'/'+c.bits;
      else n.p.ip = intToIp(ip)+'/'+c.bits;
      taken.add(ip); assigned++;
    });
    sg.ifs.forEach(f=>{
      const n = nodeById(f.nid); if (!n || canFwd(n)) return;
      if (f.ip!==null) return;
      let ip; do { ip = (netBase + host++)>>>0; } while (taken.has(ip) && host<250);
      taken.add(ip);
      n.p.ip = intToIp(ip)+'/'+c.bits;
      const gwIf = sg.ifs.find(x=>{ const m=nodeById(x.nid); return m && canFwd(m); });
      const gwNode = gwIf && nodeById(gwIf.nid);
      n.p.gw = gwNode && bareIp(gwNode.p.vip) && inNet(ipToInt(bareIp(gwNode.p.vip)), c.net, c.bits)
        ? bareIp(gwNode.p.vip)
        : (gwIf && gwIf.str) ? gwIf.str : intToIp((netBase+1)>>>0);
      assigned++;
    });
  });
  return assigned;
}
