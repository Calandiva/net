/* ═══════════════════════════════════════════════════════════════════════════
   20-catalog.js — 장비 카탈로그
   실제 제품의 동작 모델(포워딩/필터링/분산/이중화)을 타입별로 정의한다.
   근거: F5 BIG-IP LTM 분산 알고리즘, PAN-OS 정책 평가 순서(top-down first-match,
   intra-zone allow / inter-zone deny), RFC5798 VRRP / Cisco HSRP·GLBP,
   Oracle RAC·Data Guard, MySQL semi-sync, PostgreSQL streaming replication.
   ═══════════════════════════════════════════════════════════════════════════ */

const LAYERS = {
  edge: { n: '외부 / WAN',   c: '#7C8B9C' },
  net:  { n: '네트워크',      c: '#3B62B8' },
  sec:  { n: '보안',          c: '#C9333A' },
  srv:  { n: '서버',          c: '#0C7F91' },
  data: { n: '데이터 / 스토리지', c: '#7A4FBF' },
  ep:   { n: '단말 / 사용자',  c: '#2E9E5B' },
  mgmt: { n: '관리 / 운영',    c: '#A76331' }
};

/* ── SVG 아이콘 (24x24, stroke=currentColor) ───────────────────────────── */
const IC = {
  cloud:  '<path d="M6.5 18h11a3.5 3.5 0 0 0 .4-6.98A5 5 0 0 0 8.2 9.4 3.8 3.8 0 0 0 6.5 18Z"/>',
  wan:    '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.5 2.6 2.5 12.4 0 16M12 4c-2.5 2.6-2.5 12.4 0 16"/>',
  router: '<rect x="3" y="12" width="18" height="8" rx="2"/><path d="M8 9V6m0 0-2 2m2-2 2 2M16 4v5m0-5-2 2m2-2 2 2M6.5 16h2m3 0h2m3 0h1"/>',
  l3sw:   '<rect x="3" y="7" width="18" height="11" rx="2"/><path d="M7 4v3m10-3v3M6 11l2-2m0 0 2 2m-2-2v5m8-5-2 2m2-2 2 2m-2-2v5"/>',
  l2sw:   '<rect x="3" y="8" width="18" height="9" rx="2"/><path d="M6.5 11.5h4l-1.5-1.5M17.5 13.5h-4l1.5 1.5"/>',
  lb:     '<rect x="3" y="9" width="7" height="7" rx="1.6"/><path d="M10 12.5h4m0-4.5h4m-4 9h4M14 8v9"/><rect x="18" y="5.5" width="3" height="3" rx="1"/><rect x="18" y="11" width="3" height="3" rx="1"/><rect x="18" y="16.5" width="3" height="3" rx="1"/>',
  apigw:  '<path d="M8 5 4 12l4 7M16 5l4 7-4 7"/><path d="M10.5 15 13.5 9"/>',
  proxy:  '<circle cx="7" cy="12" r="3"/><circle cx="17" cy="12" r="3"/><path d="M10 12h4"/>',
  fw:     '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9.7h18M3 14.3h18M9 5v4.7M15 9.7v4.6M9 14.3V19"/>',
  ips:    '<path d="M12 3.5 5 6.3v5.4c0 4.2 2.9 7.6 7 8.8 4.1-1.2 7-4.6 7-8.8V6.3Z"/><path d="M8.5 12.5h2l1.5-3 1.5 5 1.2-2h1.8"/>',
  waf:    '<path d="M12 3.5 5 6.3v5.4c0 4.2 2.9 7.6 7 8.8 4.1-1.2 7-4.6 7-8.8V6.3Z"/><path d="m10 10-2 2.2 2 2.2m4-4.4 2 2.2-2 2.2"/>',
  vpn:    '<rect x="4" y="10.5" width="16" height="9" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14v2.5"/>',
  ddos:   '<path d="M12 3.5 5 6.3v5.4c0 4.2 2.9 7.6 7 8.8 4.1-1.2 7-4.6 7-8.8V6.3Z"/><path d="M12 8v4.5M12 15.4v.6"/>',
  nac:    '<circle cx="9" cy="9" r="3"/><path d="M3.5 18.5c.7-2.9 2.9-4.5 5.5-4.5s4.8 1.6 5.5 4.5M16.5 11.5h4v4h-4z"/>',
  web:    '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 8h18M6 6.1h.01M8.4 6.1h.01"/><circle cx="12" cy="14" r="3.2"/><path d="M8.8 14h6.4M12 10.8c1.6 1.9 1.6 4.5 0 6.4-1.6-1.9-1.6-4.5 0-6.4"/>',
  was:    '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 8h18M6 6.1h.01M8.4 6.1h.01"/><circle cx="12" cy="14" r="2"/><path d="M12 10.5v-.6m0 8.2v-.6m3-3h.6m-7.2 0h-.6m5.1-2.1.4-.4m-4.6 4.6-.4.4m4.6 0 .4.4m-4.6-4.6-.4-.4"/>',
  app:    '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 8h18M6 6.1h.01M8.4 6.1h.01M7 12h10M7 15.5h6"/>',
  dns:    '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.5 2.6 2.5 12.4 0 16M12 4c-2.5 2.6-2.5 12.4 0 16"/><path d="M9.2 12.2v2.4m0-2.4 2.4 2.4v-2.4"/>',
  mail:   '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="m3.8 7 8.2 6 8.2-6"/>',
  ad:     '<circle cx="12" cy="7.5" r="3"/><path d="M6 19.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/>',
  bastion:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="m8 10 3 2.5L8 15M13 15.5h3.5"/>',
  k8s:    '<path d="m12 3.2 7.5 3.6v8.4L12 20.8 4.5 15.2V6.8Z"/><circle cx="12" cy="12" r="2.4"/><path d="M12 6.2v3.4M12 14.4v3.4M8 9.8l2.1 1.2M13.9 13l2.1 1.2M16 9.8 13.9 11M10.1 13 8 14.2"/>',
  esxi:   '<rect x="3" y="4.5" width="18" height="7" rx="1.6"/><rect x="3" y="13.5" width="18" height="6" rx="1.6"/><path d="M6.2 8h.01M6.2 16.5h.01M9 8h5M9 16.5h5"/>',
  rdb:    '<ellipse cx="12" cy="6.5" rx="7.5" ry="2.8"/><path d="M4.5 6.5v11c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-11M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8"/>',
  nosql:  '<ellipse cx="12" cy="6.5" rx="7.5" ry="2.8"/><path d="M4.5 6.5v11c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-11"/><path d="M8.6 16.6h.01M12 16.6h.01M15.4 16.6h.01"/>',
  cache:  '<ellipse cx="12" cy="6.5" rx="7.5" ry="2.8"/><path d="M4.5 6.5v11c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-11"/><path d="m12.8 10.5-2.4 3.4h2.6l-1.6 3.1"/>',
  storage:'<rect x="3" y="4.5" width="18" height="5" rx="1.4"/><rect x="3" y="11" width="18" height="5" rx="1.4"/><path d="M6.2 7h.01M6.2 13.5h.01M3 18.5h18"/>',
  backup: '<rect x="3.5" y="11" width="17" height="8" rx="1.8"/><path d="M6.7 15h.01M12 3.5v5.2m0 0 2.4-2.4M12 8.7 9.6 6.3"/>',
  client: '<rect x="3" y="4.5" width="18" height="11" rx="2"/><path d="M8.5 19.5h7M12 15.5v4"/>',
  nms:    '<circle cx="12" cy="12" r="8"/><path d="M12 12l3.6-2.6M12 12v.01M6.5 15.5A6.5 6.5 0 0 1 12 5.5a6.5 6.5 0 0 1 5.5 10"/>',
  siem:   '<path d="M6 3.5h8l4 4v13H6Z"/><path d="M14 3.5v4h4M8.6 12h6.8M8.6 15.4h4.8"/>'
};

