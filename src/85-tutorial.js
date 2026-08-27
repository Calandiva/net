/* ═══════════════════════════════════════════════════════════════════════════
   85-tutorial.js — 100 단계 학습 과정
   장비 2~3대짜리 최소 구성에서 시작해 주소 · 라우팅 · 방화벽 · NAT · 부하분산 ·
   이중화 · 데이터 · 보안 · 종합 설계까지 단계별로 난이도를 올린다.
   각 과제는 목표 · 안내 · 힌트 · 채점 기준을 갖고, 채점하면 점수와 등급이 나온다.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── 채점 컨텍스트 ─────────────────────────────────────────────────────── */
function tctx(){
  const res = validateAll();
  const t = res.t;
  let spofCache = null;
  const N  = ty => S.n.filter(n=>n.ty===ty);
  const NA = tys => S.n.filter(n=>tys.includes(n.ty));
  const tr = (a,b,port) => (a&&b) ? trace(t, { s:a.id, d:b.id, pt:port||443, pr:'tcp' }) : { ok:false };
  return {
    t, res, issues:res.issues, flows:res.flows,
    err:  res.issues.filter(i=>i.lv==='e'),
    warn: res.issues.filter(i=>i.lv==='w'),
    N, NA, n1: ty=>N(ty)[0], cnt: ty=>N(ty).length, cntAny: tys=>NA(tys).length,
    hosts: () => S.n.filter(n=>T[n.ty].host && !isTrans(n) && n.ty!=='internet'),
    linked: (a,b) => !!(a&&b) && S.e.some(e=>(e.a===a.id&&e.b===b.id)||(e.b===a.id&&e.a===b.id)),
    linkedTy: (ta,tb) => N(ta).some(a=>N(tb).some(b=>S.e.some(e=>(e.a===a.id&&e.b===b.id)||(e.b===a.id&&e.a===b.id)))),
    tr,
    path: (a,b,port) => tr(a,b,port).ok,
    pathAny: (ta,tb,port) => N(ta).some(a=>N(tb).some(b=>tr(a,b,port).ok)),
    pathSome: (tas,tbs,port) => NA(tas).some(a=>NA(tbs).some(b=>a!==b && tr(a,b,port).ok)),
    segs: () => [...t.segs.values()],
    subnets: () => new Set([...t.segs.values()].map(s=>s.cidr).filter(Boolean)),
    vlans: () => new Set([...t.segs.values()].map(s=>s.vlan)),
    zones: () => new Set(t.ifs.map(f=>f.zone).filter(Boolean)),
    spof: () => (spofCache = spofCache || spofScan()),
    allFlows: () => res.flows.length>0 && res.flows.every(x=>x.r.ok),
    flowCount: () => res.flows.length,
    haPairs: () => t.haGroups,
    fwRules: () => N('fw').reduce((a,f)=>a.concat(f.p.rules||[]), []),
    nats: (kind) => N('fw').reduce((a,f)=>a.concat((f.p.nat||[]).filter(r=>!kind||r.kind===kind)), []),
    everyHas: (ty, fn) => N(ty).length>0 && N(ty).every(fn)
  };
}

/* ── 검사 만들기 ───────────────────────────────────────────────────────── */
const K = {
  has:   (ty, n) => ({ l:`${T[ty].n} ${n||1}대 이상 배치`, f:c=>c.cnt(ty) >= (n||1) }),
  hasAny:(tys, n, label) => ({ l:label || `${tys.map(t=>T[t].n).join(' 또는 ')} ${n||1}대 이상`, f:c=>c.cntAny(tys) >= (n||1) }),
  max:   (ty, n) => ({ l:`${T[ty].n} ${n}대 이하로 유지`, f:c=>c.cnt(ty) <= n }),
  maxNodes: n => ({ l:`전체 장비 ${n}대 이하`, f:()=>S.n.length <= n }),
  minNodes: n => ({ l:`전체 장비 ${n}대 이상`, f:()=>S.n.length >= n }),
  link:  (ta, tb) => ({ l:`${T[ta].n} ↔ ${T[tb].n} 연결`, f:c=>c.linkedTy(ta, tb) }),
  reach: (ta, tb, port, label) => ({ l:label || `${T[ta].n} → ${T[tb].n} ${port} 포트 통신`, f:c=>c.pathAny(ta, tb, port) }),
  reachAny: (tas, tbs, port, label) => ({ l:label, f:c=>c.pathSome(tas, tbs, port) }),
  ipAll: tys => ({ l:'모든 장비에 IP 설정', f:c=>{ const l=c.NA(tys); return l.length>0 && l.every(n=>bareIp(n.p.ip)); } }),
  gwAll: tys => ({ l:'모든 호스트에 게이트웨이 설정', f:c=>{ const l=c.NA(tys); return l.length>0 && l.every(n=>bareIp(n.p.gw)); } }),
  noErr: () => ({ l:'검증 오류 0건', f:c=>c.err.length===0 }),
  noWarn:() => ({ l:'검증 경고 0건', f:c=>c.warn.length===0 }),
  errBelow: n => ({ l:`검증 오류 ${n}건 미만`, f:c=>c.err.length < n }),
  allFlows: () => ({ l:'정의된 모든 플로우 통과', f:c=>c.allFlows() }),
  flowsAtLeast: n => ({ l:`검증 플로우 ${n}개 이상 정의`, f:c=>c.flowCount() >= n }),
  segs:  n => ({ l:`네트워크 구간 ${n}개 이상`, f:c=>c.segs().length >= n }),
  subnets: n => ({ l:`서로 다른 서브넷 ${n}개 이상`, f:c=>c.subnets().size >= n }),
  vlans: n => ({ l:`VLAN ${n}개 이상 사용`, f:c=>c.vlans().size >= n }),
  zones: n => ({ l:`보안존 ${n}개 이상 지정`, f:c=>c.zones().size >= n }),
  zoneNamed: z => ({ l:`"${z}" 존 사용`, f:c=>c.zones().has(z) }),
  fwRules: n => ({ l:`방화벽 정책 ${n}건 이상`, f:c=>c.fwRules().length >= n }),
  fwDeny: () => ({ l:'명시적 차단 규칙 1건 이상', f:c=>c.fwRules().some(r=>r.act==='deny') }),
  noAnyAny: () => ({ l:'any → any 전체 허용 규칙 없음',
    f:c=>!c.fwRules().some(r=>(r.act||'allow')==='allow' && (!r.s||r.s==='any') && (!r.d||r.d==='any') && (!r.sv||r.sv==='any')) }),
  nat: kind => ({ l:`${kind.toUpperCase()} 규칙 설정`, f:c=>c.nats(kind).length>0 }),
  lbVip: () => ({ l:'로드밸런서 VIP 설정', f:c=>c.everyHas('lb', n=>bareIp(n.p.vip)) }),
  lbPool: n => ({ l:`LB 풀 멤버 ${n}대 이상`, f:c=>c.N('lb').some(l=>(l.p.pool||[]).length>=n) }),
  lbAlgo: list => ({ l:`분산 알고리즘을 ${list.map(x=>ALGO_NAME[x].split(' (')[0]).join(' / ')} 중에서 선택`,
    f:c=>c.N('lb').some(l=>list.includes(l.p.algo)) }),
  lbPersist: () => ({ l:'세션 지속성 설정 (없음 이외)', f:c=>c.N('lb').some(l=>l.p.persist && l.p.persist!=='none') }),
  lbMon: () => ({ l:'헬스 모니터 설정', f:c=>c.N('lb').some(l=>l.p.mon && l.p.mon!=='none') }),
  lbSnat: () => ({ l:'SNAT AutoMap 켜기', f:c=>c.N('lb').some(l=>l.p.snat) }),
  lbMode: m => ({ l:`로드밸런서를 ${m.toUpperCase()} 모드로`, f:c=>c.N('lb').some(l=>l.p.mode===m) }),
  haPair: ty => ({ l:`${T[ty].n} 이중화 짝 구성`, f:c=>c.N(ty).some(n=>n.p.peer && nodeById(n.p.peer) && (n.p.ha||'none')!=='none') }),
  haVip: ty => ({ l:`${T[ty].n} 공유 VIP 설정`, f:c=>c.N(ty).some(n=>bareIp(n.p.vip)) }),
  fhrp: () => ({ l:'FHRP(VRRP/HSRP/GLBP) 선택', f:c=>c.NA(['l3sw','router']).some(n=>n.p.fhrp && n.p.fhrp!=='none') }),
  hbLink: () => ({ l:'HA 하트비트 링크 연결', f:()=>S.e.some(e=>e.k==='hb') }),
  dualHome: ty => ({ l:`${T[ty].n} 이중 결선(스위치 2대에 연결)`,
    f:c=>c.N(ty).some(n=>{ const sw=edgesOf(n.id).map(e=>nodeById(otherEnd(e,n.id))).filter(x=>x&&T[x.ty].sw);
      return new Set(sw.map(x=>x.id)).size >= 2; }) }),
  spofMax: n => ({ l:`단일 장애점 ${n}개 이하`, f:c=>c.spof().items.length <= n }),
  dbHa: list => ({ l:`DB 이중화를 ${list.map(x=>(O_DBHA.find(y=>y[0]===x)||[,x])[1].split(' (')[0]).join(' / ')} 로 설정`,
    f:c=>c.N('rdb').some(n=>list.includes(n.p.dbha)) }),
  dbSync: m => ({ l:`복제 모드 ${(O_SYNC.find(x=>x[0]===m)||[,m])[1]}`, f:c=>c.N('rdb').some(n=>n.p.sync===m) }),
  dbVip: () => ({ l:'DB 접속점(SCAN/AG/VIP) 설정', f:c=>c.N('rdb').some(n=>bareIp(n.p.vip)) }),
  dbStore: () => ({ l:'공유 스토리지 연결 지정', f:c=>c.N('rdb').some(n=>n.p.store && nodeById(n.p.store)) }),
  mpio: () => ({ l:'스토리지 멀티패스 켜기', f:c=>c.N('storage').some(n=>n.p.mpio) }),
  inline: (ty, dep) => ({ l:`${T[ty].n}를 ${dep==='inline'?'인라인':'브리지'}로 배치`,
    f:c=>c.N(ty).some(n=>n.p.dep===dep) }),
  bypass: ty => ({ l:`${T[ty].n} fail-open 바이패스 켜기`, f:c=>c.N(ty).some(n=>n.p.bypass) }),
  prop: (ty, key, label, test) => ({ l:label, f:c=>c.N(ty).some(n=>test(n.p[key], n)) }),
  custom: (label, fn) => ({ l:label, f:fn })
};

