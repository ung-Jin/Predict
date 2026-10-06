/* [3번 소유] 요약 카드 / 3개월 예측 / 월별 추이가 같이 쓰는 것들
 *
 * 세 조각(kpi.html, forecast3.html, trend.html)이 각자 자기 js 앞에서 이 파일을 불러온다.
 * dashboard.html 은 1번 소유라 건드리지 않으려고 이렇게 했다.
 *
 * 그래서 이 파일은 한 페이지에서 여러 번 실행된다.
 * 맨 바깥 변수를 const 로 두면 두 번째 실행에서
 * "Identifier has already been declared" 오류가 나므로 var 를 쓴다.
 * (var 와 function 은 다시 선언해도 괜찮다)
 */

/* 줄마다 쓸 색.
   A(첫 번째 지역)=파랑, B(두 번째 지역)=주황, 시도 평균=초록.
   서로 멀리 떨어진 색이라 나란히 놔도 헷갈리지 않는다. */
var KPI_COLOR_A = '#3F72B5';
var KPI_COLOR_B = '#C86A1E';
var KPI_COLOR_AVG = '#2F9E79';

/* 위 색을 옅게 만든 것.
   3개월 예측의 "작년" 막대, 추이 차트의 선 아래 배경에 쓴다.
   rgba 의 마지막 숫자(0.25)가 진하기다. 0 이면 투명, 1 이면 원래 색. */
var KPI_COLOR_A_LIGHT = 'rgba(63, 114, 181, 0.25)';
var KPI_COLOR_B_LIGHT = 'rgba(200, 106, 30, 0.25)';
var KPI_COLOR_AVG_LIGHT = 'rgba(47, 158, 121, 0.25)';

/* 몇 번째 줄인지로 색을 고른다.
   첫 줄은 항상 파랑, 둘째 줄은 "시도 평균"이면 초록, 실제 지역이면 주황. */
function kpiSeriesColor(index, name){
  if(index === 0){
    return KPI_COLOR_A;
  }
  if(name === '시도 평균'){
    return KPI_COLOR_AVG;
  }
  return KPI_COLOR_B;
}

/* 위와 같은 규칙으로 옅은 색을 고른다 */
function kpiSeriesLightColor(index, name){
  if(index === 0){
    return KPI_COLOR_A_LIGHT;
  }
  if(name === '시도 평균'){
    return KPI_COLOR_AVG_LIGHT;
  }
  return KPI_COLOR_B_LIGHT;
}

/* 2번 map-app.js 가 sessionStorage 에 넣어둔 선택 지역을 읽는다.
   키 이름(selectedRegionA/B)은 팀 공용이라 그대로 쓴다. 안 골랐으면 null. */
function kpiSelectedRegions(){
  return {
    a : sessionStorage.getItem('selectedRegionA'),
    b : sessionStorage.getItem('selectedRegionB')
  };
}

/* 선택한 지역을 axios 에 넘길 모양으로 만든다.
   예) axios.get('/chart-api/card', kpiRequestParams())
       -> /chart-api/card?a=서울특별시&b=울산광역시
   안 고른 값은 아예 빼고 보낸다. */
function kpiRequestParams(){
  const selected = kpiSelectedRegions();
  const params = {};

  if(selected.a){
    params.a = selected.a;
  }
  if(selected.b){
    params.b = selected.b;
  }
  return { params : params };
}

/* 지도에서 지역을 고르거나 뺄 때마다 2번이 document 에 region:selected 를 보낸다.
   각 차트가 이 함수로 자기 "다시 그리기" 함수를 걸어두면 선택이 바뀔 때마다 다시 그려진다. */
function onRegionChange(redraw){
  document.addEventListener('region:selected', redraw);
}

/* 44063 -> '44,063' */
function kpiComma(value){
  if(value == null){
    return '-';
  }
  return Number(value).toLocaleString();
}

/* 4.2 -> '+4.2', -6.6 -> '-6.6'
   (음수는 toFixed 가 이미 '-' 를 붙여준다) */
function kpiSigned(value, digits){
  if(value == null){
    return '-';
  }
  if(value > 0){
    return '+' + Number(value).toFixed(digits);
  }
  return Number(value).toFixed(digits);
}