/* ── 옵션 상수 ─────────────────────────────────────────────────────────── */
const O_LBALGO = [
  ['rr',        'Round Robin (라운드로빈)'],
  ['wrr',       'Ratio / Weighted RR (가중 비율)'],
  ['lc',        'Least Connections (최소 연결)'],
  ['wlc',       'Weighted Least Connections'],
  ['fastest',   'Fastest (최단 응답)'],
  ['observed',  'Observed (연결수 기반 동적 비율)'],
  ['predictive','Predictive (동적 비율 + 추세)'],
  ['srchash',   'Source IP Hash (출발지 해시)'],
  ['urihash',   'URI Hash (L7 전용)']
];
const O_PERSIST = [
  ['none',   '없음'],
  ['srcip',  'Source Address (출발지 IP)'],
  ['cookie', 'Cookie Insert (L7)'],
  ['sslsid', 'SSL Session ID'],
  ['dstip',  'Destination Address']
];
const O_MON = [['icmp','ICMP echo'],['tcp','TCP connect'],['http','HTTP GET'],['https','HTTPS GET'],['none','없음 (항상 UP 간주)']];
const O_FHRP = [['none','없음'],['vrrp','VRRP (RFC5798, 표준)'],['hsrp','HSRP (Cisco)'],['glbp','GLBP (Cisco, 부하분산형)']];
const O_HA = [
  ['none',  '단일 (이중화 없음)'],
  ['as',    'Active / Standby'],
  ['aa',    'Active / Active'],
  ['np1',   'N+1 (예비 1대 공유)'],
  ['clu',   'Cluster (다수 노드 클러스터)']
];
const O_STP = [['rstp','RSTP (802.1w)'],['mstp','MSTP (802.1s)'],['pvst','PVST+ (Cisco)'],['off','미사용']];
const O_ROUTE = [['static','Static (정적)'],['ospf','OSPF'],['bgp','BGP'],['eigrp','EIGRP'],['isis','IS-IS']];
const O_DBENG = [
  ['oracle','Oracle Database 19c/23ai'],['tibero','Tibero 7'],['mssql','SQL Server 2022'],
  ['mysql','MySQL 8.x'],['mariadb','MariaDB 11'],['pgsql','PostgreSQL 16'],['db2','IBM Db2']
];
const O_DBHA = [
  ['none',    '단일 인스턴스'],
  ['rac',     'Oracle RAC (공유 스토리지 A/A)'],
  ['dg',      'Oracle Data Guard (Primary/Standby)'],
  ['tac',     'Tibero TAC (A/A)'],
  ['alwayson','SQL Server Always On AG'],
  ['fci',     'SQL Server FCI (공유 디스크)'],
  ['semisync','MySQL 반동기 복제 (semi-sync)'],
  ['async',   '비동기 복제 (async)'],
  ['group',   'MySQL Group Replication / InnoDB Cluster'],
  ['stream',  'PostgreSQL Streaming Replication'],
  ['patroni', 'Patroni + etcd 자동 failover']
];
const O_SYNC = [['sync','동기 (Sync, RPO=0)'],['semi','반동기 (Semi-sync)'],['async','비동기 (Async)']];
const O_FWMODE = [['route','Routed / L3 모드'],['tp','Transparent / Bridge 모드']];
const O_STOR = [['fc','FC-SAN (Fibre Channel)'],['iscsi','iSCSI'],['nfs','NFS'],['smb','SMB/CIFS'],['nvmeof','NVMe-oF']];
const O_RAID = [['1','RAID 1'],['5','RAID 5'],['6','RAID 6'],['10','RAID 10'],['dp','RAID-DP / EC']];

