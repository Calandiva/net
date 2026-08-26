/* ═══════════════════════════════════════════════════════════════════════════
   70-generator.js — 레퍼런스 아키텍처 무작위 생성 · IP 자동할당 · 정책 자동생성

   매번 새 "스펙"을 굴려 규모·구성요소·연결 방식을 실제로 다르게 만들고,
   조립한 뒤 검증을 돌려 통과할 때까지 다시 굴린다 (generate → validate → retry).
   낮은 확률로 극단적인 형태(다단 방화벽 10 단 + 서버 1 대 같은)도 나온다.
   ═══════════════════════════════════════════════════════════════════════════ */

const rnd  = a => a[Math.floor(Math.random()*a.length)];
const rint = (a,b) => a + Math.floor(Math.random()*(b-a+1));
const pick = p => Math.random() < p;

const SITES = ['서울','판교','대전','부산','과천','성남','인천','대구','광주','세종','용인','청주','일산','창원'];
const ROLES = ['본사','데이터센터','지역센터','제2센터','DR 센터','업무망','대외계','포털','연구망','물류센터'];

/* 규모별 대수 범위 */
const SCALE = {
  xs: { label:'소규모',   web:[0,1], was:[1,2], db:[1,1], user:[1,1], sw:1 },
  s:  { label:'중소',     web:[1,2], was:[1,3], db:[1,2], user:[1,2], sw:2 },
  m:  { label:'중규모',   web:[2,3], was:[2,4], db:[2,2], user:[1,2], sw:2 },
  l:  { label:'대규모',   web:[2,4], was:[3,5], db:[2,3], user:[2,3], sw:2 },
  xl: { label:'초대규모', web:[3,6], was:[4,7], db:[2,3], user:[2,4], sw:2 }
};

/* 이름 있는 프로파일 — 고정 골격이 아니라 "치우친 주사위" */
const PROFILES = [
  { key:'dmz3tier', name:'표준 3-Tier DMZ',
    desc:'인터넷 ─ 방화벽 ─ DMZ(LB·WEB) ─ 내부 방화벽 ─ 코어 ─ 앱 ─ DB. 규모와 부속 장비는 매번 달라집니다.',
    bias:{ size:['s','m','m','l'], dmz:1, lb:.95, fwStages:2, core:.9, k8s:0 } },
  { key:'finance',  name:'금융 / 공공형 다계층 보안망',
    desc:'DDoS · IPS · WAF · 망분리 관리망까지 두껍게. 방화벽 단수와 보안 장비 조합이 매번 달라집니다.',
    bias:{ size:['m','l','xl'], dmz:1, lb:.95, fwStages:[2,2,3,3,4], core:.95, ddos:.85, ips:.85,
           waf:.8, bastion:1, siem:1, nac:.5, k8s:0 } },
  { key:'collapsed',name:'중소규모 통합망',
    desc:'방화벽 한 쌍이 게이트웨이를 겸하는 납작한 구조. 서버 대수와 부속은 매번 달라집니다.',
    bias:{ size:['xs','s','s','m'], fwStages:1, core:.2, ddos:0, ips:.2, waf:.2, k8s:0 } },
  { key:'k8s',      name:'컨테이너 플랫폼',
    desc:'L7 로드밸런서 ─ Ingress ─ Worker 노드 ─ 분산 DB. 워커 수와 데이터 계층이 매번 달라집니다.',
    bias:{ size:['m','l','xl'], k8s:1, lb:1, dmz:.7, core:.85, cache:.9, nosql:.6 } },
  { key:'branch',   name:'본사 ─ 지사 WAN',
    desc:'전용회선과 VPN 으로 지사·재택을 묶는 구조. 지사망 수와 내부 구성이 매번 달라집니다.',
    bias:{ size:['s','m','m'], wan:1, vpn:.9, dmz:.6, core:.8, k8s:0 } },
  { key:'wild',     name:'무작위 (극단 포함)',
    desc:'제약 없이 굴립니다. 방화벽 10 단에 서버 1 대 같은 극단적인 형태도 낮은 확률로 나옵니다.',
    bias:{ wild:1 } }
];

