/* ═══════════════════════════════════════════════════════════════════════════
   80-app.js — 툴바 · 모달 · 단축키 · 부팅
   ═══════════════════════════════════════════════════════════════════════════ */

function openModal(title, html){
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = html;
  $('#modal').classList.add('on');
}
const closeModal = ()=>$('#modal').classList.remove('on');

/* ── 랜덤 구성도 ───────────────────────────────────────────────────────── */
function openRandom(){
  openModal('레퍼런스 구성도 생성', `
    <p>실제 데이터센터 표준 설계를 따르는 구성도를 만듭니다. IP·VLAN·존·방화벽 정책·이중화·LB 풀·검증 플로우가 모두 채워진 상태로 생성되며, 생성 직후 자동 검증을 통과합니다.</p>
    <div class="tplgrid">
      ${PROFILES.map(p=>`<button class="tpl" data-p="${p.key}"><b>${esc(p.name)}</b><span>${esc(p.desc)}</span>
        <em>WEB ${p.web} · WAS ${p.was} · ${p.dualFw?'2단 방화벽':'단일 방화벽'}${p.waf?' · WAF':''}${p.ips?' · IPS':''}${p.ddos?' · DDoS':''}</em></button>`).join('')}
      <button class="tpl" data-p="*"><b>완전 랜덤</b><span>위 프로파일 중 하나를 무작위로 고르고 대역·제품·알고리즘·DB 이중화 방식을 매번 다르게 조합합니다.</span><em>매번 다른 결과</em></button>
    </div>`);
  $$('#modalBody .tpl').forEach(b=>b.onclick=()=>{
    const k = b.dataset.p;
    snapshot();
    const doc = genRandom(k==='*'?null:k);
    S = doc; $('#docname').value = S.t;
    UI.sel=null; UI.focus=null; UI.trace=null; UI.traceId=null; UI.spof=null;
    closeModal(); afterEdit(); fitView();
    const res = validateAll();
    const err = res.issues.filter(i=>i.lv==='e').length;
    toast(err ? `생성 완료 — 오류 ${err}건 (검증 탭 확인)` : `생성 완료 — ${S.n.length}개 장비, 전체 플로우 정상`, err?'':'good');
  });
}

