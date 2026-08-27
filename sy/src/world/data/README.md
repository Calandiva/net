# world/data — 지역 데이터

이 폴더의 파일만 고치면 지도가 바뀐다. 렌더링 코드는 여기 값을 읽기만 한다.

- 좌표는 전부 **WGS84 [경도, 위도]** 쌍이다. 타일 변환은 `world/geo.js` 가 한다.
- 길이 단위는 **미터**. 타일 크기는 `config.js` 의 `GEO.metersPerTile` 로 정한다.
- `regions.js` 지면(시가지·논밭·공단·공원·물), `roads.js` 이름 있는 도로,
  `districts.js` 블록 채움 규칙, `places.js` 개별 랜드마크 건물,
  `names.js` 절차적 상호명 풀, `interiors.js` 건물 종류별 실내 구성.

## 좌표 정확도에 대해

현재 값은 **손으로 넣은 근사치**다. 구래역·마산역·양촌역·산업단지·간선도로 같은
뼈대는 실제 위치에 맞췄고, 그 사이는 `districts.js` 규칙으로 절차적으로 채웠다.
개별 상가·아파트 동의 위치까지 실제와 같지는 않다.

정확한 데이터로 갈아끼우려면 `tools/bake_osm.py` 를 개발 머신에서 한 번 돌려
OSM Overpass 결과를 `regions.osm.js` / `roads.osm.js` / `places.osm.js` 로 굽고,
`index.js` 에서 그 모듈을 대신 import 하면 된다. 스키마는 동일하다.