/* ── 시작 상태 만들기 ──────────────────────────────────────────────────── */
function emptyDoc(title){ const d = blankDoc(); d.t = title || '연습'; return d; }

/* 작은 구성 하나 조립: nodes=[[type, col, row, props]], links=[[i,j,kind]] */
function miniDoc(title, nodes, links, flows){
  const prev = S; const d = blankDoc(); d.t = title; S = d;
  const made = nodes.map(([ty,c,r,p])=>addNode(ty, snap(200+c*180), snap(140+r*130), p||{}));
  (links||[]).forEach(([i,j,k])=>addEdge(made[i].id, made[j].id, k));
  (flows||[]).forEach(([n,i,j,pt])=>S.f.push({ id:'f'+(S.seq++), n, s:made[i].id,
    d:(typeof j==='string'? j : made[j].id), pt, pr:'tcp', on:true }));
  S = prev; return d;
}
/* 정상 구성을 만든 뒤 일부러 망가뜨린다 */
function brokenDoc(profile, breaker, title){
  const prev = S;
  const d = genRandom(profile) || blankDoc();
  S = d;
  try { breaker(d); } catch(_){}
  if (title) d.t = title;
  S = prev; return d;
}
const pickN = (d, ty) => d.n.filter(n=>n.ty===ty);

/* ── 과제 목록 ─────────────────────────────────────────────────────────── */
const CHAPTERS = [
  { id:1,  n:'기초 — 잇고 통하게 하기' },
  { id:2,  n:'주소와 구간' },
  { id:3,  n:'라우팅' },
  { id:4,  n:'방화벽' },
  { id:5,  n:'NAT 와 경계망' },
  { id:6,  n:'부하분산' },
  { id:7,  n:'이중화' },
  { id:8,  n:'데이터 계층' },
  { id:9,  n:'보안 심화' },
  { id:10, n:'종합 설계' }
];

const LESSONS = [];
const L = (ch, title, goal, brief, hints, seed, checks, bonus) =>
  LESSONS.push({ id:LESSONS.length+1, ch, title, goal, brief, hints:hints||[], seed, checks, bonus:bonus||[] });

/* ═════ 1장 · 기초 ═════ */
L(1,'장비 한 대 놓기','웹 서버 1대를 배치하고 IP 를 준다',
  '캔버스를 더블클릭하거나 왼쪽 팔레트에서 "웹 서버"를 끌어다 놓으세요. 노드를 클릭하면 오른쪽 속성 탭이 열립니다. IP/CIDR 칸에 <code>192.168.10.11/24</code> 처럼 넣습니다.',
  ['캔버스 더블클릭 → "웹" 입력 → Enter','IP 는 반드시 /24 같은 프리픽스까지 적어야 구간이 잡힙니다'],
  ()=>emptyDoc('1. 장비 한 대 놓기'),
  [K.has('web'), K.ipAll(['web'])],
  [K.maxNodes(1)]);

L(1,'두 대를 직접 잇기','사용자망과 웹 서버를 케이블 한 가닥으로 연결한다',
  '두 장비를 놓고, 노드 가장자리의 <b>포트</b>에서 끌어 상대 장비에 놓으면 연결됩니다. 위 ▲는 업링크, 아래 ▼는 다운링크, 좌우 ◆는 같은 계층끼리입니다.',
  ['사용자망(단말) + 웹 서버','두 IP 는 같은 대역이어야 서로 보입니다'],
  ()=>emptyDoc('2. 두 대를 직접 잇기'),
  [K.has('client'), K.has('web'), K.link('client','web')],
  [K.noErr()]);

L(1,'같은 대역에서 통신시키기','사용자망 → 웹 서버 80 포트 통신을 성립시킨다',
  '같은 스위치(또는 직결)에 붙은 장비끼리는 <b>같은 서브넷</b>이어야 통신합니다. 서버는 그 포트를 열고 있어야 하고요. 서버 속성의 "수신 포트"를 확인하세요.',
  ['둘 다 192.168.10.0/24 안에 두세요','웹 서버 기본 수신 포트는 80,443 입니다'],
  ()=>emptyDoc('3. 같은 대역에서 통신'),
  [K.link('client','web'), K.reach('client','web',80)],
  [K.noErr()]);

L(1,'스위치로 잇기','L2 스위치를 사이에 두고 통신시킨다',
  'L2 스위치는 <b>투과 장비</b>입니다. 스위치에 붙은 장비들은 하나의 구간(브로드캐스트 도메인)이 됩니다. 스위치 자체에는 통신용 IP 가 필요 없습니다.',
  ['사용자망 ─ L2 스위치 ─ 웹 서버','스위치는 IP 없이도 동작합니다'],
  ()=>emptyDoc('4. 스위치로 잇기'),
  [K.has('l2sw'), K.link('client','l2sw'), K.link('l2sw','web'), K.reach('client','web',80)],
  [K.maxNodes(3)]);

L(1,'서버 두 대 붙이기','스위치 하나에 웹 서버 2대를 붙이고 둘 다 통신시킨다',
  '같은 스위치에 여러 대를 붙일 수 있습니다. IP 는 서로 달라야 하고(충돌 검사), 같은 대역이어야 합니다.',
  ['노드를 선택하고 Ctrl+D 로 복제하면 빠릅니다','복제 후 IP 를 반드시 바꾸세요'],
  ()=>emptyDoc('5. 서버 두 대'),
  [K.has('web',2), K.reach('client','web',80), K.noErr()],
  [K.custom('두 웹 서버가 모두 통신됨', c=>{ const cl=c.n1('client'); return cl && c.N('web').every(w=>c.path(cl,w,80)); })]);

L(1,'포트 열기','웹 서버가 8080 포트도 받도록 하고 통신을 확인한다',
  '서버 속성의 "수신 포트"에 <code>80,443,8080</code> 처럼 쉼표로 나열합니다. 열려 있지 않은 포트로 가면 "포트 미개방"으로 끊깁니다.',
  ['범위도 됩니다: 30000-32767'],
  ()=>emptyDoc('6. 포트 열기'),
  [K.reach('client','web',8080)],
  [K.reach('client','web',443)]);

L(1,'끊긴 이유 읽기','링크가 끊긴 구성을 고쳐 통신을 되살린다',
  '상단 <b>장애</b> 모드에서 링크를 클릭하면 절단됩니다. 지금 구성은 케이블 하나가 끊겨 있습니다. 검증 탭에서 원인을 읽고 복구하세요.',
  ['링크를 선택하고 속성 탭에서 "링크 복구"','또는 장애 모드에서 다시 클릭'],
  ()=>{ const d = miniDoc('7. 끊긴 이유 읽기',
    [['client',0,0,{name:'PC',ip:'192.168.10.50/24'}],
     ['l2sw',1,0,{name:'SW-01'}],
     ['web',2,0,{name:'WEB-01',ip:'192.168.10.11/24',svc:'80,443'}]],
    [[0,1],[1,2]], [['PC → WEB',0,2,80]]);
    d.e[1].down = true; return d; },
  [K.custom('끊긴 링크 없음', ()=>!S.e.some(e=>e.down)), K.allFlows()],
  []);

L(1,'IP 충돌 없애기','같은 주소를 쓰는 두 장비를 고친다',
  '한 구간에서 같은 IP 를 두 장비가 쓰면 실제 망에서는 통신이 불안정해집니다. 검증 탭에 <b>IP 충돌</b>로 표시됩니다.',
  ['검증 탭의 항목을 클릭하면 해당 장비로 이동합니다'],
  ()=>miniDoc('8. IP 충돌',
    [['client',0,0,{name:'PC',ip:'192.168.10.50/24',gw:'192.168.10.1'}],
     ['l2sw',1,0,{name:'SW-01'}],
     ['web',2,-0.6,{name:'WEB-01',ip:'192.168.10.11/24'}],
     ['web',2,0.6,{name:'WEB-02',ip:'192.168.10.11/24'}]],
    [[0,1],[1,2],[1,3]], [['PC → WEB-01',0,2,80]]),
  [K.custom('IP 충돌 없음', c=>!c.err.some(i=>i.t.startsWith('IP 충돌'))), K.allFlows()],
  []);

L(1,'대역 맞추기','서브넷이 어긋난 장비를 같은 구간으로 맞춘다',
  '같은 스위치에 붙었는데 대역이 다르면 서로 보이지 않습니다. 검증 탭에 <b>구간 서브넷 불일치</b>로 나옵니다.',
  ['한쪽 IP 를 다른 쪽 대역으로 바꾸세요'],
  ()=>miniDoc('9. 대역 맞추기',
    [['client',0,0,{name:'PC',ip:'192.168.10.50/24'}],
     ['l2sw',1,0,{name:'SW-01'}],
     ['web',2,0,{name:'WEB-01',ip:'10.0.0.11/24',svc:'80,443'}]],
    [[0,1],[1,2]], [['PC → WEB',0,2,80]]),
  [K.custom('서브넷 불일치 없음', c=>!c.err.some(i=>i.t.includes('서브넷 불일치'))), K.allFlows()],
  []);

