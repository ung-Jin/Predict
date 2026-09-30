/**
 * app.js
 * -----------------------------------------------------------------
 * 2번 담당 조각들을 묶는 조립 코드.
 *
 * 레이아웃(최종 반영본):
 *  - 왼쪽 컬럼: 지도(+범례) 위, 그 밑에 "지역 비교" 순위표
 *      (총사용량/증감률/1인당사용량을 왼쪽·오른쪽 지역끼리 순위로 비교)
 *  - 오른쪽 컬럼: 계약종별 사용비중 도넛 2개
 *      · 오른쪽 도넛 = "전국 평균" (고정, 클릭해도 안 바뀜)
 *      · 왼쪽 도넛 = "가장 최근에 클릭/드래그한 지역" (매번 바뀜)
 *      (지자체 vs 지자체 비교가 아니라 "이 지역이 전국 평균 대비 어떤지" 보는 용도)
 *
 * 비교 방식(순위표용 왼쪽/오른쪽 슬롯):
 *  - 처음 화면: 왼쪽 = 서울특별시, 오른쪽 = 비어있음
 *  - 지도를 "클릭"하면: 그 값이 오른쪽에 들어가고, 기존 오른쪽 값은 왼쪽으로 밀림
 *  - 지도에서 지역을 비교 카드까지 "드래그해서 놓으면": 놓은 칸(왼쪽/오른쪽)에 바로 들어감
 *
 * 나중에 1번의 실제 "선택 규칙"이 나오면, selectRegionForCompare() /
 * selectRegionToSlot() 안쪽만 1번 로직 호출로 바꿔치기하면 됨.
 * -----------------------------------------------------------------
 */

let ALL_RECORDS = [];
let CURRENT_YEAR = null;
let CURRENT_MONTH = null;
let mapControls = null;

// 순위표(왼쪽 아래 패널)용 비교 슬롯: 왼쪽 기본값 서울특별시, 오른쪽은 아직 선택 전(null)
let compareLeft = '서울특별시';
let compareRight = null;

// 계약종별 도넛(오른쪽 컬럼)의 "왼쪽 도넛"에 표시할, 가장 최근에 클릭/드래그된 지역
let lastTouchedRegion = '서울특별시';

async function bootstrap() {
  const res = await fetch('data/region_data.json');
  const json = await res.json();

  ALL_RECORDS = json.records;
  CURRENT_YEAR = json.meta.latestYear;
  CURRENT_MONTH = json.meta.latestMonth;

  console.log(
    `[app.js] 데이터 로드 완료 (기준월: ${CURRENT_YEAR}-${String(CURRENT_MONTH).padStart(2, '0')}, 레코드 ${ALL_RECORDS.length}건)`
  );

  renderAllForMonth(CURRENT_YEAR, CURRENT_MONTH);
}

function getRecordsForMonth(year, month) {
  return ALL_RECORDS.filter((r) => r.year === year && r.month === month);
}

function getRecord(sido, year, month) {
  return ALL_RECORDS.find((r) => r.sido === sido && r.year === year && r.month === month);
}

function formatYearMonth(year, month) {
  return `${year}년 ${month}월`;
}

function renderAllForMonth(year, month) {
  const monthData = getRecordsForMonth(year, month);

  // 지도 (증감률 기준 색칠 + 범례 + 클릭 + 비교 패널로 드래그 앤 드롭)
  mapControls = initRegionMap('mapdiv', {
    regionData: monthData,
    metric: 'yoyRate',
    onRegionClick: selectRegionForCompare, // 클릭: 순위표 오른쪽에 채우고 기존 오른쪽은 왼쪽으로 밀기
    onRegionDropToSlot: selectRegionToSlot, // 드래그해서 놓은 칸(왼쪽/오른쪽)에 바로 지정
  });

  // 오른쪽 컬럼: 공통 범례(한 번만) + 전국 평균 도넛(고정) + 선택 지역 도넛(초기값 = 서울특별시)
  renderContractLegend('donutLegend');
  renderNationalAverageDonut(monthData, year, month);
  renderSelectedRegionDonut(lastTouchedRegion, year, month);

  // 왼쪽 하단 순위표 초기 렌더 (오른쪽 슬롯이 비어있으니 안내 문구만 보임)
  updateCompareUI();
}

/** 지도를 "그냥 클릭"했을 때 */
function selectRegionForCompare(sidoName) {
  // 1) 순위표 슬롯 갱신 (오른쪽에 채우고, 기존 오른쪽은 왼쪽으로 밀기)
  if (compareRight !== null) {
    compareLeft = compareRight;
  }
  compareRight = sidoName;
  updateCompareUI();

  // 2) 계약종별 "선택 지역" 도넛(왼쪽 도넛)도 방금 클릭한 지역으로 갱신
  lastTouchedRegion = sidoName;
  renderSelectedRegionDonut(lastTouchedRegion, CURRENT_YEAR, CURRENT_MONTH);

  // ============================================================
  // TODO(연동 필요): 1번의 "선택 규칙" 함수가 준비되면 여기서 같이 호출해서
  // 대시보드 전체(요약카드/추이차트/상세표)에도 전파해야 함.
  // ============================================================
}

/** 지도에서 지역을 순위표 카드까지 드래그해서 놓았을 때 */
function selectRegionToSlot(sidoName, slot) {
  if (slot === 'left') {
    compareLeft = sidoName;
  } else if (slot === 'right') {
    compareRight = sidoName;
  }
  updateCompareUI();

  // 드래그로 움직인 지역도 "가장 최근에 만진 지역"이므로 선택 지역 도넛에 반영
  lastTouchedRegion = sidoName;
  renderSelectedRegionDonut(lastTouchedRegion, CURRENT_YEAR, CURRENT_MONTH);

  // TODO(연동 필요): 위와 동일하게 1번 선택 규칙에 전파 필요
}

/** 왼쪽/오른쪽 비교표 갱신 (표 자체가 드롭 영역 + 결과 표시를 겸함 - compare-rank.js) */
function updateCompareUI() {
  mapControls.setCompareSelection(compareLeft, compareRight);

  const leftRec = compareLeft ? getRecord(compareLeft, CURRENT_YEAR, CURRENT_MONTH) : null;
  const rightRec = compareRight ? getRecord(compareRight, CURRENT_YEAR, CURRENT_MONTH) : null;

  renderCompareRankTable('compareRankTable', compareLeft, compareRight, leftRec, rightRec);
}

/** 오른쪽 도넛: 전국 평균 (총사용량으로 가중평균 - 사용량 많은 지역 비중이 더 크게 반영되게) */
function renderNationalAverageDonut(monthData, year, month) {
  const keys = Object.keys(monthData[0].contract);
  const totalUsageSum = monthData.reduce((sum, r) => sum + r.totalUsage, 0);

  const weightedAvg = {};
  keys.forEach((k) => {
    const weightedSum = monthData.reduce((sum, r) => sum + r.contract[k] * r.totalUsage, 0);
    weightedAvg[k] = Math.round((weightedSum / totalUsageSum) * 100) / 100;
  });

  renderContractDonut('donut-right', weightedAvg, `전국 평균 · ${formatYearMonth(year, month)} 기준`);
}

/** 왼쪽 도넛: 가장 최근에 클릭/드래그한 지역 */
function renderSelectedRegionDonut(sidoName, year, month) {
  const rec = getRecord(sidoName, year, month);
  if (!rec) {
    clearDonut('donut-left');
    return;
  }
  renderContractDonut('donut-left', rec.contract, `${sidoName} · ${formatYearMonth(year, month)} 기준`);
}

document.addEventListener('DOMContentLoaded', bootstrap);
