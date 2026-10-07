/* [3번 소유] 월별 사용량 추이 차트
 *
 * 데이터는 /chart-api/trend 에서 받아온다.
 * 보여줄 기간(2025.07 ~ 2026.12)은 자바 쪽 KpiService 가 정해서 잘라 보낸다.
 * 받는 모양 : {
 *   unit : 'GWh',
 *   labels : ['2025.07', '2025.08', ... , '2026.10'],
 *   forecastStart : 12,                                  // 예측이 시작되는 칸 번호
 *   series : [ {name:'서울', actual:[...], forecast:[...]}, ... ]
 * }
 *
 * actual(실측)과 forecast(예측)는 길이가 labels 와 같고, 값이 없는 달은 null 이다.
 * Chart.js 는 null 을 "선 끊김"으로 처리한다.
 */

//차트 객체를 저장할 변수. 다시 그릴 때 이전 차트를 지우는 데 쓴다
let savedTrendChart = null;

/* 예측이 시작되는 칸 번호. 아래 drawTrendChart 가 넣어두고 플러그인이 꺼내 쓴다.
   차트를 만들기 "전에" 넣어야 한다. 차트는 만들어질 때 한 번 그려지는데,
   그 시점에 값이 없으면 세로 점선이 그려지지 않는다. */
let trendForecastStart = -1;

/* 선과 음영이 왼쪽에서 오른쪽으로 그려지는 효과.

   눈금(1,000 / 2,000 ...)과 가로 격자선은 처음부터 그대로 두고
   "선과 음영만" 드러나야 한다. 이건 CSS 로는 할 수 없다.
   눈금도 격자선도 선과 같은 캔버스 한 장에 그려지기 때문에,
   캔버스를 가리면 전부 같이 가려진다.
   그래서 Chart.js 가 "선을 그리는 순간"에만 끼어들어 그 부분만 범위를 제한한다.

   Chart.js 는 한 번 그릴 때 아래 순서로 그린다.
     격자·눈금 -> beforeDatasetsDraw -> 선·음영 -> afterDatasetsDraw -> 범례
   가운데 두 자리에 우리 함수를 끼워 넣으면 선과 음영에만 효과가 걸린다.

   ctx.save() / ctx.clip() / ctx.restore() 세 개만 알면 된다.
     save    : 지금 설정을 잠깐 저장
     clip    : 방금 그린 네모 "안쪽에만" 그려지도록 제한
     restore : 저장해둔 설정으로 되돌리기 (제한 해제) */
const TREND_DRAW_MS = 900;   //다 드러나는 데 걸리는 시간

let trendDrawStart = 0;      //효과가 시작된 시각
let trendDrawRatio = 0;      //0 = 아직 안 보임, 1 = 다 보임
let trendDrawDone = false;   //다 드러났는지

const trendDrawEffect = {
  id : 'trendDrawEffect',

  //선을 그리기 직전 : 지금까지 보여줄 만큼만 네모로 오려낸다
  beforeDatasetsDraw : function(chart){
    if(trendDrawDone){
      return;   //다 드러났으면 아무것도 하지 않는다
    }

    //시작한 지 얼마나 지났는지를 0 ~ 1 사이의 값으로 바꾼다
    trendDrawRatio = Math.min((Date.now() - trendDrawStart) / TREND_DRAW_MS, 1);

    const area = chart.chartArea;                          //선이 그려지는 네모 영역
    const width = (area.right - area.left) * trendDrawRatio;

    chart.ctx.save();
    chart.ctx.beginPath();
    chart.ctx.rect(area.left, area.top, width, area.bottom - area.top);
    chart.ctx.clip();
  },

  //선을 다 그린 뒤 : 오려내기를 풀고, 아직 덜 드러났으면 한 번 더 그려달라고 요청한다
  afterDatasetsDraw : function(chart){
    if(trendDrawDone){
      return;
    }

    chart.ctx.restore();

    if(trendDrawRatio >= 1){
      trendDrawDone = true;   //끝났으면 다음부터는 오려내지 않는다
    }else{
      //다음 화면이 그려질 때 다시 불러 달라고 브라우저에 부탁한다
      requestAnimationFrame(function(){ chart.draw(); });
    }
  }
};

