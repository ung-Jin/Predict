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
 *   cardId    : 채울 카드의 id       (예: 'kpiRecent')
 *   labelText : 카드 위에 쓸 제목    (예: '최근 실측 · 2026.7')
 *   nameList  : 지역 이름 목록       (예: ['경북', '충북'])
 *   textList  : 보여줄 값 목록       (예: ['3,358', '2,304'])
 *   unit      : 숫자 뒤에 붙일 단위  ('GWh' 또는 '%')
 *
 * nameList 와 textList 는 길이가 같고 같은 순서로 짝을 이룬다.
 * 즉 nameList[0] 의 값이 textList[0] 이다.
 */
function fillKpiCard(cardId, labelText, nameList, textList, unit){
  const card = document.querySelector('#' + cardId);
  const label = card.querySelector('.kpi-label');
  const rows = card.querySelector('.kpi-rows');

  label.textContent = labelText;

  //한 줄씩 HTML 을 만들어서 이어 붙인다
  let html = '';

  for(let i = 0; i < nameList.length; i++){
    const color = kpiSeriesColor(i, nameList[i]);

    html += '<div class="kpi-row">';
    html += '  <span class="kpi-name"><i class="kpi-dot" style="background:' + color + '"></i>' + nameList[i] + '</span>';
    html += '  <span class="kpi-value">' + textList[i] + '</span>';
    html += '  <span class="kpi-unit">' + unit + '</span>';
    html += '</div>';
  }

  //만든 HTML 을 한 번에 집어넣는다
  rows.innerHTML = html;
}

//요약 카드 4개 그리기
function drawKpiCards(chartData){
  const series = chartData.series;

  /* 받은 데이터를 카드별 목록으로 나눠 담는다.
     한 번 돌면서 다섯 개의 목록을 동시에 채운다.
     이렇게 해두면 아래에서 카드마다 목록 하나씩만 넘겨주면 된다. */
  const nameList = [];        //지역 이름       : ['경북', '충북']
  const recentList = [];      //최근 실측       : ['3,358', '2,304']
  const predictedList = [];   //예측 사용량     : ['3,827', '2,415']
  const yoyList = [];         //전년 동월 대비  : ['-1.0', '-1.1']
  const mapeList = [];        //검증 오차       : ['5.9', '4.4']

  for(let i = 0; i < series.length; i++){
    const one = series[i];

    nameList.push( one.name );
    recentList.push( kpiComma(one.recentGwh) );        //천 단위 콤마를 넣는다
    predictedList.push( kpiComma(one.predictedGwh) );
    yoyList.push( kpiSigned(one.yoyPct, 1) );          //늘었으면 앞에 + 를 붙인다
    mapeList.push( Number(one.mape).toFixed(1) );      //오차는 부호가 없는 값이라 + 를 안 붙인다
  }

  //1) 최근 실측
  fillKpiCard('kpiRecent',
              '최근 실측 · ' + chartData.recentYear + '.' + chartData.recentMonth,
              nameList, recentList, 'GWh');

  //2) 예측 사용량
  fillKpiCard('kpiPredicted',
              chartData.forecastMonth + '월 예측 사용량',
              nameList, predictedList, 'GWh');

  //3) 전년 동월 대비
  fillKpiCard('kpiYoy',
              '전년 동월 대비 · ' + chartData.forecastMonth + '월 예측',
              nameList, yoyList, '%');

  //4) 검증 오차
  fillKpiCard('kpiMape',
              '검증 오차 (MAPE)',
              nameList, mapeList, '%');
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
