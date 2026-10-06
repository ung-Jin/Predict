/* [3번 소유] 월별 사용량 추이 차트
 *
 * 데이터는 /chart-api/trend 에서 axios 로 받아온다 (KpiApiController -> KpiService).
 * 응답 형태 : { unit : 'GWh', labels : ['2022.01', ...], forecastStart : 54,
 *               series : [ {name, actual:[...], forecast:[...]}, ... ] }
 * 세 배열의 길이는 같고, 값이 없는 달은 null 이다 (Chart.js 가 선 끊김으로 처리).
 */

//선이 왼쪽 끝에서 오른쪽 끝까지 그려지는 데 걸리는 시간
const TREND_ANIM_MS = 1200;

//차트 객체를 저장할 변수. 다시 그릴 때 이전 차트를 지우는 데 쓴다
let savedTrendChart = null;

//툴팁에 붙일 단위. 응답의 unit 으로 덮어쓴다
let trendUnit = 'GWh';

/* 왼쪽에서 오른쪽으로 선이 그려지는 진입 연출.
   점 좌표를 건드리지 않고, 캔버스를 왼쪽부터 넓혀가며 보여주는 방식이다.
   좌표(x)를 NaN 에서 출발시키는 방식은 창 크기가 바뀌어 차트가 다시 그려질 때
   점이 전부 사라지므로 쓰지 않는다 (지도 로드로 레이아웃이 흔들리면 바로 재현됨).
   축/격자/범례는 클립 밖이라 처음부터 보이고, 선과 점만 왼쪽부터 드러난다. */
const revealLeftToRight = {
  id : 'revealLeftToRight',

  beforeDatasetsDraw : (chart) => {
    if(chart.$revealDone) return;
    if(!chart.$revealStart) chart.$revealStart = performance.now();

    chart.$revealP = Math.min((performance.now() - chart.$revealStart) / TREND_ANIM_MS, 1);

    const area = chart.chartArea;
    const ctx = chart.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(area.left, area.top, (area.right - area.left) * chart.$revealP, area.bottom - area.top);
    ctx.clip();
  },

  afterDatasetsDraw : (chart) => {
    if(chart.$revealDone) return;
    chart.ctx.restore();

    if(chart.$revealP >= 1){
      chart.$revealDone = true;   //끝나면 클립을 아예 걸지 않는다
      return;
    }
    requestAnimationFrame(() => chart.draw());
  }
};

/* 실측이 끝나고 예측이 시작되는 자리에 세로 점선을 긋는다.
   어디부터가 "모델이 만든 값"인지 한눈에 보이게 하는 게 목적이다. */
const trendForecastMarker = {
  id : 'trendForecastMarker',

  afterDatasetsDraw : (chart) => {
    const start = chart.$forecastStart;
    if(start == null || start < 0) return;

    const x = chart.scales.x.getPixelForValue(start);
    const area = chart.chartArea;
    const ctx = chart.ctx;

    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#C6D2E3';
    ctx.moveTo(x, area.top);
    ctx.lineTo(x, area.bottom);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.fillStyle = '#66789A';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('예측 시작', x - 6, area.top + 12);
    ctx.restore();
  }
};

//선 한 줄(dataset)을 만드는 함수. 실측은 실선, 예측은 점선으로만 다르다
function trendSeries(label, data, color, dash, fill){
  return {
    label : label,            //범례
    data : data,              //Y축 그래프 데이터
    borderColor : color,      //선 색상
    backgroundColor : fill ? kpiAlpha(color, 0.12) : color,
    fill : fill,              //선 아래 배경색 (첫 번째 지역만)
    borderWidth : 2,          //선 굵기
    borderDash : dash,        //점선 간격, 빈 배열이면 실선
    tension : 0.3,            //0 > 직선, 1에 가까울수록 곡선
    //점이 58개라 평소엔 숨기고, 마우스를 올린 달만 보여준다
    pointRadius : 0,
    pointHoverRadius : 5,
    pointBackgroundColor : color,
    pointBorderColor : '#fff',
    pointBorderWidth : 2
  };
}

