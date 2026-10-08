/* [3번 소유] 앞으로 3개월 예측
 *
 * 데이터는 /chart-api/forecast3 에서 받아온다.
 * 받는 모양 : {
 *   unit : 'GWh',
 *   labels : ['8월', '9월', '10월'],
 *   series : [ {name:'서울', predicted:[...], prevYear:[...], yoyPct:[...]}, ... ]
 * }
 *
 * 한 달마다 줄(지역)별로 막대를 두 개 세운다.
 *   얇고 옅은 막대 = 작년 같은 달 실적
 *   진한 막대      = 올해 예측
 * 막대 아래에는 전년 동월 대비 증감률을 글자로 적는다.
 */

//차트 객체를 저장할 변수. 다시 그릴 때 이전 차트를 지우는 데 쓴다
let savedForecast3Chart = null;

/* [2026-10-08] 전년도 막대 전용 light color. kpiSeriesLightColor(공용) 는 alpha 0.18 인데
   trend 음영이 겹치는 상황을 전제한 값이라 forecast3 막대에는 너무 희미했다. 여기선 bar 가
   서로 겹치지 않고 나란히 서므로 alpha 0.4 정도까지 올려도 안전하고 가시성이 올라감. */
function forecast3LightColor(index, name){
  const base = kpiSeriesColor(index, name);
  const r = parseInt(base.slice(1,3), 16);
  const g = parseInt(base.slice(3,5), 16);
  const b = parseInt(base.slice(5,7), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',0.4)';
}

//한 줄(지역)을 "작년 / 예측" 막대 두 개로 만드는 함수
function makeForecast3Bars(one, index){
  const color = kpiSeriesColor(index, one.name);
  const lightColor = forecast3LightColor(index, one.name);

  //작년 막대 : 얇고 옅게. 비교 기준이라 눈에 덜 띄게 한다
  const lastYearBar = {
    label : one.name + ' 작년',
    data : one.prevYear,
    backgroundColor : lightColor,
    borderWidth : 0,
    borderRadius : 4,
    barPercentage : 0.5
  };

  //예측 막대 : 진하게
  const predictedBar = {
    label : one.name,
    data : one.predicted,
    backgroundColor : color,
    borderWidth : 0,
    borderRadius : 4,
    barPercentage : 0.75
  };

  return [lastYearBar, predictedBar];
}

//막대 아래 증감률 글자 채우기 (막대 위에 숫자를 다 올리면 읽기 힘들어서 아래에 적는다)
//[2026-10-08] 각 "예측" bar 바로 아래에 그 지역 캡션이 오도록 재배치.
//  bar 는 월 묶음 안에 (작년|예측) × N 지역 순으로 들어간다. 캡션 cell 을 2N 열 grid 로
//  두고 짝수 자리(2,4,...)에만 지역 글자를 넣고 홀수 자리(작년 bar 아래) 는 비운다 →
//  지역명이 예측 bar 아래 세로 정렬.
function drawForecast3Caption(chartData){
  const caption = document.querySelector('#forecast3Caption');
  const labels = chartData.labels;
  const series = chartData.series;

  //달 수만큼 칸을 만든다 (8월 / 9월 / 10월 이면 3칸)
  caption.style.gridTemplateColumns = 'repeat(' + labels.length + ', 1fr)';

  const colsPerCell = series.length * 2;  // 작년/예측 × 지역 수
  let html = '';

  //달 하나마다 한 칸, 그 안에 bar 자리수(2N) grid 로 지역 글자를 "예측" 자리에만 배치
  for(let month = 0; month < labels.length; month++){
    html += '<div class="f3-caption-cell" style="grid-template-columns: repeat(' + colsPerCell + ', minmax(0, 1fr))">';

    for(let i = 0; i < series.length; i++){
      const one = series[i];
      const color = kpiSeriesColor(i, one.name);
      const valueText = kpiSigned(one.yoyPct[month], 1) + '%';

      // 작년 bar 아래 자리는 비움 (글자 없이 grid 칸만 차지)
      html += '<span class="f3-caption-spacer"></span>';
      // 예측 bar 아래 자리에 지역명 + 증감률
      html += '<span class="f3-caption-item">';
      html += '  <span class="f3-dot" style="background:' + color + '"></span>';
      html += '  <span>' + one.name + ' ' + valueText + '</span>';
      html += '</span>';
    }

    html += '</div>';
  }

  caption.innerHTML = html;
}

//앞으로 3개월 예측 막대 차트 그리기
function drawForecast3Chart(chartData){
  //차트 그릴 영역을 선택
  const forecast3Chart = document.querySelector('#forecast3Chart');

  //지역 수만큼 막대 묶음을 만들어 한 배열에 모은다
  let datasets = [];
  for(let i = 0; i < chartData.series.length; i++){
    datasets = datasets.concat(makeForecast3Bars(chartData.series[i], i));
  }

  //같은 자리에 두 번 그리면 Chart.js 가 오류를 내므로, 그리기 전에 이전 차트를 지운다
  if(savedForecast3Chart){
    savedForecast3Chart.destroy();
  }

  //new Chart(어디에, 어떻게);
  savedForecast3Chart = new Chart(forecast3Chart, {
    type : 'bar',       //차트 종류
    data : {
      labels : chartData.labels,   //x축에 표시할 항목 (8월, 9월, 10월)
      datasets : datasets          //y축에 표시할 막대들
    },
    options : {
      responsive : true,
      //높이는 forecast3.css 가 정한다. 이 값이 true 면 캔버스가 계속 늘어난다
      maintainAspectRatio : false,
      plugins : {
        //2번 donut.js 가 숫자 표시 플러그인을 전체에 켜둬서 막대마다 숫자가 찍힌다. 여기선 끈다
        datalabels : { display : false },
        legend : {
          position : 'top',
          align : 'end',
          labels : {
            usePointStyle : true,
            pointStyle : 'circle',   //범례 표시를 동그라미로
            /* 동그라미 지름을 요약 카드의 점(.kpi-dot 9px)과 맞춘다.
               Chart.js 는 boxHeight 에 1.41 을 곱한 값을 지름으로 쓰므로
               9 / 1.41 = 6.4 를 넣으면 화면에 9px 로 그려진다.
               boxWidth 는 동그라미가 들어갈 가로 자리폭이라 9px 로 둔다. */
            boxHeight : 6.4,
            boxWidth : 9,
            padding : 6,      //범례와 그래프 사이 간격. 클수록 그래프가 아래로 밀린다
            //'작년' 막대는 범례에서 뺀다. 제목 옆에 "얇은 막대는 작년"이라고 적어뒀다
            filter : function(item){
              return item.text.indexOf(' 작년') === -1;
            }
          }
        }
      },
      scales : {
        //세로 격자선은 끈다 (막대 자체가 이미 구분된다)
        x : { grid : { display : false } },
        y : {
          beginAtZero : true,
          ticks : { maxTicksLimit : 5 }
        }
      }
    }
  });
}

//화면이 열리면 3개월 예측 데이터를 조회하는 함수
async function getForecast3Data(){
  let resultData;

  try{
    const response = await axios.get('/chart-api/forecast3', kpiRequestParams());
    resultData = response.data;   //자바에서 리턴받은 데이터
    console.log(resultData);

  }catch(error){
    console.log('앞으로 3개월 예측 조회 시 오류 발생');
    console.log(error);
    return;   //데이터를 못 받았으면 그리지 않는다
  }

  drawForecast3Chart(resultData);
  drawForecast3Caption(resultData);
}

getForecast3Data();

//지도에서 지역을 고르거나 뺄 때마다 다시 조회해서 다시 그린다
onRegionChange(getForecast3Data);
