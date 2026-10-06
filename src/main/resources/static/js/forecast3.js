/* [3번 소유] 앞으로 3개월 예측
 *
 * 데이터는 /chart-api/forecast3 에서 axios 로 받아온다 (KpiApiController -> KpiService).
 * 응답 형태 : { unit : 'GWh', labels : ['8월','9월','10월'],
 *               series : [ {name, predicted:[...], prevYear:[...], yoyPct:[...]}, ... ] }
 *
 * 한 달마다 시리즈별로 막대 두 개를 세운다 - 얇은 쪽이 작년 실적, 진한 쪽이 예측.
 * 막대 아래 캡션에는 전년 동월 대비 증감률을 글자로 적는다.
 */

let savedForecast3Chart = null;

//한 시리즈를 "작년 / 예측" 막대 두 벌로 만든다
function forecast3Datasets(series){
  const datasets = [];

  series.forEach((one, index) => {
    const color = kpiSeriesColor(index, one.name);

    //작년 : 얇고 옅게. 비교 기준이지 주인공이 아니다
    datasets.push({
      label : one.name + ' 작년',
      data : one.prevYear,
      backgroundColor : kpiAlpha(color, 0.28),
      borderWidth : 0,
      borderRadius : { topLeft : 4, topRight : 4 },
      barPercentage : 0.5,
      categoryPercentage : 0.8
    });

    //예측 : 진하게
    datasets.push({
      label : one.name,
      data : one.predicted,
      backgroundColor : color,
      borderWidth : 0,
      borderRadius : { topLeft : 4, topRight : 4 },
      barPercentage : 0.75,
      categoryPercentage : 0.8
    });
  });

  return datasets;
}

//막대 아래에 달 별 증감률을 적는다 (막대 위에 숫자를 다 올리면 읽히지 않는다)
function drawForecast3Caption(chartData){
  const box = document.querySelector('#forecast3Caption');
  if(!box) return;

  const labels = chartData.labels || [];
  const series = chartData.series || [];

  box.style.gridTemplateColumns = 'repeat(' + labels.length + ', 1fr)';
  box.textContent = '';

  //달 이름은 차트 x축이 이미 보여주므로, 여기서는 칸만 맞추고 증감률만 적는다
  labels.forEach((_, monthIndex) => {
    const cell = document.createElement('div');
    cell.className = 'f3-caption-cell';

    series.forEach((one, index) => {
      const item = document.createElement('span');
      item.className = 'f3-caption-item';

      const dot = document.createElement('span');
      dot.className = 'f3-dot';
      dot.style.background = kpiSeriesColor(index, one.name);

      const text = document.createElement('span');
      text.textContent = one.name + ' ' + kpiSigned(one.yoyPct[monthIndex], 1) + '%';

      item.appendChild(dot);
      item.appendChild(text);
      cell.appendChild(item);
    });

    box.appendChild(cell);
  });
}

//앞으로 3개월 예측 막대 차트 그리기
function drawForecast3(chartData){
  //차트 그릴 영역을 선택
  const forecast3Chart = document.querySelector('#forecast3Chart');
  if(!forecast3Chart || !chartData || !chartData.series) return;

  const mute = getComputedStyle(document.documentElement).getPropertyValue('--mute').trim() || '#66789A';
  const line = getComputedStyle(document.documentElement).getPropertyValue('--line').trim() || '#E6EEF8';
  const unit = chartData.unit || 'GWh';

  //같은 캔버스에 두 번 그리면 Chart.js 가 에러를 낸다. 갱신 전에 반드시 정리
  if(savedForecast3Chart) savedForecast3Chart.destroy();

  //new Chart(어디에, 어떻게);
  savedForecast3Chart = new Chart(forecast3Chart, {
    type : 'bar',
    data : {
      labels : chartData.labels,
      datasets : forecast3Datasets(chartData.series)
    },
    options : {
      responsive : true,
      maintainAspectRatio : false,
      interaction : { mode : 'index', intersect : false },
      plugins : {
        //2번 donut.js 가 chartjs-plugin-datalabels 를 전역 등록해서 막대마다 숫자가 찍힌다. 끈다
        datalabels : { display : false },
        legend : {
          position : 'top',
          align : 'end',
          labels : {
            usePointStyle : true,
            pointStyle : 'circle',
            boxWidth : 8,
            boxHeight : 8,
            padding : 14,
            color : mute,
            font : { size : 12 },
            //"작년" 막대는 범례에서 뺀다. 머리말에 "얇은 막대는 작년"이라고 적어둔다
            filter : (item) => item.text.indexOf(' 작년') === -1
          }
        },
        tooltip : {
          backgroundColor : '#fff',
          titleColor : '#2A3654',
          bodyColor : '#2A3654',
          borderColor : line,
          borderWidth : 1,
          padding : 10,
          cornerRadius : 8,
          callbacks : {
            label : (ctx) => ' ' + ctx.dataset.label + '  ' + ctx.parsed.y.toLocaleString() + ' ' + unit
          }
        }
      },
      scales : {
        x : {
          grid : { display : false },
          border : { color : line },
          ticks : { color : mute, font : { size : 11 } }
        },
        y : {
          beginAtZero : true,
          grid : { color : line, drawTicks : false },
          border : { display : false },
          ticks : {
            color : mute,
            font : { size : 11 },
            maxTicksLimit : 5,
            callback : (value) => value.toLocaleString()
          }
        }
      }
    }
  });

  drawForecast3Caption(chartData);
}

//앞으로 3개월 예측 데이터 조회 및 그림 그리기
function getForecast3DataAndDraw(){
  axios.get('/chart-api/forecast3', kpiRequestParams())
  .then((response)=>{
    //response.data; 자바에서 리턴받은 데이터
    console.log(response.data);
    drawForecast3(response.data);
  })
  .catch((error)=>{
    console.log('앞으로 3개월 예측 조회 시 오류 발생');
    console.log(error);
  });
}

getForecast3DataAndDraw();

//지도에서 지역을 고르거나 뺄 때마다 다시 조회해서 다시 그린다
onRegionChange(getForecast3DataAndDraw);