L(1,'첫 구성도 완성','사용자망 · 스위치 · 웹 · WAS 를 잇고 두 경로 모두 통과시킨다',
  '웹 서버는 정적 화면을, WAS 는 프로그램을 처리합니다. 플로우 탭에서 <b>자동 생성</b>을 누르면 검증할 경로를 만들어 줍니다.',
  ['WAS 기본 포트는 8080,8443','플로우 탭 → 자동 생성 → 전체 실행'],
  ()=>emptyDoc('10. 첫 구성도'),
  [K.has('was'), K.reach('client','web',80), K.reach('web','was',8080), K.noErr()],
  [K.flowsAtLeast(2), K.allFlows()]);

/* ═════ 2장 · 주소와 구간 ═════ */
L(2,'구간 두 개 만들기','스위치 2대로 서로 다른 서브넷 2개를 만든다',
  '스위치를 서로 연결하지 않으면 각각 별개의 구간이 됩니다. 구간마다 다른 대역을 씁니다.',
  ['192.168.10.0/24 와 192.168.20.0/24'],
  ()=>emptyDoc('11. 구간 두 개'),
  [K.has('l2sw',2), K.subnets(2)],
  [K.noErr()]);

L(2,'VLAN 으로 나누기','스위치 한 대에서 VLAN 2개로 구간을 나눈다',
  '같은 스위치라도 포트의 <b>VLAN 이 다르면 다른 구간</b>입니다. 장비 속성의 VLAN 값을 다르게 주세요.',
  ['서버 VLAN 10, 사용자 VLAN 20','스위치의 허용 VLAN(트렁크)에도 적어 두면 좋습니다'],
  ()=>emptyDoc('12. VLAN 분리'),
  [K.has('l2sw',1), K.vlans(2), K.subnets(2)],
  [K.noErr()]);

L(2,'VLAN 세 개','업무 · 서버 · 관리 세 VLAN 을 만든다',
  '실제 망은 용도별로 VLAN 을 나눕니다. 업무(사용자), 서버, 관리(운영 장비) 정도가 기본입니다.',
  ['관리망에는 NMS 나 배스천을 두세요'],
  ()=>emptyDoc('13. VLAN 세 개'),
  [K.vlans(3), K.subnets(3)],
  [K.hasAny(['nms','siem','bastion'],1,'관리 장비 배치')]);

L(2,'게이트웨이 대역 오류','자기 서브넷 밖을 가리키는 게이트웨이를 고친다',
  '게이트웨이는 <b>반드시 자기 서브넷 안</b>에 있어야 합니다. 밖을 가리키면 패킷을 어디로 보낼지 알 수 없습니다.',
  ['서버 IP 가 10.1.1.x 이면 게이트웨이도 10.1.1.x'],
  ()=>miniDoc('14. 게이트웨이 대역 오류',
    [['client',0,0,{name:'PC',ip:'10.1.1.50/24',gw:'192.168.0.1'}],
     ['l2sw',1,0,{name:'SW-01'}],
     ['router',2,0,{name:'RT-01'}],
     ['web',3,0,{name:'WEB-01',ip:'10.1.2.11/24',gw:'10.1.2.1',svc:'80,443'}],
     ['l2sw',2.6,0.8,{name:'SW-02'}]],
    [[0,1],[1,2],[2,4],[4,3]], [['PC → WEB',0,3,80]]),
  [K.custom('게이트웨이 대역 오류 없음', c=>!c.err.some(i=>i.t.includes('게이트웨이 대역')))],
  [K.allFlows()]);

L(2,'/30 전송망','라우터 두 대를 /30 전송 구간으로 잇는다',
  '장비 간 1:1 연결에는 주소 2개짜리 <code>/30</code> 을 씁니다. 낭비가 없고 의도가 분명해집니다.',
  ['10.255.0.0/30 → 사용 가능 주소는 .1 과 .2'],
  ()=>emptyDoc('15. /30 전송망'),
  [K.has('router',2), K.custom('/30 구간 존재', c=>c.segs().some(s=>s.bits===30))],
  [K.noErr()]);

L(2,'구간 다섯 개','서로 다른 서브넷 5개를 가진 망을 만든다',
  '구간이 늘면 라우팅이 필요해집니다. 아직 통신까지는 안 되어도 됩니다 — 주소 계획만 세워 보세요.',
  ['레이어 탭 하단에서 구간 목록을 볼 수 있습니다'],
  ()=>emptyDoc('16. 구간 다섯 개'),
  [K.subnets(5)],
  [K.vlans(4)]);

L(2,'존 이름 붙이기','모든 인터페이스에 보안존을 지정한다',
  '보안존은 방화벽 정책의 출발지/목적지가 됩니다. <code>untrust · dmz · trust · mgmt</code> 처럼 역할로 이름 붙이세요.',
  ['호스트는 속성의 "보안존", L3 장비는 인터페이스별로 지정합니다'],
  ()=>emptyDoc('17. 존 이름 붙이기'),
  [K.zones(3)],
  [K.zoneNamed('dmz'), K.zoneNamed('trust')]);

L(2,'사설과 공인','인터넷 구간은 공인, 내부는 사설 대역으로 나눈다',
  '내부는 RFC1918 사설 대역(10/8, 172.16/12, 192.168/16)을, 인터넷 접점은 공인 대역을 씁니다.',
  ['문서용 공인 대역: 203.0.113.0/24'],
  ()=>emptyDoc('18. 사설과 공인'),
  [K.has('internet'), K.custom('사설 대역 사용', c=>c.hosts().some(n=>bareIp(n.p.ip) && isPrivate(bareIp(n.p.ip)))),
   K.custom('공인 대역 사용', c=>c.hosts().some(n=>bareIp(n.p.ip) && !isPrivate(bareIp(n.p.ip))))],
  []);

L(2,'주소 자동 할당 써보기','빈 IP 를 자동 할당으로 채우고 오류를 0으로 만든다',
  '상단 <b>IP 자동할당</b> 은 구간별로 대역을 정하고 게이트웨이까지 맞춰 줍니다. 급할 때 뼈대를 잡는 용도로 쓰세요.',
  ['자동 할당 후에도 검증 탭을 꼭 확인하세요'],
  ()=>emptyDoc('19. 자동 할당'),
  [K.minNodes(5), K.noErr()],
  [K.subnets(2)]);

L(2,'주소 계획 종합','구간 4개 · VLAN 4개 · 오류 0 인 망을 만든다',
  '지금까지 배운 주소 규칙을 한 번에 적용해 보세요. 통신까지 되면 더 좋습니다.',
  [],
  ()=>emptyDoc('20. 주소 계획 종합'),
  [K.subnets(4), K.vlans(4), K.noErr()],
  [K.allFlows(), K.zones(3)]);

/* ═════ 3장 · 라우팅 ═════ */
L(3,'라우터로 두 대역 잇기','서로 다른 두 서브넷이 라우터를 통해 통신하게 한다',
  '라우터는 인터페이스마다 다른 대역을 갖습니다. 각 호스트의 게이트웨이를 <b>자기 쪽 라우터 인터페이스</b>로 지정하세요. L3 장비의 인터페이스 IP 는 속성 탭의 "인터페이스" 항목에서 링크별로 넣습니다.',
  ['라우터 포트1 = 10.1.1.1/24, 포트2 = 10.1.2.1/24','호스트 게이트웨이를 각각 .1 로'],
  ()=>emptyDoc('21. 두 대역 잇기'),
  [K.has('router'), K.subnets(2), K.reachAny(['client'],['web','was'],80,'양쪽 대역 간 통신 성립')],
  [K.noErr()]);

L(3,'정적 경로 쓰기','라우터에 정적 경로를 넣어 먼 대역에 도달한다',
  '연결되지 않은 대역은 <code>&lt;목적지CIDR&gt; via &lt;넥스트홉IP&gt;</code> 형식으로 알려 줘야 합니다. 한 줄에 하나씩.',
  ['10.1.3.0/24 via 10.1.2.2'],
  ()=>emptyDoc('22. 정적 경로'),
  [K.has('router',2), K.custom('정적 경로 1건 이상', c=>c.NA(['router','l3sw','fw']).some(n=>parseRoutes(n.p.routes).length>0)),
   K.reachAny(['client'],['web','was','rdb'],80,'먼 대역까지 통신 성립')],
  [K.noErr()]);

L(3,'기본 경로','모르는 목적지는 기본 경로로 내보낸다',
  '모든 대역을 일일이 적을 수는 없습니다. <b>Default via</b> 에 상위 장비를 적으면 나머지는 전부 그쪽으로 갑니다.',
  ['0.0.0.0/0 에 해당합니다'],
  ()=>emptyDoc('23. 기본 경로'),
  [K.has('internet'), K.custom('기본 경로 설정', c=>c.NA(['router','l3sw','fw','vpn']).some(n=>bareIp(n.p.defgw))),
   K.reachAny(['client'],['internet'],443,'내부 → 인터넷 통신 성립')],
  [K.noErr()]);

L(3,'세 대역 라우팅','세 구간이 서로 모두 통신하게 만든다',
  '구간이 셋이면 경로도 늘어납니다. 한 라우터에 세 인터페이스를 두면 연결 경로만으로 해결됩니다.',
  ['L3 스위치의 SVI 를 쓰면 더 깔끔합니다'],
  ()=>emptyDoc('24. 세 대역'),
  [K.subnets(3), K.custom('세 구간 간 통신 성립', c=>{ const h=c.hosts();
    if (h.length<3) return false;
    let ok=0; for (let i=0;i<h.length;i++) for (let j=0;j<h.length;j++)
      if (i!==j && c.path(h[i],h[j], parseInt(String(h[j].p.svc||'80').split(',')[0])||80)) ok++;
    return ok >= h.length; })],
  [K.noErr()]);

