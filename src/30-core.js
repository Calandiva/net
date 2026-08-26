/* ═══════════════════════════════════════════════════════════════════════════
   30-core.js — 상태 모델 · IP 유틸 · URL 인코딩(코덱) · 실행취소
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── IP 유틸 ───────────────────────────────────────────────────────────── */
const ipToInt = s => { const p = String(s||'').trim().split('.'); if (p.length!==4) return null;
  let v = 0; for (const x of p){ const n = +x; if (!/^\d+$/.test(x) || n<0 || n>255) return null; v = v*256 + n; } return v>>>0; };
const intToIp = v => [(v>>>24)&255,(v>>>16)&255,(v>>>8)&255,v&255].join('.');
const maskOf  = b => b<=0 ? 0 : (0xFFFFFFFF << (32-b)) >>> 0;

function parseCidr(s){
  if (!s) return null;
  const [a,b] = String(s).trim().split('/');
  const ip = ipToInt(a); if (ip===null) return null;
  const bits = b===undefined ? 32 : parseInt(b,10);
  if (!(bits>=0 && bits<=32)) return null;
  const m = maskOf(bits), net = (ip & m)>>>0;
  return { ip, bits, mask:m, net, bcast:(net | (~m>>>0))>>>0, str:intToIp(ip), cidr:intToIp(net)+'/'+bits };
}
const bareIp = s => { const c = parseCidr(s); return c ? c.str : null; };
const inNet  = (ipInt, net, bits) => ipInt!==null && ((ipInt & maskOf(bits))>>>0) === ((net & maskOf(bits))>>>0);
const sameSubnet = (a,b) => { const x=parseCidr(a), y=parseCidr(b); return !!(x&&y&&x.bits===y.bits&&x.net===y.net); };
const isPrivate = ip => { const v=ipToInt(ip); if(v===null) return false;
  return inNet(v,ipToInt('10.0.0.0'),8)||inNet(v,ipToInt('172.16.0.0'),12)||inNet(v,ipToInt('192.168.0.0'),16); };

/* 포트 문자열("80,443", "30000-32767") → 매칭 함수 */
function portMatch(spec, port){
  if (spec===undefined || spec===null || spec==='' || spec==='any' || spec==='*') return true;
  for (const part of String(spec).split(/[,\s]+/)){
    if (!part) continue;
    const m = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m){ if (port >= +m[1] && port <= +m[2]) return true; }
    else if (+part === port) return true;
  }
  return false;
}
const portName = p => WKP[p] ? WKP[p]+'/'+p : String(p);

/* ── 상태 ──────────────────────────────────────────────────────────────── */
const GRID = 16;
let S = null;            // 현재 문서
let UI = {               // URL에 저장하지 않는 휘발성 상태
  mode:'select', sel:null, selKind:null, selSet:new Set(), zoom:1, tx:0, ty:0,
  layers:{}, focus:null, trace:null, issues:[], anim:null, dirty:0
};
LAYERS && Object.keys(LAYERS).forEach(k=>UI.layers[k]=true);

function blankDoc(){
  return { t:'새 구성도', seq:1, n:[], e:[], f:[], view:{ z:1, x:0, y:0 } };
}
const uid = () => 'n' + (S.seq++);

function addNode(type, gx, gy, props){
  const def = T[type]; if (!def) return null;
  const p = Object.assign({}, def.d||{}, props||{});
  if (!p.name) p.name = autoName(type);
  if (!p.model && def.models && def.models.length) p.model = def.models[0];
  const n = { id:uid(), ty:type, x:gx, y:gy, p };
  S.n.push(n); return n;
}
function autoName(type){
  const base = ({internet:'INET',wan:'WAN',router:'RT',l3sw:'L3SW',l2sw:'L2SW',lb:'LB',apigw:'APIGW',proxy:'PRX',
    fw:'FW',ips:'IPS',waf:'WAF',vpn:'VPN',ddos:'DDoS',nac:'NAC',web:'WEB',was:'WAS',app:'APP',dns:'DNS',mail:'MAIL',
    ad:'AD',bastion:'BAS',k8s:'K8S',esxi:'ESXi',rdb:'DB',nosql:'NOSQL',cache:'CACHE',storage:'STG',backup:'BKP',
    client:'USER',nms:'NMS',siem:'SIEM'})[type] || 'ND';
  let i = 1; const used = new Set(S.n.map(x=>x.p.name));
  while (used.has(base+'-'+String(i).padStart(2,'0'))) i++;
  return base+'-'+String(i).padStart(2,'0');
}
const nodeById = id => S.n.find(n=>n.id===id) || null;
const edgeById = id => S.e.find(e=>e.id===id) || null;
function addEdge(a, b, kind){
  if (a===b) return null;
  if (S.e.some(e => (e.a===a&&e.b===b) || (e.a===b&&e.b===a))) return null;
  const e = { id:'e'+(S.seq++), a, b, k:kind||autoKind(a,b), pa:{}, pb:{} };
  S.e.push(e); return e;
}
function autoKind(a,b){
  const A = nodeById(a), B = nodeById(b); if (!A||!B) return 'cu';
  const ts = [A.ty,B.ty];
  if (ts.includes('storage') && (nodeById(a).p.proto==='fc' || nodeById(b).p.proto==='fc')) return 'fc';
  if (ts.includes('wan') || ts.includes('internet')) return 'wan';
  if (ts.includes('vpn')) return 'vpn';
  if (ts.some(t=>['lb','fw','l3sw','rdb','storage'].includes(t)) && ts.filter(t=>['lb','fw','l3sw'].includes(t)).length===2) return 'fo';
  return 'cu';
}
function delNode(id){
  S.n = S.n.filter(n=>n.id!==id);
  S.e = S.e.filter(e=>e.a!==id && e.b!==id);
  S.f = S.f.filter(f=>f.s!==id && f.d!==id);
  S.n.forEach(n=>{
    if (n.p.peer===id) n.p.peer = '';
    if (n.p.up===id) n.p.up = '';
    if (n.p.store===id) n.p.store = '';
    if (Array.isArray(n.p.pool)) n.p.pool = n.p.pool.filter(x=>x!==id);
  });
}
const delEdge = id => { S.e = S.e.filter(e=>e.id!==id); };