//월별 사용량 추이 차트 그리기
function drawTrendChart(chartData){
  //차트 그릴 영역을 선택
  const trendChart = document.querySelector('#trendChart');
  if(!trendChart || !chartData || !chartData.series) return;

  trendUnit = chartData.unit || 'GWh';

  const root = getComputedStyle(document.documentElement);
  const ink = (root.getPropertyValue('--ink') || '').trim() || '#2A3654';
  const mute = (root.getPropertyValue('--mute') || '').trim() || '#66789A';
  const line = (root.getPropertyValue('--line') || '').trim() || '#E6EEF8';

  //시리즈마다 실측선 + 예측선 두 벌을 만든다
  const datasets = [];
  chartData.series.forEach((one, index) => {
    const color = kpiSeriesColor(index, one.name);
    //배경 채움은 첫 번째 줄에만. 두 줄 다 칠하면 서로 가린다
    datasets.push(trendSeries(one.name, one.actual, color, [], index === 0));
    datasets.push(trendSeries(one.name + ' 예측', one.forecast, color, [6, 4], false));
  });

  //같은 캔버스에 두 번 그리면 Chart.js 가 에러를 낸다. 갱신 전에 반드시 정리
  if(savedTrendChart) savedTrendChart.destroy();

  //new Chart(어디에, 어떻게);
  savedTrendChart = new Chart(trendChart, {
    type : 'line',  //차트 종류
    data : {
      labels : chartData.labels,  //x축에 표시할 항목
      datasets : datasets
    },
    options : {   //차트에 추가 속성 부여
      responsive : true,
      //높이는 trend.css 의 .trend-chart 가 잡는다. 이 값이 true 면 캔버스가 계속 늘어난다
      maintainAspectRatio : false,
      //기본 진입 애니메이션(아래에서 솟아오름)은 끄고, revealLeftToRight 플러그인에 맡긴다
      animation : false,
      interaction : { mode : 'index', intersect : false },
      plugins : {
        //2번 donut.js 가 chartjs-plugin-datalabels 를 전역 등록해서 점마다 숫자가 찍힌다. 끈다
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
            //"예측" 선은 범례에서 뺀다. 실선/점선으로 이미 구분된다
            filter : (item) => item.text.indexOf(' 예측') === -1
          }
        },
        tooltip : {
          backgroundColor : '#fff',
          titleColor : ink,
          bodyColor : ink,
          borderColor : line,
          borderWidth : 1,
          padding : 10,
          cornerRadius : 8,
          usePointStyle : true,
          //값이 없는 줄(실측 구간의 예측선 등)은 툴팁에서 뺀다
          filter : (ctx) => ctx.parsed.y != null,
          callbacks : {
            label : (ctx) => ' ' + ctx.dataset.label + '  ' + ctx.parsed.y.toLocaleString() + ' ' + trendUnit
          }
        }
      },
      scales : {
        x : {
          grid : { display : false },
          border : { color : line },
          ticks : {
            color : mute,
            font : { size : 11 },
            maxRotation : 0,
            //58개월치라 전부 찍으면 글자가 겹친다. 1월만 골라 연도 구분점으로 쓴다
            callback : function(value){
              const label = this.getLabelForValue(value);
              return (label && label.endsWith('.01')) ? label.slice(0, 4) : '';
            },
            autoSkip : false
          }
        },
        y : {
          //선 아래를 칠하므로 0 에서 시작해야 칠해진 넓이가 값과 맞는다
          beginAtZero : true,
          grid : { color : line, drawTicks : false },
          border : { display : false },
          ticks : {
            color : mute,
            font : { size : 11 },
            maxTicksLimit : 6,
            callback : (value) => value.toLocaleString()
          }
        }
      }
    },
    plugins : [revealLeftToRight, trendForecastMarker]   //전역 Chart.register 아님
  });

  //예측이 시작되는 위치를 플러그인이 쓸 수 있게 차트에 실어둔다
  savedTrendChart.$forecastStart = chartData.forecastStart;
}

//추이 차트 데이터 조회 및 그림 그리기
function getTrendDataAndDraw(){
  axios.get('/chart-api/trend', kpiRequestParams())
  .then((response)=>{
    //response.data; 자바에서 리턴받은 데이터
    console.log(response.data);
    drawTrendChart(response.data);
  })
  .catch((error)=>{
    console.log('월별 추이 데이터 조회 시 오류 발생');
    console.log(error);
  });
}

getTrendDataAndDraw();

//지도에서 지역을 고르거나 뺄 때마다 다시 조회해서 다시 그린다
onRegionChange(getTrendDataAndDraw);
