/**
 * [1번 작성 - 4번 지원] /static/js/detail-charts.js  (뼈대 - 아직 차트는 안 그림)
 * ----------------------------------------------------------------------------
 * 상세 데이터 우측 차트 3종(연도별 막대, 계절 패턴, 히트맵)을 그리는 파일.
 * 원래 4번 담당인데 진도 때문에 1번이 대신 만드는 중. 4번 파일은 건드리지 않음.
 *
 * [선택 지역 받는 방법] 2번 map-app.js 규칙 그대로 (URL/서버 안 거침)
 *   - sessionStorage 키: 'selectedRegionA', 'selectedRegionB' (값 = 시도명, 예: "서울특별시")
 *   - 선택이 없으면 키 자체가 없음 -> getItem()이 null
 *   - 같은 탭에서 값이 바뀌면 'region:selected' 이벤트가 옴 (detail: {a, b})
 *   => 4번 표에서 행을 눌러 선택을 바꿀 때도 "저장 + 이벤트" 둘 다 해줘야 차트가 따라 바뀜.
 *
 * [데이터] 임시: /data/region_data.json (2번이 쓰는 것과 동일, 17개 시도 x 2022-01~2026-07)
 *   DB 연동되면 fetch 주소만 API로 바꾸면 됨.
 *
 * [Chart.js] detail.html에서 이미 CDN으로 불러오므로 여기서 또 불러오지 않음.
 */

// ---- 팀 공용 키 (map-app.js와 같은 이름이어야 함. 바꾸지 말 것) ----
const DETAIL_REGION_A_KEY = 'selectedRegionA';
const DETAIL_REGION_B_KEY = 'selectedRegionB';

// ---- 시안 색상 (A=파랑, B=살구) ----
const DETAIL_COLOR_A = '#6F9BD6';
const DETAIL_COLOR_B = '#F2A97E';

let detailRecords = [];     // region_data.json의 records 전체
let detailBarChart = null;    // Chart.js 인스턴스 (다시 그릴 때 destroy 하려고 보관)
let detailSeasonChart = null;

// 지금 선택된 지역 A, B를 읽는다 (없으면 null)
function readSelectedRegions() {
  return {
    a: sessionStorage.getItem(DETAIL_REGION_A_KEY),
    b: sessionStorage.getItem(DETAIL_REGION_B_KEY),
  };
}

// 한 지역의 레코드만 골라낸다 (시도명 풀네임 기준)
function recordsOf(sido) {
  return detailRecords.filter((r) => r.sido === sido);
}

// ---- TODO 1: 연도별 월평균 사용량 막대 (A/B 비교, 전년 대비 % 표시) ----
function renderYearlyBar(a, b) {
  // TODO: 연도별 월평균 = 그 연도 totalUsage 합 / 개월 수  (2026은 1~7월뿐이라 월평균으로 비교)
  // TODO: 단위 GWh로 환산해서 축에 표시
}

// ---- TODO 2: 계절 패턴 선 (월 사용량 ÷ 연평균 × 100, 2022~2025) ----
function renderSeasonLine(a, b) {
  // TODO
}

// ---- TODO 3: 기간별 사용량 히트맵 (담당 미정) ----
function renderHeatmap(a, b) {
  // TODO: #detailHeatmap 안에 격자로 직접 그리기
}

// 선택 상태에 맞춰 3개 차트를 모두 다시 그림
function renderAllDetailCharts() {
  const { a, b } = readSelectedRegions();
  const empty = document.getElementById('detailChartEmpty');
  if (empty) empty.hidden = !!(a || b);   // 하나라도 선택되면 안내 문구 숨김

  renderYearlyBar(a, b);
  renderSeasonLine(a, b);
  renderHeatmap(a, b);
}

// ---- 진입점 ----
async function bootstrapDetailCharts() {
  try {
    const res = await fetch('/data/region_data.json');
    detailRecords = (await res.json()).records;
  } catch (e) {
    console.error('[detail-charts] region_data.json 로드 실패', e);
    return;
  }
  renderAllDetailCharts();                                   // (1) 페이지 처음 열 때
  document.addEventListener('region:selected', renderAllDetailCharts);   // (2) 선택이 바뀔 때
}

document.addEventListener('DOMContentLoaded', bootstrapDetailCharts);