/* ── 스펙 굴리기 ───────────────────────────────────────────────────────── */
function rollSpec(bias){
  const B = bias || {};
  const P = (k, d) => B[k]===undefined ? pick(d) : (B[k]===1 ? true : B[k]===0 ? false : pick(B[k]));
  const wild = B.wild===1 ? true : pick(.07);          // 극단 구성

  const size = B.size ? rnd(B.size)
             : wild ? rnd(['xs','xs','s','m','l','xl','xl'])
             : rnd(['xs','s','s','m','m','m','l','l','xl']);
  const N = SCALE[size];
  const k8s = B.k8s===0 ? false : (B.k8s===1 ? true : pick(.22));
  const dmz = P('dmz', .82);

  /* 방화벽 단수 — 보통 1~2 단, 극단이면 최대 10 단 */
  let fwStages;
  if (Array.isArray(B.fwStages)) fwStages = rnd(B.fwStages);
  else if (typeof B.fwStages === 'number') fwStages = B.fwStages;
  else if (wild) fwStages = rnd([1,2,3,4,5,6,7,8,9,10]);
  else fwStages = pick(.6) ? 2 : 1;
  if (!dmz && fwStages > 1 && !wild) fwStages = 1;

  const s = {
    wild, size, scaleLabel:N.label, site:rnd(SITES), role:rnd(ROLES),
    fwStages,
    fwHa: fwStages > 2 ? 1 : (pick(.85) ? 2 : 1),      // 다단 체인은 단일기로
    ddos:  P('ddos', wild ? .5 : .3),
    ips:   P('ips',  wild ? .6 : .45),
    waf:   dmz && P('waf', wild ? .6 : .45),
    dmz,   dmzSw: dmz ? (N.sw>1 && pick(.85) ? 2 : 1) : 0,
    srvSw: N.sw>1 && pick(.9) ? 2 : 1,
    core:  P('core', .68),
    coreHa: pick(.85) ? 2 : 1,
    fhrp:  rnd(['vrrp','vrrp','hsrp','glbp']),
    dualHome: pick(.75),
    stp:   rnd(['rstp','rstp','mstp','pvst']),
    lb: dmz && P('lb', .85),
    lbCount: pick(.8) ? 2 : (pick(.6) ? 1 : rint(3,4)),
    lbMode: k8s ? 'l7' : rnd(['l4','l4','l7']),
    lbAlgo: rnd(['rr','rr','lc','wlc','observed','predictive','srchash','wrr','fastest']),
    lbPersist: rnd(['none','srcip','srcip','cookie','sslsid']),
    lbSsl: pick(.55),
    web: k8s ? 0 : rint(...N.web),
    was: k8s ? Math.max(2, rint(...N.was)) : rint(...N.was),
    k8s,
    proxy: P('proxy', .25), dns: dmz && P('dns', .35), mail: dmz && P('mail', .18),
    db: rint(...N.db),
    cache: P('cache', .5), nosql: P('nosql', .22),
    storage: P('storage', .45), backup: P('backup', .65),
    user: rint(...N.user),
    wan: P('wan', .25), vpn: P('vpn', .35), ad: P('ad', .3),
    bastion: P('bastion', .7), nms: P('nms', .65), siem: P('siem', .45), nac: P('nac', .15),
    mgmtVlan: pick(.8)
  };

  /* 극단 보정 — 한쪽으로 확 치우치게 */
  if (wild){
    const style = rnd(['fortress','bare','fanout','flat','tiny']);
    if (style==='fortress'){                 // 보안 장비만 잔뜩, 서버는 최소
      s.web = pick(.5) ? 0 : 1; s.was = 1; s.db = 1; s.user = 1;
      s.ddos = true; s.ips = true; s.waf = dmz; s.bastion = true; s.siem = true;
      s.cache = false; s.nosql = false;
      if (s.fwStages < 4) s.fwStages = rint(4,10);
      s.fwHa = 1;
    } else if (style==='bare'){              // 보안 장비 없이 서버만
      s.ddos = s.ips = s.waf = s.vpn = s.nac = false;
      s.fwStages = 1; s.web = rint(0,2); s.was = rint(3,7);
    } else if (style==='fanout'){            // 한 스위치에 서버 대량
      s.srvSw = 1; s.dmzSw = dmz ? 1 : 0; s.dualHome = false;
      s.was = rint(5,8); s.web = dmz ? rint(3,6) : 0; s.user = rint(2,4);
    } else if (style==='flat'){              // 코어 없이 완전 평면
      s.core = false; s.dmz = pick(.4); s.lb = s.dmz && pick(.5);
      s.was = rint(1,4);
    } else {                                  // tiny — 정말 작은 망
      s.dmz = pick(.3); s.lb = false; s.core = false; s.srvSw = 1;
      s.web = 0; s.was = 1; s.db = 1; s.user = 1;
      s.cache = s.nosql = s.storage = s.nac = false;
      s.fwStages = pick(.5) ? 1 : 2; s.fwHa = 1;
    }
    if (!s.dmz){ s.waf = false; s.dns = false; s.mail = false; s.lb = s.lb && false; }
  }

  if (!s.dmz){ s.waf = false; s.dns = false; s.mail = false; s.dmzSw = 0; }
  if (!s.core) s.flat = true;
  if (s.lbMode==='l4' && s.lbPersist==='cookie') s.lbPersist = 'srcip';
  if (!s.web && !s.was) s.was = 1;
  if (!s.lb) s.lbCount = 0;
  return s;
}

/* ── 주소 계획 ─────────────────────────────────────────────────────────── */
function rollNet(s){
  const a = rint(10,250), ext = rnd(['203.0.113','198.51.100','192.0.2']);
  const V = { core:1, dmz:rint(10,19), app:rint(20,29), db:rint(30,39),
              user:rint(40,49), mgmt:rint(90,99), wan:rint(50,59) };
  const N = {
    ext, dmz:`172.${rnd([16,17,18,20,21])}.${rint(1,60)}`,
    core:`10.${a}.1`, app:`10.${a}.${V.app%250}`, db:`10.${a}.${V.db%250}`,
    user:`10.${a}.${V.user%250}`, mgmt:`10.${a}.${V.mgmt%250}`,
    wan:`10.${a}.${V.wan%250}`, flat:`10.${a}.10`, a
  };
  if (s.flat){
    V.app = V.db = V.user = V.mgmt = V.core;
    N.app = N.db = N.user = N.mgmt = N.flat;
  }
  return { N, V };
}

/* ═══ 진입점 — 만들고 검증하고, 안 되면 다시 굴린다 ═══ */
function genRandom(profileKey){
  const prof = profileKey ? PROFILES.find(p=>p.key===profileKey) : null;
  let best = null, bestScore = 1e9;
  for (let attempt=0; attempt<16; attempt++){
    let doc;
    try { doc = assemble(rollSpec(prof ? prof.bias : null), prof); }
    catch(err){ console.warn('조립 실패', err); continue; }
    const prev = S; S = doc;
    let errs = 99, fails = 99;
    try {
      const res = validateAll();
      errs  = res.issues.filter(i=>i.lv==='e').length;
      fails = res.flows.filter(f=>!f.r.ok).length;
    } catch(err){ console.warn('검증 실패', err); }
    S = prev;
    const score = fails*10 + errs;
    if (score < bestScore){ bestScore = score; best = doc; }
    if (score === 0) return doc;
  }
  return best || blankDoc();
}