/* 공통 필드 */
const F_NAME  = { k:'name',  l:'이름',    t:'text' };
const F_MODEL = { k:'model', l:'제품/모델', t:'sel',  o:[] };
const F_ZONE  = { k:'zone',  l:'보안존',   t:'text', ph:'trust / dmz / untrust', help:'방화벽 정책의 src/dst 존으로 사용됩니다.' };
const F_VLAN  = { k:'vlan',  l:'VLAN',    t:'num',  ph:'1' };
const F_IP    = { k:'ip',    l:'IP/CIDR',  t:'mono', ph:'10.10.10.11/24' };
const F_GW    = { k:'gw',    l:'게이트웨이', t:'mono', ph:'10.10.10.1' };
const F_NOTE  = { k:'note',  l:'메모',     t:'ta' };
const F_HA    = [
  { k:'ha',    l:'이중화 방식', t:'sel', o:O_HA, d:'none' },
  { k:'peer',  l:'이중화 짝',   t:'nodesel', help:'같은 종류의 노드를 짝으로 지정하면 장애 시 자동 인수합니다.' },
  { k:'vip',   l:'가상 IP(VIP)', t:'mono', ph:'10.10.10.1', help:'A/S·A/A 구성에서 서비스가 바라보는 대표 IP.' },
  { k:'prio',  l:'우선순위',    t:'num', ph:'100', help:'값이 클수록 Active. VRRP/HSRP 공통.' },
  { k:'preempt', l:'Preempt',  t:'chk', d:true, help:'복구된 고순위 장비가 Active를 되찾습니다.' },
  { k:'sess',  l:'세션 동기화', t:'chk', help:'끊김 없는 절체(stateful failover) 여부.' }
];

