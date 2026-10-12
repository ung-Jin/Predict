/**
 * [1번 작성] 대시보드 "지역 특성 비교" 레이더 차트.
 *
 * 5개 축을 모두 0~100 점으로 맞춰서(정규화) 한 도형으로 비교한다.
 *   1. 총 전력사용량     2. 1인당 전력사용량     3. 전년 동월 대비 증감률(최근 소비 변화)
 *   4. 평균기온(기상 조건)   5. 산업용 비중
 *
 * 보여주는 대상 (지금 대시보드 선택 규칙과 같다)
 *   0개 선택 : 전국
 *   1개 선택 : 전국 vs A 지역
 *   2개 선택 : A 지역 vs B 지역
 *
 * [정규화 방식] 17개 시도의 가장 최근 달 값에서 축마다 "가장 작은 시도 = 0점, 가장 큰 시도 = 100점"
 * 으로 맞춘다(min-max). 단, 총 전력사용량 축만 먼저 로그(log10)를 씌운다.
 *   이유: 경기도 하나가 다른 시도보다 압도적으로 커서, 그냥 min-max 하면 12개 시도가 20점 미만에
 *   몰려 레이더가 한쪽 축만 찌그러진 모양이 된다. 로그를 씌우면 다른 4개 축과 비슷한 눈금대로 올라온다.
 *   (실제 값으로 두 방식을 비교한 결과: 축별 평균의 편차 15.0 -> 8.7)
 *
 * [평균기온 축] 원본에 평균기온이 없어서 "냉방도일 - 난방도일"로 대신한다.
 *   더울수록 크고(+), 추울수록 작다(-). 값은 region_data.json 의 coolingDegreeDays / heatingDegreeDays.
 *
 * ['전국' 값] 전국 합계 전력량은 시도 하나보다 압도적으로 커서 같은 눈금에 못 올린다. 그래서
 *   총 전력사용량 = 17개 시도 평균 / 1인당 = 전국 사용량 합 ÷ 전국 인구 합 /
 *   증감률 = 전국 합계 기준 / 평균기온·산업용 비중 = 사용량 가중평균 (전국 평균 도넛과 같은 방식).
 *
 * 데이터: /data/region_data.json (대시보드의 다른 조각과 같은 임시 정적 파일, 가장 최근 달 사용)
 * 선택 지역: sessionStorage(selectedRegionA/B). 바뀌면 map-app.js 가 'region:selected' 를 보낸다.
 */

// 색: A=파랑, B=주황, 전국=초록 ("빨강, 초록, 파랑" 숫자. 상세 페이지 차트와 같은 팔레트)
const RADAR_RGB_A = '111, 155, 214';
const RADAR_RGB_B = '242, 169, 126';
const RADAR_RGB_NATIONAL = '111, 191, 159';

// 축 제목. 배열로 쓰면 줄바꿈이 된다 (칸이 좁아서 긴 이름은 두 줄로)
const RADAR_AXIS_LABELS = [
  ['총 전력사용량'],
  ['1인당', '전력사용량'],
  ['전년 동월 대비', '증감률'],
  ['평균기온'],
  ['산업용 비중'],
];
// 마우스를 올렸을 때 제목으로 쓰는 한 줄짜리 이름
const RADAR_AXIS_NAMES = ['총 전력사용량', '1인당 전력사용량', '전년 동월 대비 증감률', '평균기온(냉난방도일 환산)', '산업용 비중'];

let radarChart = null;       // 한 번 만들어 두고 선택이 바뀔 때 데이터만 갈아 끼운다
let radarMonthData = [];     // 가장 최근 달의 17개 시도 기록
let radarScale = null;       // 축마다 {min, max} (총사용량 축은 로그 값 기준)
let radarNational = null;    // '전국' 기준 원본 값 5개
let radarRefText = '';       // "2026년 7월 기준"


// 한 시도의 원본 값 5개 (축 순서와 같다)
function radarRawValues(rec) {
  return [
    rec.totalUsage,
    rec.perCapitaUsage,
    rec.yoyRate,
    rec.coolingDegreeDays - rec.heatingDegreeDays,
    rec.contract['산업용'],
  ];
}

// '전국' 기준 원본 값 5개
function radarBuildNational(monthData) {
  const total = monthData.reduce((sum, r) => sum + r.totalUsage, 0);
  const prev = monthData.reduce((sum, r) => sum + r.prevYearSameMonth, 0);
  // 1인당은 인구가 있는 시도끼리만 (사용량 합 ÷ 인구 합)
  const hasPop = monthData.filter((r) => r.perCapitaUsage !== null);
  const popTotal = hasPop.reduce((sum, r) => sum + r.population, 0);
  const popUsage = hasPop.reduce((sum, r) => sum + r.totalUsage, 0);
  // 사용량 가중평균
  const weighted = (pick) => monthData.reduce((sum, r) => sum + pick(r) * r.totalUsage, 0) / total;

  return [
    total / monthData.length,
    popUsage / popTotal,
    (total / prev - 1) * 100,
    weighted((r) => r.coolingDegreeDays - r.heatingDegreeDays),
    weighted((r) => r.contract['산업용']),
  ];
}

