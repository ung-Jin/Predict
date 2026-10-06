/* [3번 소유] 요약 카드 4개
 *
 * 데이터는 /chart-api/card 에서 axios 로 받아온다 (KpiApiController -> KpiService).
 * 응답 형태 : { recentYear, recentMonth, forecastMonth,
 *               series : [ {name, recentGwh, predictedGwh, yoyPct, mape}, ... ] }
 *
 * series 는 선택 상태에 따라 1~2줄이다.
 *   선택 0개 : [전국]
 *   선택 1개 : [그 시도, 시도 평균]
 *   선택 2개 : [시도A, 시도B]
 * 카드 하나에 series 수만큼 줄이 쌓인다.
 */

//카드 4개의 정의. 어떤 값을 어떻게 보여줄지만 다르고 그리는 방식은 같다
const KPI_CARDS = [
  {
    id : 'kpiRecent',
    //라벨은 데이터가 와야 정해지므로 함수로 둔다
    label : (data) => '최근 실측 · ' + data.recentYear + '.' + data.recentMonth,
    value : (row) => kpiComma(row.recentGwh),
    unit : 'GWh'
  },
  {
    id : 'kpiPredicted',
    label : (data) => data.forecastMonth + '월 예측 사용량',
    value : (row) => kpiComma(row.predictedGwh),
    unit : 'GWh'
  },
  {
    id : 'kpiYoy',
    label : (data) => '전년 동월 대비 · ' + data.forecastMonth + '월 예측',
    value : (row) => kpiSigned(row.yoyPct, 1),
    unit : '%'
  },
  {
    id : 'kpiMape',
    label : () => '검증 오차 (MAPE)',
    //오차는 부호가 없는 값이라 + 를 붙이지 않는다
    value : (row) => (row.mape == null ? '-' : Number(row.mape).toFixed(1)),
    unit : '%'
  }
];

//카드 한 장을 채운다
function fillKpiCard(card, data){
  const box = document.querySelector('#' + card.id);
  if(!box) return;

  const labelEl = box.querySelector('.kpi-label');
  const rowsEl = box.querySelector('.kpi-rows');
  if(labelEl) labelEl.textContent = card.label(data);
  if(!rowsEl) return;

  rowsEl.textContent = '';   //다시 그릴 때를 대비해 비우고 시작

  (data.series || []).forEach((row, index) => {
    const line = document.createElement('div');
    line.className = 'kpi-row';

    //어느 지역 줄인지 색 점으로 구분한다. 색만으로 구분되지 않게 이름도 같이 쓴다.
    //점을 이름 "안에" 넣어야 글자 기준으로 세로 가운데가 잡힌다.
    //밖에 두면 행 높이(값 글자 크기)를 따라가서 줄마다 점 높이가 어긋난다.
    const dot = document.createElement('i');
    dot.className = 'kpi-dot';
    dot.style.background = kpiSeriesColor(index, row.name);

    const nameEl = document.createElement('span');
    nameEl.className = 'kpi-name';
    nameEl.appendChild(dot);
    nameEl.appendChild(document.createTextNode(row.name));

    const valueEl = document.createElement('span');
    valueEl.className = 'kpi-value';
    valueEl.textContent = card.value(row);

    const unitEl = document.createElement('span');
    unitEl.className = 'kpi-unit';
    unitEl.textContent = card.unit;

    line.appendChild(nameEl);
    line.appendChild(valueEl);
    line.appendChild(unitEl);
    rowsEl.appendChild(line);
  });
}

//요약 카드 4개 그리기
function drawKpiCards(data){
  if(!data || !data.series) return;
  KPI_CARDS.forEach((card) => fillKpiCard(card, data));
}

//요약 카드 데이터 조회 및 그림 그리기
function getKpiDataAndDraw(){
  axios.get('/chart-api/card', kpiRequestParams())
  .then((response)=>{
    //response.data; 자바에서 리턴받은 데이터
    console.log(response.data);
    drawKpiCards(response.data);
  })
  .catch((error)=>{
    console.log('요약 카드 데이터 조회 시 오류 발생');
    console.log(error);
  });
}

getKpiDataAndDraw();

//지도에서 지역을 고르거나 뺄 때마다 다시 조회해서 다시 그린다
onRegionChange(getKpiDataAndDraw);