/* ── 타입 정의 ─────────────────────────────────────────────────────────── */
const T = {
  /* ---------- edge ---------- */
  internet: { n:'인터넷', ly:'edge', ic:'cloud', l3:1, host:1, w:104, h:56,
    models:['Public Internet'],
    f:[F_NAME,{k:'ip',l:'대표 IP',t:'mono',d:'0.0.0.0/0'},F_ZONE,F_NOTE],
    d:{ zone:'untrust', ip:'0.0.0.0/0' } },
  wan: { n:'전용회선/MPLS', ly:'edge', ic:'wan', l3:1, host:1,
    models:['KT VPN(MPLS)','LG U+ 전용회선','SKB 이더넷전용','AWS Direct Connect','Azure ExpressRoute'],
    f:[F_NAME,F_MODEL,F_IP,{k:'bw',l:'회선 대역폭',t:'text',ph:'1Gbps'},F_ZONE,...F_HA,F_NOTE],
    d:{ zone:'wan', bw:'1Gbps' } },

  /* ---------- net ---------- */
  router: { n:'라우터', ly:'net', ic:'router', l3:1, rt:1,
    models:['Cisco ISR 4451-X','Cisco ASR 1001-HX','Juniper MX204','Huawei NE40E','Handreamnet 라우터'],
    f:[F_NAME,F_MODEL,
       {k:'proto',l:'라우팅',t:'sel',o:O_ROUTE,d:'static'},
       {k:'defgw',l:'Default via',t:'mono',ph:'203.0.113.1',help:'0.0.0.0/0 넥스트홉.'},
       {k:'routes',l:'정적 라우팅',t:'ta',ph:'10.20.0.0/16 via 10.10.10.2\n0.0.0.0/0 via 203.0.113.1',help:'한 줄에 하나: <목적지CIDR> via <넥스트홉IP>'},
       {k:'fhrp',l:'FHRP',t:'sel',o:O_FHRP,d:'none'},
       ...F_HA,F_NOTE],
    d:{ proto:'static', prio:100, preempt:true } },

  l3sw: { n:'L3 스위치', ly:'net', ic:'l3sw', l3:1, rt:1, sw:1,
    models:['Cisco Catalyst 9300','Cisco Nexus 93180YC-FX','Arista 7050SX3','HPE Aruba 6300M','Extreme X465'],
    f:[F_NAME,F_MODEL,
       {k:'vlans',l:'VLAN / SVI',t:'ta',ph:'10 SVI 10.10.10.1/24 svc\n20 SVI 10.10.20.1/24 was',help:'<VLAN ID> SVI <IP/CIDR> [존이름]'},
       {k:'proto',l:'라우팅',t:'sel',o:O_ROUTE,d:'static'},
       {k:'defgw',l:'Default via',t:'mono'},
       {k:'routes',l:'정적 라우팅',t:'ta'},
       {k:'fhrp',l:'FHRP',t:'sel',o:O_FHRP,d:'vrrp'},
       {k:'stp',l:'STP',t:'sel',o:O_STP,d:'rstp'},
       {k:'mlag',l:'MLAG/VSS/vPC',t:'chk',help:'섀시 간 링크 애그리게이션. 켜면 A/A 이중화로 계산합니다.'},
       ...F_HA,F_NOTE],
    d:{ proto:'static', stp:'rstp', fhrp:'vrrp', prio:110, preempt:true } },

  l2sw: { n:'L2 스위치', ly:'net', ic:'l2sw', tp:1, sw:1,
    models:['Cisco Catalyst 9200L','Cisco 2960-X','HPE Aruba 2930F','Dasan V2724G','Netgear M4300'],
    f:[F_NAME,F_MODEL,
       {k:'vlan',l:'액세스 VLAN',t:'num',ph:'10',help:'이 스위치에 붙은 포트의 기본 VLAN.'},
       {k:'trunk',l:'허용 VLAN(트렁크)',t:'mono',ph:'10,20,30'},
       {k:'stp',l:'STP',t:'sel',o:O_STP,d:'rstp'},
       {k:'lacp',l:'LACP 본딩',t:'chk'},
       {k:'mip',l:'관리 IP',t:'mono',ph:'10.10.99.11/24'},
       ...F_HA,F_NOTE],
    d:{ stp:'rstp', vlan:10 } },

  lb: { n:'로드밸런서', ly:'net', ic:'lb', l3:1, lb:1, w:120,
    models:['F5 BIG-IP LTM i4800','F5 BIG-IP VE','Citrix ADC MPX 5900','A10 Thunder 3030S','Piolink PAS-K 4000','HAProxy 2.9','NGINX Plus R31','AWS ALB/NLB'],
    f:[F_NAME,F_MODEL,
       {k:'mode',l:'동작 계층',t:'sel',o:[['l4','L4 (TCP/UDP)'],['l7','L7 (HTTP/HTTPS)']],d:'l4'},
       F_IP,{k:'defgw',l:'Default via',t:'mono',ph:'10.10.10.1',help:'LB 자신이 밖으로 나갈 때 쓰는 넥스트홉.'},F_VLAN,F_ZONE,
       {k:'vip',l:'VIP',t:'mono',ph:'10.10.10.100',help:'클라이언트가 접속하는 가상 서버 주소.'},
       {k:'vport',l:'서비스 포트',t:'mono',ph:'443'},
       {k:'algo',l:'분산 알고리즘',t:'sel',o:O_LBALGO,d:'rr'},
       {k:'persist',l:'세션 지속성',t:'sel',o:O_PERSIST,d:'none'},
       {k:'pool',l:'풀 멤버',t:'poolsel',help:'실제 서비스를 받을 서버들. 헬스체크에 실패하면 자동 제외됩니다.'},
       {k:'mon',l:'헬스 모니터',t:'sel',o:O_MON,d:'tcp'},
       {k:'monint',l:'점검 주기(초)',t:'num',d:5},
       {k:'monretry',l:'실패 임계',t:'num',d:3},
       {k:'snat',l:'SNAT AutoMap',t:'chk',d:true,help:'풀 멤버가 보는 출발지 IP를 LB IP로 치환. 끄면 서버의 기본 GW가 LB여야 합니다.'},
       {k:'ssl',l:'SSL 오프로드',t:'chk',help:'L7에서 TLS 종료 후 평문 전달.'},
       ...F_HA,F_NOTE],
    d:{ mode:'l4', algo:'rr', mon:'tcp', monint:5, monretry:3, snat:true, ha:'as', prio:100, preempt:true, sess:true } },

  apigw: { n:'API 게이트웨이', ly:'net', ic:'apigw', l3:1, host:1, svc:'443',
    models:['Kong Gateway','Apigee','AWS API Gateway','WSO2 API Manager','Spring Cloud Gateway'],
    f:[F_NAME,F_MODEL,F_IP,F_GW,F_VLAN,F_ZONE,{k:'svc',l:'수신 포트',t:'mono',d:'443'},
       {k:'rate',l:'Rate Limit',t:'text',ph:'1000 req/s'},
       {k:'up',l:'업스트림',t:'nodesel'},...F_HA,F_NOTE],
    d:{ svc:'443' } },

  proxy: { n:'프록시', ly:'net', ic:'proxy', l3:1, host:1, svc:'3128',
    models:['Squid','NGINX (reverse)','HAProxy','Blue Coat ProxySG','Zscaler ZIA'],
    f:[F_NAME,F_MODEL,
       {k:'dir',l:'방향',t:'sel',o:[['fwd','Forward (내부→외부)'],['rev','Reverse (외부→내부)']],d:'fwd'},
       F_IP,F_GW,F_VLAN,F_ZONE,{k:'svc',l:'수신 포트',t:'mono',d:'3128'},...F_HA,F_NOTE],
    d:{ dir:'fwd', svc:'3128' } },

  /* ---------- sec ---------- */
  fw: { n:'방화벽', ly:'sec', ic:'fw', l3:1, fw:1, rt:1, w:120,
    models:['Palo Alto PA-3220','Palo Alto PA-5220','FortiGate 600F','Cisco Firepower 2130','Check Point 6600','SECUI MF2','AhnLab TrusGuard 5000','Sophos XGS'],
    f:[F_NAME,F_MODEL,
       {k:'mode',l:'동작 모드',t:'sel',o:O_FWMODE,d:'route'},
       {k:'defgw',l:'Default via',t:'mono'},
       {k:'routes',l:'정적 라우팅',t:'ta'},
       {k:'rules',l:'보안 정책',t:'rules',help:'위에서 아래로 first-match. 매칭 없으면 같은 존은 허용, 다른 존은 차단(implicit deny) — PAN-OS 기본 동작.'},
       {k:'nat',l:'NAT 정책',t:'nat',help:'DNAT는 목적지 변환(공인→사설), SNAT는 출발지 변환(사설→공인).'},
       {k:'log',l:'세션 로깅',t:'chk',d:true},
       ...F_HA,F_NOTE],
    d:{ mode:'route', log:true, ha:'as', prio:100, preempt:false, sess:true, zone:'' } },

  ips: { n:'IPS / IDS', ly:'sec', ic:'ips', tp:1,
    models:['Palo Alto Threat Prevention','Trellix NSP','WINS SNIPER IPS','Suricata','Cisco Firepower IPS'],
    f:[F_NAME,F_MODEL,
       {k:'dep',l:'구축 방식',t:'sel',o:[['inline','Inline (차단 가능)'],['tap','TAP/SPAN (탐지 전용)']],d:'inline'},
       {k:'act',l:'기본 동작',t:'sel',o:[['detect','탐지(알람)'],['block','차단']],d:'block'},
       {k:'bypass',l:'Fail-open 바이패스',t:'chk',d:true,help:'장비 장애 시 회선을 물리적으로 통과시킵니다. 끄면 fail-close(단절).'},
       {k:'mip',l:'관리 IP',t:'mono'},...F_HA,F_NOTE],
    d:{ dep:'inline', act:'block', bypass:true } },

  waf: { n:'WAF', ly:'sec', ic:'waf', l3:1, host:1, svc:'443',
    models:['F5 Advanced WAF','Penta Security WAPPLES','Imperva SecureSphere','Cloudflare WAF','ModSecurity + CRS','AWS WAF'],
    f:[F_NAME,F_MODEL,
       {k:'dep',l:'구축 방식',t:'sel',o:[['proxy','Reverse Proxy'],['bridge','Bridge (투명)'],['tap','모니터링']],d:'proxy'},
       {k:'act',l:'정책',t:'sel',o:[['block','차단'],['detect','탐지']],d:'block'},
       {k:'bypass',l:'Fail-open 바이패스',t:'chk',d:true,help:'브리지 모드에서 장비 장애 시 회선을 통과시킵니다. 끄면 fail-close(단절).'},
       F_IP,F_GW,F_VLAN,F_ZONE,{k:'svc',l:'수신 포트',t:'mono',d:'443'},
       {k:'up',l:'보호 대상',t:'nodesel'},...F_HA,F_NOTE],
    d:{ dep:'proxy', act:'block', svc:'443', bypass:true } },

  vpn: { n:'VPN 게이트웨이', ly:'sec', ic:'vpn', l3:1, rt:1,
    models:['Cisco ASA 5516 VPN','FortiGate SSL-VPN','Palo Alto GlobalProtect','Pulse Secure','Genians VPN','WireGuard'],
    f:[F_NAME,F_MODEL,
       {k:'kind',l:'유형',t:'sel',o:[['ssl','SSL-VPN (원격 접속)'],['ipsec','IPsec Site-to-Site'],['l2tp','L2TP/IPsec']],d:'ssl'},
       {k:'pool',l:'할당 IP 풀',t:'mono',ph:'172.30.10.0/24'},
       {k:'defgw',l:'Default via',t:'mono'},
       {k:'routes',l:'정적 라우팅',t:'ta'},
       F_ZONE,...F_HA,F_NOTE],
    d:{ kind:'ssl', zone:'vpn' } },

  ddos: { n:'DDoS 방어', ly:'sec', ic:'ddos', tp:1,
    models:['Radware DefensePro','Arbor APS','A10 Thunder TPS','Cloudflare Magic Transit','KT DDoS 대응서비스'],
    f:[F_NAME,F_MODEL,{k:'th',l:'임계치',t:'text',ph:'2Gbps / 200kpps'},
       {k:'bypass',l:'Fail-open 바이패스',t:'chk',d:true},{k:'mip',l:'관리 IP',t:'mono'},...F_HA,F_NOTE],
    d:{ bypass:true } },

  nac: { n:'NAC', ly:'sec', ic:'nac', l3:1, host:1, svc:'1812',
    models:['Genians NAC','Cisco ISE','Aruba ClearPass','NetAND NAC'],
    f:[F_NAME,F_MODEL,F_IP,F_GW,F_VLAN,F_ZONE,{k:'kind',l:'제어 방식',t:'sel',o:[['arp','ARP Spoofing'],['8021x','802.1X'],['agent','에이전트']],d:'8021x'},...F_HA,F_NOTE],
    d:{ kind:'8021x', svc:'1812' } },

  /* ---------- srv ---------- */
  web: { n:'웹 서버', ly:'srv', ic:'web', host:1, svc:'80,443',
    models:['NGINX 1.26','Apache HTTPD 2.4','Microsoft IIS 10','Apache Tomcat (정적)','LiteSpeed'],
    f:[F_NAME,F_MODEL,F_IP,F_GW,F_VLAN,F_ZONE,
       {k:'svc',l:'수신 포트',t:'mono',d:'80,443'},
       {k:'os',l:'OS',t:'sel',o:[['rhel','RHEL / Rocky 9'],['ubuntu','Ubuntu 22.04'],['win','Windows Server 2022'],['aix','AIX 7.3']],d:'rhel'},
       {k:'up',l:'업스트림(WAS)',t:'nodesel'},
       {k:'health',l:'헬스 엔드포인트',t:'mono',ph:'/healthz'},
       ...F_HA,F_NOTE],
    d:{ svc:'80,443', os:'rhel', ha:'aa' } },

  was: { n:'WAS', ly:'srv', ic:'was', host:1, svc:'8080,8443',
    models:['Apache Tomcat 10','JBoss EAP 8','Oracle WebLogic 14c','TmaxSoft JEUS 8','IBM WebSphere 9','Spring Boot(내장)'],
    f:[F_NAME,F_MODEL,F_IP,F_GW,F_VLAN,F_ZONE,
       {k:'svc',l:'수신 포트',t:'mono',d:'8080,8443'},
       {k:'os',l:'OS',t:'sel',o:[['rhel','RHEL / Rocky 9'],['ubuntu','Ubuntu 22.04'],['win','Windows Server 2022'],['aix','AIX 7.3']],d:'rhel'},
       {k:'up',l:'업스트림(DB)',t:'nodesel'},
       {k:'sessrep',l:'세션 클러스터링',t:'chk',help:'WAS 간 HTTP 세션 복제. 끄면 LB에 세션 지속성이 필요합니다.'},
       {k:'health',l:'헬스 엔드포인트',t:'mono',ph:'/actuator/health'},
       ...F_HA,F_NOTE],
    d:{ svc:'8080,8443', os:'rhel', ha:'aa' } },

  app: { n:'응용 서버', ly:'srv', ic:'app', host:1, svc:'9000',
    models:['배치 서버','EAI/ESB','전문(FEP) 서버','리포팅 서버','파일 전송(FTP) 서버'],
    f:[F_NAME,F_MODEL,F_IP,F_GW,F_VLAN,F_ZONE,{k:'svc',l:'수신 포트',t:'mono',d:'9000'},{k:'up',l:'업스트림',t:'nodesel'},...F_HA,F_NOTE],
    d:{ svc:'9000' } },

  dns: { n:'DNS', ly:'srv', ic:'dns', host:1, svc:'53',
    models:['BIND 9','Windows DNS','Infoblox','PowerDNS','Unbound'],
    f:[F_NAME,F_MODEL,F_IP,F_GW,F_VLAN,F_ZONE,{k:'svc',l:'수신 포트',t:'mono',d:'53'},
       {k:'kind',l:'역할',t:'sel',o:[['auth','Authoritative'],['rec','Recursive/Caching'],['both','겸용']],d:'both'},...F_HA,F_NOTE],
    d:{ svc:'53', kind:'both', ha:'as' } },

  mail: { n:'메일 서버', ly:'srv', ic:'mail', host:1, svc:'25,587,993',
    models:['MS Exchange 2019','Postfix + Dovecot','Zimbra','Crinity','Google Workspace 릴레이'],
    f:[F_NAME,F_MODEL,F_IP,F_GW,F_VLAN,F_ZONE,{k:'svc',l:'수신 포트',t:'mono',d:'25,587,993'},...F_HA,F_NOTE],
    d:{ svc:'25,587,993' } },

  ad: { n:'AD / LDAP', ly:'srv', ic:'ad', host:1, svc:'389,636,88',
    models:['Windows Server AD DS','OpenLDAP','FreeIPA','Oracle Directory'],
    f:[F_NAME,F_MODEL,F_IP,F_GW,F_VLAN,F_ZONE,{k:'svc',l:'수신 포트',t:'mono',d:'389,636,88'},...F_HA,F_NOTE],
    d:{ svc:'389,636,88', ha:'aa' } },

  bastion: { n:'점프/배스천', ly:'srv', ic:'bastion', host:1, svc:'22,3389',
    models:['SSH Bastion (OpenSSH)','Teleport','넷맨 서버접근제어','파수 SecureSHell','CyberArk PSM'],
    f:[F_NAME,F_MODEL,F_IP,F_GW,F_VLAN,F_ZONE,{k:'svc',l:'수신 포트',t:'mono',d:'22,3389'},
       {k:'mfa',l:'MFA',t:'chk',d:true},{k:'rec',l:'세션 녹화',t:'chk',d:true},...F_HA,F_NOTE],
    d:{ svc:'22,3389', mfa:true, rec:true, zone:'mgmt' } },

  k8s: { n:'컨테이너 노드', ly:'srv', ic:'k8s', host:1, svc:'6443,30000-32767',
    models:['Kubernetes 1.30 Worker','OpenShift 4.15','Rancher RKE2','EKS Node Group','Docker Swarm'],
    f:[F_NAME,F_MODEL,F_IP,F_GW,F_VLAN,F_ZONE,{k:'svc',l:'수신 포트',t:'mono',d:'6443,30000-32767'},
       {k:'role',l:'역할',t:'sel',o:[['cp','Control Plane'],['worker','Worker']],d:'worker'},
       {k:'pods',l:'Pod CIDR',t:'mono',ph:'10.244.0.0/16'},
       {k:'cni',l:'CNI',t:'sel',o:[['calico','Calico'],['cilium','Cilium'],['flannel','Flannel'],['ovn','OVN-Kubernetes']],d:'calico'},
       ...F_HA,F_NOTE],
    d:{ role:'worker', cni:'calico', ha:'clu' } },

  esxi: { n:'가상화 호스트', ly:'srv', ic:'esxi', host:1, svc:'443,902',
    models:['VMware ESXi 8','Nutanix AHV','Proxmox VE 8','Hyper-V 2022','KVM/oVirt'],
    f:[F_NAME,F_MODEL,F_IP,F_GW,F_VLAN,F_ZONE,{k:'svc',l:'수신 포트',t:'mono',d:'443,902'},
       {k:'vms',l:'VM 수',t:'num',d:12},
       {k:'ha',l:'클러스터 HA',t:'sel',o:O_HA,d:'clu'},
       {k:'peer',l:'클러스터 짝',t:'nodesel'},
       {k:'drs',l:'DRS / 라이브 마이그레이션',t:'chk',d:true},
       F_NOTE],
    d:{ vms:12, ha:'clu', drs:true } },

  /* ---------- data ---------- */
  rdb: { n:'RDBMS', ly:'data', ic:'rdb', host:1, svc:'1521', w:118,
    models:['Oracle Exadata X10','Oracle DB 19c on RHEL','Tibero 7','SQL Server 2022','MySQL 8.4','PostgreSQL 16','MariaDB 11'],
    f:[F_NAME,{k:'eng',l:'엔진',t:'sel',o:O_DBENG,d:'oracle'},F_MODEL,F_IP,F_GW,F_VLAN,F_ZONE,
       {k:'svc',l:'리스너 포트',t:'mono',d:'1521'},
       {k:'dbha',l:'DB 이중화',t:'sel',o:O_DBHA,d:'none'},
       {k:'sync',l:'복제 모드',t:'sel',o:O_SYNC,d:'sync'},
       {k:'peer',l:'상대 노드',t:'nodesel'},
       {k:'vip',l:'SCAN/VIP',t:'mono',ph:'10.10.30.100',help:'RAC SCAN, AG Listener, Patroni VIP 등 클라이언트 접속점.'},
       {k:'role',l:'역할',t:'sel',o:[['pri','Primary / 쓰기'],['sec','Standby / 읽기'],['both','A/A 양방향']],d:'pri'},
       {k:'store',l:'스토리지 연결',t:'nodesel'},
       {k:'ha',l:'노드 이중화',t:'sel',o:O_HA,d:'none'},
       F_NOTE],
    d:{ eng:'oracle', svc:'1521', dbha:'none', sync:'sync', role:'pri' } },

  nosql: { n:'NoSQL', ly:'data', ic:'nosql', host:1, svc:'27017',
    models:['MongoDB 7 Replica Set','Elasticsearch 8','Cassandra 5','Couchbase','InfluxDB'],
    f:[F_NAME,F_MODEL,F_IP,F_GW,F_VLAN,F_ZONE,{k:'svc',l:'수신 포트',t:'mono',d:'27017'},
       {k:'shard',l:'샤딩',t:'chk'},{k:'repl',l:'복제본 수',t:'num',d:3},
       {k:'ha',l:'이중화 방식',t:'sel',o:O_HA,d:'clu'},{k:'peer',l:'클러스터 짝',t:'nodesel'},F_NOTE],
    d:{ svc:'27017', repl:3, ha:'clu' } },

  cache: { n:'캐시 / 세션', ly:'data', ic:'cache', host:1, svc:'6379',
    models:['Redis 7 Sentinel','Redis Cluster','Memcached','Hazelcast','Valkey'],
    f:[F_NAME,F_MODEL,F_IP,F_GW,F_VLAN,F_ZONE,{k:'svc',l:'수신 포트',t:'mono',d:'6379'},
       {k:'ha',l:'이중화 방식',t:'sel',o:O_HA,d:'as'},{k:'peer',l:'짝',t:'nodesel'},
       {k:'vip',l:'VIP / Sentinel',t:'mono'},{k:'persist',l:'영속화(AOF/RDB)',t:'chk'},F_NOTE],
    d:{ svc:'6379', ha:'as' } },

  storage: { n:'스토리지', ly:'data', ic:'storage', host:1, svc:'3260',
    models:['NetApp AFF A400','Dell PowerStore 500T','HPE Primera','Pure FlashArray//X','Synology SA3600'],
    f:[F_NAME,F_MODEL,{k:'proto',l:'접속 프로토콜',t:'sel',o:O_STOR,d:'fc'},
       F_IP,F_GW,F_VLAN,F_ZONE,{k:'svc',l:'수신 포트',t:'mono',d:'3260'},
       {k:'raid',l:'RAID',t:'sel',o:O_RAID,d:'6'},
       {k:'cap',l:'용량',t:'text',ph:'120TB'},
       {k:'mpio',l:'멀티패스(MPIO)',t:'chk',d:true,help:'컨트롤러/경로 이중화. 끄면 경로가 SPOF입니다.'},
       {k:'ha',l:'컨트롤러 이중화',t:'sel',o:O_HA,d:'aa'},{k:'peer',l:'미러 짝',t:'nodesel'},F_NOTE],
    d:{ proto:'fc', raid:'6', mpio:true, ha:'aa', svc:'3260' } },

  backup: { n:'백업', ly:'data', ic:'backup', host:1, svc:'10000',
    models:['Veeam B&R 12','Commvault','Dell NetWorker','Rubrik','Veritas NetBackup'],
    f:[F_NAME,F_MODEL,F_IP,F_GW,F_VLAN,F_ZONE,{k:'svc',l:'수신 포트',t:'mono',d:'10000'},
       {k:'sched',l:'주기',t:'text',ph:'일 1회 전체 + 시간별 증분'},
       {k:'rpo',l:'목표 RPO',t:'text',ph:'1시간'},
       {k:'offsite',l:'원격지 복제',t:'chk'},F_NOTE],
    d:{ svc:'10000', zone:'mgmt' } },

  /* ---------- ep / mgmt ---------- */
  client: { n:'사용자망', ly:'ep', ic:'client', host:1, w:112,
    models:['사무실 PC 대역','지사 사용자','재택 VPN 사용자','키오스크/단말'],
    f:[F_NAME,F_MODEL,F_IP,F_GW,F_VLAN,F_ZONE,{k:'cnt',l:'단말 수',t:'num',d:50},F_NOTE],
    d:{ cnt:50, zone:'trust' } },

  nms: { n:'모니터링(NMS)', ly:'mgmt', ic:'nms', host:1, svc:'161,443',
    models:['Zabbix 7','Prometheus + Grafana','SolarWinds NPM','WhaTap','Datadog Agent'],
    f:[F_NAME,F_MODEL,F_IP,F_GW,F_VLAN,F_ZONE,{k:'svc',l:'수신 포트',t:'mono',d:'161,443'},F_NOTE],
    d:{ svc:'161,443', zone:'mgmt' } },

  siem: { n:'로그 / SIEM', ly:'mgmt', ic:'siem', host:1, svc:'514,9200',
    models:['Splunk Enterprise','Elastic Security','IBM QRadar','이글루 SPiDER TM','Wazuh'],
    f:[F_NAME,F_MODEL,F_IP,F_GW,F_VLAN,F_ZONE,{k:'svc',l:'수신 포트',t:'mono',d:'514,9200'},
       {k:'ret',l:'보관 기간',t:'text',ph:'6개월'},F_NOTE],
    d:{ svc:'514,9200', zone:'mgmt' } }
};