// 축마다 최솟값/최댓값 (17개 시도 기준). 총사용량 축은 로그를 씌운 값으로 잰다.
function radarBuildScale(monthData) {
  const scale = [];
  for (let axis = 0; axis < 5; axis++) {
    const values = monthData
      .map((r) => radarRawValues(r)[axis])
      .filter((v) => v !== null)
      .map((v) => (axis === 0 ? Math.log10(v) : v));
    scale.push({ min: Math.min(...values), max: Math.max(...values) });
  }
  return scale;
}

// 원본 값 하나를 0~100 점으로
function radarScore(axis, value) {
  if (value === null) return null;
  const x = axis === 0 ? Math.log10(value) : value;
  const { min, max } = radarScale[axis];
  if (max === min) return 50;
  const score = ((x - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, score));   // 혹시 범위를 벗어나도 0~100 안으로
}

// 마우스를 올렸을 때 보여줄 "진짜 값" 글자
function radarRawText(axis, value, isNational) {
  if (value === null) return '-';
  if (axis === 0) return (isNational ? '시도 평균 ' : '') + (value / 1e8).toFixed(1) + '억kWh';
  if (axis === 1) return Math.round(value).toLocaleString('ko-KR') + ' kWh/인';
  if (axis === 2) return (value > 0 ? '+' : '') + value.toFixed(1) + '%';
  if (axis === 3) return value.toFixed(1) + ' (냉방도일 - 난방도일)';
  return value.toFixed(1) + '%';
}

// 그릴 줄(데이터셋) 하나 만들기. rawValues 는 원본 값 5개.
function radarMakeDataset(name, rgb, rawValues, isNational) {
  return {
    label: name,
    data: rawValues.map((v, axis) => radarScore(axis, v)),
    rawText: rawValues.map((v, axis) => radarRawText(axis, v, isNational)),
    borderColor: 'rgb(' + rgb + ')',
    backgroundColor: 'rgba(' + rgb + ', 0.18)',
    pointBackgroundColor: 'rgb(' + rgb + ')',
    borderWidth: 2,
    pointRadius: 3,
  };
}

// 선택 상태에 맞는 줄 목록
function radarBuildDatasets() {
  const a = sessionStorage.getItem('selectedRegionA') || null;
  const b = sessionStorage.getItem('selectedRegionB') || null;

  const national = radarMakeDataset('전국', RADAR_RGB_NATIONAL, radarNational, true);
  const region = (name, rgb) => {
    const rec = radarMonthData.find((r) => r.sido === name);
    return rec ? radarMakeDataset(name, rgb, radarRawValues(rec), false) : null;
  };

  const list = [];
  if (a && b) {
    list.push(region(a, RADAR_RGB_A), region(b, RADAR_RGB_B));      // A vs B
  } else if (a || b) {
    // 하나만 골랐다: 전국 vs 그 지역 (그 지역의 색은 자리(A/B)에 맞춘다)
    list.push(national, a ? region(a, RADAR_RGB_A) : region(b, RADAR_RGB_B));
  } else {
    list.push(national);                                            // 전국
  }
  return list.filter(Boolean);   // 그 달 기록이 없는 지역은 뺀다
}

function drawRadar() {
  if (radarMonthData.length === 0) return;   // 데이터가 아직 안 왔으면 그리지 않음
  const datasets = radarBuildDatasets();

  // 이미 그려 둔 차트가 있으면 데이터만 갈아 끼운다 (새로 만들면 깜빡인다)
  if (radarChart) {
    radarChart.data.datasets = datasets;
    radarChart.update();
    return;
  }

  radarChart = new Chart(document.getElementById('radarChart'), {
    type: 'radar',
    data: { labels: RADAR_AXIS_LABELS, datasets: datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,   // 높이는 radar.css 가 정한다. true 면 캔버스가 계속 늘어난다
      layout: { padding: 4 },
      scales: {
        r: {
          min: 0,
          max: 100,
          ticks: { display: false, stepSize: 25 },    // 눈금 글자는 숨기고 거미줄 선만 (25점 간격)
          grid: { color: '#E6EEF8' },
          angleLines: { color: '#E6EEF8' },
          pointLabels: { color: '#66789A', font: { size: 11 } },
        },
      },
      plugins: {
        legend: {
          position: 'right',
          labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8, padding: 10, font: { size: 12 } },
        },
        tooltip: {
          callbacks: {
            title: (items) => RADAR_AXIS_NAMES[items[0].dataIndex],
            // 예) "서울특별시: 56점 (48.2억kWh)"
            label: (ctx) => ctx.dataset.label + ': ' + Math.round(ctx.parsed.r) + '점 (' + ctx.dataset.rawText[ctx.dataIndex] + ')',
          },
        },
      },
    },
  });
}

async function startRadar() {
  try {
    const res = await fetch('/data/region_data.json');
    const json = await res.json();
    const year = json.meta.latestYear;
    const month = json.meta.latestMonth;
    radarMonthData = json.records.filter((r) => r.year === year && r.month === month);
    radarRefText = year + '년 ' + month + '월 기준';
  } catch (error) {
    console.error('[radar] 지역 데이터(region_data.json) 조회 오류', error);
    return;   // 데이터를 못 받았으면 그리지 않는다
  }

  radarScale = radarBuildScale(radarMonthData);
  radarNational = radarBuildNational(radarMonthData);
  document.getElementById('radarSub').textContent = '정규화 0~100 · ' + radarRefText;
  drawRadar();
}

document.addEventListener('DOMContentLoaded', startRadar);
document.addEventListener('region:selected', drawRadar);   // 선택이 바뀔 때마다 다시 그림
