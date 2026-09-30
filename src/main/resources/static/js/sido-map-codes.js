/**
 * [2번 소유] /static/js/sido-map-codes.js
 * -----------------------------------------------------------------
 * fragments/map.html에서 map.js보다 먼저 로드됨. 이 파일을 지우면 지도의 폴리곤
 * id와 우리 데이터의 시도명이 매칭 안 돼서 지도 색칠/클릭이 전부 죽습니다.
 * -----------------------------------------------------------------
 *
 * amCharts5의 대한민국 지도 데이터(am5geodata_southKoreaLow)는 지역을
 * "KR-11", "KR-26" 같은 ISO 3166-2:KR 코드(id)로 구분함.
 * 근데 우리 데이터(region_data.json)는 "서울특별시", "부산광역시" 같은
 * 한글 시도명을 쓰니까, 이 둘을 이어주는 매핑 테이블이 필요함.
 *
 * 참고(자바 비유): Map<String, String> 같은 딕셔너리 하나 만들어두는 것과 동일.
 * -----------------------------------------------------------------
 */

// ISO 3166-2:KR 코드 -> 우리 데이터의 한글 시도명
const SIDO_CODE_TO_NAME = {
  'KR-11': '서울특별시',
  'KR-26': '부산광역시',
  'KR-27': '대구광역시',
  'KR-28': '인천광역시',
  'KR-29': '광주광역시',
  'KR-30': '대전광역시',
  'KR-31': '울산광역시',
  'KR-36': '세종특별자치시',
  'KR-41': '경기도',
  'KR-42': '강원도',           // 2023년에 '강원특별자치도'로 개편됐지만, 우리 데이터는 '강원도' 표기 사용
  'KR-43': '충청북도',
  'KR-44': '충청남도',
  'KR-45': '전라북도',
  'KR-46': '전라남도',
  'KR-47': '경상북도',
  'KR-48': '경상남도',
  'KR-49': '제주특별자치도',
};

// 반대 방향(한글 시도명 -> 코드)도 자주 쓰니까 미리 뒤집어서 만들어둠
const SIDO_NAME_TO_CODE = Object.fromEntries(
  Object.entries(SIDO_CODE_TO_NAME).map(([code, name]) => [name, code])
);

/**
 * amCharts geodata를 실제로 로드한 뒤에 한 번 호출해서
 * 우리가 알고 있는 17개 코드가 geodata 안에 전부 있는지,
 * 혹시 빠진 게 있는지 콘솔에 경고해주는 안전장치 함수.
 * (지도 라이브러리 버전이 바뀌면서 코드가 달라지는 경우가 있어서 미리 체크하는 용도)
 */
function validateSidoCodes(geoJSON) {
  const idsInGeo = new Set(geoJSON.features.map((f) => f.id));
  const missing = Object.keys(SIDO_CODE_TO_NAME).filter((code) => !idsInGeo.has(code));

  if (missing.length > 0) {
    console.warn(
      '[sido-map-codes] geodata에서 못 찾은 코드가 있음 (amCharts geodata 버전 확인 필요):',
      missing.map((code) => `${code}(${SIDO_CODE_TO_NAME[code]})`)
    );
  } else {
    console.log('[sido-map-codes] 17개 시도 코드 전부 geodata와 매칭 확인됨');
  }
}