/* 실측이 끝나고 예측이 시작되는 자리에 세로 점선을 긋는 플러그인.
   어디부터가 "모델이 만든 값"인지 한눈에 보이게 하는 게 목적이다.
   Chart.js 가 선을 다 그린 뒤(afterDatasetsDraw) 그 위에 직접 선을 하나 긋는다. */
const trendForecastLine = {
  id : 'trendForecastLine',

  afterDatasetsDraw : function(chart){
    if(trendForecastStart < 0){
      return;   //예측 구간이 없으면 선을 긋지 않는다
    }

    const x = chart.scales.x.getPixelForValue(trendForecastStart);   //그 칸의 가로 위치(픽셀)
    const area = chart.chartArea;                       //그래프가 그려지는 네모 영역
    const ctx = chart.ctx;                              //그림을 그리는 도구

    ctx.save();                      //지금 설정을 잠깐 저장
    ctx.setLineDash([4, 4]);         //4픽셀 그리고 4픽셀 쉬는 점선
    ctx.strokeStyle = '#C6D2E3';
    ctx.beginPath();
    ctx.moveTo(x, area.top);         //위에서
    ctx.lineTo(x, area.bottom);      //아래까지 선 긋기
    ctx.stroke();

    ctx.setLineDash([]);             //점선 해제 (글자는 실선으로)
    ctx.fillStyle = '#66789A';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    //그래프 맨 윗 기준선 "위쪽" 바깥에 적는다. area.top 이 기준선 자리라 거기서 5px 더 올린다
    ctx.fillText('예측 시작', x - 6, area.top - 5);
    ctx.restore();                   //저장해둔 설정으로 되돌리기
  }
};

/* 선 하나(dataset)를 만드는 함수.
   실측은 실선, 예측은 점선인 것만 다르다.
   fill 이 true 면 선 아래를 옅은 색으로 칠한다. */
function makeTrendLine(label, data, color, lightColor, dash, fill){
  return {
    label : label,              //범례에 쓸 이름
    data : data,                //y축 데이터
    borderColor : color,        //선 색
    backgroundColor : lightColor,
    fill : fill,                //선 아래 배경 칠하기
    borderWidth : 2,            //선 굵기
    borderDash : dash,          //점선 간격. 빈 배열이면 실선
    tension : 0.3,              //0 이면 직선, 1 에 가까울수록 곡선
    pointRadius : 0,            //점이 58개라 평소엔 숨긴다
    pointHoverRadius : 5,       //마우스를 올린 달만 점을 보여준다
    //범례의 동그라미는 이 색을 쓴다.
    //이걸 안 주면 위의 backgroundColor(옅은 배경색)가 쓰여서 범례가 비어 보인다
    pointBackgroundColor : color
  };
}