L(3,'L3 스위치 SVI','L3 스위치에 VLAN 별 SVI 를 만들어 라우팅한다',
  'SVI 는 VLAN 마다 하나씩 두는 가상 인터페이스입니다. 속성의 "VLAN / SVI" 칸에 이렇게 씁니다:<br><code>20 SVI 10.10.20.11/24 trust vip 10.10.20.1</code>',
  ['한 줄에 VLAN 하나','vip 는 이중화용 대표 주소 (생략 가능)'],
  ()=>emptyDoc('25. SVI'),
  [K.has('l3sw'), K.custom('SVI 2개 이상 정의', c=>c.N('l3sw').some(n=>parseSVI(n.p.vlans).length>=2)),
   K.subnets(2)],
  [K.reachAny(['client'],['web','was','rdb'],80,'VLAN 간 통신 성립')]);

L(3,'넥스트홉 고치기','인터페이스 대역 밖을 가리키는 넥스트홉을 바로잡는다',
  '넥스트홉은 <b>내 인터페이스와 같은 대역</b>에 있어야 합니다. 그래야 어느 포트로 내보낼지 정해집니다.',
  ['검증 탭에 "넥스트홉 불일치"로 표시됩니다'],
  ()=>miniDoc('26. 넥스트홉 고치기',
    [['client',0,0,{name:'PC',ip:'10.1.1.50/24',gw:'10.1.1.1'}],
     ['l2sw',1,0,{name:'SW-01'}],
     ['router',2,0,{name:'RT-01',routes:'10.1.9.0/24 via 172.31.99.9'}],
     ['l2sw',3,0,{name:'SW-02'}],
     ['web',4,0,{name:'WEB-01',ip:'10.1.2.11/24',gw:'10.1.2.1',svc:'80,443'}]],
    [[0,1],[1,2],[2,3],[3,4]], [['PC → WEB',0,4,80]]),
  [K.allFlows(), K.noErr()],
  []);

L(3,'라우팅 루프 끊기','서로를 가리키는 경로를 정리한다',
  '두 라우터가 같은 대역을 서로에게 떠넘기면 패킷이 홉 한계까지 돌다 버려집니다. 검증 결과에 <b>루프 의심</b>으로 나옵니다.',
  ['한쪽의 정적 경로를 지우거나 올바른 방향으로 바꾸세요'],
  ()=>miniDoc('27. 라우팅 루프',
    [['client',0,0,{name:'PC',ip:'10.1.1.50/24',gw:'10.1.1.1'}],
     ['l2sw',1,0,{name:'SW-01'}],
     ['router',2,-0.5,{name:'RT-01',routes:'10.9.9.0/24 via 10.1.5.2'}],
     ['router',3,0.5,{name:'RT-02',routes:'10.9.9.0/24 via 10.1.5.1'}],
     ['l2sw',4,0,{name:'SW-02'}],
     ['web',5,0,{name:'WEB-01',ip:'10.9.9.11/24',gw:'10.9.9.1',svc:'80,443'}]],
    [[0,1],[1,2],[2,3],[3,4],[4,5]], [['PC → WEB',0,5,80]]),
  [K.custom('루프 없음', c=>!c.flows.some(f=>!f.r.ok && /루프/.test(f.r.reason))), K.allFlows()],
  []);

L(3,'동적 라우팅','라우터들을 OSPF 로 묶어 경로를 학습시킨다',
  '정적 경로를 일일이 넣는 대신 라우팅 프로토콜을 쓰면 서로의 연결 대역을 자동으로 배웁니다. 속성의 "라우팅" 을 OSPF 로 바꾸세요.',
  ['같은 프로토콜을 쓰는 장비끼리만 학습합니다'],
  ()=>emptyDoc('28. 동적 라우팅'),
  [K.custom('OSPF/BGP 사용 장비 2대 이상', c=>c.NA(['router','l3sw']).filter(n=>['ospf','bgp','eigrp','isis'].includes(n.p.proto)).length>=2),
   K.subnets(3)],
  [K.allFlows()]);

L(3,'인터넷으로 나가기','내부 사용자망이 인터넷까지 도달하게 한다',
  '기본 경로를 계단식으로 이어 붙이면 됩니다. 내부 → 라우터 → 인터넷.',
  ['인터넷 노드에도 IP 를 주세요 (예: 203.0.113.1/29)'],
  ()=>emptyDoc('29. 인터넷 나가기'),
  [K.has('internet'), K.reachAny(['client'],['internet'],443,'사용자망 → 인터넷 도달')],
  [K.noErr()]);

L(3,'라우팅 종합','구간 4개, 모두 상호 통신, 오류 0',
  '연결·정적·기본 경로를 섞어 4개 구간이 전부 서로 닿게 만들어 보세요.',
  [],
  ()=>emptyDoc('30. 라우팅 종합'),
  [K.subnets(4), K.allFlows(), K.flowsAtLeast(3), K.noErr()],
  [K.spofMax(99)]);

/* ═════ 4장 · 방화벽 ═════ */
L(4,'방화벽 세우기','인터넷과 내부 사이에 방화벽을 놓고 존을 나눈다',
  '방화벽 인터페이스마다 존 이름을 줍니다. 바깥은 <code>untrust</code>, 안쪽은 <code>trust</code> 가 관례입니다.',
  ['속성 탭의 인터페이스 목록에서 포트별로 IP 와 존을 지정'],
  ()=>emptyDoc('31. 방화벽 세우기'),
  [K.has('fw'), K.zones(2), K.zoneNamed('untrust')],
  [K.zoneNamed('trust')]);

L(4,'implicit deny 넘기','정책이 없어 막힌 트래픽을 허용 규칙으로 통과시킨다',
  '존이 다른 트래픽은 규칙이 없으면 <b>자동으로 차단</b>됩니다(implicit deny). 같은 존끼리는 기본 허용이고요. 필요한 만큼만 열어 주세요.',
  ['속성 탭의 보안 정책 표에서 "+ 규칙"','"경로 자동 허용" 버튼도 있습니다'],
  ()=>brokenDoc('collapsed', d=>{ d.n.filter(n=>n.ty==='fw').forEach(f=>f.p.rules=[]); }, '32. implicit deny'),
  [K.fwRules(1), K.allFlows()],
  [K.noAnyAny()]);

L(4,'순서가 중요하다','위에서 아래로 first-match 임을 이용해 규칙을 배치한다',
  '정책은 <b>위에서부터 순서대로</b> 검사하고 처음 맞는 규칙에서 멈춥니다. 넓은 차단 규칙이 위에 있으면 아래 허용은 영영 쓰이지 않습니다.',
  ['구체적인 규칙을 위에, 포괄적인 규칙을 아래에'],
  ()=>brokenDoc('collapsed', d=>{ d.n.filter(n=>n.ty==='fw').forEach(f=>{
      f.p.rules = [{sz:'any',dz:'any',s:'any',d:'any',sv:'any',act:'deny'}].concat(f.p.rules||[]); }); },
    '33. 정책 순서'),
  [K.allFlows()],
  [K.fwDeny()]);

L(4,'포트만 열기','서비스 포트만 골라 허용하고 나머지는 막는다',
  'any 서비스로 열어 두면 방화벽이 사실상 없는 것과 같습니다. 필요한 포트만 적으세요.',
  ['서비스 칸: 443 또는 80,443 또는 8000-8100'],
  ()=>brokenDoc('dmz3tier', d=>{ d.n.filter(n=>n.ty==='fw').forEach(f=>{
      f.p.rules = [{sz:'any',dz:'any',s:'any',d:'any',sv:'any',act:'allow'}]; }); },
    '34. 포트만 열기'),
  [K.noAnyAny(), K.allFlows()],
  [K.fwRules(2)]);

L(4,'명시적 차단','맨 아래에 정리용 차단 규칙을 둔다',
  'implicit deny 가 있어도 <b>명시적 deny</b> 를 마지막에 두는 것이 관례입니다. 로그가 남고 의도가 분명해집니다.',
  [],
  ()=>emptyDoc('35. 명시적 차단'),
  [K.has('fw'), K.fwDeny(), K.fwRules(2)],
  [K.allFlows()]);

L(4,'세 개의 존','untrust · dmz · trust 3존 구조를 만든다',
  '외부에 노출되는 서버는 DMZ 에 두고, 내부 자원은 trust 에 둡니다. DMZ 가 뚫려도 내부까지 한 번에 가지 못하게 하는 구조입니다.',
  ['DMZ 에 웹 서버, trust 에 WAS/DB'],
  ()=>emptyDoc('36. 3존 구조'),
  [K.zoneNamed('untrust'), K.zoneNamed('dmz'), K.zoneNamed('trust'), K.has('fw')],
  [K.allFlows(), K.noErr()]);

L(4,'관리망 존','운영 장비를 별도 존으로 분리한다',
  '관리 트래픽(SSH·SNMP·Syslog)은 서비스 트래픽과 섞이면 안 됩니다. <code>mgmt</code> 존으로 분리하고 필요한 포트만 여세요.',
  ['배스천 · NMS · SIEM 을 mgmt 존에'],
  ()=>emptyDoc('37. 관리망 존'),
  [K.zoneNamed('mgmt'), K.hasAny(['bastion','nms','siem'],1,'관리 장비 배치'),
   K.custom('mgmt 관련 정책 존재', c=>c.fwRules().some(r=>r.sz==='mgmt'||r.dz==='mgmt'))],
  [K.allFlows()]);

