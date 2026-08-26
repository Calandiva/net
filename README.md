# NetForge 망구성도

전산망 구성도를 그리고, **실제 장비의 동작 방식대로 통신이 되는지 검증**하는 브라우저 시뮬레이터.
구성 전체(장비·IP·VLAN·보안존·방화벽 정책·이중화·플로우·화면 상태)가 **URL 해시 한 줄**에 들어갑니다.
서버도, 계정도, 빌드 도구도 필요 없습니다.

---

## 실행 방법

### 1. 로컬 파일로 바로 실행
`index.html` 을 더블클릭하면 됩니다 (`file://`). 모든 기능이 동작하며,
인터넷이 없으면 웹폰트만 시스템 글꼴로 대체됩니다.

### 2. GitHub Pages
```bash
git init && git add . && git commit -m "NetForge"
git branch -M main && git remote add origin <저장소 URL> && git push -u origin main
```
저장소 **Settings → Pages → Source: Deploy from a branch → main / (root)** 로 설정하면
`https://<사용자>.github.io/<저장소>/` 에서 열립니다.
(`.nojekyll` 파일이 포함되어 있어 Jekyll 전처리를 건너뜁니다.)

### 3. Vercel
```bash
npx vercel deploy --prod
```
빌드 명령 없음 / 출력 디렉터리 = 프로젝트 루트. `vercel.json` 이 이미 들어 있습니다.
Vercel 대시보드에서 폴더를 드래그해 올려도 됩니다.

### 4. 그 밖의 정적 호스팅
Netlify, S3+CloudFront, Nginx, 사내 웹서버 — `index.html` 하나만 올리면 끝입니다.

---

## 저장 · 불러오기 · 공유

| 방법 | 형식 | 쓰임새 |
|---|---|---|
| **URL 복사** | `…/index.html#N1.eJyt…` | 링크만 보내면 상대방 화면에 그대로 재현 |
| **저장 → 압축 텍스트** | `N1.eJyt…` 한 줄 | 메신저·이슈·위키에 붙여넣기 |
| **저장 → JSON** | 사람이 읽고 편집 가능 | 형상관리(Git) 에 커밋, 리뷰 |
| **저장 → .nfg 파일** | 압축 텍스트 파일 | 오프라인 보관 |
| **불러오기** | 위 넷 중 무엇이든 | 형식 자동 판별 |

### URL 인코딩 규칙
1. 문서를 배열 표현으로 정규화 — 노드 `[타입번호, x, y, 속성]`, 링크 `[a인덱스, b인덱스, 매체]`,
   노드 참조는 배열 인덱스로 치환
2. 타입 기본값과 같은 속성은 생략
3. `JSON → UTF-8 → DEFLATE(raw) → base64url`
4. `location.hash = "N1." + payload` (`N1`=압축, `N0`=평문 폴백)

해시(`#`)는 서버로 전송되지 않으므로 구성 정보가 외부로 나가지 않습니다.
29개 장비 / 60개 링크 규모가 약 2.9 KB 입니다.

---

## 무엇을 시뮬레이션하는가

| 영역 | 구현한 동작 | 근거 |
|---|---|---|
| 방화벽 정책 | 위→아래 first-match, 미매칭 시 동일 존 허용 / 다른 존 차단 | Palo Alto PAN-OS |
| NAT | DNAT 는 라우팅 전 목적지 변환, SNAT 는 송신 인터페이스에서 출발지 변환 | PAN-OS NAT 정책 |
| 로드밸런싱 | RR / Ratio / Least Conn / WLC / Fastest / Observed / Predictive / Source·URI Hash | F5 BIG-IP LTM |
| 세션 지속성 | Source Address, Cookie Insert(L7 전용), SSL Session ID, Destination | F5 LTM Persistence |
| 게이트웨이 이중화 | 가상 IP + 우선순위 + Preempt | VRRP(RFC 5798) / HSRP / GLBP |
| 방화벽 이중화 | A/S 쌍이 동일 인터페이스 IP 를 공유, 장애·링크다운 시 인수 | PAN-OS / FortiGate A-P HA |
| DB 이중화 | RAC / Data Guard / Always On / FCI / 반동기 / Group Replication / 스트리밍 / Patroni 별 RPO·RTO | Oracle MAA, MySQL, PostgreSQL |
| 인라인 보안장비 | 다운 시 fail-open 바이패스면 회선 유지, 아니면 단절 | IPS·DDoS·WAF 바이패스 모듈 |
| 라우팅 | 연결·정적·기본경로 최장 프리픽스 매칭, OSPF/BGP/EIGRP/IS-IS 최단경로 학습 | 일반 라우팅 원리 |

단방향 포워딩만 계산하며, 상태 기반 방화벽의 리턴 트래픽은 허용된 것으로 봅니다.

---

## 검증 항목

- **연결성** — 미연결 노드, 링크 단절, 투과 장비 다운, L2 경로 부재
- **주소** — IP 미설정·충돌, 구간 서브넷 불일치, 게이트웨이 대역 오류·응답 없음
- **라우팅** — 경로 없음, 넥스트홉 불일치, 루프
- **보안** — implicit deny 차단, any-any 허용, 존 미지정, 인터넷 직결, 아웃바운드 NAT 누락
- **부하분산** — VIP·풀 미설정, 멤버 포트 불일치, SNAT 없는 비대칭 경로, L4 에 Cookie 지속성
- **가용성** — 이중화 짝/VIP 누락, 하트비트 없음, 단일 상단 스위치, DB 단일 인스턴스, 스토리지 단일 경로
- **SPOF 분석** — 모든 장비·링크를 하나씩 다운시켜 어떤 플로우가 끊기는지 전수 계산

---

## 랜덤 구성도

`랜덤 구성도` 버튼은 네 가지 레퍼런스 아키텍처를 만듭니다. 생성 결과는 IP·VLAN·존·정책·이중화·
LB 풀·검증 플로우가 모두 채워진 상태이며, **생성 직후 검증에서 오류·경고 0건**을 통과합니다.

- 표준 3-Tier DMZ (이중화)
- 금융/공공형 다계층 보안망 (DDoS·IPS·WAF·망분리 관리망)
- 중소규모 통합 서버망
- 컨테이너 플랫폼 (K8s + Patroni + Redis Sentinel)

---

## 소스 구조

```
src/00-head.html    디자인 토큰 · 스타일
src/10-body.html    화면 마크업
src/20-catalog.js   장비 카탈로그 (31종, 제품별 동작 모델)
src/30-core.js      상태 모델 · IP 유틸 · URL 코덱 · 실행취소
src/40-engine.js    토폴로지 해석 · 포워딩 시뮬레이션 · 검증 · SPOF
src/50-render.js    SVG 렌더링 · 팬/줌 · 패치 케이블 라우팅
src/60-ui.js        속성 인스펙터 · 검증/플로우/레이어/이중화/URL 패널
src/70-generator.js 레퍼런스 아키텍처 생성 · IP 자동할당 · 정책 자동생성
src/80-app.js       툴바 · 저장/불러오기 · 도움말 · 부팅
build.py            위 파일을 index.html 하나로 묶음
```

수정 후 `python build.py` 를 실행하면 `index.html` 이 다시 만들어집니다.

---

## 단축키

`V` 선택 · `L` 연결 · `F` 장애 주입 · `Del` 삭제 · `0` 화면맞춤 · `R` 랜덤 ·
`Enter` 검증 · `Ctrl+S` 저장 · `Ctrl+O` 불러오기 · `Ctrl+Z` 실행취소