//월별 사용량 추이 차트 그리기
function drawTrendChart(chartData){
  //차트 그릴 영역을 선택
  const trendChart = document.querySelector('#trendChart');
  const unit = chartData.unit;

  //지역마다 "실측 선 + 예측 선" 두 개씩 만든다
  const datasets = [];
  for(let i = 0; i < chartData.series.length; i++){
    const one = chartData.series[i];
    const color = kpiSeriesColor(i, one.name);
    const lightColor = kpiSeriesLightColor(i, one.name);

    /* 실측 선 아래는 두 줄 다 칠한다.
       색이 반투명(0.18)이라 겹치는 자리도 아래쪽 색이 비쳐 보인다.
       예측(점선)은 칠하지 않는다. 칠해진 구간이 곧 "실측 구간"이라는 표시가 된다. */
    datasets.push(makeTrendLine(one.name, one.actual, color, lightColor, [], true));
    datasets.push(makeTrendLine(one.name + ' 예측', one.forecast, color, lightColor, [6, 4], false));
  }

  //"예측 시작" 선을 그릴 자리를 플러그인이 꺼내 쓸 수 있게 미리 넣어둔다
  trendForecastStart = chartData.forecastStart;

  //드러내기 효과를 처음부터 다시 시작한다 (차트를 만들기 전에 해둬야 첫 그림부터 적용된다)
  trendDrawStart = Date.now();
  trendDrawRatio = 0;
  trendDrawDone = false;

  //같은 자리에 두 번 그리면 Chart.js 가 오류를 내므로, 그리기 전에 이전 차트를 지운다
  if(savedTrendChart){
    savedTrendChart.destroy();
  }

  //new Chart(어디에, 어떻게);
  savedTrendChart = new Chart(trendChart, {
    type : 'line',   //차트 종류
    data : {
      labels : chartData.labels,   //x축에 표시할 항목
      datasets : datasets          //y축에 표시할 선들
    },
    options : {
      responsive : true,
      //높이는 trend.css 가 정한다. 이 값이 true 면 캔버스가 계속 늘어난다
      maintainAspectRatio : false,

      /* Chart.js 기본 애니메이션은 점이 바닥에서 올라오는 효과라
         월별 추이에는 어울리지 않아서 끈다. 선이 바로 그려진다. */
      animation : false,

      //마우스를 올리면 그 달의 모든 선 값을 한 번에 보여준다
      interaction : { mode : 'index', intersect : false },
      plugins : {
        //2번 donut.js 가 숫자 표시 플러그인을 전체에 켜둬서 점마다 숫자가 찍힌다. 여기선 끈다
        datalabels : { display : false },
        legend : {
          position : 'top',
          align : 'end',
          labels : {
            usePointStyle : true,
            pointStyle : 'circle',   //범례 표시를 동그라미로
            /* 동그라미 지름을 요약 카드의 점(.kpi-dot 9px)과 맞춘다.
               Chart.js 는 boxHeight 에 1.41 을 곱한 값을 지름으로 쓴다.
               여기는 선 그래프라 선 굵기(borderWidth 2)가 동그라미 테두리로도 쓰여서
               바깥으로 1px 씩, 지름으로 2px 이 더 붙는다.
               그래서 (9 - 2) / 1.41 = 5 를 넣어야 테두리까지 합쳐 9px 가 된다.
               막대 그래프인 forecast3.js 는 테두리가 없어서 6.4 를 쓴다.
               boxWidth 는 동그라미가 들어갈 가로 자리폭이라 9px 로 둔다. */
            boxHeight : 5,
            boxWidth : 9,
            padding : 6,      //범례와 그래프 사이 간격. 클수록 그래프가 아래로 밀린다
            //'예측' 선은 범례에서 뺀다. 실선/점선으로 이미 구분된다
            filter : function(item){
              return item.text.indexOf(' 예측') === -1;
            }
          }
        },
        tooltip : {
          callbacks : {
            label : function(ctx){
              return ' ' + ctx.dataset.label + '  ' + ctx.parsed.y.toLocaleString() + ' ' + unit;
            }
          }
        }
      },
      scales : {
        x : {
          //세로 격자선은 끈다. 달 수가 많아서 다 그으면 복잡하다
          grid : { display : false },
          ticks : {
            maxRotation : 0,
            /* 달마다 글자를 다 찍으면 서로 겹친다. 석 달에 한 번만 보여준다.
               1, 4, 7, 10월을 3 으로 나누면 나머지가 1 이라서 이렇게 고른다. */
            callback : function(value){
              const label = this.getLabelForValue(value);   //'2025.07'
              const month = Number(label.substring(5));     //7
              if(month % 3 === 1){
                return label;
              }
              return '';
            }
          }
        },
        y : {
          //선 아래를 칠하므로 0 에서 시작해야 칠해진 넓이가 값과 맞는다
          beginAtZero : true,
          //가로 격자선을 6개 정도로 제한한다. 너무 많으면 지저분하다
          ticks : { maxTicksLimit : 6 }
        }
      }
    },
    plugins : [trendDrawEffect, trendForecastLine]   //이 차트에만 쓰는 플러그인
  });
}

//화면이 열리면 추이 데이터를 조회하는 함수
async function getTrendData(){
  let resultData;

  try{
    const response = await axios.get('/chart-api/trend', kpiRequestParams());
    resultData = response.data;   //자바에서 리턴받은 데이터
    console.log(resultData);

  }catch(error){
    console.log('월별 추이 데이터 조회 시 오류 발생');
    console.log(error);
    return;   //데이터를 못 받았으면 그리지 않는다
  }

  drawTrendChart(resultData);
}

getTrendData();

//지도에서 지역을 고르거나 뺄 때마다 다시 조회해서 다시 그린다
onRegionChange(getTrendData);