L(4,'방화벽 두 단','외부/내부 방화벽 사이에 DMZ 를 둔다',
  '방화벽 두 대 사이 구간이 DMZ 입니다. 서로 다른 제조사를 쓰면 한쪽 취약점이 전체로 번지지 않습니다.',
  ['외부 FW ─ DMZ 스위치 ─ 내부 FW'],
  ()=>emptyDoc('38. 2단 방화벽'),
  [K.has('fw',2), K.zoneNamed('dmz'), K.allFlows()],
  [K.custom('두 방화벽 제조사가 다름', c=>new Set(c.N('fw').map(f=>String(f.p.model).split(' ')[0])).size>=2)]);

L(4,'투명 모드','기존 대역을 건드리지 않고 방화벽을 끼워 넣는다',
  '투명(브리지) 모드 방화벽은 IP 를 갖지 않고 회선 사이에 끼어 필터링만 합니다. 운영 중인 망에 넣을 때 씁니다.',
  ['방화벽 속성의 "동작 모드"를 Transparent 로'],
  ()=>emptyDoc('39. 투명 모드'),
  [K.prop('fw','mode','방화벽 1대를 투명 모드로', v=>v==='tp')],
  [K.allFlows()]);

L(4,'방화벽 종합','3존 · 정책 4건 이상 · any-any 없음 · 전 플로우 통과',
  '지금까지의 정책 원칙을 한 구성에 모아 보세요.',
  [],
  ()=>emptyDoc('40. 방화벽 종합'),
  [K.zones(3), K.fwRules(4), K.noAnyAny(), K.allFlows()],
  [K.fwDeny(), K.noErr()]);

/* ═════ 5장 · NAT 와 경계망 ═════ */
L(5,'SNAT 로 나가기','사설 IP 가 공인 주소로 바뀌어 인터넷에 나가게 한다',
  '사설 대역은 인터넷에서 라우팅되지 않습니다. 방화벽 NAT 정책에 <b>SNAT</b> 규칙을 넣어 출발지를 공인 주소로 바꿉니다.',
  ['NAT 표에서 SNAT 선택 → 출발지 10.0.0.0/8 → 변환주소는 방화벽 공인 IP'],
  ()=>emptyDoc('41. SNAT'),
  [K.has('internet'), K.nat('snat'), K.reachAny(['client'],['internet'],443,'내부 → 인터넷 도달')],
  [K.noErr()]);

L(5,'DNAT 로 들어오기','공인 주소로 들어온 요청을 내부 서버로 넘긴다',
  '외부에 알려진 주소는 방화벽의 공인 IP 하나입니다. <b>DNAT</b> 로 목적지를 내부 서버 주소로 바꿔 줍니다.',
  ['NAT 표에서 DNAT → 목적지 = 공인 IP, 서비스 = 443, 변환주소 = 내부 서버'],
  ()=>emptyDoc('42. DNAT'),
  [K.nat('dnat'), K.reachAny(['internet'],['web','was','lb'],443,'외부 → 내부 서비스 도달')],
  [K.noErr()]);

L(5,'포트까지 바꾸기','공인 443 을 내부 8443 으로 넘긴다',
  'DNAT 규칙의 "포트" 칸을 채우면 포트도 함께 변환됩니다. 내부 서버 포트를 외부에 숨길 수 있습니다.',
  ['변환주소 옆의 포트 칸에 8443'],
  ()=>emptyDoc('43. 포트 변환'),
  [K.custom('포트 변환이 있는 DNAT', c=>c.nats('dnat').some(r=>r.tp))],
  [K.allFlows()]);

L(5,'NAT 빠뜨렸을 때','아웃바운드 NAT 가 없는 구성을 고친다',
  'NAT 없이 사설 IP 로 인터넷에 나가면 돌아올 길이 없습니다. 검증 탭이 <b>아웃바운드 NAT 미설정</b>으로 알려 줍니다.',
  [],
  ()=>brokenDoc('dmz3tier', d=>{ d.n.filter(n=>n.ty==='fw').forEach(f=>{
      f.p.nat = (f.p.nat||[]).filter(r=>r.kind!=='snat'); }); }, '44. NAT 누락'),
  [K.nat('snat'), K.custom('NAT 경고 해소', c=>!c.warn.some(i=>i.t.includes('NAT')))],
  [K.allFlows()]);

L(5,'프록시 경유','내부 사용자의 인터넷 접속을 프록시로 모은다',
  '포워드 프록시를 두면 접속 기록을 남기고 유해 사이트를 거를 수 있습니다.',
  ['프록시 방향을 Forward 로'],
  ()=>emptyDoc('45. 프록시'),
  [K.has('proxy'), K.prop('proxy','dir','포워드 방향으로 설정', v=>v==='fwd')],
  [K.allFlows()]);

L(5,'DNS 두기','DMZ 에 DNS 서버를 두고 통신을 확인한다',
  '이름 해석이 안 되면 사실상 전부 멈춥니다. DNS 는 이중화 1순위입니다.',
  ['DNS 기본 포트 53'],
  ()=>emptyDoc('46. DNS'),
  [K.has('dns'), K.reachAny(['client','was','web'],['dns'],53,'내부 → DNS 53 통신')],
  [K.has('dns',2)]);

L(5,'메일 경로','메일 서버를 DMZ 에 두고 25 포트를 연다',
  '메일은 외부와 직접 주고받으므로 DMZ 에 둡니다.',
  [],
  ()=>emptyDoc('47. 메일'),
  [K.has('mail'), K.reachAny(['internet','client'],['mail'],25,'메일 25 포트 통신')],
  [K.zoneNamed('dmz')]);

L(5,'공인 서비스 공개','인터넷 → DNAT → 내부 서비스 경로를 완성한다',
  '외부 사용자가 공인 IP 로 접속하면 방화벽이 DNAT 해서 내부 서비스로 넘기는 전체 흐름을 만들어 보세요.',
  ['플로우의 목적지에 공인 IP 를 직접 입력할 수 있습니다'],
  ()=>emptyDoc('48. 서비스 공개'),
  [K.has('internet'), K.nat('dnat'), K.allFlows(), K.flowsAtLeast(1)],
  [K.nat('snat'), K.noErr()]);

L(5,'인터넷 직결 없애기','서버가 인터넷에 바로 붙은 구성을 고친다',
  '서버를 인터넷에 직접 연결하면 보호 장치가 하나도 없습니다. 사이에 방화벽을 넣으세요.',
  [],
  ()=>miniDoc('49. 인터넷 직결',
    [['internet',0,0,{name:'INTERNET',ip:'203.0.113.1/29',zone:'untrust'}],
     ['web',1,0,{name:'WEB-01',ip:'203.0.113.2/29',gw:'203.0.113.1',svc:'80,443',zone:'untrust'}]],
    [[0,1]], [['외부 → WEB',0,1,443]]),
  [K.has('fw'), K.custom('인터넷 직결 경고 없음', c=>!c.err.some(i=>i.t.includes('직결'))), K.allFlows()],
  []);

L(5,'경계망 종합','DMZ · SNAT · DNAT · 정책을 갖춘 경계 구조를 만든다',
  '외부에서 들어오는 길과 내부에서 나가는 길을 모두 세우고 검증까지 통과시켜 보세요.',
  [],
  ()=>emptyDoc('50. 경계망 종합'),
  [K.has('internet'), K.has('fw'), K.nat('snat'), K.nat('dnat'), K.zoneNamed('dmz'), K.allFlows()],
  [K.noAnyAny(), K.noErr()]);

/* ═════ 6장 · 부하분산 ═════ */
L(6,'로드밸런서 놓기','LB 를 배치하고 VIP 를 준다',
  'VIP(가상 IP)는 클라이언트가 접속하는 대표 주소입니다. 뒤에 몇 대가 있든 밖에서는 하나로 보입니다.',
  ['VIP 는 LB 자신의 IP 와 같은 대역에'],
  ()=>emptyDoc('51. LB 놓기'),
  [K.has('lb'), K.lbVip()],
  [K.noErr()]);

L(6,'풀 만들기','서버 2대를 풀에 넣고 분산시킨다',
  '풀 멤버는 실제로 서비스를 받는 서버들입니다. 속성 탭의 "풀 멤버"에서 체크하세요.',
  ['멤버가 1대뿐이면 분산 효과가 없습니다'],
  ()=>emptyDoc('52. 풀 만들기'),
  [K.has('lb'), K.lbPool(2), K.reachAny(['client','internet'],['lb'],443,'클라이언트 → VIP 통신')],
  [K.noErr()]);

L(6,'헬스체크','죽은 서버를 자동으로 빼도록 모니터를 건다',
  '헬스체크가 실패한 멤버는 분산 대상에서 제외됩니다. HTTP 모니터는 실제 응답까지 확인합니다.',
  ['모니터를 HTTP 로, 실패 임계는 3회 정도'],
  ()=>emptyDoc('53. 헬스체크'),
  [K.has('lb'), K.lbMon(), K.lbPool(2)],
  [K.prop('lb','mon','HTTP/HTTPS 모니터 사용', v=>v==='http'||v==='https')]);

L(6,'알고리즘 고르기','최소 연결 계열 알고리즘으로 바꾼다',
  '라운드로빈은 단순하지만 처리 시간이 제각각인 요청에는 불리합니다. <b>Least Connections</b> 계열은 현재 연결 수가 적은 쪽으로 보냅니다.',
  ['정적: RR, Ratio / 동적: LC, WLC, Fastest, Observed, Predictive'],
  ()=>emptyDoc('54. 알고리즘'),
  [K.has('lb'), K.lbAlgo(['lc','wlc','observed','predictive','fastest'])],
  [K.lbPool(2)]);

L(6,'세션 지속성','같은 사용자가 같은 서버로 가도록 묶는다',
  '장바구니·로그인 상태가 서버 메모리에 있으면 매 요청이 다른 서버로 가면 안 됩니다. Source Address 나 Cookie 로 묶습니다.',
  ['Cookie Insert 는 L7 모드에서만 동작합니다'],
  ()=>emptyDoc('55. 세션 지속성'),
  [K.has('lb'), K.lbPersist()],
  [K.custom('L4 인데 Cookie 를 쓰지 않음', c=>!c.N('lb').some(l=>l.p.mode==='l4'&&l.p.persist==='cookie'))]);

