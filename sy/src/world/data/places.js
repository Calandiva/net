// 개별 랜드마크 건물. 나머지 건물은 districts.js 규칙으로 절차 생성된다.
//
// 이름은 전부 실제 시설명이다. 확인한 주소를 주석에 남겨 둔다.
// 좌표는 그 주소를 실제 위치에 맞춰 옮긴 근사치다.
//
// 스키마
//   name    표시 이름
//   kind    config.js 의 KIND 값
//   lon,lat 건물 중심 좌표
//   w,h     가로·세로 (미터)
//   floors  지상 층수, basement 지하 층수
//   note    실내 안내판에 뜨는 한 줄
//   metro   지하철역이면 { line, order }
//   floorNames  층별 안내. 엘리베이터 대화창과 실내 표시에 쓴다.

import { KIND } from '../../config.js';

export const PLACES = [
  // ── 김포 골드라인 ───────────────────────────────────────────────
  { name: '구래역', kind: KIND.STATION, lon: 126.6285, lat: 37.6437,
    w: 22, h: 15, floors: 1, basement: 2,     // 김포한강7로 87 (구래동 6880-8) · 지상은 출입구만
    note: '김포 골드라인 · 양촌 ↔ 마산',
    floorNames: { '-2': '승강장', '-1': '대합실', 1: '역사 출입구' },
    metro: { line: '김포 골드라인', order: 2 } },
  { name: '마산역', kind: KIND.STATION, lon: 126.6395, lat: 37.6392,
    w: 20, h: 14, floors: 1, basement: 2,     // 김포한강3로 지하442 (마산동 641-3)
    note: '김포 골드라인 · 구래 ↔ 장기',
    metro: { line: '김포 골드라인', order: 3 } },
  { name: '양촌역', kind: KIND.STATION, lon: 126.6120, lat: 37.6478,
    w: 20, h: 14, floors: 1, basement: 2,     // 양촌역길 107 (유현리 275-7)
    note: '김포 골드라인 기점 · 산업단지 방면',
    metro: { line: '김포 골드라인', order: 1 } },

  // ── 상업 ───────────────────────────────────────────────────────
  { name: '이마트 김포한강점', kind: KIND.MART, lon: 126.6309, lat: 37.6420,
    w: 100, h: 66, floors: 4, basement: 2,    // 구래동 6880-9 · 구래역 4번 출구
    note: '구래역 4번 출구 · 10:00 ~ 23:00',
    floorNames: { '-2': '주차장', '-1': '주차장', 1: '식품매장', 2: '생활용품',
      3: '가전·푸드코트', 4: '문화센터' } },
  { name: '두원타워', kind: KIND.TOWER, lon: 126.6262, lat: 37.6456,
    w: 42, h: 34, floors: 12, basement: 2,    // 김포한강9로75번길 180
    note: '8층 메가박스 김포한강신도시 · 5개관 712석',
    floorNames: { '-2': '주차장', '-1': '주차장', 1: '로비·은행', 2: '학원',
      3: '병원', 4: '학원', 5: '사무실', 6: '사무실', 7: '사무실',
      8: '메가박스', 9: '메가박스 상영관', 10: '사무실', 11: '사무실', 12: '옥상' } },

  // ── 관공서 ─────────────────────────────────────────────────────
  { name: '구래동 행정복지센터', kind: KIND.PUBLIC, lon: 126.6270, lat: 37.6478,
    w: 40, h: 24, floors: 4, basement: 1,     // 김포한강9로115번길 25
    note: '민원실은 1층입니다' },
  { name: '마산동 행정복지센터', kind: KIND.PUBLIC, lon: 126.6410, lat: 37.6418,
    w: 32, h: 20, floors: 3, basement: 0 },
  { name: '양촌읍 행정복지센터', kind: KIND.PUBLIC, lon: 126.6032, lat: 37.6555,
    w: 36, h: 22, floors: 3, basement: 0 },   // 양곡1로68번길 37
  { name: '김포시 마산도서관', kind: KIND.PUBLIC, lon: 126.6428, lat: 37.6404,
    w: 36, h: 28, floors: 3, basement: 1,
    note: '3층 열람실 · 2층 어린이자료실',
    floorNames: { '-1': '주차장', 1: '종합자료실', 2: '어린이자료실', 3: '열람실' } },

  // ── 학교 ───────────────────────────────────────────────────────
  { name: '김포구래초등학교', kind: KIND.SCHOOL, lon: 126.6228, lat: 37.6472,
    w: 80, h: 24, floors: 4, basement: 0 },
  { name: '나비초등학교', kind: KIND.SCHOOL, lon: 126.6196, lat: 37.6494,
    w: 76, h: 24, floors: 4, basement: 0 },   // 구래동 5723
  { name: '한가람초등학교', kind: KIND.SCHOOL, lon: 126.6302, lat: 37.6500,
    w: 76, h: 24, floors: 4, basement: 0 },   // 김포한강9로 한가람초 교차로
  { name: '김포한가람중학교', kind: KIND.SCHOOL, lon: 126.6318, lat: 37.6472,
    w: 72, h: 22, floors: 4, basement: 0 },
  { name: '나래중학교', kind: KIND.SCHOOL, lon: 126.6352, lat: 37.6441,
    w: 72, h: 22, floors: 4, basement: 0 },
  { name: '양곡초등학교', kind: KIND.SCHOOL, lon: 126.6076, lat: 37.6559,
    w: 74, h: 24, floors: 4, basement: 0 },   // 양곡로 548
  { name: '양곡중학교', kind: KIND.SCHOOL, lon: 126.6098, lat: 37.6577,
    w: 70, h: 22, floors: 4, basement: 0 },   // 양곡4로 138
  { name: '양곡고등학교', kind: KIND.SCHOOL, lon: 126.6102, lat: 37.6593,
    w: 84, h: 26, floors: 5, basement: 0,     // 양곡4로 138
    note: '급식실은 1층 끝' },

  // ── 산업단지 시설 ──────────────────────────────────────────────
  { name: '양촌일반산업단지 관리사무소', kind: KIND.PUBLIC, lon: 126.6054, lat: 37.6437,
    w: 30, h: 20, floors: 3, basement: 0,
    note: '정문 옆 · 출입증은 1층에서 발급합니다' },
  { name: '학운2일반산업단지 폐수처리장', kind: KIND.FACTORY, lon: 126.6118, lat: 37.6392,
    w: 62, h: 42, floors: 2, basement: 0,
    note: '관계자 외 출입금지' },
  { name: '학운5일반산업단지 공동물류창고', kind: KIND.WAREHOUSE, lon: 126.6100, lat: 37.6298,
    w: 124, h: 70, floors: 2, basement: 0 },

  // ── 그 밖 ──────────────────────────────────────────────────────
  { name: '한가람마을 우미린 관리사무소', kind: KIND.PARK_FACILITY, lon: 126.6322, lat: 37.6446,
    w: 24, h: 16, floors: 2, basement: 0,
    note: '단지 안내방송은 여기서 나갑니다' },
  { name: '가현산 전망대', kind: KIND.PARK_FACILITY, lon: 126.6180, lat: 37.6182,
    w: 14, h: 12, floors: 1, basement: 0,
    note: '해발 215m · 맑으면 강화도까지 보인다' },
  { name: '구래낚시터 관리동', kind: KIND.PARK_FACILITY, lon: 126.6126, lat: 37.6290,
    w: 16, h: 12, floors: 1, basement: 0,
    note: '가현산 등산로 들머리' },
];
