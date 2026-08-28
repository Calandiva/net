// 주요 시설 안내 (층 구성 · 안내문)
//
// 이 파일은 tools/bake_overture.py 가 만든다. 손으로 고치지 말 것.
// 원본: Overture Maps (OpenStreetMap 기여자, ODbL) · 2026-08-19 릴리스

// 이름 → { 층수, 지하층, 안내문, 층별 용도, 지하철 }
export const LANDMARK_NOTES = {
  "구래역": { floors: 1, basement: 2, kind: 'station', note: "김포 골드라인 · 양촌 ↔ 마산", floorNames: {"-2": "승강장", "-1": "대합실", "1": "역사 출입구"}, metro: {"line": "김포 골드라인", "order": 2} },
  "마산역": { floors: 1, basement: 2, kind: 'station', note: "김포 골드라인 · 구래 ↔ 장기", floorNames: {"-2": "승강장", "-1": "대합실", "1": "역사 출입구"}, metro: {"line": "김포 골드라인", "order": 3} },
  "양촌역": { floors: 1, basement: 2, kind: 'station', note: "김포 골드라인 기점 · 산업단지 방면", floorNames: {"-2": "승강장", "-1": "대합실", "1": "역사 출입구"}, metro: {"line": "김포 골드라인", "order": 1} },
  "이마트 김포한강점": { floors: 4, basement: 2, kind: 'mart', note: "구래역 4번 출구 · 10:00 ~ 23:00", floorNames: {"-2": "주차장", "-1": "주차장", "1": "식품매장", "2": "생활용품", "3": "가전·푸드코트", "4": "문화센터"} },
  "두원타워": { floors: 12, basement: 2, kind: 'tower', note: "8층 메가박스 김포한강신도시", floorNames: {"-2": "주차장", "-1": "주차장", "1": "로비·은행", "2": "학원", "3": "병원", "4": "학원", "5": "사무실", "6": "사무실", "7": "사무실", "8": "메가박스", "9": "메가박스 상영관", "10": "사무실", "11": "사무실", "12": "옥상"} },
  "구래동 행정복지센터": { floors: 4, basement: 1, kind: 'public', note: "민원실은 1층입니다" },
  "양촌읍행정복지센터": { floors: 3, basement: 0, kind: 'public' },
  "양곡도서관": { floors: 3, basement: 1, kind: 'public', note: "열람실은 3층", floorNames: {"-1": "주차장", "1": "종합자료실", "2": "어린이자료실", "3": "열람실"} },
};