L(6,'비대칭 경로 막기','SNAT AutoMap 을 켜 응답이 LB 를 거치게 한다',
  'SNAT 를 끄면 서버는 클라이언트 IP 를 그대로 보고, 응답을 자기 기본 게이트웨이로 보내 LB 를 우회합니다. 그러면 세션이 깨집니다.',
  ['SNAT AutoMap 을 켜거나, 서버 게이트웨이를 LB 로 지정'],
  ()=>emptyDoc('56. 비대칭 경로'),
  [K.has('lb'), K.lbSnat(), K.lbPool(2)],
  [K.noWarn()]);

L(6,'L7 로 올리기','HTTP 를 이해하는 L7 모드로 바꾸고 쿠키 지속성을 쓴다',
  'L7 은 URL·헤더·쿠키를 보고 분기할 수 있습니다. 대신 부하가 큽니다.',
  ['동작 계층을 L7 로 바꾼 뒤 Cookie Insert 선택'],
  ()=>emptyDoc('57. L7'),
  [K.lbMode('l7'), K.prop('lb','persist','Cookie Insert 지속성', v=>v==='cookie')],
  [K.prop('lb','ssl','SSL 오프로드 켜기', v=>!!v)]);

L(6,'멤버 장애 견디기','서버 한 대를 다운시켜도 서비스가 유지되게 한다',
  '장애 모드로 풀 멤버 한 대를 다운시킨 뒤에도 플로우가 통과해야 합니다. 멤버가 2대 이상이어야 가능합니다.',
  ['상단 장애 모드 → 서버 클릭'],
  ()=>emptyDoc('58. 멤버 장애'),
  [K.lbPool(2), K.custom('멤버 1대를 내려도 서비스 유지', c=>{
    const lb = c.n1('lb'); if (!lb) return false;
    const pool = (lb.p.pool||[]).map(nodeById).filter(Boolean); if (pool.length<2) return false;
    const src = c.n1('client') || c.n1('internet'); if (!src) return false;
    const port = parseInt(String(lb.p.vport||'443').split(',')[0])||443;
    const m = pool[0]; m.p.down = true;
    const t2 = buildTopo();
    const ok = trace(t2, { s:src.id, d:lb.id, pt:port, pr:'tcp' }).ok;
    delete m.p.down;
    return ok; })],
  [K.lbMon()]);

L(6,'LB 도 이중화','로드밸런서 자체를 A/S 로 묶는다',
  'LB 가 죽으면 VIP 가 사라집니다. 두 대를 짝지어 같은 VIP 를 공유하게 하세요.',
  ['이중화 방식 A/S + 짝 지정 + 같은 VIP + 세션 동기화'],
  ()=>emptyDoc('59. LB 이중화'),
  [K.has('lb',2), K.haPair('lb'), K.lbVip()],
  [K.prop('lb','sess','세션 동기화 켜기', v=>!!v), K.hbLink()]);

L(6,'부하분산 종합','VIP · 풀 3대 · 헬스체크 · 지속성 · LB 이중화',
  '실제 서비스 구간에 들어가는 요소를 모두 갖춰 보세요.',
  [],
  ()=>emptyDoc('60. 부하분산 종합'),
  [K.has('lb',2), K.lbVip(), K.lbPool(3), K.lbMon(), K.lbPersist(), K.haPair('lb'), K.allFlows()],
  [K.noWarn(), K.lbSnat()]);

/* ═════ 7장 · 이중화 ═════ */
L(7,'스위치 두 대','액세스 스위치를 2대로 만들고 서로 연결한다',
  '스위치가 한 대면 그 한 대가 멈출 때 구간 전체가 죽습니다. 2대를 두고 서로 연결하세요.',
  ['스위치끼리는 좌우 ◆ 피어 포트로 잇습니다','STP 를 켜 두면 루프가 생겨도 안전합니다'],
  ()=>emptyDoc('61. 스위치 두 대'),
  [K.has('l2sw',2), K.link('l2sw','l2sw')],
  [K.prop('l2sw','stp','STP 활성화', v=>v && v!=='off')]);

L(7,'이중 결선','서버를 스위치 2대에 나눠 물린다',
  '서버 NIC 를 두 스위치에 각각 연결하면(NIC 티밍) 스위치 한 대가 죽어도 살아남습니다.',
  ['서버 한 대에서 두 스위치로 각각 링크'],
  ()=>emptyDoc('62. 이중 결선'),
  [K.has('l2sw',2), K.dualHome('was')],
  [K.dualHome('rdb')]);

L(7,'VRRP 게이트웨이','L3 스위치 2대가 하나의 게이트웨이 주소를 공유하게 한다',
  '하위 장비는 VIP 하나만 게이트웨이로 봅니다. 실제로 응답하는 장비가 바뀌어도 하위는 아무것도 몰라도 됩니다.',
  ['FHRP 를 VRRP 로, 두 대에 같은 VIP, 우선순위는 다르게'],
  ()=>emptyDoc('63. VRRP'),
  [K.has('l3sw',2), K.fhrp(), K.haVip('l3sw'), K.haPair('l3sw')],
  [K.custom('우선순위가 서로 다름', c=>new Set(c.N('l3sw').map(n=>+(n.p.prio||100))).size>=2)]);

L(7,'방화벽 A/S','방화벽 두 대를 Active/Standby 로 묶는다',
  '방화벽 A/S 쌍은 <b>같은 인터페이스 IP</b> 를 공유하고, Active 가 죽으면 Standby 가 그 주소를 그대로 인수합니다.',
  ['두 방화벽의 같은 쪽 포트에 같은 IP 를 주세요','이중화 방식 A/S + 짝 지정 + 세션 동기화'],
  ()=>emptyDoc('64. 방화벽 A/S'),
  [K.has('fw',2), K.haPair('fw')],
  [K.prop('fw','sess','세션 동기화 켜기', v=>!!v), K.hbLink()]);

L(7,'하트비트','이중화 쌍 사이에 전용 하트비트 링크를 놓는다',
  '상태 동기화와 생존 확인은 서비스 회선과 분리하는 것이 안전합니다. 링크 매체를 "HA 하트비트"로 바꾸세요.',
  ['링크 선택 → 속성 → 매체 종류 → HA 하트비트','우클릭 메뉴에서도 바꿀 수 있습니다'],
  ()=>emptyDoc('65. 하트비트'),
  [K.hbLink(), K.custom('이중화 쌍이 1조 이상', c=>c.haPairs().length>=1)],
  [K.noWarn()]);

L(7,'상단 SPOF 없애기','이중화한 장비들이 스위치 한 대에만 물린 구조를 고친다',
  '아무리 장비를 두 대 두어도 둘 다 같은 스위치에 물려 있으면 그 스위치가 단일 장애점입니다. 교차로 연결하세요.',
  ['FW-01 → SW-01, FW-02 → SW-02, 그리고 SW 끼리 연결'],
  ()=>emptyDoc('66. 상단 SPOF'),
  [K.has('l2sw',2), K.custom('단일 상단 스위치 경고 없음', c=>!c.warn.some(i=>i.t.includes('단일 상단')))],
  [K.allFlows()]);

L(7,'절체 확인','Active 를 내려도 서비스가 유지되는지 확인한다',
  '장애 모드에서 Active 장비를 다운시키고 플로우를 다시 돌려 보세요. 절체가 되면 트레이스에 "이중화 절체" 홉이 나타납니다.',
  ['이중화 탭에서 그룹별로 다운/복구 버튼을 쓸 수 있습니다'],
  ()=>emptyDoc('67. 절체 확인'),
  [K.custom('이중화 그룹 1조 이상', c=>c.haPairs().length>=1),
   K.custom('그룹의 한 대를 내려도 전 플로우 유지', c=>{
     const g = c.haPairs()[0]; if (!g) return false;
     const m = g.members[0]; m.p.down = true;
     const t2 = buildTopo();
     const ok = (S.f||[]).filter(f=>f.on!==false).every(f=>trace(t2,f).ok);
     delete m.p.down; return ok && (S.f||[]).length>0; })],
  [K.hbLink()]);

L(7,'SPOF 줄이기','단일 장애점을 3개 이하로 만든다',
  '검증 탭의 <b>SPOF 분석</b> 은 모든 장비와 링크를 하나씩 내려 보며 어떤 플로우가 끊기는지 전수 계산합니다.',
  ['플로우의 출발지·목적지 자신은 SPOF 로 세지 않습니다'],
  ()=>emptyDoc('68. SPOF 줄이기'),
  [K.flowsAtLeast(2), K.spofMax(3)],
  [K.spofMax(1)]);

L(7,'무중단 만들기','단일 장애점 0 인 망을 만든다',
  '경로·장비·전원 어느 하나가 빠져도 서비스가 계속되는 구조입니다. 모든 계층을 2중으로.',
  ['스위치·방화벽·LB·서버·DB 전부 2대씩, 그리고 교차 결선'],
  ()=>emptyDoc('69. 무중단'),
  [K.flowsAtLeast(3), K.spofMax(0), K.allFlows()],
  [K.noWarn()]);

L(7,'이중화 종합','FHRP · A/S · 이중 결선 · 하트비트 · SPOF 1 이하',
  '이 장에서 배운 모든 이중화 기법을 한 구성에 적용하세요.',
  [],
  ()=>emptyDoc('70. 이중화 종합'),
  [K.fhrp(), K.haPair('fw'), K.hbLink(), K.dualHome('was'), K.spofMax(1), K.allFlows()],
  [K.noWarn(), K.noErr()]);

