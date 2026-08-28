// 아이템. NPC 에게서만 얻는다 (바닥에 떨어져 있지 않다).
// 한 번에 하나만 들고 다닐 수 있고, 새로 받으면 들고 있던 것을 놓아야 한다.
//
//   id     내부 이름 (사건의 결과가 이 값을 본다)
//   name   화면에 뜨는 이름
//   icon   render/sprites.js 의 아이템 그림 종류
//   tag    '도구' 계속 쓴다 · '투척' 던지면 사라진다 · '착용' 입고 다닌다
//   from   어디서 누구에게 받는지 (엔딩 목록의 힌트로도 쓴다)
//   give   이 아이템을 주는 사람이 있는 곳 (kinds: 건물 종류 · regions: 바깥 지역)
//   line   줄 때 그 사람이 하는 말
//   use    사건이 없는 데서 그냥 썼을 때 나오는 말

export const ITEMS = [
  { id: 'extinguisher', name: '소화기', icon: 'cylinder', tag: '도구',
    from: '공장·상가 관리인',
    give: { kinds: ['factory', 'warehouse', 'shop', 'tower'] },
    line: '이거 하나 가져가요. 우리 층에 두 개 있어요.',
    use: '안전핀을 뽑았다가 도로 꽂았다. 여기서 뿌릴 일은 아니다.' },

  { id: 'gloves', name: '목장갑', icon: 'cloth', tag: '착용',
    from: '공단 근로자',
    give: { kinds: ['factory', 'warehouse'], regions: ['industrial'] },
    line: '맨손으로 다니지 마요. 새것 한 켤레 있어요.',
    use: '장갑을 고쳐 꼈다. 손바닥에 아직 풀 냄새가 난다.' },

  { id: 'umbrella', name: '우산', icon: 'stick', tag: '도구',
    from: '아파트 경비실',
    give: { kinds: ['apartment', 'public', 'station'] },
    line: '분실물이에요. 한 달째 아무도 안 찾아가네.',
    use: '펴 봤다. 오늘 비는 안 온다고 했다.' },

  { id: 'flashlight', name: '손전등', icon: 'device', tag: '도구',
    from: '역무원·경비',
    give: { kinds: ['station', 'public', 'apartment', 'warehouse'] },
    line: '지하 내려갈 거면 이거 들고 가요.',
    use: '천장에 동그란 빛을 비췄다. 밝은 데서는 표도 안 난다.' },

  { id: 'thermos', name: '보온병', icon: 'cylinder', tag: '도구',
    from: '편의점·상가 사람',
    give: { kinds: ['shop', 'mart', 'tower'] },
    line: '보리차예요. 아침엔 이게 낫습니다.',
    use: '뚜껑에 따라 한 모금 마셨다. 아직 뜨겁다.' },

  { id: 'kimbap', name: '김밥 한 줄', icon: 'food', tag: '투척',
    from: '분식집 주인',
    give: { kinds: ['shop', 'mart'] },
    line: '끝줄이라 못 팔아요. 가져가서 드세요.',
    use: '한 알 집어 먹었다. 단무지가 좋다.' },

  { id: 'coffee', name: '캔커피', icon: 'cylinder', tag: '투척',
    from: '길에서 만난 사람',
    give: { regions: ['city', 'industrial'] },
    line: '두 개 뽑혔어요. 하나 드세요.',
    use: '따서 반쯤 마셨다. 손이 좀 따뜻해졌다.' },

  { id: 'flower', name: '꽃 한 다발', icon: 'plant', tag: '투척',
    from: '화원·화훼 하는 사람',
    give: { kinds: ['shop'], regions: ['field'] },
    line: '오늘 못 나가는 물건이에요. 들고 가요.',
    use: '냄새를 맡았다. 이걸 누구한테 줄지는 아직 모른다.' },

  { id: 'catsnack', name: '고양이 간식', icon: 'food', tag: '투척',
    from: '길에서 밥 주는 사람',
    give: { regions: ['city'], kinds: ['apartment'] },
    line: '주머니에 늘 있어요. 하나 가져가요.',
    use: '봉지를 흔들었다. 어디선가 보고는 있을 것이다.' },

  { id: 'baseball', name: '야구공', icon: 'ball', tag: '투척',
    from: '학교 학생',
    give: { kinds: ['school'] },
    line: '이거 담 넘어간 거예요. 저는 이제 안 해요.',
    use: '위로 던졌다 받았다. 세 번째에 놓쳤다.' },

  { id: 'tape', name: '줄자', icon: 'device', tag: '도구',
    from: '부동산 중개인',
    give: { kinds: ['shop', 'tower'] },
    line: '집 볼 때 필요해요. 하나 더 있어요.',
    use: '아무 데나 대고 재 봤다. 1미터 40.' },

  { id: 'megaphone', name: '확성기', icon: 'device', tag: '도구',
    from: '통장·자율방범대',
    give: { kinds: ['public', 'apartment'], regions: ['city'] },
    line: '반상회 때 쓰던 건데, 배터리는 있어요.',
    use: '"아, 아." 소리가 골목을 한 바퀴 돌아왔다.' },

  { id: 'radio', name: '휴대용 라디오', icon: 'device', tag: '도구',
    from: '경비실 아저씨',
    give: { kinds: ['apartment', 'public', 'warehouse', 'station'] },
    line: '아침엔 이거 켜 놔야 시간 가는 줄 알아요.',
    use: '주파수를 돌렸다. 교통정보와 잡음 사이 어딘가.' },

  { id: 'rod', name: '낚싯대', icon: 'stick', tag: '도구',
    from: '낚시터 주인',
    give: { kinds: ['park_facility'], regions: ['field'] },
    line: '한 대 남는 거요. 저녁까지 돌려주면 되고.',
    use: '허공에 한 번 던졌다. 걸린 건 없다.' },

  { id: 'pole', name: '등산 스틱', icon: 'stick', tag: '도구',
    from: '가현산 등산객',
    give: { regions: ['forest'] },
    line: '두 짝인데 한 짝만 써요. 가져가요.',
    use: '땅을 두 번 짚었다. 걷기가 조금 낫다.' },

  { id: 'acorn', name: '도토리 한 줌', icon: 'food', tag: '투척',
    from: '산에서 만난 할머니',
    give: { regions: ['forest'] },
    line: '주워도 다 못 가져가. 좀 덜어 가.',
    use: '주머니에서 달그락거린다. 다람쥐 몫이라고 했다.' },

  { id: 'talisman', name: '부적', icon: 'paper', tag: '착용',
    from: '가현산 도인',
    give: { regions: ['forest'], kinds: ['church'] },
    line: '접어서 안주머니에. 오늘 하루치예요.',
    use: '한자 같기도 하고 그림 같기도 하다.' },

  { id: 'incense', name: '향 한 다발', icon: 'plant', tag: '투척',
    from: '절·기도처 사람',
    give: { kinds: ['church'], regions: ['forest'] },
    line: '태우면 오 분쯤 가요.',
    use: '냄새만 맡았다. 불은 붙이지 않았다.' },

  { id: 'keys', name: '열쇠 꾸러미', icon: 'metal', tag: '도구',
    from: '관리사무소 직원',
    give: { kinds: ['apartment', 'public', 'tower'] },
    line: '옥상이랑 지하 거예요. 잃어버리면 큰일 나요.',
    use: '몇 개인지 세어 봤다. 열한 개.' },

  { id: 'badge', name: '출입카드', icon: 'card', tag: '착용',
    from: '공단 사무직',
    give: { kinds: ['factory', 'tower'], regions: ['industrial'] },
    line: '방문증이에요. 오늘까지만 됩니다.',
    use: '아무 데나 대 봤다. 삑, 소리는 안 났다.' },

  { id: 'helmet', name: '안전모', icon: 'cloth', tag: '착용',
    from: '현장 소장',
    give: { kinds: ['factory', 'warehouse'], regions: ['industrial'] },
    line: '쓰고 다니세요. 여기 위에서 뭐 떨어져요.',
    use: '턱끈을 조였다. 조금 우스운 기분이 든다.' },

  { id: 'tripod', name: '삼각대', icon: 'stick', tag: '도구',
    from: '사진 찍는 사람',
    give: { regions: ['field', 'forest'], kinds: ['park_facility'] },
    line: '무거워서요. 오는 길에 돌려주면 되고.',
    use: '다리를 펴 세웠다. 위에 올릴 게 없다.' },

  { id: 'binoculars', name: '쌍안경', icon: 'device', tag: '도구',
    from: '새 보러 온 사람',
    give: { regions: ['field'], kinds: ['park_facility'] },
    line: '한강 쪽 보려면 이게 있어야 해요.',
    use: '멀리 굴뚝이 보였다. 연기는 오늘도 오른다.' },

  { id: 'loupe', name: '확대경', icon: 'device', tag: '도구',
    from: '곤충 보는 아이',
    give: { kinds: ['school'], regions: ['field', 'forest'] },
    line: '아저씨도 봐요. 다리에 털 엄청 많아요.',
    use: '손등을 봤다. 안 보던 게 보인다.' },

  { id: 'net', name: '포충망', icon: 'stick', tag: '도구',
    from: '방역반·곤충 채집',
    give: { regions: ['field', 'forest'], kinds: ['school', 'public'] },
    line: '오늘 벌레 많아요. 하나 들고 다니세요.',
    use: '허공을 한 번 저었다. 뭔가 들어왔다가 나갔다.' },

  { id: 'spray', name: '모기 스프레이', icon: 'cylinder', tag: '도구',
    from: '보건소 직원',
    give: { kinds: ['public', 'hospital', 'mart'] },
    line: '이번 주 나눠 주는 거예요.',
    use: '허공에 한 번 뿌렸다. 냄새가 오래 간다.' },

  { id: 'balloon', name: '풍선', icon: 'ball', tag: '투척',
    from: '아이',
    give: { kinds: ['mart', 'apartment', 'school'], regions: ['city'] },
    line: '두 개 받았어요. 하나 가져요.',
    use: '손에서 놓았다가 급히 잡았다.' },

  { id: 'basket', name: '장바구니', icon: 'cloth', tag: '도구',
    from: '마트 판매사원',
    give: { kinds: ['mart'] },
    line: '이거 접으면 주머니에 들어가요.',
    use: '펼쳤다 접었다. 넣을 게 없다.' },

  { id: 'sample', name: '시식 접시', icon: 'food', tag: '투척',
    from: '마트 시식 사원',
    give: { kinds: ['mart'] },
    line: '남은 거 다 가져가세요. 접시째로.',
    use: '하나 집어 먹었다. 짜다.' },

  { id: 'ticket', name: '영화표', icon: 'paper', tag: '도구',
    from: '영화관 직원',
    give: { kinds: ['cinema', 'mart', 'tower'] },
    line: '조조 한 자리 남았어요. 안 쓰면 버려요.',
    use: '상영 시각을 봤다. 출근 시간과 겹친다.' },

  { id: 'popcorn', name: '팝콘', icon: 'food', tag: '투척',
    from: '영화관 손님',
    give: { kinds: ['cinema', 'mart'] },
    line: '혼자 다 못 먹어요. 반 가져가요.',
    use: '한 알 던져 입으로 받았다. 성공.' },

  { id: 'laser', name: '장난감 레이저총', icon: 'device', tag: '도구',
    from: '이상한 이야기를 하는 연구원',
    give: { kinds: ['tower', 'factory', 'school'], regions: ['industrial'] },
    line: '장난감이에요. …아마도.',
    use: '벽에 초록 점이 생겼다. 점이 혼자 조금 움직인 것 같다.' },

  { id: 'magnet', name: '커다란 자석', icon: 'metal', tag: '도구',
    from: '과학 선생님',
    give: { kinds: ['school', 'factory'] },
    line: '수업에 쓰던 건데 요새 안 써요.',
    use: '난간에 붙였다 뗐다. 소리가 좋다.' },

  { id: 'battery', name: '건전지 한 팩', icon: 'metal', tag: '도구',
    from: '전파사 주인',
    give: { kinds: ['shop'] },
    line: '이거 없으면 아무것도 안 돌아가요.',
    use: '흔들어 봤다. 아직 안 쓴 것 같다.' },

  { id: 'walkie', name: '무전기', icon: 'device', tag: '도구',
    from: '경비 반장',
    give: { kinds: ['factory', 'warehouse', 'public', 'tower'] },
    line: '3번 채널이에요. 아무 말이나 하면 누가 받아요.',
    use: '"…들리세요?" 잡음만 돌아왔다.' },

  { id: 'papermap', name: '종이 지도', icon: 'paper', tag: '도구',
    from: '안내소·민원실 직원',
    give: { kinds: ['public', 'station'] },
    line: '요새 아무도 안 가져가요. 한 장 드릴게요.',
    use: '펴 보니 구래동은 아직 논으로 그려져 있다.' },

  { id: 'shovel', name: '모종삽', icon: 'metal', tag: '도구',
    from: '밭에서 일하는 사람',
    give: { regions: ['field'], kinds: ['farmhouse'] },
    line: '쓰고 아무 데나 꽂아 놔요.',
    use: '흙을 한 번 떠 봤다. 아직 차다.' },

  { id: 'seeds', name: '씨앗 봉지', icon: 'paper', tag: '투척',
    from: '종묘상·농부',
    give: { regions: ['field'], kinds: ['farmhouse', 'shop'] },
    line: '작년 것이라 잘 나올지는 몰라요.',
    use: '봉지를 흔들었다. 안에서 자잘한 소리가 난다.' },
];

export const ITEM_BY_ID = new Map(ITEMS.map((it) => [it.id, it]));

export function itemName(id) {
  const it = ITEM_BY_ID.get(id);
  return it ? it.name : '';
}

// 이 자리(건물 종류 / 지역 성격)에서 줄 만한 아이템들
export function itemsFor(kind, region) {
  return ITEMS.filter((it) => (kind && it.give.kinds && it.give.kinds.includes(kind))
    || (region && it.give.regions && it.give.regions.includes(region)));
}
