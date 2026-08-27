/* ═══════════════════════════════════════════════════════════════════════════
   86-tutorial-ui.js — 학습 탭 (과제 목록 · 안내 · 채점)
   ═══════════════════════════════════════════════════════════════════════════ */

let tutTimer = null;
const tutPaneOn = () => $('#pane-tut') && $('#pane-tut').classList.contains('on');

/* 구성이 바뀔 때마다 자동으로 다시 채점한다 — 채점 버튼을 누르지 않아도 된다 */
function tutRefreshSoon(){
  if (!TUT.cur) return;
  clearTimeout(tutTimer);
  tutTimer = setTimeout(tutAutoGrade, 420);
}
function tutBadge(){
  const el = $('#cntTut'); if (!el) return;
  const st = tutStats();
  el.textContent = TUT.cur ? (TUT.last ? TUT.last.score : st.done) : st.done;
  el.className = 'cnt' + (TUT.cur ? (TUT.last && TUT.last.passed ? ' warn' : '') : '');
}
function tutAutoGrade(){
  const les = LESSONS.find(l=>l.id===TUT.cur); if (!les) return null;
  const before = TUT.last;
  let g; try { g = gradeLesson(les); } catch(err){ console.warn('채점 실패', err); return null; }
  TUT.last = g;
  const best = TUT.prog[les.id];
  if (!best || g.score > best.score || (g.passed && !best.passed)){
    TUT.prog[les.id] = { score:g.score, passed:g.passed, grade:g.grade };
    tutSaveProg();
  }
  /* 방금 조건을 채운 순간에만 알린다 */
  if (g.passed && !(before && before.passed))
    toast(`통과! ${les.id}. ${les.title} — ${g.score}점 (${g.grade})`, 'good');
  else if (before && before.passed && !g.passed)
    toast(`조건이 다시 깨졌습니다 — 남은 조건 ${g.rt-g.rp}개`, 'bad');
  else if (before && g.rp > before.rp)
    toast(`조건 달성 ${g.rp}/${g.rt}`);
  if (tutPaneOn()) renderTutorialPane(true);
  tutBadge();
  return g;
}

function tutStats(){
  const done = LESSONS.filter(l=>TUT.prog[l.id] && TUT.prog[l.id].passed).length;
  const scores = LESSONS.map(l=>TUT.prog[l.id] ? TUT.prog[l.id].score : null).filter(x=>x!==null);
  const avg = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0;
  return { done, total:LESSONS.length, avg, tried:scores.length };
}

function openLesson(id){
  const les = LESSONS.find(l=>l.id===id); if (!les) return;
  const go = ()=>{
    snapshot();
    try { S = les.seed ? les.seed() : blankDoc(); } catch(err){ console.warn(err); S = blankDoc(); }
    if (!S.t) S.t = `${les.id}. ${les.title}`;
    $('#docname').value = S.t;
    TUT.cur = id; TUT.last = null;
    UI.sel=null; UI.selSet=new Set(); UI.focus=null; UI.trace=null; UI.traceId=null; UI.spof=null;
    afterEdit(); fitView(); switchTab('tut'); tutAutoGrade(); renderTutorialPane();
    toast(`${les.id}. ${les.title} 시작`);
  };
  /* 이미 학습 중이면 바로 넘어간다. 자유 편집 중인 구성만 확인을 받는다. */
  if (S.n.length > 0 && TUT.cur === null){
    openModal('과제를 시작할까요?', `
      <p>현재 캔버스의 <b>${S.n.length}개 장비</b>가 과제 시작 상태로 바뀝니다.
         지금 구성을 남기려면 먼저 <b>저장</b>하거나 URL 을 복사해 두세요.</p>
      <div class="row" style="margin-top:10px">
        <button class="btn pri" id="lsGo">${esc(les.id+'. '+les.title)} 시작</button>
        <button class="btn" id="lsSave">먼저 저장하기</button>
        <button class="btn" id="lsCancel">취소</button>
      </div>`);
    $('#lsGo').onclick = ()=>{ closeModal(); go(); };
    $('#lsSave').onclick = ()=>{ closeModal(); openExport(); };
    $('#lsCancel').onclick = closeModal;
  } else go();
}