/* ═════ 8장 · 데이터 계층 ═════ */
L(8,'DB 놓기','DB 서버를 배치하고 앱에서 접속시킨다',
  'DB 는 전용 VLAN 에 두고 앱 계층에서만 접근하게 하는 것이 기본입니다.',
  ['Oracle 1521, MySQL 3306, PostgreSQL 5432, MSSQL 1433'],
  ()=>emptyDoc('71. DB 놓기'),
  [K.has('rdb'), K.reachAny(['was','k8s','app'],['rdb'],1521,'앱 → DB 접속')],
  [K.noErr()]);

L(8,'복제 쌍 만들기','DB 2대를 복제로 묶는다',
  'DB 한 대는 곧 데이터 손실 위험입니다. 상대 노드를 지정하고 복제 방식을 고르세요.',
  ['속성 탭 → DB 이중화 → 상대 노드 지정'],
  ()=>emptyDoc('72. 복제 쌍'),
  [K.has('rdb',2), K.custom('DB 복제 설정', c=>c.N('rdb').some(n=>(n.p.dbha||'none')!=='none' && n.p.peer))],
  [K.hbLink()]);

L(8,'공유 스토리지형','RAC 처럼 스토리지를 공유하는 A/A 구성을 만든다',
  'Oracle RAC · Tibero TAC · SQL Server FCI 는 여러 노드가 <b>같은 디스크</b>를 봅니다. 스토리지 노드가 반드시 필요합니다.',
  ['DB 속성의 "스토리지 연결"에 스토리지 노드를 지정'],
  ()=>emptyDoc('73. 공유 스토리지'),
  [K.dbHa(['rac','tac','fci']), K.has('storage'), K.dbStore()],
  [K.mpio()]);

L(8,'무손실 복제','동기 복제로 RPO 0 을 만든다',
  '동기(sync)는 상대가 받았다고 답해야 커밋이 끝납니다. 데이터 손실은 0 이지만 커밋 지연이 늘어납니다.',
  ['Data Guard 최대보호, Always On 동기, PostgreSQL synchronous_commit'],
  ()=>emptyDoc('74. 무손실 복제'),
  [K.has('rdb',2), K.dbSync('sync'), K.custom('DB 이중화 설정됨', c=>c.N('rdb').some(n=>(n.p.dbha||'none')!=='none'))],
  [K.custom('진단에서 RPO 0 으로 표시', c=>c.N('rdb').some(n=>/^0/.test(dbProfile(n).rpo)))]);

L(8,'반동기 복제','MySQL 반동기로 지연과 손실을 절충한다',
  '반동기는 상대가 <b>받았는지</b>만 확인하고 적용은 기다리지 않습니다. 동기보다 빠르고 비동기보다 안전합니다.',
  ['엔진을 MySQL 로, DB 이중화를 반동기 복제로'],
  ()=>emptyDoc('75. 반동기'),
  [K.dbHa(['semisync'])],
  [K.dbSync('semi')]);

L(8,'자동 승격','Patroni 처럼 자동 failover 되는 구성을 만든다',
  '수동 승격은 사람이 붙을 때까지 서비스가 멈춥니다. 합의 기반 자동 승격을 쓰면 수십 초 안에 복구됩니다.',
  ['PostgreSQL + Patroni, 또는 MySQL Group Replication'],
  ()=>emptyDoc('76. 자동 승격'),
  [K.dbHa(['patroni','group','alwayson','rac','tac'])],
  [K.dbVip()]);

L(8,'접속점 하나로','SCAN/AG 리스너 같은 대표 주소를 만든다',
  '앱이 DB 노드 주소를 직접 알면 절체할 때마다 설정을 고쳐야 합니다. 대표 주소 하나만 바라보게 하세요.',
  ['DB 속성의 SCAN/VIP 칸'],
  ()=>emptyDoc('77. 접속점'),
  [K.has('rdb',2), K.dbVip(), K.reachAny(['was','k8s','app'],['rdb'],1521,'앱 → DB 대표 주소 접속')],
  [K.allFlows()]);

L(8,'스토리지 다중 경로','MPIO 를 켜고 경로를 2개 이상 만든다',
  '스토리지 경로가 하나면 HBA·케이블 하나만 끊겨도 볼륨이 내려갑니다. 컨트롤러 A/B 를 서로 다른 스위치로.',
  ['스토리지 속성의 멀티패스(MPIO) 체크'],
  ()=>emptyDoc('78. 다중 경로'),
  [K.has('storage'), K.mpio(), K.custom('스토리지 링크 2개 이상', c=>c.N('storage').some(n=>edgesOf(n.id).length>=2))],
  [K.noWarn()]);

L(8,'캐시 이중화','세션 캐시를 두 대로 묶고 대표 주소를 준다',
  '세션을 캐시에 두면 WAS 를 자유롭게 늘리고 줄일 수 있습니다. 대신 캐시가 SPOF 가 되지 않게 이중화하세요.',
  ['Redis Sentinel / Cluster'],
  ()=>emptyDoc('79. 캐시 이중화'),
  [K.has('cache',2), K.haPair('cache'), K.reachAny(['was','k8s','app'],['cache'],6379,'앱 → 캐시 접속')],
  [K.haVip('cache')]);

L(8,'백업과 RPO','백업 장비를 두고 목표 RPO 를 정한다',
  '복제는 실수까지 복제합니다. 별도 백업이 있어야 논리적 오류에서 복구할 수 있습니다. 백업 주기가 곧 RPO 입니다.',
  ['원격지 복제를 켜면 센터 전체 장애에도 대비됩니다'],
  ()=>emptyDoc('80. 백업'),
  [K.has('backup'), K.prop('backup','rpo','목표 RPO 기재', v=>!!v)],
  [K.prop('backup','offsite','원격지 복제 켜기', v=>!!v)]);

/* ═════ 9장 · 보안 심화 ═════ */
L(9,'IPS 인라인','IPS 를 회선 사이에 끼워 차단하게 한다',
  '인라인 IPS 는 지나가는 트래픽을 실시간으로 막을 수 있습니다. TAP 모드는 탐지만 합니다.',
  ['구축 방식 Inline + 기본 동작 차단'],
  ()=>emptyDoc('81. IPS 인라인'),
  [K.has('ips'), K.inline('ips','inline'), K.allFlows()],
  [K.prop('ips','act','차단 동작으로 설정', v=>v==='block')]);

L(9,'fail-open','보안 장비가 죽어도 회선은 살아 있게 한다',
  '인라인 장비는 자기가 죽으면 회선을 끊습니다. 물리 바이패스를 켜면 장애 시 그냥 통과시킵니다. 가용성과 보안의 맞바꿈입니다.',
  ['IPS 속성의 Fail-open 바이패스'],
  ()=>emptyDoc('82. fail-open'),
  [K.has('ips'), K.bypass('ips'),
   K.custom('IPS 를 내려도 플로우 유지', c=>{
     const ips = c.n1('ips'); if (!ips) return false;
     ips.p.down = true; const t2 = buildTopo();
     const ok = (S.f||[]).filter(f=>f.on!==false).every(f=>trace(t2,f).ok);
     delete ips.p.down; return ok && (S.f||[]).length>0; })],
  []);

L(9,'WAF 브리지','웹 서버 앞에 투명 WAF 를 끼운다',
  '브리지 모드 WAF 는 IP 를 갖지 않고 회선에 끼어 HTTP 를 검사합니다. 주소 체계를 바꾸지 않아도 됩니다.',
  ['WAF 구축 방식을 Bridge 로'],
  ()=>emptyDoc('83. WAF 브리지'),
  [K.has('waf'), K.inline('waf','bridge'), K.allFlows()],
  [K.bypass('waf')]);

L(9,'DMZ 분리','외부 공개 서버를 내부와 분리한다',
  'DMZ 는 "뚫려도 내부까지는 못 간다"를 만드는 장치입니다. DMZ ↔ 내부 사이에도 정책이 있어야 합니다.',
  ['DMZ 서버의 게이트웨이는 내부 방화벽으로'],
  ()=>emptyDoc('84. DMZ 분리'),
  [K.zoneNamed('dmz'), K.zoneNamed('trust'), K.has('fw',2),
   K.custom('dmz → trust 정책이 포트를 제한함', c=>c.fwRules().some(r=>r.sz==='dmz'&&r.dz==='trust'&&r.sv&&r.sv!=='any'))],
  [K.allFlows()]);

L(9,'관리망 분리','운영 접속을 별도 VLAN·존으로 뺀다',
  '관리 트래픽이 서비스망과 섞이면 사고 시 원인 추적이 어렵고 공격 표면도 넓어집니다.',
  ['관리 VLAN + mgmt 존 + 필요한 포트만'],
  ()=>emptyDoc('85. 관리망 분리'),
  [K.zoneNamed('mgmt'), K.hasAny(['bastion','nms','siem'],2,'관리 장비 2대 이상'), K.vlans(3)],
  [K.allFlows()]);

L(9,'배스천 경유','서버 접속을 배스천 한 곳으로 모은다',
  '운영자가 서버에 직접 붙으면 누가 무엇을 했는지 남지 않습니다. 배스천을 유일한 관문으로 두세요.',
  ['MFA 와 세션 녹화를 켜세요'],
  ()=>emptyDoc('86. 배스천'),
  [K.has('bastion'), K.reachAny(['bastion'],['was','web','rdb'],22,'배스천 → 서버 SSH'),
   K.prop('bastion','mfa','MFA 켜기', v=>!!v)],
  [K.prop('bastion','rec','세션 녹화 켜기', v=>!!v)]);

L(9,'DDoS 전단','회선 앞단에 DDoS 방어를 둔다',
  '대량 유입은 방화벽 세션 테이블부터 무너뜨립니다. 회선 바로 뒤, 방화벽 앞에 두는 것이 순서입니다.',
  ['인터넷 ─ DDoS ─ 방화벽'],
  ()=>emptyDoc('87. DDoS'),
  [K.has('ddos'), K.link('internet','ddos'), K.link('ddos','fw')],
  [K.bypass('ddos'), K.allFlows()]);

