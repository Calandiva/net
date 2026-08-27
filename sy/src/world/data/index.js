// 지역 데이터 모음. 다른 코드는 이 파일만 import 한다.
// OSM 에서 구운 데이터로 갈아끼울 때도 여기서 import 대상만 바꾸면 된다.

import { REGIONS, WATERWAYS } from './regions.js';
import { ROADS } from './roads.js';
import { DISTRICTS } from './districts.js';
import { PLACES } from './places.js';

export const WORLD_DATA = { REGIONS, WATERWAYS, ROADS, DISTRICTS, PLACES };