/* 노드의 링크 목록 / 상대편 */
const edgesOf = id => S.e.filter(e=>e.a===id||e.b===id);
const otherEnd = (e,id) => e.a===id ? e.b : e.a;
const endProps = (e,id) => e.a===id ? (e.pa||(e.pa={})) : (e.pb||(e.pb={}));

/* ── 실행취소 ──────────────────────────────────────────────────────────── */
const HIST = { past:[], future:[], lock:false };
function snapshot(){
  if (HIST.lock) return;
  HIST.past.push(JSON.stringify(S));
  if (HIST.past.length>80) HIST.past.shift();
  HIST.future.length = 0;
}
function undo(){ if (!HIST.past.length) return false;
  HIST.future.push(JSON.stringify(S)); S = JSON.parse(HIST.past.pop()); return true; }
function redo(){ if (!HIST.future.length) return false;
  HIST.past.push(JSON.stringify(S)); S = JSON.parse(HIST.future.pop()); return true; }

/* ═══════════════════════════════════════════════════════════════════════
   URL 코덱
   ───────────────────────────────────────────────────────────────────────
   [1] 문서를 배열 기반 최소 표현으로 정규화 (키 이름 제거, 기본값 생략,
       노드 참조를 배열 인덱스로 치환)
   [2] JSON → UTF-8 → DEFLATE(raw, CompressionStream) → base64url
   [3] location.hash = "#N1." + payload      (N1 = 압축 / N0 = 평문 폴백)
   해시는 서버로 전송되지 않으므로 구성 전체가 클라이언트에만 남는다.
   ═══════════════════════════════════════════════════════════════════════ */
const CODEC_VER = 1;

const b64u = {
  enc(bytes){ let s=''; const CH=0x8000;
    for (let i=0;i<bytes.length;i+=CH) s += String.fromCharCode.apply(null, bytes.subarray(i,i+CH));
    return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); },
  dec(str){ const s = atob(str.replace(/-/g,'+').replace(/_/g,'/'));
    const b = new Uint8Array(s.length); for (let i=0;i<s.length;i++) b[i]=s.charCodeAt(i); return b; }
};
const hasCS = typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
async function deflate(bytes){
  const cs = new CompressionStream('deflate-raw');
  const w = cs.writable.getWriter(); w.write(bytes); w.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}
async function inflate(bytes){
  const ds = new DecompressionStream('deflate-raw');
  const w = ds.writable.getWriter(); w.write(bytes); w.close();
  return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}

/* 노드 속성에서 타입 기본값과 같은 값은 버린다 */
function slimProps(node){
  const def = T[node.ty] ? (T[node.ty].d||{}) : {};
  const out = {};
  for (const k in node.p){
    const v = node.p[k];
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v) && !v.length) continue;
    if (JSON.stringify(v) === JSON.stringify(def[k])) continue;
    out[k] = v;
  }
  return out;
}

