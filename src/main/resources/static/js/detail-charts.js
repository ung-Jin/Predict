/**
 * [1번 작성] 
 * ----------------------------------------------------------------------------
 * 상세 데이터 우측 차트 3종(연도별 막대, 계절 패턴, 히트맵)을 그리는 파일.

 * 선택이 없으면 키 자체가 없음 -> getItem()이 null

 * 같은 탭에서 값이 바뀌면 'region:selected' 이벤트가 옴 (detail: {a, b})
 * => 4번 표에서 행을 눌러 선택을 바꿀 때도 "저장 + 이벤트" 둘 다 해줘야 차트가 따라 바뀜.
 *
 
 * [데이터] 서버(DB)에서 axios로 가져옴: GET /detail/chart?a=...&b=...  (차트 3종 값을 한 번에 받음)
 *   흐름: sessionStorage 읽기 -> axios 요청 -> JSON 응답 -> Chart.js로 그리기
 *   서버 쪽은 detailchart 패키지 (Controller -> Service -> Mapper -> DB)
 */

// ---- 시안 색상: A=파랑, B=살구, 비교 기준(시도 평균·전국 합계)=초록 ----
// "빨강, 초록, 파랑" 숫자로 적어둠. 쓸 때는 'rgb(' + 값 + ')' 로 감싼다
const DETAIL_RGB_A = '111, 155, 214';
const DETAIL_RGB_B = '242, 169, 126';
const DETAIL_RGB_REF = '111, 191, 159';

// Chart.js 공통 색 (시안): 눈금 글자, 격자선
Chart.defaults.color = '#66789A';
Chart.defaults.borderColor = '#E6EEF8';

// 만든 차트를 보관 (다시 그릴 때 이전 차트를 지우려고)
let detailBarChart = null;
let detailSeasonChart = null;
let detailHeatChart1 = null;
let detailHeatChart2 = null;


// 시작: 세션스토리지 읽기 -> 서버에 요청 -> 차트 3개 그리기
async function renderAllDetailCharts() {
  // 1. 선택된 지역 읽기 (없으면 null). 키 이름은 2번 map-app.js 와 같아야 함
  const a = sessionStorage.getItem('selectedRegionA');
  const b = sessionStorage.getItem('selectedRegionB');

  // 2. 서버에 요청. a || '' : null이면 빈 문자열로 보냄 ("null" 글자가 가지 않게)
  const response = await axios.get(`/detail/chart?a=${a || ''}&b=${b || ''}`);
  const result = response.data;
  // result 안에 들어있는 것 (서버 DetailChartService 가 만들어 줌)
  //   name1, name2            : 줄 이름 (name2는 없으면 null)
  //   years                   : 연도 목록 ['2022', ..., '2026']
  //   bar1, bar2              : 막대 값 (연도 순서)
  //   season1, season2        : 계절 패턴 값 12개
  //   heat1, heat2            : 히트맵 칸 목록. 칸 하나 = {x: 월, y: 연도, value: 사용량, opacity: 진하기}
  //   heatFoot1, heatFoot2    : 히트맵 아래 "최대 ... · 최소 ..." 문구

  // 3. 줄(series) 목록 만들기: 이름, 색, 차트별 값을 한 묶음으로
  let rgb1 = DETAIL_RGB_A;
  if (result.name1 === '전국 합계') {
    rgb1 = DETAIL_RGB_REF;
  }
  const seriesList = [
    { name: result.name1, rgb: rgb1, color: 'rgb(' + rgb1 + ')',
      bar: result.bar1, season: result.season1, heat: result.heat1, heatFoot: result.heatFoot1 },
  ];

  if (result.name2 !== null) {
    let rgb2 = DETAIL_RGB_B;
    if (result.name2 === '시도 평균') {
      rgb2 = DETAIL_RGB_REF;
    }
    seriesList.push(
      { name: result.name2, rgb: rgb2, color: 'rgb(' + rgb2 + ')',
        bar: result.bar2, season: result.season2, heat: result.heat2, heatFoot: result.heatFoot2 });
  }

  // 4. 차트 3개 그리기
  renderYearlyBar(result.years, seriesList);
  renderSeasonLine(seriesList);
  renderHeatmap(result.years, seriesList);
}


// 1) 연도별 월평균 사용량 (막대)
function renderYearlyBar(years, seriesList) {
  const datasets = [];
  for (const series of seriesList) {
    datasets.push({
      label: series.name,
      data: series.bar,                       // 서버가 준 리스트를 그대로 넣음
      backgroundColor: series.color,
    });
  }

  if (detailBarChart !== null) {
    detailBarChart.destroy();         // 이전 차트를 안 지우면 겹쳐서 그려짐
  }
  detailBarChart = new Chart(document.getElementById('detailBarChart'), {
    type: 'bar',
    data: { labels: years, datasets: datasets },
    options: { maintainAspectRatio: false },  // 카드 크기에 맞춰 늘어나게
  });
  // TODO: 시안의 막대 위 값 숫자, "전년 대비 %" 표시
}