L(9,'VPN 원격 접속','원격 사용자를 VPN 으로 내부에 들인다',
  'VPN 게이트웨이는 별도 존으로 두고, 할당 IP 풀을 정한 뒤 필요한 자원에만 접근을 허용합니다.',
  ['VPN 존을 따로 만들고 정책으로 제한'],
  ()=>emptyDoc('88. VPN'),
  [K.has('vpn'), K.prop('vpn','pool','할당 IP 풀 지정', v=>!!v)],
  [K.zoneNamed('vpn'), K.allFlows()]);

L(9,'망 분리','인터넷망과 업무망을 물리적으로 나눈다',
  '금융·공공에서 쓰는 구조입니다. 두 망이 서로 라우팅되지 않아야 합니다 — 검증에서 서로 도달하지 못해야 정답입니다.',
  ['두 망을 각각 다른 방화벽 뒤에 두고 연결하지 마세요'],
  ()=>emptyDoc('89. 망 분리'),
  [K.has('client',2), K.subnets(4),
   K.custom('두 사용자망이 서로 도달하지 못함', c=>{ const u=c.N('client');
     return u.length>=2 && !c.path(u[0],u[1],445) && !c.path(u[1],u[0],445); })],
  [K.allFlows()]);

L(9,'보안 종합','DDoS · 방화벽 2단 · IPS · WAF · 관리망 분리',
  '보안 계층을 겹겹이 쌓되, 각 층이 죽어도 서비스는 유지되도록 만들어 보세요.',
  [],
  ()=>emptyDoc('90. 보안 종합'),
  [K.has('fw',2), K.has('ips'), K.has('waf'), K.zoneNamed('mgmt'), K.noAnyAny(), K.allFlows()],
  [K.has('ddos'), K.spofMax(2)]);

/* ═════ 10장 · 종합 설계 ═════ */
L(10,'3-Tier 직접 짓기','인터넷 → 방화벽 → LB → WEB → WAS → DB 전체를 만든다',
  '지금까지 배운 것을 처음부터 끝까지 한 번에 쌓아 보세요. 막히면 랜덤 구성도를 만들어 참고해도 됩니다.',
  ['플로우 자동 생성 → 전체 실행으로 확인'],
  ()=>emptyDoc('91. 3-Tier'),
  [K.has('internet'), K.has('fw'), K.has('lb'), K.has('web'), K.has('was'), K.has('rdb'),
   K.allFlows(), K.flowsAtLeast(3)],
  [K.noErr(), K.noWarn()]);

L(10,'경고까지 없애기','오류 0 · 경고 0 인 구성을 만든다',
  '오류는 통신이 안 되는 것, 경고는 지금은 되지만 위험한 것입니다. 둘 다 없애 보세요.',
  ['경고 항목을 클릭하면 해당 장비로 이동합니다'],
  ()=>emptyDoc('92. 무결점'),
  [K.minNodes(8), K.noErr(), K.noWarn(), K.allFlows()],
  [K.spofMax(2)]);

L(10,'남의 구성 고치기','고장난 구성을 넘겨받아 전부 통과시킨다',
  '실제 업무에서 더 흔한 상황입니다. 검증 탭을 위에서부터 하나씩 해결하세요.',
  ['오류 → 경고 순으로','플로우 탭에서 홉별 트레이스를 보면 어디서 막히는지 정확히 보입니다'],
  ()=>brokenDoc(null, d=>{
      const prev=S; S=d;
      const hosts = d.n.filter(n=>T[n.ty].host && !isTrans(n) && n.ty!=='internet');
      if (hosts[0]) hosts[0].p.gw = '10.99.99.99';
      const fw = d.n.find(n=>n.ty==='fw'); if (fw) fw.p.rules = [];
      const lb = d.n.find(n=>n.ty==='lb'); if (lb) lb.p.pool = [];
      if (d.e[3]) d.e[3].down = true;
      S=prev;
    }, '93. 남의 구성 고치기'),
  [K.noErr(), K.allFlows()],
  [K.noWarn()]);

L(10,'규모 키우기','장비 25대 이상 규모에서 전 플로우를 통과시킨다',
  '규모가 커지면 주소 계획과 이름 규칙이 곧 생산성입니다.',
  ['복제(Ctrl+D)와 다중 선택 정렬을 활용하세요'],
  ()=>emptyDoc('94. 규모 키우기'),
  [K.minNodes(25), K.allFlows(), K.noErr()],
  [K.subnets(5), K.spofMax(3)]);

L(10,'컨테이너 플랫폼','L7 LB → K8s 워커 → 분산 DB 구조를 만든다',
  'NodePort 로 들어와 워커에 분산되고, DB 는 합의 기반으로 자동 승격되는 구조입니다.',
  ['워커 3대 이상, LB 는 L7'],
  ()=>emptyDoc('95. 컨테이너'),
  [K.has('k8s',3), K.lbMode('l7'), K.lbPool(3), K.allFlows()],
  [K.dbHa(['patroni','group']), K.has('cache',2)]);

L(10,'지사 연결','WAN 회선과 라우터로 지사망을 붙인다',
  '전용회선은 비싸고 느립니다. 대역폭과 이중화 수준을 서비스 중요도에 맞춰 정하세요.',
  ['WAN → 라우터 2대 → 내부 스위치'],
  ()=>emptyDoc('96. 지사 연결'),
  [K.has('wan'), K.has('router',2), K.haPair('router'), K.allFlows()],
  [K.has('vpn'), K.spofMax(2)]);

L(10,'금융형 다계층','DDoS·IPS·WAF·2단 방화벽·관리망 분리를 모두 갖춘다',
  '규제 산업에서 요구하는 계층 구조입니다. 층이 많을수록 경로 추적이 중요해집니다.',
  [],
  ()=>emptyDoc('97. 금융형'),
  [K.has('ddos'), K.has('ips'), K.has('waf'), K.has('fw',2), K.zoneNamed('mgmt'),
   K.has('rdb',2), K.allFlows(), K.noErr()],
  [K.spofMax(2), K.noAnyAny()]);

L(10,'완전 무중단','SPOF 0 · 오류 0 · 경고 0 · 플로우 5개 이상',
  '가장 엄격한 조건입니다. 모든 계층이 이중화되고 교차 결선되어야 합니다.',
  ['이중화 탭의 커버리지와 검증 탭의 SPOF 분석을 번갈아 보며 좁혀 가세요'],
  ()=>emptyDoc('98. 완전 무중단'),
  [K.flowsAtLeast(5), K.spofMax(0), K.noErr(), K.allFlows()],
  [K.noWarn()]);

L(10,'최소 장비 설계','장비 12대 이하로 인터넷 공개 서비스를 완성한다',
  '예산이 곧 설계 제약입니다. 무엇을 포기하고 무엇을 지킬지 결정해 보세요.',
  ['꼭 필요한 것: 방화벽, 스위치, 서버, DB'],
  ()=>emptyDoc('99. 최소 설계'),
  [K.maxNodes(12), K.has('internet'), K.has('fw'), K.nat('snat'),
   K.reachAny(['internet'],['web','was','lb'],443,'외부 → 서비스 도달'), K.noErr()],
  [K.allFlows(), K.maxNodes(10)]);

L(10,'졸업 과제','스스로 설계하고 모든 기준을 만족시킨다',
  '규모 · 계층 · 보안 · 이중화 · 데이터를 모두 갖춘 실전 구성도를 만드세요. 이 문제를 통과하면 이 도구로 실제 구역의 전산망을 그릴 준비가 된 것입니다.',
  ['막히면 랜덤 구성도를 만들어 구조를 참고하세요'],
  ()=>emptyDoc('100. 졸업 과제'),
  [K.minNodes(20), K.subnets(5), K.zones(4), K.has('fw',2), K.haPair('fw'),
   K.dbHa(['rac','dg','tac','alwayson','fci','semisync','group','stream','patroni']),
   K.flowsAtLeast(5), K.allFlows(), K.noErr(), K.spofMax(1)],
  [K.noWarn(), K.noAnyAny(), K.hbLink(), K.has('backup')]);

/* ── 채점 ──────────────────────────────────────────────────────────────── */
function gradeLesson(lesson){
  const c = tctx();
  const run = list => list.map(k=>{ let ok=false; try { ok = !!k.f(c); } catch(_){ ok=false; }
    return { l:k.l, ok }; });
  const req = run(lesson.checks || []);
  const bon = run(lesson.bonus || []);
  const rp = req.filter(x=>x.ok).length, rt = req.length;
  const bp = bon.filter(x=>x.ok).length, bt = bon.length;
  const passed = rt>0 && rp===rt;
  /* 추가 점수는 필수를 모두 채운 뒤에만 붙는다 */
  let score = passed ? (bt ? 70 + Math.round(30*(bp/bt)) : 100)
                     : Math.round(70*(rp/Math.max(1,rt)));
  const grade = score>=100 ? 'S' : score>=90 ? 'A' : score>=75 ? 'B' : score>=60 ? 'C' : 'D';
  return { req, bon, rp, rt, bp, bt, passed, score, grade };
}

/* ── 진행 상황 저장 (있으면 좋고 없어도 그만) ──────────────────────────── */
const TUT = { cur:null, last:null, prog:{} };
function tutLoadProg(){ try { TUT.prog = JSON.parse(localStorage.getItem('nf-tutorial')||'{}') || {}; } catch(_){ TUT.prog = {}; } }
function tutSaveProg(){ try { localStorage.setItem('nf-tutorial', JSON.stringify(TUT.prog)); } catch(_){} }
tutLoadProg();
