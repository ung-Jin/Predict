/* [3번 소유] 요약 카드 / 3개월 예측 / 월별 추이가 같이 쓰는 것들
 *
 * 이 파일이 dashboard.html head 에서 먼저 로드되므로,
 * 아래 kpiSelectedRegions / kpiSeriesColor / onRegionChange 는 세 파일 모두에서 쓸 수 있다.
 */

/* 시리즈 색.
   A(첫 번째 지역) = 파랑, B(두 번째 지역) = 주황, 시도 평균 = 초록.
   명도/채도/색각이상 분리도/대비 6개 검사를 통과한 조합이다.
   바꿀 때는 색상환에서 서로 먼 색으로 유지할 것. */
const KPI_COLOR_A = '#3F72B5';
const KPI_COLOR_B = '#C86A1E';
const KPI_COLOR_AVG = '#2F9E79';

/* 두 번째 줄이 "시도 평균"이면 초록, 실제 지역이면 주황 */
function kpiSeriesColor(index, name){
  if(index === 0) return KPI_COLOR_A;
  return name === '시도 평균' ? KPI_COLOR_AVG : KPI_COLOR_B;
}

/* '#3F72B5' + 0.3 -> 'rgba(63,114,181,0.3)'
   작년 막대나 선 아래 배경처럼 같은 색을 옅게 쓸 때 사용한다 */
function kpiAlpha(hex, alpha){
  const value = parseInt(hex.replace('#', ''), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

/* 2번 map-app.js 가 sessionStorage 에 넣어둔 선택 지역을 읽는다.
   키 이름(selectedRegionA/B)은 팀 공용이라 그대로 쓴다. 없으면 null. */
function kpiSelectedRegions(){
  return {
    a : sessionStorage.getItem('selectedRegionA'),
    b : sessionStorage.getItem('selectedRegionB')
  };
}

/* 선택 지역을 axios 쿼리 파라미터로 바꾼다. 없는 값은 아예 안 보낸다 */
function kpiRequestParams(){
  const selected = kpiSelectedRegions();
  const params = {};
  if(selected.a) params.a = selected.a;
  if(selected.b) params.b = selected.b;
  return { params : params };
}

/* 지도에서 지역을 고르거나 뺄 때마다 2번이 document 에 region:selected 를 쏜다.
   각 차트가 이 함수로 자기 갱신 함수를 걸어두면 선택이 바뀔 때마다 다시 그려진다. */
function onRegionChange(redraw){
  document.addEventListener('region:selected', redraw);
}

/* 4816 -> '4,816' */
function kpiComma(value){
  return (value == null) ? '-' : Number(value).toLocaleString();
}

/* 4.2 -> '+4.2', -6.6 -> '-6.6' */
function kpiSigned(value, digits){
  if(value == null) return '-';
  const sign = value > 0 ? '+' : '';
  return sign + Number(value).toFixed(digits == null ? 1 : digits);
}