function normalize(doc){
  const idx = {}; doc.n.forEach((n,i)=>idx[n.id]=i);
  const ref = id => (id && idx[id]!==undefined) ? idx[id] : -1;
  const nodes = doc.n.map(n=>{
    const p = slimProps(n);
    // 노드 참조 필드는 인덱스로 치환
    if (p.peer  !== undefined) p.peer  = ref(p.peer);
    if (p.up    !== undefined) p.up    = ref(p.up);
    if (p.store !== undefined) p.store = ref(p.store);
    if (Array.isArray(p.pool)) p.pool  = p.pool.map(ref).filter(i=>i>=0);
    return [ TYPE_IDX[n.ty]!==undefined ? TYPE_IDX[n.ty] : n.ty, n.x, n.y, p ];
  });
  const edges = doc.e.map(e=>{
    const a = [ ref(e.a), ref(e.b), LINKKIND_ORDER.indexOf(e.k||'cu') ];
    const pa = e.pa && Object.keys(e.pa).length ? e.pa : 0;
    const pb = e.pb && Object.keys(e.pb).length ? e.pb : 0;
    if (pa || pb) { a.push(pa||0); a.push(pb||0); }
    return a;
  });
  const flows = (doc.f||[]).map(f=>[ f.n||'', ref(f.s), f.d && f.d.startsWith && !idx[f.d] ? f.d : ref(f.d), f.pt||443, f.pr||'tcp', f.on===false?0:1 ]);
  return { v:CODEC_VER, t:doc.t||'', n:nodes, e:edges, f:flows, w:[doc.view.z, doc.view.x, doc.view.y] };
}

function denormalize(o){
  const doc = blankDoc();
  doc.t = o.t || '새 구성도';
  doc.seq = 1;
  const ids = [];
  (o.n||[]).forEach(a=>{
    const ty = typeof a[0]==='number' ? TYPE_ORDER[a[0]] : a[0];
    if (!T[ty]) return;
    const id = 'n'+(doc.seq++);
    ids.push(id);
    doc.n.push({ id, ty, x:a[1]|0, y:a[2]|0, p:Object.assign({}, T[ty].d||{}, a[3]||{}) });
  });
  const R = i => (typeof i==='number' && i>=0 && ids[i]) ? ids[i] : '';
  doc.n.forEach(n=>{
    const p = n.p;
    if (typeof p.peer  === 'number') p.peer  = R(p.peer);
    if (typeof p.up    === 'number') p.up    = R(p.up);
    if (typeof p.store === 'number') p.store = R(p.store);
    if (Array.isArray(p.pool)) p.pool = p.pool.map(R).filter(Boolean);
    if (!p.name) p.name = n.ty.toUpperCase();
  });
  (o.e||[]).forEach(a=>{
    const A = R(a[0]), B = R(a[1]); if (!A||!B) return;
    doc.e.push({ id:'e'+(doc.seq++), a:A, b:B, k:LINKKIND_ORDER[a[2]]||'cu', pa:a[3]||{}, pb:a[4]||{} });
  });
  (o.f||[]).forEach(a=>{
    const s = R(a[1]); if (!s) return;
    const d = typeof a[2]==='number' ? R(a[2]) : a[2];
    doc.f.push({ id:'f'+(doc.seq++), n:a[0]||'플로우', s, d, pt:a[3]||443, pr:a[4]||'tcp', on:a[5]!==0 });
  });
  if (o.w) doc.view = { z:o.w[0]||1, x:o.w[1]||0, y:o.w[2]||0 };
  return doc;
}

async function encodeDoc(doc){
  const json = JSON.stringify(normalize(doc));
  const bytes = new TextEncoder().encode(json);
  if (hasCS){
    try { return 'N1.' + b64u.enc(await deflate(bytes)); } catch(_){}
  }
  return 'N0.' + b64u.enc(bytes);
}
async function decodeDoc(payload){
  if (!payload) return null;
  const dot = payload.indexOf('.');
  const tag = dot>0 ? payload.slice(0,dot) : 'N0';
  const body = dot>0 ? payload.slice(dot+1) : payload;
  let bytes = b64u.dec(body);
  if (tag === 'N1'){
    if (!hasCS) throw new Error('이 브라우저는 압축 해제(DecompressionStream)를 지원하지 않습니다.');
    bytes = await inflate(bytes);
  }
  return denormalize(JSON.parse(new TextDecoder().decode(bytes)));
}

let urlTimer = null, lastHash = '';
function scheduleUrl(){
  clearTimeout(urlTimer);
  urlTimer = setTimeout(async ()=>{
    try{
      S.view = { z:+UI.zoom.toFixed(3), x:Math.round(UI.tx), y:Math.round(UI.ty) };
      S.t = document.getElementById('docname').value || '새 구성도';
      const p = await encodeDoc(S);
      lastHash = '#' + p;
      try { history.replaceState(null, '', lastHash); }
      catch(_){ try { location.hash = p; } catch(__){ UI.urlLocked = true; } }
      if (document.getElementById('urlLen')) renderUrlPane();
    }catch(err){ console.warn('URL 저장 실패', err); }
  }, 260);
}
async function currentUrl(){
  const p = await encodeDoc(S);
  return location.href.split('#')[0] + '#' + p;   // file:// 에서도 동작
}
