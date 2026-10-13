/**
 * [1번 작성] 상세 데이터 페이지의 "계약종별 사용 비중" 도넛.
 *
 * 대시보드(map-app.js)에서 하던 도넛 로직을 그대로 옮겨 온 파일이라 규칙도 같다.
 *   0개 선택 : 왼쪽 도넛 = 전국 평균 (오른쪽 도넛은 숨김)
 *   1개 선택 : 왼쪽 도넛 = A 지역,   오른쪽 도넛 = 전국 평균
 *   2개 선택 : 왼쪽 도넛 = A 지역,   오른쪽 도넛 = B 지역
 *
 * 도넛을 그리는 함수(renderContractDonut, clearDonut, renderContractLegend)는 공용 donut.js 에 있고,
 * 이 파일은 "무엇을 그릴지"만 정한다.
 * 데이터는 대시보드와 같은 임시 정적 파일(/data/region_data.json)의 가장 최근 달을 쓴다.
 * 선택 지역은 sessionStorage(selectedRegionA/B)에서 읽고, 바뀌면 'region:selected' 이벤트가 온다.
 */

// 도넛 가운데 글자 색: 대시보드와 같은 값 (A=파랑, B=주황, 전국 평균=초록)
const DETAIL_DONUT_COLOR_A = '#4E7FB8';
const DETAIL_DONUT_COLOR_B = '#D4834F';
const DETAIL_DONUT_COLOR_NATIONAL = '#3E8E73';

let detailDonutRecords = [];   // region_data.json 의 전체 기록
let detailDonutYear = null;    // 그릴 기준 연도 (가장 최근 달)
let detailDonutMonth = null;   // 그릴 기준 월


// 전국 평균 도넛. 단순 평균이 아니라 총사용량으로 가중평균한다 (사용량 큰 지역이 더 크게 반영됨).
function drawDetailDonutNational(canvasId, monthData) {
  if (monthData.length === 0) {
    clearDonut(canvasId);
    return;
  }
  const keys = Object.keys(monthData[0].contract);
  const totalSum = monthData.reduce((sum, r) => sum + r.totalUsage, 0);

  const weighted = {};
  keys.forEach((key) => {
    const weightedSum = monthData.reduce((sum, r) => sum + r.contract[key] * r.totalUsage, 0);
    weighted[key] = Math.round((weightedSum / totalSum) * 100) / 100;
  });
  renderContractDonut(canvasId, weighted, '전국 평균', DETAIL_DONUT_COLOR_NATIONAL);
}

// 지역 하나의 도넛. 그 달 기록이 없으면 비워 둔다.
function drawDetailDonutRegion(canvasId, sidoName, color, monthData) {
  const rec = monthData.find((r) => r.sido === sidoName);
  if (!rec) {
    clearDonut(canvasId);
    return;
  }
  // 가운데 글자는 짧은 이름(부산광역시 -> 부산). 표에 없으면 원래 이름 그대로
  const shortName = SIDO_CODE_TO_SHORT[SIDO_NAME_TO_CODE[sidoName]] || sidoName;
  renderContractDonut(canvasId, rec.contract, shortName, color);
}

// 선택 상태에 맞춰 왼쪽/오른쪽 도넛을 다시 그린다
function drawDetailDonuts() {
  if (detailDonutRecords.length === 0) return;   // 데이터가 아직 안 왔으면 그리지 않음

  const a = sessionStorage.getItem('selectedRegionA') || null;
  const b = sessionStorage.getItem('selectedRegionB') || null;
  const monthData = detailDonutRecords.filter(
    (r) => r.year === detailDonutYear && r.month === detailDonutMonth
  );
  const rightSlot = document.getElementById('donut-slot-right');

  // 왼쪽: A 가 있으면 A, 없으면 전국 평균
  if (a) {
    drawDetailDonutRegion('donut-left', a, DETAIL_DONUT_COLOR_A, monthData);
  } else {
    drawDetailDonutNational('donut-left', monthData);
  }

  // 오른쪽: B 가 있으면 B / A 만 있으면 전국 평균 / 둘 다 없으면 숨김
  if (b) {
    rightSlot.classList.remove('is-empty');
    drawDetailDonutRegion('donut-right', b, DETAIL_DONUT_COLOR_B, monthData);
  } else if (a) {
    rightSlot.classList.remove('is-empty');
    drawDetailDonutNational('donut-right', monthData);
  } else {
    clearDonut('donut-right');
    rightSlot.classList.add('is-empty');
  }
}

async function startDetailDonut() {
  try {
    const res = await fetch('/data/region_data.json');
    const json = await res.json();
    detailDonutRecords = json.records;
    detailDonutYear = json.meta.latestYear;
    detailDonutMonth = json.meta.latestMonth;
  } catch (error) {
    console.error('[detail-donut] 지역 데이터(region_data.json) 조회 오류', error);
    return;   // 데이터를 못 받았으면 그리지 않는다
  }

  renderContractLegend('donutLegend');
  drawDetailDonuts();
}

document.addEventListener('DOMContentLoaded', startDetailDonut);
document.addEventListener('region:selected', drawDetailDonuts);   // 선택이 바뀔 때마다 다시 그림
