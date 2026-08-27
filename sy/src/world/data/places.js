// 개별 랜드마크 건물. 나머지 건물은 districts.js 규칙으로 절차 생성된다.
//
// 스키마
//   name    표시 이름
//   kind    config.js 의 KIND 값
//   lon,lat 건물 중심 좌표
//   w,h     가로·세로 (미터)
//   floors  지상 층수, basement 지하 층수
//   note    실내 안내판에 뜨는 한 줄
//   metro   지하철역이면 { line, order } — 역끼리 이동할 때 쓴다

import { KIND } from '../../config.js';

export const PLACES = [
  // ── 김포골드라인 역 ──────────────────────────────────────────────
  { name: '구래역', kind: KIND.STATION, lon: 126.6285, lat: 37.6437,
    w: 30, h: 20, floors: 1, basement: 2, note: '김포골드라인 · 양촌 ↔ 마산',
    metro: { line: '김포골드라인', order: 2 } },
  { name: '마산역', kind: KIND.STATION, lon: 126.6398, lat: 37.6396,
    w: 26, h: 18, floors: 1, basement: 2, note: '김포골드라인 · 구래 ↔ 장기',
    metro: { line: '김포골드라인', order: 3 } },
  { name: '양촌역', kind: KIND.STATION, lon: 126.6135, lat: 37.6484,
    w: 26, h: 18, floors: 1, basement: 2, note: '김포골드라인 종점 · 산업단지 방면',
    metro: { line: '김포골드라인', order: 1 } },

  // ── 관공서 ─────────────────────────────────────────────────────
  { name: '구래동 행정복지센터', kind: KIND.PUBLIC, lon: 126.6262, lat: 37.6462,
    w: 40, h: 24, floors: 4, basement: 1, note: '민원실은 1층입니다' },
  { name: '마산동 행정복지센터', kind: KIND.PUBLIC, lon: 126.6412, lat: 37.6420,
    w: 32, h: 20, floors: 3, basement: 0 },
  { name: '양촌읍 행정복지센터', kind: KIND.PUBLIC, lon: 126.6046, lat: 37.6552,
    w: 36, h: 22, floors: 3, basement: 0 },
  { name: '구래우체국', kind: KIND.PUBLIC, lon: 126.6250, lat: 37.6440,
    w: 24, h: 18, floors: 2, basement: 0 },
  { name: '구래파출소', kind: KIND.PUBLIC, lon: 126.6242, lat: 37.6455,
    w: 20, h: 14, floors: 2, basement: 0 },
  { name: '양촌119안전센터', kind: KIND.PUBLIC, lon: 126.6090, lat: 37.6520,
    w: 30, h: 20, floors: 3, basement: 0, note: '차고 안쪽은 관계자 외 출입금지' },
  { name: '구래도서관', kind: KIND.PUBLIC, lon: 126.6296, lat: 37.6470,
    w: 34, h: 26, floors: 3, basement: 1, note: '3층 열람실 · 2층 어린이자료실' },
  { name: '김포양촌산업단지 관리사무소', kind: KIND.PUBLIC, lon: 126.5980, lat: 37.6412,
    w: 30, h: 20, floors: 3, basement: 0 },

  // ── 학교 ───────────────────────────────────────────────────────
  { name: '구래초등학교', kind: KIND.SCHOOL, lon: 126.6222, lat: 37.6484,
    w: 80, h: 24, floors: 4, basement: 0 },
  { name: '구래중학교', kind: KIND.SCHOOL, lon: 126.6206, lat: 37.6448,
    w: 72, h: 22, floors: 4, basement: 0 },
  { name: '마산초등학교', kind: KIND.SCHOOL, lon: 126.6450, lat: 37.6414,
    w: 76, h: 24, floors: 4, basement: 0 },
  { name: '양곡고등학교', kind: KIND.SCHOOL, lon: 126.6070, lat: 37.6558,
    w: 84, h: 26, floors: 5, basement: 0, note: '급식실은 지상 1층 끝' },
  { name: '양촌초등학교', kind: KIND.SCHOOL, lon: 126.6022, lat: 37.6520,
    w: 70, h: 22, floors: 4, basement: 0 },

  // ── 상업 ───────────────────────────────────────────────────────
  { name: '한강마트 구래점', kind: KIND.MART, lon: 126.6302, lat: 37.6428,
    w: 70, h: 50, floors: 3, basement: 1, note: '지하 1층 주차 · 3층 푸드코트' },
  { name: '양촌농협 하나로마트', kind: KIND.MART, lon: 126.6060, lat: 37.6532,
    w: 46, h: 30, floors: 2, basement: 0 },
  { name: '구래 시네마', kind: KIND.TOWER, lon: 126.6272, lat: 37.6425,
    w: 40, h: 30, floors: 6, basement: 1, note: '상영관은 4층부터' },
  { name: '구래역 스퀘어', kind: KIND.TOWER, lon: 126.6268, lat: 37.6446,
    w: 32, h: 30, floors: 18, basement: 2, note: '1~3층 상가 · 4층부터 오피스텔' },
  { name: '한강 센트럴타워', kind: KIND.TOWER, lon: 126.6312, lat: 37.6452,
    w: 30, h: 28, floors: 20, basement: 2 },
  { name: '로데오 아케이드', kind: KIND.SHOP, lon: 126.6292, lat: 37.6412,
    w: 46, h: 22, floors: 4, basement: 0, note: '2층 전체가 학원가' },

  // ── 그 밖 ──────────────────────────────────────────────────────
  { name: '한강종합병원', kind: KIND.HOSPITAL, lon: 126.6322, lat: 37.6486,
    w: 50, h: 36, floors: 7, basement: 2, note: '응급실 24시간' },
  { name: '구래중앙교회', kind: KIND.CHURCH, lon: 126.6230, lat: 37.6510,
    w: 34, h: 24, floors: 3, basement: 1 },
  { name: '호수공원 전망데크', kind: KIND.PARK_FACILITY, lon: 126.6356, lat: 37.6452,
    w: 14, h: 10, floors: 1, basement: 0, note: '호수 건너편이 마산동입니다' },
  { name: '가현산 정자', kind: KIND.PARK_FACILITY, lon: 126.6300, lat: 37.6598,
    w: 12, h: 12, floors: 1, basement: 0, note: '여기서 신도시가 다 보인다' },
  { name: '대한정밀 제1공장', kind: KIND.FACTORY, lon: 126.5936, lat: 37.6440,
    w: 110, h: 60, floors: 2, basement: 0 },
  { name: '한성물류 김포센터', kind: KIND.WAREHOUSE, lon: 126.6046, lat: 37.6250,
    w: 130, h: 70, floors: 2, basement: 0 },
];