/* 타입키 <-> 인덱스 (URL 인코딩용 고정 순서 — 절대 순서를 바꾸지 말 것) */
const TYPE_ORDER = ['internet','wan','router','l3sw','l2sw','lb','apigw','proxy','fw','ips','waf','vpn','ddos','nac',
  'web','was','app','dns','mail','ad','bastion','k8s','esxi','rdb','nosql','cache','storage','backup','client','nms','siem'];
const TYPE_IDX = {}; TYPE_ORDER.forEach((k,i)=>TYPE_IDX[k]=i);

/* 팔레트 그룹 순서 */
const PALETTE = [
  ['edge', ['internet','wan']],
  ['net',  ['router','l3sw','l2sw','lb','apigw','proxy']],
  ['sec',  ['fw','ips','waf','vpn','ddos','nac']],
  ['srv',  ['web','was','app','dns','mail','ad','bastion','k8s','esxi']],
  ['data', ['rdb','nosql','cache','storage','backup']],
  ['ep',   ['client']],
  ['mgmt', ['nms','siem']]
];

/* 링크 종류: 물리 매체 + 색상 */
const LINKKIND = {
  cu:  { n:'구리 (UTP/RJ45)',  c:'#6E7C8C', d:'' },
  fo:  { n:'광 (SFP+/QSFP)',   c:'#0C7F91', d:'' },
  fc:  { n:'FC (SAN)',         c:'#7A4FBF', d:'' },
  hb:  { n:'HA 하트비트',       c:'#B67B12', d:'5 4' },
  wan: { n:'WAN 회선',         c:'#A76331', d:'9 4' },
  vpn: { n:'VPN 터널',         c:'#2E9E5B', d:'2 4' }
};
const LINKKIND_ORDER = ['cu','fo','fc','hb','wan','vpn'];