function assemble(s, prof){
  const { N, V } = rollNet(s);
  const doc = blankDoc();
  const tag = s.wild ? '특수' : (prof ? prof.name : SCALE[s.size].label);
  doc.t = `${s.site} ${s.role} — ${tag} 구성`;
  const prev = S; S = doc;
  try { wireAll(s, N, V); } finally { }
  const built = S; S = prev;
  return built;
}

/* ── 조립 ──────────────────────────────────────────────────────────────── */
function wireAll(s, N, V){
  const LAT = 150, DEP = 106, X0 = 640, Y0 = 70;
  const at = (tier, lane) => ({ x:snap(X0 + lane*LAT), y:snap(Y0 + tier*DEP) });
  const mk = (ty, tier, lane, p) => { const q = at(tier, lane); return addNode(ty, q.x, q.y, p); };
  const CU='cu', FO='fo', FC='fc', HB='hb', WANK='wan';
  const SPINE=0, DMZLANE=-3.0, DATA=0.2, SIDE=3.0, MGMT=5.0, USER=-3.1;

  const group = (ty, count, tier, laneCenter, spread, propsFn) => {
    const out = [];
    for (let i=0;i<count;i++)
      out.push(mk(ty, tier, laneCenter + (i-(count-1)/2)*spread, propsFn(i+1, count)));
    return out;
  };
  const peerLink = (arr, kind) => {
    for (let i=1;i<arr.length;i++){
      const e = addEdge(arr[i-1].id, arr[i].id, kind||HB);
      if (e){ endProps(e, arr[i-1].id).port='r'; endProps(e, arr[i].id).port='l'; }
    }
  };
  const haPair = arr => {
    if (arr.length===2){ arr[0].p.peer = arr[1].id; arr[1].p.peer = arr[0].id; }
    arr.forEach((n,i)=>n.p.prio = 110 - i*10);
  };
  /* A 를 B 에 연결. dualHome 이면 교차 결선 */
  const wire = (A, B, kind, epFn) => A.forEach((a,ai)=>{
    (s.dualHome ? B : [B[ai % B.length]]).forEach(b=>{
      const e = addEdge(a.id, b.id, kind);
      if (e && epFn) Object.assign(endProps(e, a.id), epFn(ai));
    });
  });

  let tier = 0;
  const swModel = rnd(T.l2sw.models);

  /* ── 외부 ── */
  const inet = mk('internet', tier, SPINE, { name:'INTERNET', ip:N.ext+'.1/29', zone:'untrust' });
  let up = [inet];
  tier += 1.15;

  if (s.ddos){
    const dd = mk('ddos', tier, SPINE, { name:'DDoS-01', model:rnd(T.ddos.models), bypass:pick(.85),
      vlan:V.core, th:rnd(['1Gbps / 100kpps','2Gbps / 200kpps','10Gbps / 1Mpps','40Gbps / 4Mpps']),
      mip:N.mgmt+'.15/24' });
    up.forEach(u=>addEdge(u.id, dd.id, WANK));
    up = [dd]; tier += 1.05;
  }

  /* ── 방화벽 체인 (1 ~ 10 단) ── */
  const dmzGwIp   = N.dmz+'.1';
  const insideNet = s.flat ? N.flat : N.core;
  const transitOf = k => `10.${N.a}.${200+k}`;      // 단 사이 전용 대역
  const stages = [];
  let dsw = [];

  for (let k=1; k<=s.fwStages; k++){
    const last  = (k === s.fwStages);
    const model = rnd(T.fw.models);
    const grp = group('fw', s.fwHa, tier, SPINE, 1.3, i=>({
      name: s.fwStages===1 ? 'FW-0'+i : (k===1 ? 'FW-EXT-0'+i : last ? 'FW-INT-0'+i : `FW-${k}단-0${i}`),
      model, mode:'route', ha:s.fwHa>1?'as':'none', preempt:false, sess:true, log:true, rules:[] }));
    haPair(grp); peerLink(grp);

    /* 상단 연결 */
    if (k===1){
      grp.forEach(f=>up.forEach(u=>{ const e = addEdge(u.id, f.id, WANK);
        if (e) Object.assign(endProps(e, f.id), { ip:N.ext+'.2/29', zone:'untrust' }); }));
      grp.forEach(f=>f.p.defgw = N.ext+'.1');
    } else {
      const prev = stages[k-2];
      const tr = transitOf(k-1);
      if (s.dmz && k===2 && dsw.length){
        grp.forEach(f=>dsw.forEach(d=>{ const e = addEdge(d.id, f.id, FO);
          if (e) Object.assign(endProps(e, f.id), { ip:N.dmz+'.4/24', zone:'dmz', vlan:V.dmz }); }));
        grp.forEach(f=>f.p.defgw = dmzGwIp);
      } else {
        prev.forEach(pf=>grp.forEach(f=>{
          const e = addEdge(pf.id, f.id, FO);
          if (e){ Object.assign(endProps(e, pf.id), { ip:tr+'.1/30', zone:'z'+(k-1) });
                  Object.assign(endProps(e, f.id),  { ip:tr+'.2/30', zone:'z'+(k-1) }); }
        }));
        grp.forEach(f=>f.p.defgw = tr+'.1');
      }
    }
    stages.push(grp);
    tier += 1.2;

    /* 1 단 뒤에 IPS + DMZ 스위치 */
    if (k===1 && s.dmz){
      let feed = grp;
      if (s.ips){
        const ips = mk('ips', tier, SPINE, { name:'IPS-01', model:rnd(T.ips.models),
          dep:pick(.85)?'inline':'tap', act:rnd(['block','block','detect']), bypass:pick(.85),
          vlan:V.dmz, mip:N.mgmt+'.14/24' });
        grp.forEach(f=>{ const e = addEdge(f.id, ips.id, FO);
          if (e) Object.assign(endProps(e, f.id), { ip:dmzGwIp+'/24', zone:'dmz', vlan:V.dmz }); });
        feed = [ips]; tier += 1.05;
      }
      dsw = group('l2sw', s.dmzSw, tier, SPINE, 1.3, i=>({
        name:'L2SW-DMZ-0'+i, model:swModel, vlan:V.dmz, trunk:String(V.dmz),
        stp:s.stp, lacp:s.dmzSw>1, mip:N.mgmt+'.'+(10+i)+'/24' }));
      peerLink(dsw, FO);
      if (feed === grp){
        grp.forEach(f=>dsw.forEach(d=>{ const e = addEdge(f.id, d.id, FO);
          if (e) Object.assign(endProps(e, f.id), { ip:dmzGwIp+'/24', zone:'dmz', vlan:V.dmz }); }));
      } else feed.forEach(x=>dsw.forEach(d=>addEdge(x.id, d.id, FO)));
      tier += 1.2;
    } else if (k===1 && !s.dmz && s.ips){
      const ips = mk('ips', tier, SPINE, { name:'IPS-01', model:rnd(T.ips.models),
        dep:'inline', act:'block', bypass:true, vlan:V.core, mip:N.mgmt+'.14/24' });
      grp.forEach(f=>addEdge(f.id, ips.id, FO));
      tier += 1.05;
    }
  }
  const fwe = stages[0], fwLast = stages[stages.length-1];

  /* ── DMZ 서비스 ── */
  const VIP = N.dmz+'.100';
  const dmzHostGw = (s.fwStages>1 && s.dmz) ? N.dmz+'.4' : dmzGwIp;
  let lbs = [], webs = [], waf = null;
  let svcTier = s.dmz ? tier : tier;

  if (s.dmz && s.lb){
    const lbModel = rnd(T.lb.models);
    lbs = group('lb', Math.max(1, s.lbCount), svcTier, DMZLANE, 1.15, i=>({
      name:'LB-0'+i, model:lbModel, mode:s.lbMode,
      ip:N.dmz+'.'+(10+i)+'/24', gw:dmzGwIp, defgw:dmzGwIp, vlan:V.dmz, zone:'dmz',
      vip:VIP, vport:'443,80', algo:s.lbAlgo, persist:s.lbPersist,
      mon:rnd(['tcp','http','http','https']), monint:rnd([3,5,10]), monretry:rint(2,4),
      snat:true, ssl:s.lbSsl, ha:s.lbCount>2?'clu':(s.lbCount===2?'as':'none'), preempt:true, sess:true }));
    haPair(lbs);
    if (s.lbCount!==2) lbs.forEach(l=>l.p.peer='');
    lbs.forEach(l=>dsw.forEach(d=>addEdge(d.id, l.id, FO)));
    peerLink(lbs);
    svcTier += 1.15;
  }
  if (s.waf){
    waf = mk('waf', svcTier, DMZLANE, { name:'WAF-01', model:rnd(T.waf.models),
      dep:'bridge', act:rnd(['block','block','detect']), bypass:true,
      zone:'dmz', ip:N.dmz+'.9/24', gw:dmzHostGw, vlan:V.dmz });
    dsw.forEach(d=>addEdge(d.id, waf.id, FO));
    svcTier += 1.1;
  }
  if (s.dmz && s.web){
    const webModel = rnd(T.web.models), os = rnd(['rhel','rhel','ubuntu','win']);
    webs = group('web', s.web, svcTier, DMZLANE, 0.95, i=>({
      name:'WEB-0'+i, model:webModel, os,
      ip:N.dmz+'.'+(20+i)+'/24', gw:dmzHostGw, vlan:V.dmz, zone:'dmz',
      svc:'80,443,22', health:'/healthz', ha:s.web>1?'aa':'none' }));
    webs.forEach(w=>{ if (waf) addEdge(waf.id, w.id, FO); else dsw.forEach(d=>addEdge(d.id, w.id, CU)); });
    if (webs.length>1){ webs[0].p.peer = webs[1].id; webs[1].p.peer = webs[0].id; }
    if (lbs.length) lbs.forEach(l=>l.p.pool = webs.map(w=>w.id));
    svcTier += 1.2;
  }
  if (s.dns){
    const d = mk('dns', svcTier, DMZLANE-1.7, { name:'DNS-01', model:rnd(T.dns.models),
      ip:N.dmz+'.31/24', gw:dmzHostGw, vlan:V.dmz, zone:'dmz', svc:'53', ha:'none' });
    dsw.forEach(x=>addEdge(x.id, d.id, CU));
  }
  if (s.mail){
    const m = mk('mail', svcTier+1.0, DMZLANE-1.7, { name:'MAIL-01', model:rnd(T.mail.models),
      ip:N.dmz+'.32/24', gw:dmzHostGw, vlan:V.dmz, zone:'dmz', svc:'25,587,993' });
    dsw.forEach(x=>addEdge(x.id, m.id, CU));
  }
  tier = Math.max(tier, s.dmz ? svcTier - 1.0 : tier);

  /* ── 서버 액세스 스위치 ── */
  const trunkList = s.flat ? String(V.core) : [V.core,V.app,V.db,V.user,V.mgmt].join(',');
  const ssw = group('l2sw', s.srvSw, tier, SPINE, 1.3, i=>({
    name:'L2SW-SRV-0'+i, model:swModel, vlan:V.core, trunk:trunkList,
    stp:s.stp, lacp:s.srvSw>1, mip:N.mgmt+'.'+(12+i)+'/24' }));
  peerLink(ssw, FO);
  fwLast.forEach(f=>ssw.forEach(x=>{ const e = addEdge(f.id, x.id, FO);
    if (e) Object.assign(endProps(e, f.id), { ip:insideNet+'.1/24', zone:'trust', vlan:V.core }); }));
  tier += 1.25;

  /* ── 코어 L3 ── */
  let l3 = [];
  const coreVip = N.core+'.10';
  if (s.core && !s.flat){
    const l3Model = rnd(T.l3sw.models);
    l3 = group('l3sw', s.coreHa, tier, SPINE, 1.3, i=>({
      name:'L3SW-CORE-0'+i, model:l3Model, proto:rnd(['static','static','ospf']), stp:s.stp,
      mlag:s.coreHa>1, fhrp:s.fhrp, zone:'trust', prio:120-(i-1)*10, preempt:true,
      ha:s.coreHa>1?'aa':'none', vip:s.coreHa>1 ? coreVip : '', defgw:insideNet+'.1',
      vlans:[
        `${V.app} SVI ${N.app}.1${i}/24 trust vip ${N.app}.1`,
        `${V.db} SVI ${N.db}.1${i}/24 trust vip ${N.db}.1`,
        `${V.user} SVI ${N.user}.1${i}/24 trust vip ${N.user}.1`,
        `${V.mgmt} SVI ${N.mgmt}.1${i}/24 mgmt vip ${N.mgmt}.1`
      ].join('\n') }));
    l3.forEach((sw,i)=>ssw.forEach(x=>{ const e = addEdge(x.id, sw.id, FO);
      if (e) Object.assign(endProps(e, sw.id), { ip:N.core+'.1'+(i+1)+'/24', zone:'trust', vlan:V.core }); }));
    if (l3.length===2){
      l3[0].p.peer = l3[1].id; l3[1].p.peer = l3[0].id;
      const e = addEdge(l3[0].id, l3[1].id, FO);
      if (e){ Object.assign(endProps(e,l3[0].id), { ip:N.core+'.253/30', zone:'trust', vlan:4094, port:'r' });
              Object.assign(endProps(e,l3[1].id), { ip:N.core+'.254/30', zone:'trust', vlan:4094, port:'l' }); }
    }
    tier += 1.25;
  }

  const appGw   = s.flat ? insideNet+'.1' : N.app+'.1';
  const dbGw    = s.flat ? insideNet+'.1' : N.db+'.1';
  const userGw  = s.flat ? insideNet+'.1' : N.user+'.1';
  const mgmtOwn = (!s.flat && s.core);
  const mgmtNet = mgmtOwn ? N.mgmt : insideNet;
  const mgmtGw  = mgmtOwn ? N.mgmt+'.1' : insideNet+'.1';
  const appVlan = s.flat ? V.core : V.app;
  const dbVlan  = s.flat ? V.core : V.db;
  const userVlan= s.flat ? V.core : V.user;
  const mgmtVln = mgmtOwn ? V.mgmt : V.core;

  /* ── 라우팅 ── */
  const downHopOf = k => {                       // k 단 방화벽이 안쪽으로 보낼 넥스트홉
    if (k < s.fwStages) return (s.dmz && k===1) ? N.dmz+'.4' : transitOf(k)+'.2';
    return (s.core && !s.flat) ? (s.coreHa>1 ? coreVip : N.core+'.11') : null;
  };
  stages.forEach((grp,i)=>{
    const nh = downHopOf(i+1);
    /* 내부 대역만 아래로 보낸다. DMZ(172.16/12)는 1·2단에 직접 붙어 있고,
       그보다 아래 단에서는 기본 경로로 위쪽에 도달하므로 정적 경로를 주면 루프가 된다. */
    grp.forEach(f=>{ f.p.routes = nh ? `10.0.0.0/8 via ${nh}` : ''; });
  });
  if (s.core && !s.flat) l3.forEach(x=>x.p.defgw = insideNet+'.1');
  fwe.forEach(f=>{
    const target = lbs.length ? VIP : (webs[0] ? bareIp(webs[0].p.ip) : '');
    f.p.nat = [
      target ? { kind:'dnat', s:'any', d:N.ext+'.2', sv:'443', ti:target, tp:'443' } : null,
      { kind:'snat', s:'10.0.0.0/8 172.16.0.0/12', d:'any', sv:'any', ti:N.ext+'.2' }
    ].filter(Boolean);
  });

  /* ── 애플리케이션 ── */
  const appTier = tier;
  let apps = [];
  if (s.k8s){
    const m = rnd(T.k8s.models), cni = rnd(['calico','cilium','flannel','ovn']);
    apps = group('k8s', s.was, appTier, DATA, 0.95, i=>({
      name:'K8S-WK-0'+i, model:m, role:'worker', cni,
      ip:N.app+'.'+(20+i)+'/24', gw:appGw, vlan:appVlan, zone:'trust',
      svc:'30080,30443,6443,22', pods:`10.244.${i}.0/24`, ha:'clu' }));
  } else {
    const m = rnd(T.was.models), os = rnd(['rhel','rhel','ubuntu','aix','win']);
    apps = group('was', Math.max(1,s.was), appTier, DATA, 0.95, i=>({
      name:'WAS-0'+i, model:m, os,
      ip:N.app+'.'+(20+i)+'/24', gw:appGw, vlan:appVlan, zone:'trust',
      svc:'8080,8443,22', health:'/actuator/health', sessrep:pick(.5),
      ha:s.was>1?'aa':'none' }));
  }
  apps.forEach(a=>ssw.forEach(x=>addEdge(x.id, a.id, CU)));
  if (apps.length>1 && !s.k8s){ apps[0].p.peer = apps[1].id; apps[1].p.peer = apps[0].id; }
  if (webs.length && apps.length) webs.forEach(w=>w.p.up = apps[0].id);
  if (lbs.length && !webs.length && apps.length) lbs.forEach(l=>l.p.pool = apps.map(a=>a.id));
  tier += 1.3;

  /* ── 데이터 ── */
  const dbSet = s.k8s
    ? rnd([{eng:'pgsql',dbha:'patroni',sync:'sync',model:'PostgreSQL 16',port:'5432',store:0},
           {eng:'mysql',dbha:'group', sync:'sync',model:'MySQL 8.4',    port:'3306',store:0}])
    : rnd([
        { eng:'oracle', dbha:'rac',      sync:'sync', model:'Oracle DB 19c on RHEL', port:'1521', store:1 },
        { eng:'oracle', dbha:'dg',       sync:rnd(['sync','async']), model:'Oracle Exadata X10', port:'1521', store:1 },
        { eng:'mssql',  dbha:'alwayson', sync:rnd(['sync','async']), model:'SQL Server 2022', port:'1433', store:0 },
        { eng:'mssql',  dbha:'fci',      sync:'sync', model:'SQL Server 2022', port:'1433', store:1 },
        { eng:'mysql',  dbha:'semisync', sync:'semi', model:'MySQL 8.4',  port:'3306', store:0 },
        { eng:'mariadb',dbha:'async',    sync:'async',model:'MariaDB 11',  port:'3306', store:0 },
        { eng:'tibero', dbha:'tac',      sync:'sync', model:'Tibero 7',    port:'8629', store:1 },
        { eng:'pgsql',  dbha:'stream',   sync:rnd(['sync','async']), model:'PostgreSQL 16', port:'5432', store:0 },
        { eng:'pgsql',  dbha:'patroni',  sync:'sync', model:'PostgreSQL 16', port:'5432', store:0 }
      ]);
  const SCAN = N.db+'.100';
  const dbs = group('rdb', Math.max(1,s.db), tier, DATA, 1.05, i=>({
    name:'DB-0'+i, eng:dbSet.eng, model:dbSet.model,
    ip:N.db+'.'+(40+i)+'/24', gw:dbGw, vlan:dbVlan, zone:'trust',
    svc:dbSet.port+',22', dbha:s.db>1?dbSet.dbha:'none', sync:dbSet.sync,
    vip:s.db>1?SCAN:'', role:i===1?'pri':(['rac','tac'].includes(dbSet.dbha)?'both':'sec'),
    ha:s.db>1 ? (['rac','tac','group','patroni'].includes(dbSet.dbha)?'aa':'as') : 'none',
    prio:110-(i-1)*10 }));
  if (dbs.length>1){ dbs[0].p.peer = dbs[1].id; dbs[1].p.peer = dbs[0].id; }
  dbs.forEach(d=>ssw.forEach(x=>addEdge(x.id, d.id, CU)));
  peerLink(dbs);
  if (apps.length) apps.forEach(a=>a.p.up = dbs[0].id);
  tier += 1.3;

  if (s.storage || dbSet.store){
    const proto = rnd(['fc','fc','iscsi','nfs']);
    const stg = mk('storage', tier, DATA, { name:'STG-01', model:rnd(T.storage.models), proto,
      raid:rnd(['6','10','dp','5']), cap:rnd(['40TB','60TB','120TB','240TB','480TB']),
      mpio:true, ha:'aa', svc:proto==='nfs'?'2049':'3260',
      ip:mgmtNet+'.70/24', gw:mgmtGw, vlan:mgmtVln, zone:mgmtOwn?'mgmt':'trust' });
    dbs.forEach(d=>{ addEdge(d.id, stg.id, proto==='fc'?FC:CU); d.p.store = stg.id; });
    ssw.forEach(x=>addEdge(x.id, stg.id, CU));
    tier += 1.2;
  }

  /* ── 옆 라인 ── */
  let sideT = appTier;
  if (s.cache){
    const ch = group('cache', pick(.8)?2:1, sideT, SIDE, 0.95, i=>({
      name:'REDIS-0'+i, model:rnd(T.cache.models), ip:N.app+'.'+(50+i)+'/24', gw:appGw,
      vlan:appVlan, zone:'trust', svc:'6379', ha:'as', prio:110-(i-1)*10,
      vip:N.app+'.149', persist:pick(.6) }));
    haPair(ch);
    if (ch.length<2) ch.forEach(c=>{ c.p.ha='none'; c.p.vip=''; });
    ch.forEach(c=>ssw.forEach(x=>addEdge(x.id, c.id, CU)));
    peerLink(ch);
    sideT += 1.2;
  }
  if (s.nosql){
    const cnt = rint(3,5);
    const ns = group('nosql', cnt, sideT, SIDE, 0.85, i=>({
      name:'NOSQL-0'+i, model:rnd(T.nosql.models), ip:N.db+'.'+(60+i)+'/24', gw:dbGw,
      vlan:dbVlan, zone:'trust', svc:'27017', repl:cnt, ha:'clu' }));
    ns.forEach(x=>ssw.forEach(y=>addEdge(y.id, x.id, CU)));
    sideT += 1.2;
  }
  if (s.proxy){
    const px = mk('proxy', sideT, SIDE, { name:'PROXY-01', model:rnd(T.proxy.models),
      dir:'fwd', ip:mgmtNet+'.71/24', gw:mgmtGw, vlan:mgmtVln, zone:mgmtOwn?'mgmt':'trust', svc:'3128,8080' });
    ssw.forEach(x=>addEdge(x.id, px.id, CU));
    sideT += 1.1;
  }
  if (s.ad){
    const ad = mk('ad', sideT, SIDE, { name:'AD-01', model:rnd(T.ad.models),
      ip:mgmtNet+'.72/24', gw:mgmtGw, vlan:mgmtVln, zone:mgmtOwn?'mgmt':'trust', svc:'389,636,88', ha:'none' });
    ssw.forEach(x=>addEdge(x.id, ad.id, CU));
    sideT += 1.1;
  }
  if (s.vpn){
    const vp = mk('vpn', sideT, SIDE, { name:'VPN-01', model:rnd(T.vpn.models),
      kind:rnd(['ssl','ipsec','l2tp']), pool:`172.30.${rint(1,40)}.0/24`,
      defgw:insideNet+'.1', zone:'vpn' });
    ssw.forEach(x=>{ const e = addEdge(vp.id, x.id, FO);
      if (e) Object.assign(endProps(e, vp.id), { ip:insideNet+'.'+rint(230,245)+'/24', zone:'vpn', vlan:V.core }); });
  }

  /* ── 사용자망 ── */
  const users = [];
  for (let i=1;i<=Math.max(1,s.user);i++){
    const u = mk('client', appTier + (i-1)*1.05, USER, {
      name: s.user>1 ? 'USER-LAN-0'+i : 'USER-LAN',
      model: rnd(['사무실 PC 대역','업무용 단말','콜센터 단말','현장 단말','임원/개발망','교육장 단말']),
      ip:N.user+'.'+(150+i*5)+'/24', gw:userGw, vlan:userVlan, zone:'trust', cnt:rint(20,600) });
    ssw.forEach(x=>addEdge(x.id, u.id, CU));
    users.push(u);
  }
  if (s.nac){
    const nac = mk('nac', appTier + Math.max(1,s.user)*1.05, USER, { name:'NAC-01', model:rnd(T.nac.models),
      ip:mgmtNet+'.73/24', gw:mgmtGw, vlan:mgmtVln, zone:mgmtOwn?'mgmt':'trust',
      kind:rnd(['8021x','arp','agent']) });
    ssw.forEach(x=>addEdge(x.id, nac.id, CU));
  }

  /* ── WAN 지사 ── */
  if (s.wan){
    const w = mk('wan', 1.0, SPINE-3.4, { name:'WAN-지사망', model:rnd(T.wan.models),
      ip:N.wan+'.1/30', bw:rnd(['100Mbps','500Mbps','1Gbps','10Gbps']), zone:'wan' });
    const rt = group('router', pick(.6)?2:1, 2.2, SPINE-3.4, 1.25, i=>({
      name:'RT-WAN-0'+i, model:rnd(T.router.models), proto:rnd(['static','ospf','bgp']),
      defgw:N.wan+'.1', routes:`10.0.0.0/8 via ${insideNet}.1`, fhrp:s.fhrp,
      ha:'as', prio:110-(i-1)*10, preempt:true, vip:N.wan+'.10', zone:'wan' }));
    haPair(rt);
    if (rt.length<2) rt.forEach(r=>{ r.p.ha='none'; r.p.vip=''; });
    rt.forEach(r=>{ const e = addEdge(w.id, r.id, WANK);
      if (e) Object.assign(endProps(e, r.id), { ip:N.wan+'.2/30', zone:'wan' }); });
    peerLink(rt);
    rt.forEach((r,i)=>ssw.forEach(x=>{ const e = addEdge(r.id, x.id, FO);
      if (e) Object.assign(endProps(e, r.id), { ip:insideNet+'.'+(200+i)+'/24', zone:'trust', vlan:V.core }); }));
  }

  /* ── 관리망 ── */
  const mgmtList = [];
  if (s.bastion) mgmtList.push(['bastion','BAS-01', 81, { svc:'22,3389', mfa:pick(.9), rec:pick(.85) }]);
  if (s.nms)     mgmtList.push(['nms','NMS-01', 82, { svc:'161,443' }]);
  if (s.siem)    mgmtList.push(['siem','SIEM-01', 83, { svc:'514,9200', ret:rnd(['3개월','6개월','1년','3년']) }]);
  if (s.backup)  mgmtList.push(['backup','BKP-01', 84, {
    sched:rnd(['일 1회 전체','일 1회 전체 + 4시간 증분','주 1회 전체 + 일 증분']),
    rpo:rnd(['1시간','4시간','24시간']), offsite:pick(.5) }]);
  const mgmtNodes = mgmtList.map(([ty,name,host,extra],i)=>{
    const n = mk(ty, appTier + i*1.1, MGMT, Object.assign({
      name, model:rnd(T[ty].models), ip:mgmtNet+'.'+host+'/24', gw:mgmtGw,
      vlan:mgmtVln, zone:mgmtOwn?'mgmt':'trust' }, extra));
    ssw.forEach(x=>addEdge(x.id, n.id, CU));
    return n;
  });

  /* ── 검증 플로우 ── */
  S.f = [];
  const F = (n, src, dst, pt) => { if (!src || !dst) return;
    S.f.push({ id:'f'+(S.seq++), n, s:src.id, d:(typeof dst==='string'?dst:dst.id), pt, pr:'tcp', on:true }); };
  const entry = lbs.length ? VIP : (webs[0] || apps[0]);
  if (entry) F('인터넷 → 서비스 (DNAT)', inet, N.ext+'.2', 443);
  if (users[0] && entry) F('사용자망 → 서비스', users[0], entry, lbs.length||webs.length ? 443 : 8080);
  if (webs[0] && apps[0]) F('WEB → 앱 계층', webs[0], apps[0], parseInt(String(apps[0].p.svc).split(',')[0])||8080);
  if (apps[0] && dbs[0])  F('앱 → DB', apps[0], dbs[0], parseInt(dbSet.port));
  if (s.cache && apps[0]) F('앱 → 캐시', apps[0], N.app+'.149', 6379);
  if (mgmtNodes[0] && (apps[0]||dbs[0])) F('관리 접근 (SSH)', mgmtNodes[0], apps[0]||dbs[0], 22);
  if (users[0]) F('사용자망 → 인터넷', users[0], N.ext+'.1', 443);
  if (users[1] && dbs[0]) F('제2 사용자망 → DB', users[1], dbs[0], parseInt(dbSet.port));

  /* ── 정책 뼈대 + 자동 보정 ── */
  stages.forEach((grp,i)=>{
    const first = (i===0), last = (i===stages.length-1);
    grp.forEach(f=>{ f.p.rules = first ? [
      { sz:'untrust', dz:'any',   s:'any', d:'any', sv:'80,443',        act:'allow' },
      { sz:'any',     dz:'untrust', s:'any', d:'any', sv:'53,80,123,443', act:'allow' },
      { sz:'untrust', dz:'any',   s:'any', d:'any', sv:'any',           act:'deny'  }
    ] : last ? [
      { sz:'dmz',   dz:'trust', s:'any', d:'any', sv:'8080,8443',      act:'allow' },
      { sz:'trust', dz:'any',   s:'any', d:'any', sv:'53,80,443,8080', act:'allow' },
      { sz:'mgmt',  dz:'trust', s:'any', d:'any', sv:'22,3389,161',    act:'allow' },
      { sz:'trust', dz:'mgmt',  s:'any', d:'any', sv:'161,514,9200',   act:'allow' }
    ] : []; });
  });
  autoFwAll();
}