/* ── 저장 (텍스트 / 파일) ──────────────────────────────────────────────── */
function fileName(ext){
  const base = (S.t||'netforge').replace(/[\\/:*?"<>|]/g,'_').slice(0,60).trim() || 'netforge';
  return base + '.' + ext;
}
/* 저장 경로는 두 가지 — 상위 뷰어가 중개하는 저장(Artifact)과 일반 브라우저 다운로드 */
const DL = (typeof window!=='undefined' && window.claude && typeof window.claude.use==='function')
  ? window.claude.use('downloads').catch(()=>null) : Promise.resolve(null);
async function download(text, name, mime){
  try{
    const dl = await DL;
    if (dl){
      try { await dl.save({ filename:name, data:text }); toast(name + ' 저장', 'good'); }
      catch(err){ if (!err || err.code!=='declined') toast('저장 실패: '+((err&&err.message)||''), 'bad'); }
      return;
    }
  }catch(_){}
  try{
    const b = new Blob([text], { type:(mime||'text/plain')+';charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 3000);
    toast(name + ' 저장', 'good');
  }catch(err){ toast('저장 실패: '+err.message+' — 텍스트를 복사해 쓰세요.', 'bad'); }
}
async function openExport(){
  const compact = await encodeDoc(S);
  const json = JSON.stringify(normalize(S), null, 1);
  const url = await currentUrl();
  openModal('구성 저장', `
    <p>구성 전체(장비·IP·VLAN·존·정책·이중화·플로우·화면 상태)를 <b>텍스트</b>로 저장합니다. 아래 텍스트만 있으면 어디서든 그대로 복원됩니다.</p>
    <div class="row" style="margin-bottom:8px">
      <label class="ck"><input type="radio" name="exfmt" value="c" checked> 압축 텍스트 <span class="muted">(한 줄, 공유용)</span></label>
      <label class="ck"><input type="radio" name="exfmt" value="j"> JSON <span class="muted">(사람이 읽고 편집 가능)</span></label>
      <label class="ck"><input type="radio" name="exfmt" value="u"> 전체 URL</label>
    </div>
    <textarea id="exBox" rows="14" style="width:100%"></textarea>
    <div class="row" style="margin-top:8px;flex-wrap:wrap">
      <button class="btn pri" id="exCopy">텍스트 복사</button>
      <button class="btn" id="exTxt">텍스트 파일(.txt)로 저장</button>
      <button class="btn" id="exJson">.json 파일로 저장</button>
      <button class="btn" id="exLoad">이 텍스트로 되돌리기</button>
    </div>
    <p class="muted" style="margin-top:10px">저장된 텍스트 파일은 압축 텍스트 한 줄입니다. 불러오기 창에 붙여넣거나 파일을 선택하면 됩니다.</p>`);
  const box = $('#exBox');
  const set = ()=>{ const v=[...document.getElementsByName('exfmt')].find(r=>r.checked).value;
    box.value = v==='c' ? compact : v==='j' ? json : url; };
  [...document.getElementsByName('exfmt')].forEach(r=>r.onchange=set);
  set();
  $('#exCopy').onclick = async ()=>{ try{ await navigator.clipboard.writeText(box.value); toast('복사했습니다.','good'); }
    catch(_){ box.select(); document.execCommand('copy'); toast('복사했습니다.','good'); } };
  $('#exTxt').onclick  = ()=>download(compact, fileName('netforge.txt'), 'text/plain');
  $('#exJson').onclick = ()=>download(json, fileName('json'), 'application/json');
  $('#exLoad').onclick = ()=>{ importText(box.value); closeModal(); };
}

/* ── 불러오기 (텍스트 / 파일) ──────────────────────────────────────────── */
function openImport(){
  openModal('구성 불러오기', `
    <p>저장해 둔 <b>압축 텍스트</b>·<b>JSON</b>·<b>URL</b> 중 무엇이든 붙여넣거나, <code>.nfg</code>/<code>.json</code> 파일을 선택하세요.</p>
    <textarea id="imBox" rows="12" style="width:100%" placeholder="N1.eJyt... / {&quot;v&quot;:1,...} / https://….#N1.…"></textarea>
    <div class="row" style="margin-top:8px;flex-wrap:wrap">
      <button class="btn pri" id="imGo">불러오기</button>
      <button class="btn" id="imPick">파일 선택…</button>
      <button class="btn" id="imPaste">클립보드에서 붙여넣기</button>
      <input type="file" id="imFile" accept=".txt,.json,.nfg,text/plain,application/json" style="display:none">
    </div>
    <p class="muted" style="margin-top:10px">불러오면 현재 구성이 대체됩니다. <code>Ctrl+Z</code> 로 되돌릴 수 있습니다.</p>`);
  $('#imGo').onclick    = ()=>{ importText($('#imBox').value); closeModal(); };
  $('#imPick').onclick  = ()=>$('#imFile').click();
  $('#imFile').onchange = ev=>{
    const f = ev.target.files && ev.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = ()=>{ $('#imBox').value = String(rd.result||''); importText($('#imBox').value); closeModal(); };
    rd.onerror = ()=>toast('파일을 읽지 못했습니다.','bad');
    rd.readAsText(f, 'utf-8');
  };
  $('#imPaste').onclick = async ()=>{ try{ $('#imBox').value = await navigator.clipboard.readText(); }
    catch(_){ toast('브라우저가 클립보드 읽기를 막았습니다. 직접 붙여넣어 주세요.','bad'); } };
}

/* ── 도움말 ────────────────────────────────────────────────────────────── */
function openHelp(){
  openModal('NetForge 사용법 · 모델링 근거', `
<h4>1. 기본 조작</h4>
<ul>
  <li><b>배치</b> — 좌측 팔레트에서 끌어놓거나 클릭. 캔버스를 <b>더블클릭</b>하면 이름을 쳐서 바로 넣는 빠른 추가 창이 열립니다.</li>
  <li><b>연결</b> — 노드 가장자리의 포트에서 끌어 다른 장비에 놓습니다. 끌고 가는 동안 대상 장비와 붙을 포트가 표시됩니다.</li>
  <li><b>이동</b> — 드래그. 다른 장비와 줄이 맞으면 자동으로 붙고 안내선이 뜹니다. <code>Alt</code> 를 누르면 스냅이 풀립니다.</li>
  <li><b>선택</b> — 빈 곳 드래그로 범위 선택, <code>Shift</code>+클릭으로 추가 선택. 여러 개를 고르면 정렬·간격·일괄 작업을 쓸 수 있습니다.</li>
  <li><b>화면</b> — <code>Space</code>+드래그 또는 가운데 버튼으로 이동, 휠로 확대·축소, <code>Shift</code>+휠로 좌우 이동.</li>
  <li><b>우클릭</b> — 장비·링크·빈 곳 각각에 맞는 메뉴가 열립니다 (연결 시작, 이중화 짝 지정, 매체·포트 변경, 정렬, 붙여넣기 등).</li>
  <li><b>호버</b> — 장비·포트·링크에 마우스를 올리면 그것이 무엇이고 어떻게 설정돼 있는지 설명이 뜹니다.</li>
  <li><b>장애</b> 모드에서 노드·링크를 클릭하면 다운시켜 절체 동작을 확인할 수 있습니다. 우클릭 메뉴에서도 됩니다.</li>
  <li>단축키 — <code>V</code>/<code>L</code>/<code>F</code> 모드 · <code>방향키</code> 이동 · <code>Ctrl+A/C/V/D</code> 전체선택·복사·붙여넣기·복제 ·
      <code>F2</code> 이름변경 · <code>Del</code> 삭제 · <code>0</code> 화면맞춤 · <code>R</code> 랜덤 · <code>Enter</code> 검증 · <code>Ctrl+Z</code> 실행취소</li>
</ul>

<h4>2. 노드 상하좌우 포트의 의미</h4>
<div class="tblwrap"><table>
<thead><tr><th>위치</th><th>역할</th><th>어떤 연결에 쓰나</th></tr></thead>
<tbody>
<tr><td>▲ 위</td><td>업링크</td><td>상위망 방향 — 인터넷·코어·상단 스위치로 올라가는 회선</td></tr>
<tr><td>▼ 아래</td><td>다운링크</td><td>하위망 방향 — 서버·단말·하단 스위치로 내려가는 회선</td></tr>
<tr><td>◆ 좌 / 우</td><td>피어</td><td>같은 계층끼리 — 이중화 짝의 하트비트, 스위치 스택/MLAG, DB 복제</td></tr>
</tbody></table></div>
<p>포트는 두 장비의 상대 위치에서 자동으로 정해집니다. 특정 포트에서 끌어 연결하거나 우클릭 메뉴에서 고르면 그 선택이 고정되고, “포트 자동 배치로 되돌리기”로 해제할 수 있습니다. 한 면에 여러 회선이 붙으면 패치 패널처럼 자리를 나눠 겹치지 않게 그립니다.</p>

<h4>3. 네트워크 구간(세그먼트)이 만들어지는 규칙</h4>
<ul>
  <li>L2 스위치·인라인 IPS·브리지 WAF·투명모드 방화벽은 <b>투과 장비</b>로 보고, 이들을 건너 연결된 링크를 하나의 <b>브로드캐스트 도메인</b>으로 묶습니다.</li>
  <li>같은 도메인이라도 포트의 <b>VLAN 이 다르면 다른 구간</b>이 됩니다 (액세스 포트 모델).</li>
  <li>구간의 서브넷은 그 구간에 붙은 인터페이스 IP 중 다수결로 정해지고, 다른 대역이 섞이면 오류로 표시합니다.</li>
  <li>L3 스위치의 <code>SVI</code> 는 같은 VLAN 이 존재하는 구간에 가상 인터페이스로 붙습니다.<br>
      문법: <code>20 SVI 10.10.20.11/24 trust vip 10.10.20.1</code></li>
  <li><b>FC</b>·<b>HA 하트비트</b> 매체의 링크는 IP 를 갖지 않는 물리 경로로만 취급합니다.</li>
</ul>

<h4>4. 포워딩 시뮬레이션이 따르는 실제 동작</h4>
<div class="tblwrap"><table>
<thead><tr><th>영역</th><th>구현한 동작</th><th>근거가 된 실제 제품/표준</th></tr></thead>
<tbody>
<tr><td>방화벽 정책</td><td>위→아래 first-match, 미매칭 시 동일 존 허용 / 다른 존 차단(implicit deny)</td><td>Palo Alto PAN-OS 보안 정책 기본 동작</td></tr>
<tr><td>NAT</td><td>DNAT 는 라우팅 전에 목적지를 변환, SNAT 는 송신 인터페이스에서 출발지를 변환</td><td>PAN-OS NAT 정책 (본 도구는 편의를 위해 <i>변환 후</i> 주소로 정책을 평가합니다)</td></tr>
<tr><td>로드밸런싱</td><td>RR / Ratio / Least Conn / Weighted LC / Fastest / Observed / Predictive / Source·URI Hash</td><td>F5 BIG-IP LTM 분산 알고리즘 (정적 2종 + 동적 4종)</td></tr>
<tr><td>세션 지속성</td><td>Source Address · Cookie Insert(L7 전용) · SSL Session ID · Destination</td><td>F5 LTM Persistence Profile</td></tr>
<tr><td>게이트웨이 이중화</td><td>가상 IP + 우선순위 + Preempt. 높은 우선순위의 정상 장비가 VIP 응답</td><td>VRRP(RFC 5798) / HSRP / GLBP</td></tr>
<tr><td>방화벽 이중화</td><td>A/S 쌍은 <b>동일한 인터페이스 IP</b>를 공유하고 장애 시 정상기가 그 주소를 인수</td><td>PAN-OS / FortiGate Active-Passive HA 의 플로팅 인터페이스</td></tr>
<tr><td>DB 이중화</td><td>RAC·Data Guard·Always On·FCI·반동기·Group Replication·스트리밍·Patroni 별 RPO/RTO 산출</td><td>Oracle MAA, MySQL semi-sync, PostgreSQL streaming replication</td></tr>
<tr><td>인라인 보안장비</td><td>다운 시 <b>fail-open 바이패스</b>면 회선 유지, 아니면 구간 단절</td><td>IPS/DDoS 장비의 물리 바이패스 모듈</td></tr>
<tr><td>라우팅</td><td>연결·정적·기본경로는 최장 프리픽스 매칭, OSPF/BGP/EIGRP/IS-IS 는 동일 프로토콜 라우터 간 최단경로 학습</td><td>일반 라우팅 원리(단순화 모델)</td></tr>
</tbody></table></div>
<p class="muted">단방향 포워딩만 계산합니다. 상태 기반 방화벽의 리턴 트래픽은 허용된 것으로 간주합니다.</p>

<h4>5. 무엇을 검증하나</h4>
<ul>
  <li><b>연결성</b> — 미연결 노드, 링크 단절, 투과 장비 다운, L2 경로 부재</li>
  <li><b>주소</b> — IP 미설정, IP 충돌, 구간 서브넷 불일치, 게이트웨이 대역 오류·응답 없음</li>
  <li><b>라우팅</b> — 경로 없음, 넥스트홉 불일치, 루프</li>
  <li><b>보안</b> — implicit deny 차단, any-any 허용 규칙, 존 미지정, 인터넷 직결, 아웃바운드 NAT 누락</li>
  <li><b>부하분산</b> — VIP·풀 미설정, 멤버 포트 불일치, SNAT 없이 게이트웨이 불일치(비대칭 경로), L4 에 Cookie 지속성</li>
  <li><b>가용성</b> — 이중화 짝/VIP 누락, 하트비트 링크 없음, 단일 상단 스위치, DB 단일 인스턴스, 스토리지 단일 경로</li>
  <li><b>SPOF 분석</b> — 모든 장비·링크를 하나씩 다운시켜 어떤 플로우가 끊기는지 전수 계산</li>
</ul>

<h4>6. 저장 · 불러오기 · 배포</h4>
<ul>
  <li><b>저장</b> — 압축 텍스트 한 줄(<code>.txt</code>), 읽을 수 있는 JSON, 전체 URL 셋 중에서 고를 수 있습니다. 모두 순수 텍스트라 메신저·이슈트래커·형상관리에 그대로 붙여 넣을 수 있습니다.</li>
  <li><b>불러오기</b> — 위 셋 중 아무거나 붙여넣거나 파일을 선택하면 됩니다. 형식은 자동으로 판별합니다.</li>
  <li><b>배포</b> — 의존성 없는 정적 HTML 파일 하나입니다. GitHub Pages 는 저장소에 <code>index.html</code> 을 두고 Pages 를 켜면 되고, Vercel 은 그 폴더를 그대로 올리면 됩니다(빌드 명령 불필요).</li>
  <li><b>로컬 실행</b> — 파일을 더블클릭해 <code>file://</code> 로 열어도 모든 기능이 동작합니다. 이 경우 주소창 자동 갱신이 브라우저에 따라 제한될 수 있는데, 저장 버튼으로 텍스트를 뽑으면 동일하게 보존됩니다. 인터넷이 없으면 웹폰트만 시스템 글꼴로 대체됩니다.</li>
</ul>

<h4>7. URL 인코딩 규칙</h4>
<ul>
  <li>노드·링크·플로우·화면상태까지 <b>모든 정보</b>가 URL 해시에 들어갑니다. 서버 저장소가 없습니다.</li>
  <li>정규화: 키 이름을 제거하고 <code>노드=[타입번호,x,y,속성]</code>, <code>링크=[a인덱스,b인덱스,매체]</code>. 노드 참조는 배열 인덱스로 치환하고 타입 기본값과 같은 속성은 생략합니다.</li>
  <li>압축: <code>JSON → UTF-8 → DEFLATE(raw) → base64url</code>, 접두사 <code>N1.</code> (미지원 브라우저는 평문 <code>N0.</code>).</li>
  <li>해시는 서버로 전송되지 않으므로 구성 정보가 외부로 나가지 않습니다. URL 탭에서 길이와 압축률을 확인할 수 있습니다.</li>
</ul>`);
}

/* ── 툴바 ──────────────────────────────────────────────────────────────── */
function initToolbar(){
  $$('#modeseg button').forEach(b=>b.onclick=()=>{
    UI.mode = b.dataset.mode;
    $$('#modeseg button').forEach(x=>x.classList.toggle('on', x===b));
    $('#stage').classList.toggle('linking', UI.mode==='link');
    $('#minihelp').innerHTML = UI.mode==='link' ? '<b>연결 모드</b> — 장비를 누른 채 대상 장비로 끌어놓으세요. 가까운 쪽 포트가 자동으로 선택됩니다.'
      : UI.mode==='fault' ? '<b>장애 모드</b> — 노드나 링크를 클릭하면 다운/복구됩니다. 이중화 절체가 즉시 반영됩니다.'
      : '<b>▲</b> 위=업링크 <b>▼</b> 아래=다운링크 <b>◆</b> 좌우=피어 &middot; 포트에서 끌면 연결 &middot; 빈 곳 드래그=범위선택 &middot; Space+드래그=화면이동 &middot; 우클릭=메뉴';
  });
  $('#btnRandom').onclick   = openRandom;
  $('#btnValidate').onclick = ()=>{ runValidate(true); switchTab('val'); };
  $('#btnAutoIP').onclick   = ()=>{ snapshot(); const n = autoAssignIP(); afterEdit();
    toast(n ? `${n}개 인터페이스에 IP 를 할당했습니다.` : '비어 있는 IP 가 없습니다.', n?'good':''); };
  $('#btnFit').onclick      = fitView;
  $('#btnZin').onclick      = ()=>{ UI.zoom=Math.min(3,UI.zoom*1.2); applyView(); scheduleUrl(); };
  $('#btnZout').onclick     = ()=>{ UI.zoom=Math.max(.18,UI.zoom/1.2); applyView(); scheduleUrl(); };
  $('#btnPal').onclick      = ()=>$('#palette').classList.toggle('hide');
  $('#btnDock').onclick     = ()=>$('#dock').classList.toggle('hide');
  $('#btnUndo').onclick     = ()=>{ if (undo()){ HIST.lock=true; afterEdit(); HIST.lock=false; $('#docname').value=S.t; } };
  $('#btnRedo').onclick     = ()=>{ if (redo()){ HIST.lock=true; afterEdit(); HIST.lock=false; $('#docname').value=S.t; } };
  $('#btnShare').onclick    = copyUrl;
  $('#btnExport').onclick   = openExport;
  $('#btnImport').onclick   = openImport;
  $('#btnHelp').onclick     = openHelp;
  $('#modalClose').onclick  = closeModal;
  $('#modal').onclick       = ev=>{ if (ev.target.id==='modal') closeModal(); };
  $('#docname').onchange    = ()=>{ S.t = $('#docname').value; scheduleUrl(); };
  $$('#tabs button').forEach(b=>b.onclick=()=>switchTab(b.dataset.pane));

  /* 테마 */
  const applyTheme = v => {
    if (v==='system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', v);
    try{ localStorage.setItem('nf-theme', v); }catch(_){}
  };
  let theme = 'system';
  try{ theme = localStorage.getItem('nf-theme') || 'system'; }catch(_){}
  applyTheme(theme);
  $('#btnTheme').onclick = ()=>{
    theme = theme==='system' ? 'light' : theme==='light' ? 'dark' : 'system';
    applyTheme(theme);
    toast('테마: ' + ({system:'시스템 설정',light:'라이트',dark:'다크'})[theme]);
  };

  /* 단축키 */
  addEventListener('keydown', ev=>{
    const tag = (ev.target.tagName||'').toLowerCase();
    if (['input','textarea','select'].includes(tag)) return;
    const mod = ev.ctrlKey||ev.metaKey;
    if (mod && ev.key.toLowerCase()==='z'){ ev.preventDefault();
      (ev.shiftKey?redo:undo)() && (HIST.lock=true, afterEdit(), HIST.lock=false, $('#docname').value=S.t); return; }
    if (mod && ev.key.toLowerCase()==='s'){ ev.preventDefault(); openExport(); return; }
    if (mod && ev.key.toLowerCase()==='o'){ ev.preventDefault(); openImport(); return; }
    if (mod && ev.key.toLowerCase()==='a'){ ev.preventDefault(); setSel(S.n.map(n=>n.id)); return; }
    if (mod && ev.key.toLowerCase()==='c'){ ev.preventDefault(); copySel(); return; }
    if (mod && ev.key.toLowerCase()==='d'){ ev.preventDefault();
      const ids=[...(UI.selSet||[])].filter(id=>nodeById(id)); if (ids.length) duplicateNodes(ids); return; }
    if (mod && ev.key.toLowerCase()==='v'){ ev.preventDefault();
      const st=$('#stage').getBoundingClientRect();
      const w=screenToWorld(st.left+st.width/2, st.top+st.height/2); pasteAt(w.x, w.y); return; }
    if (mod) return;
    /* 방향키 이동 */
    if (ev.key.startsWith('Arrow')){
      const ns = selectionNodes();
      if (ns.length){
        ev.preventDefault();
        const step = (ev.shiftKey ? 4 : 1) * GRID;
        const dx = ev.key==='ArrowLeft' ? -step : ev.key==='ArrowRight' ? step : 0;
        const dy = ev.key==='ArrowUp'   ? -step : ev.key==='ArrowDown'  ? step : 0;
        snapshot(); ns.forEach(n=>{ n.x+=dx; n.y+=dy; }); markLayout(); afterEdit();
      }
      return;
    }
    switch(ev.key){
      case 'v': case 'V': $$('#modeseg button')[0].click(); break;
      case 'l': case 'L': $$('#modeseg button')[1].click(); break;
      case 'f': case 'F': $$('#modeseg button')[2].click(); break;
      case '0': fitView(); break;
      case 'r': case 'R': openRandom(); break;
      case 'F2': if (UI.sel && nodeById(UI.sel)){ ev.preventDefault(); renameNode(UI.sel); } break;
      case 'Enter': runValidate(true); switchTab('val'); break;
      case 'Escape': closeModal(); closeCtx(); closeQuick(); UI.focus=null; select(null); render(); break;
      case 'Delete': case 'Backspace': {
        const ids = [...(UI.selSet||[])];
        if (ids.length){ ev.preventDefault(); snapshot();
          ids.forEach(id=>{ if (nodeById(id)) delNode(id); else delEdge(id); });
          select(null); afterEdit();
          toast(`${ids.length}개 삭제`); }
        break;
      }
    }
  });
  addEventListener('resize', ()=>applyView());
}

/* ── 부팅 ──────────────────────────────────────────────────────────────── */
async function boot(){
  S = blankDoc();
  const hash = decodeURIComponent(location.hash.replace(/^#/,''));
  let loaded = false;
  if (hash){
    try { const d = await decodeDoc(hash); if (d){ S = d; loaded = true; } }
    catch(err){ console.warn(err); }
  }
  if (!loaded) S = genRandom('dmz3tier');

  $('#docname').value = S.t;
  UI.zoom = S.view.z||1; UI.tx = S.view.x||0; UI.ty = S.view.y||0;

  renderPalette(); initCanvas(); initToolbar(); applyView();
  afterEdit();
  if (!loaded || !S.view || (!S.view.x && !S.view.y)) fitView();
  switchTab('insp');
  if (!loaded) setTimeout(()=>toast('예제 구성도를 불러왔습니다. 상단 “랜덤 구성도”로 다른 아키텍처를 만들어 보세요.'), 500);
}
boot();