function gradeCurrent(loud){
  const les = LESSONS.find(l=>l.id===TUT.cur); if (!les) return null;
  TUT.last = null;                       // 강제로 다시 계산
  const g = tutAutoGrade();
  if (!g) return null;
  if (loud) toast(g.passed ? `통과 — ${g.score}점 (${g.grade})`
                           : `아직 ${g.rp}/${g.rt} — 남은 조건 ${g.rt-g.rp}개`, g.passed ? 'good' : '');
  renderTutorialPane();
  return g;
}

function renderTutorialPane(keepScroll){
  const p = $('#pane-tut'); if (!p) return;
  const sc = keepScroll ? p.scrollTop : 0;
  p.textContent = '';
  const st = tutStats();

  /* 헤더 */
  const head = h('div',{cls:'card'});
  head.innerHTML = `<h5>학습 과정 <span class="pill ${st.done===st.total?'up':'acc'}">${st.done} / ${st.total}</span></h5>
    <div class="bar"><i style="width:${Math.round(st.done/st.total*100)}%"></i></div>
    <div class="kv" style="margin-top:6px"><span>도전한 과제</span><b>${st.tried}개</b></div>
    <div class="kv"><span>평균 점수</span><b>${st.avg}점</b></div>`;
  p.appendChild(head);

  if (!TUT.cur){
    p.appendChild(h('div',{cls:'muted', style:'margin:2px 0 8px'},
      '장비 2~3대짜리 최소 구성에서 시작해 10개 장으로 난이도가 올라갑니다. 과제를 고르면 캔버스가 시작 상태로 바뀝니다.'));
    const row = h('div',{cls:'row', style:'margin-bottom:8px'});
    const next = LESSONS.find(l=>!(TUT.prog[l.id]&&TUT.prog[l.id].passed)) || LESSONS[0];
    row.appendChild(btn(`이어서 하기 — ${next.id}. ${next.title}`, ()=>openLesson(next.id), 'pri'));
    p.appendChild(row);
    const row2 = h('div',{cls:'row', style:'margin-bottom:8px'});
    row2.appendChild(btn('진행 초기화', ()=>{ if (!st.tried) return;
      TUT.prog = {}; tutSaveProg(); renderTutorialPane(); toast('학습 기록을 지웠습니다.'); }));
    p.appendChild(row2);

    CHAPTERS.forEach(ch=>{
      const list = LESSONS.filter(l=>l.ch===ch.id);
      const ok = list.filter(l=>TUT.prog[l.id]&&TUT.prog[l.id].passed).length;
      const kids = list.map(les=>{
        const pr = TUT.prog[les.id];
        const d = h('div',{cls:'iss '+(pr ? (pr.passed?'ok':'w') : 'i'), style:'align-items:center'});
        d.innerHTML = `<div style="flex:1"><div class="t">${les.id}. ${esc(les.title)}</div>
          <div class="d">${esc(les.goal)}</div></div>
          ${pr ? `<span class="pill ${pr.passed?'up':'warn'}">${pr.grade} ${pr.score}</span>` : '<span class="pill n">미도전</span>'}`;
        d.onclick = ()=>openLesson(les.id);
        return d;
      });
      const sec1 = sec(`${ch.id}장 · ${ch.n}  (${ok}/${list.length})`, ok<list.length && ok>0 || ch.id===1, kids);
      p.appendChild(sec1);
    });
    p.scrollTop = sc;
    return;
  }

  /* 진행 중인 과제 */
  const les = LESSONS.find(l=>l.id===TUT.cur);
  const ch  = CHAPTERS.find(c=>c.id===les.ch);
  const g   = TUT.last || gradeLesson(les);
  TUT.last  = g;

  const card = h('div',{cls:'card'});
  card.innerHTML = `<h5>${les.id}. ${esc(les.title)}
      <span class="pill ${g.passed?'up':'warn'}">${g.passed?'통과':'진행 중'}</span></h5>
    <div class="meta">${ch.id}장 · ${esc(ch.n)}</div>
    <div style="margin-top:6px;font-size:12px"><b>목표</b> — ${esc(les.goal)}</div>`;
  const nav = h('div',{cls:'row', style:'margin-top:7px;flex-wrap:wrap'});
  nav.appendChild(btn('지금 다시 채점', ()=>gradeCurrent(true), 'pri'));
  nav.appendChild(btn('다시 시작', ()=>{ TUT.cur=null; openLesson(les.id); }));
  const prev = LESSONS.find(l=>l.id===les.id-1), nxt = LESSONS.find(l=>l.id===les.id+1);
  if (prev) nav.appendChild(btn('◀ 이전', ()=>openLesson(prev.id)));
  if (nxt)  nav.appendChild(btn('다음 ▶', ()=>openLesson(nxt.id)));
  nav.appendChild(btn('목록', ()=>{ TUT.cur=null; TUT.last=null; renderTutorialPane(); }));
  card.appendChild(nav);
  p.appendChild(card);

  /* 점수 */
  const sco = h('div',{cls:'card'});
  sco.innerHTML = `<h5>점수 <span class="pill ${g.score>=90?'up':g.score>=60?'warn':'down'}">${g.grade} · ${g.score}점</span></h5>
    <div class="bar"><i class="${g.score<60?'bad':g.score<90?'warn':''}" style="width:${g.score}%"></i></div>
    <div class="kv" style="margin-top:6px"><span>필수 조건</span><b>${g.rp} / ${g.rt}</b></div>
    ${g.bt ? `<div class="kv"><span>추가 점수</span><b>${g.bp} / ${g.bt}</b></div>` : ''}
    <div class="muted" style="margin-top:4px;font-size:10.5px">구성을 고칠 때마다 <b>자동으로 다시 채점</b>됩니다. 필수 조건을 모두 채우면 통과 70점, 추가 조건까지 채우면 100점.</div>`;
  p.appendChild(sco);

  /* 안내 */
  const brief = h('div',{});
  brief.innerHTML = `<div style="font-size:12px;line-height:1.7;color:var(--ink-2)">${les.brief}</div>`;
  p.appendChild(sec('안내', true, [brief]));

  /* 채점 기준 */
  const mkRow = (x, need) => {
    const d = h('div',{cls:'iss '+(x.ok?'ok':(need?'e':'w')), style:'cursor:default;align-items:center'});
    d.innerHTML = `<div style="flex:1"><div class="t" style="font-weight:${x.ok?400:600};${x.ok?'color:var(--ink-2)':''}">
      ${x.ok?'✓':'○'} ${esc(x.l)}</div></div>`;
    return d;
  };
  p.appendChild(sec(`필수 조건 (${g.rp}/${g.rt})`, true, g.req.map(x=>mkRow(x,true))));
  if (g.bt) p.appendChild(sec(`추가 조건 (${g.bp}/${g.bt})`, g.bp<g.bt, g.bon.map(x=>mkRow(x,false))));

  /* 힌트 */
  if (les.hints.length){
    const hb = h('div',{});
    hb.innerHTML = '<ul style="margin:0;padding-left:16px;font-size:11.5px;color:var(--ink-2);line-height:1.7">'
      + les.hints.map(x=>`<li>${x}</li>`).join('') + '</ul>';
    p.appendChild(sec('힌트', false, [hb]));
  }

  /* 도구 바로가기 */
  const tools = h('div',{cls:'row', style:'flex-wrap:wrap'});
  tools.appendChild(btn('플로우 자동 생성', ()=>{ snapshot(); S.f = autoFlows(); afterEdit();
    toast(`${S.f.length}개 플로우 생성`,'good'); }));
  tools.appendChild(btn('IP 자동할당', ()=>{ snapshot(); const n=autoAssignIP(); afterEdit();
    toast(n?`${n}개 인터페이스 할당`:'비어 있는 IP 없음', n?'good':''); }));
  tools.appendChild(btn('검증 탭 보기', ()=>switchTab('val')));
  tools.appendChild(btn('SPOF 분석', ()=>{ runSpof(); switchTab('val'); }));
  p.appendChild(sec('도구', true, [tools]));

  p.scrollTop = sc;
}