/* 잘 알려진 서비스 포트 */
const WKP = {
  20:'FTP-DATA',21:'FTP',22:'SSH',23:'TELNET',25:'SMTP',53:'DNS',80:'HTTP',88:'Kerberos',
  110:'POP3',123:'NTP',135:'RPC',139:'NetBIOS',143:'IMAP',161:'SNMP',389:'LDAP',443:'HTTPS',
  445:'SMB',465:'SMTPS',514:'Syslog',587:'SMTP-SUB',636:'LDAPS',993:'IMAPS',995:'POP3S',
  1433:'MSSQL',1521:'Oracle',1812:'RADIUS',2049:'NFS',3260:'iSCSI',3306:'MySQL',3389:'RDP',
  5432:'PostgreSQL',5672:'AMQP',6379:'Redis',6443:'K8s-API',8080:'HTTP-ALT',8443:'HTTPS-ALT',
  9000:'APP',9200:'Elastic',10000:'Backup',27017:'MongoDB'
};

/* 장비별 한 줄 설명 — 호버 어시스트 · 빠른 추가 · 팔레트 툴팁에 쓰인다 */
const DESC = {
  internet: '외부 공중망. 구성도의 트래픽 출발점이자 종착점 역할을 합니다.',
  wan:      '지사·타 센터와 잇는 전용회선/MPLS 구간. 대역폭과 이중화가 관건입니다.',
  router:   '서로 다른 네트워크 대역 사이에서 패킷의 다음 경로를 정합니다.',
  l3sw:     'VLAN 별 SVI 를 두고 내부 대역 간 라우팅을 담당하는 코어 장비입니다.',
  l2sw:     '같은 대역 안에서 프레임을 전달합니다. 여기에 붙은 장비들이 한 구간을 이룹니다.',
  lb:       '가상 IP(VIP) 로 들어온 요청을 살아있는 서버들에 나눠 보냅니다.',
  apigw:    'API 요청의 단일 진입점. 인증·유량 제어·라우팅을 처리합니다.',
  proxy:    '내부→외부(포워드) 또는 외부→내부(리버스) 요청을 대신 처리합니다.',
  fw:       '존과 5-튜플 기준으로 트래픽을 허용/차단하고 NAT 를 수행합니다.',
  ips:      '통과하는 트래픽에서 공격 패턴을 찾아 차단하거나 알립니다.',
  waf:      'HTTP 요청을 검사해 웹 취약점 공격을 막습니다.',
  vpn:      '암호화 터널로 원격 사용자나 다른 사업장을 내부망에 잇습니다.',
  ddos:     '대량 유입 트래픽을 걸러 회선과 장비를 지킵니다.',
  nac:      '접속 단말을 인증하고 정책에 맞지 않으면 격리합니다.',
  web:      '정적 콘텐츠를 처리하고 동적 요청은 WAS 로 넘깁니다.',
  was:      '애플리케이션 로직을 실행하고 DB 와 통신합니다.',
  app:      '배치·EAI·전문 처리 등 목적별 응용 서버입니다.',
  dns:      '도메인 이름을 IP 로 바꿔 줍니다. 장애 시 체감 영향이 큽니다.',
  mail:     '메일 송수신과 사서함을 담당합니다.',
  ad:       '계정·인증·권한을 중앙에서 관리합니다.',
  bastion:  '운영 서버로 가는 유일한 관문. 접근 기록과 통제를 담당합니다.',
  k8s:      '컨테이너를 실행하는 워커/컨트롤 노드입니다.',
  esxi:     'VM 을 올려 구동하는 가상화 호스트입니다.',
  rdb:      '관계형 데이터베이스. 이중화 방식이 RPO·RTO 를 결정합니다.',
  nosql:    '문서·검색·시계열 등 비관계형 데이터 저장소입니다.',
  cache:    '세션과 조회 결과를 메모리에 담아 응답을 앞당깁니다.',
  storage:  'FC/iSCSI/NFS 로 볼륨을 제공합니다. 다중 경로가 필수입니다.',
  backup:   '데이터를 주기적으로 복사해 둡니다. 주기가 곧 RPO 입니다.',
  client:   '사용자 PC 대역. 트래픽의 출발점으로 씁니다.',
  nms:      '장비 상태를 수집해 장애를 알립니다.',
  siem:     '로그를 모아 보관하고 이상 징후를 찾습니다.'
};