// 2) 계절 패턴 (선). 100 = 평소 수준
function renderSeasonLine(seriesList) {
  const datasets = [];
  for (const series of seriesList) {
    datasets.push({
      label: series.name,
      data: series.season,                    // 서버가 계산해 준 12개 값
      borderColor: series.color,
      backgroundColor: series.color,
      tension: 0.3,                           // 선을 살짝 부드럽게
    });
  }

  if (detailSeasonChart !== null) {
    detailSeasonChart.destroy();
  }
  detailSeasonChart = new Chart(document.getElementById('detailSeasonChart'), {
    type: 'line',
    data: {
      labels: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
      datasets: datasets,
    },
    options: { maintainAspectRatio: false },
  });
}


// 3) 기간별 사용량 (히트맵)
//    Chart.js 산점도(scatter)의 점을 네모로 바꿔서 히트맵처럼 그린다. 가로 1~12월, 세로 연도.
//    칸의 위치, 값, 진하기는 서버가 계산해서 보내준다.
function renderHeatmap(years, seriesList) {
  // 이전 차트 지우기
  if (detailHeatChart1 !== null) {
    detailHeatChart1.destroy();
    detailHeatChart1 = null;
  }
  if (detailHeatChart2 !== null) {
    detailHeatChart2.destroy();
    detailHeatChart2 = null;
  }

  // 1번 줄
  detailHeatChart1 = drawHeatChart(1, seriesList[0], years);

  // 2번 줄: 있으면 그리고, 없으면 자리를 숨김
  const block2 = document.getElementById('detailHeatBlock2');
  if (seriesList.length === 2) {
    block2.style.display = '';
    detailHeatChart2 = drawHeatChart(2, seriesList[1], years);
  } else {
    block2.style.display = 'none';
  }
}

// 히트맵 하나 그리기. number 는 1 또는 2 (HTML의 detailHeatChart1, detailHeatChart2 ...)
function drawHeatChart(number, series, years) {
  document.getElementById('detailHeatName' + number).textContent = series.name;
  document.getElementById('detailHeatDot' + number).style.background = series.color;   // 이름 앞 색 점
  document.getElementById('detailHeatFoot' + number).textContent = series.heatFoot;

  // 칸마다 색 만들기: 같은 색에 진하기(투명도)만 다르게
  const colors = [];
  for (const point of series.heat) {
    colors.push('rgba(' + series.rgb + ', ' + point.opacity + ')');
  }

  // 네모 크기: 차트 가로 폭을 12칸으로 나눠서 정함 -> 화면 폭이 달라져도 칸에 딱 맞음
  function cellRadius(context) {
    const area = context.chart.chartArea;     // 축 글자를 뺀, 네모가 그려지는 영역
    if (!area) {
      return 0;                               // 맨 처음에는 아직 크기를 모름
    }
    const cellWidth = area.width / 12;
    return (cellWidth - 2) / 1.414;           // 틈 2px. Chart.js 네모는 반지름의 1.414배 크기로 그려짐
  }

  const chart = new Chart(document.getElementById('detailHeatChart' + number), {
    type: 'scatter',                          // 산점도: 점을 (x, y) 자리에 찍는 차트
    data: {
      datasets: [{
        data: series.heat,                    // 서버가 준 칸 목록을 그대로 넣음
        pointStyle: 'rect',                   // 점 모양을 원 대신 네모로
        pointBackgroundColor: colors,
        pointBorderWidth: 0,
        pointRadius: cellRadius,
        pointHoverRadius: cellRadius,         // 마우스를 올려도 크기는 그대로
        pointHoverBackgroundColor: colors,    // 마우스를 올려도 색은 그대로
      }],
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },           // 이름은 차트 위에 따로 적어서 범례는 끔
        tooltip: {
          callbacks: {
            label: function (context) {       // 마우스를 올렸을 때 글자: "2025.8 · 5,547.9 GWh"
              const point = context.raw;
              return point.y + '.' + point.x + ' · ' + point.value.toLocaleString() + ' GWh';
            },
          },
        },
      },
      scales: {
        // type: 'category' = 숫자 축이 아니라 "글자 목록" 축
        // offset: true     = 네모를 칸 가운데에 놓기
        // grid 끄기        = 네모 위로 격자선이 지나가지 않게
        // autoSkip: false  = 칸이 좁아도 글자를 건너뛰지 않고 전부 표시
        // maxRotation: 0   = 칸이 좁아도 글자를 비스듬히 돌리지 않기
        x: { type: 'category', labels: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
             offset: true, grid: { display: false }, ticks: { autoSkip: false, maxRotation: 0 } },
        y: { type: 'category', labels: years,
             offset: true, grid: { display: false }, ticks: { autoSkip: false } },
      },
    },
  });

  // 처음 만들 때는 차트 크기를 아직 몰라서 네모 크기가 0으로 계산됨 -> 한 번 더 그려서 맞춘다
  chart.update();
  return chart;
}


// 진입점
document.addEventListener('DOMContentLoaded', function () {
  renderAllDetailCharts();                                              // (1) 페이지 처음 열 때
  document.addEventListener('region:selected', renderAllDetailCharts);  // (2) 선택이 바뀔 때
});
