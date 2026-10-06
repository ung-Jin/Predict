/* [3번 소유] 월별 사용량 추이 차트
 *
 * 데이터는 /chart-api/trend 에서 받아온다.
 * 받는 모양 : {
 *   unit : 'GWh',
 *   labels : ['2022.01', '2022.02', ... , '2026.10'],
 *   forecastStart : 54,                                  // 예측이 시작되는 칸 번호
 *   series : [ {name:'서울', actual:[...], forecast:[...]}, ... ]
 * }
 *
 * actual(실측)과 forecast(예측)는 길이가 labels 와 같고, 값이 없는 달은 null 이다.
 * Chart.js 는 null 을 "선 끊김"으로 처리한다.
 */

//차트 객체를 저장할 변수. 다시 그릴 때 이전 차트를 지우는 데 쓴다
let savedTrendChart = null;

/* 선이 왼쪽에서 오른쪽으로 그려지는 효과.
   선은 이미 다 그려져 있고, "보여줄 영역"을 왼쪽부터 조금씩 넓혀가는 방식이다.
   점이 바닥에서 올라오는 게 아니라 제 높이로 그어지면서 드러난다.

   ctx.save() / ctx.clip() / ctx.restore() 세 개만 알면 된다.
     save    : 지금 설정을 잠깐 저장
     clip    : 방금 그린 네모 "안쪽에만" 그려지게 제한
     restore : 저장해둔 설정으로 되돌리기 (제한 해제) */
const TREND_DRAW_MS = 900;   //다 그려지는 데 걸리는 시간

const trendDrawEffect = {
  id : 'trendDrawEffect',

  //선을 그리기 직전 : 지금까지 보여줄 만큼만 네모로 오려낸다
  beforeDatasetsDraw : function(chart){
    if(chart.$drawDone){
      return;   //다 그렸으면 아무것도 하지 않는다
    }

    //처음 들어왔을 때 시작 시각을 기록해둔다
    if(!chart.$drawStart){
      chart.$drawStart = Date.now();
    }

    //0 에서 1 사이의 값. 1 이 되면 다 보여준 것
    chart.$drawRatio = Math.min((Date.now() - chart.$drawStart) / TREND_DRAW_MS, 1);

    const area = chart.chartArea;   //그래프가 그려지는 네모 영역
    const width = (area.right - area.left) * chart.$drawRatio;

    chart.ctx.save();
    chart.ctx.beginPath();
    chart.ctx.rect(area.left, area.top, width, area.bottom - area.top);
    chart.ctx.clip();
  },

  //선을 다 그린 뒤 : 오려내기를 풀고, 아직 덜 보여줬으면 한 번 더 그리라고 요청한다
  afterDatasetsDraw : function(chart){
    if(chart.$drawDone){
      return;
    }
    chart.ctx.restore();

    if(chart.$drawRatio >= 1){
      chart.$drawDone = true;   //끝났으면 다음부터는 오려내지 않는다
    }else{
      //다음 화면이 그려질 때 다시 호출해 달라고 브라우저에 부탁한다
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
    const start = chart.$forecastStart;
    if(start == null || start < 0){
      return;
    }

    const x = chart.scales.x.getPixelForValue(start);   //그 칸의 가로 위치(픽셀)
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
    ctx.fillText('예측 시작', x - 6, area.top + 12);
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

    //배경 칠하기는 첫 번째 줄에만. 두 줄 다 칠하면 서로 가린다
    const fill = (i === 0);

    datasets.push(makeTrendLine(one.name, one.actual, color, lightColor, [], fill));
    datasets.push(makeTrendLine(one.name + ' 예측', one.forecast, color, lightColor, [6, 4], false));
  }

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

      /* Chart.js 기본 애니메이션(점이 바닥에서 올라오는 효과)은 끈다.
         선이 왼쪽부터 그려지는 효과는 아래 trend-draw 클래스가 맡는다. */
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
            pointStyle : 'circle',   //범례 표시를 작은 동그라미로
            boxWidth : 8,
            padding : 14,
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
          //세로 격자선은 끈다. 58개월치라 그어놓으면 너무 복잡하다
          grid : { display : false },
          ticks : {
            maxRotation : 0,
            //58개월치를 다 찍으면 글자가 겹친다. 1월만 골라 연도로 바꿔 보여준다
            callback : function(value){
              const label = this.getLabelForValue(value);
              if(label.endsWith('.01')){
                return label.substring(0, 4);   //'2026.01' -> '2026'
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

  //"예측 시작" 선을 그릴 위치를 플러그인이 꺼내 쓸 수 있게 차트에 넣어둔다
  savedTrendChart.$forecastStart = chartData.forecastStart;
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
