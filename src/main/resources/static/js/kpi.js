/* [3번 소유] 요약 카드 4개
 *
 * 데이터는 /chart-api/card 에서 받아온다.
 * 받는 모양 : {
 *   recentYear : 2026, recentMonth : 7, forecastMonth : 8,
 *   series : [ {name:'서울', recentGwh:4816, predictedGwh:5180, yoyPct:-6.6, mape:2.7}, ... ]
 * }
 *
 * series 는 지역을 몇 개 골랐느냐에 따라 1~2줄이다.
 *   0개 : [전국]
 *   1개 : [고른 지역, 시도 평균]
 *   2개 : [지역A, 지역B]
 * 카드 한 장에 series 수만큼 줄이 쌓인다.
 */

/* 카드 한 장을 채우는 함수.
 *   cardId      : 채울 카드의 id            (예: 'kpiRecent')
 *   labelText   : 카드 위에 쓸 제목         (예: '최근 실측 · 2026.7')
 *   seriesList  : 줄 목록                   (서버에서 받은 series)
 *   valueName   : 그 줄에서 꺼내 쓸 값 이름  (예: 'recentGwh')
 *   unit        : 숫자 뒤에 붙일 단위        ('GWh' 또는 '%')
 *   showPlus    : 양수일 때 '+' 를 붙일지    (증감률만 true)
 */
function fillKpiCard(cardId, labelText, seriesList, valueName, unit, showPlus){
  const card = document.querySelector('#' + cardId);
  const label = card.querySelector('.kpi-label');
  const rows = card.querySelector('.kpi-rows');

  label.textContent = labelText;

  //한 줄씩 HTML 을 만들어서 이어 붙인다
  let html = '';

  for(let i = 0; i < seriesList.length; i++){
    const one = seriesList[i];
    const value = one[valueName];
    const color = kpiSeriesColor(i, one.name);

    //단위에 따라 숫자 모양을 정한다. GWh 는 천 단위 콤마, % 는 소수점 한 자리
    let valueText;
    if(unit === 'GWh'){
      valueText = kpiComma(value);
    }else if(showPlus){
      valueText = kpiSigned(value, 1);
    }else{
      valueText = Number(value).toFixed(1);
    }

    html += '<div class="kpi-row">';
    html += '  <span class="kpi-name"><i class="kpi-dot" style="background:' + color + '"></i>' + one.name + '</span>';
    html += '  <span class="kpi-value">' + valueText + '</span>';
    html += '  <span class="kpi-unit">' + unit + '</span>';
    html += '</div>';
  }

  //만든 HTML 을 한 번에 집어넣는다
  rows.innerHTML = html;
}

//요약 카드 4개 그리기
function drawKpiCards(chartData){
  const series = chartData.series;

  //1) 최근 실측
  fillKpiCard('kpiRecent',
              '최근 실측 · ' + chartData.recentYear + '.' + chartData.recentMonth,
              series, 'recentGwh', 'GWh', false);

  //2) 예측 사용량
  fillKpiCard('kpiPredicted',
              chartData.forecastMonth + '월 예측 사용량',
              series, 'predictedGwh', 'GWh', false);

  //3) 전년 동월 대비 (늘었으면 + 를 붙인다)
  fillKpiCard('kpiYoy',
              '전년 동월 대비 · ' + chartData.forecastMonth + '월 예측',
              series, 'yoyPct', '%', true);

  //4) 검증 오차 (오차는 부호가 없는 값이라 + 를 안 붙인다)
  fillKpiCard('kpiMape',
              '검증 오차 (MAPE)',
              series, 'mape', '%', false);
}

//화면이 열리면 카드 데이터를 조회하는 함수
async function getKpiData(){
  let resultData;

  try{
    const response = await axios.get('/chart-api/card', kpiRequestParams());
    resultData = response.data;   //자바에서 리턴받은 데이터
    console.log(resultData);

  }catch(error){
    console.log('요약 카드 데이터 조회 시 오류 발생');
    console.log(error);
    return;   //데이터를 못 받았으면 그리지 않는다
  }

  drawKpiCards(resultData);
}

getKpiData();

//지도에서 지역을 고르거나 뺄 때마다 다시 조회해서 다시 그린다
onRegionChange(getKpiData);