/* ── 방화벽 정책 자동 생성 ───────────────────────────────────────────────
   체인이 길면 차단은 "안쪽 방화벽부터" 발견된다. 방화벽별로 한 번씩 돌면
   바깥쪽 단은 차례가 지나 버리므로, 전체를 한 덩어리로 놓고 변화가 없을
   때까지 반복한다. */
function autoFwAll(maxRounds){
  const flows = () => (S.f||[]).filter(x=>x.on!==false);
  for (let round=0; round < (maxRounds||120); round++){
    const t = buildTopo();
    let changed = false;
    for (const f of flows()){
      const r = trace(t, f);
      if (r.ok) continue;
      const bad = r.hops.find(hp=>hp.k==='fail' && hp.sz && nodeById(hp.nid));
      if (!bad) continue;
      const fw = nodeById(bad.nid);
      if (!fw || fw.ty!=='fw') continue;
      fw.p.rules = Array.isArray(fw.p.rules) ? fw.p.rules : [];
      const nr = { sz:bad.sz, dz:bad.dz, s:'any', d:'any', sv:String(bad.port), act:'allow' };
      if (fw.p.rules.some(x=>x.sz===nr.sz && x.dz===nr.dz && x.sv===nr.sv && x.act==='allow')) continue;
      const denyAt = fw.p.rules.findIndex(x=>x.act==='deny');
      if (denyAt>=0) fw.p.rules.splice(denyAt, 0, nr); else fw.p.rules.push(nr);
      changed = true;
    }
    if (!changed) break;
  }
}
/* 인스펙터의 "경로 자동 허용" 버튼 — 이 방화벽만 손본다 */
function autoFwRules(fw){
  for (let round=0; round<40; round++){
    const t = buildTopo();
    let changed = false;
    for (const f of (S.f||[]).filter(x=>x.on!==false)){
      const r = trace(t, f);
      if (r.ok) continue;
      const bad = r.hops.find(hp=>hp.k==='fail' && hp.nid===fw.id && hp.sz);
      if (!bad) continue;
      fw.p.rules = Array.isArray(fw.p.rules) ? fw.p.rules : [];
      const nr = { sz:bad.sz, dz:bad.dz, s:'any', d:'any', sv:String(bad.port), act:'allow' };
      if (fw.p.rules.some(x=>x.sz===nr.sz && x.dz===nr.dz && x.sv===nr.sv && x.act==='allow')) continue;
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
    let host = 20;
    const taken = new Set(sg.ifs.filter(f=>f.ip!==null).map(f=>f.ip));
    const l3 = sg.ifs.filter(f=>{ const n=nodeById(f.nid); return n && canFwd(n); });
    l3.forEach((f,i)=>{
      const n = nodeById(f.nid);
      if (f.ip!==null || f.svi) return;
      const ip = (netBase + 1 + i)>>>0;
      const e = f.eid && edgeById(f.eid);
      if (e) endProps(e, n.id).ip = intToIp(ip)+'/'+c.bits;
      else n.p.ip = intToIp(ip)+'/'+c.bits;
      taken.add(ip); assigned++;
    });
    sg.ifs.forEach(f=>{
      const n = nodeById(f.nid); if (!n || canFwd(n) || f.ip!==null) return;
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
