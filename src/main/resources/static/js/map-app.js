/* ============================================================================
 * [2번 소유] /static/js/map-app.js
 * ============================================================================
 * 역할: 지도(map.js) + 도넛(donut.js) + 순위표(compare-rank.js) 조각들을
 *       한 화면 안에서 조립·연결해주는 부트스트랩 스크립트.
 *       - JSON 데이터 로드
 *       - 지도/도넛(2개)/순위표 초기 렌더
 *       - 지도 클릭·드래그 이벤트를 받아서 순위표·도넛 갱신
 *
 * 이 파일 자체는 UI 조각을 만들지 않고, 다른 모듈이 만들어 놓은 함수를 호출만 함.
 * (initRegionMap, renderContractDonut, renderContractLegend, clearDonut,
 *  renderCompareRankTable)
 *
 * 파일명이 "app.js"가 아니라 "map-app.js"인 이유:
 *   /static/js/ 안에 다른 팀원분이 만드실 수 있는 app.js와 이름이 겹치지 않게
 *   하기 위해 접두어를 붙였습니다. 2번 담당 파일임을 파일명으로도 표시.
 *
 * fragments/map.html의 <script> 태그 순서 상 이 파일이 반드시 마지막에 로드되어야 함
 * (sido-map-codes -> map -> compare-rank -> map-app 순).
 *
 * ============================================================================
 * 도넛 2개 배치 (2026-09-30 개편: 원래 3개였다가 "카드는 좁게, 도넛은 크게" 요청으로 축소):
 *   왼쪽 도넛(#donut-left)  = compareLeft. 아직 아무 지역도 안 골랐으면(=null) "전국 평균"을
 *                             대신 보여주고, 지역을 고르면 그 지역 데이터로 바뀜. (파랑/회색 캡션)
 *   오른쪽 도넛(#donut-right) = compareRight. 두 번째 지역을 고르기 전까지는 슬롯 자체가
 *                             숨겨져 있다가(map.css의 .is-empty), 두 번째 지역을 고르면 나타남. (분홍 캡션)
 *   → compareLeft/compareRight가 지도 테두리 색·순위표 배지 색과 완전히 매칭됨.
 *   → 예전에 있던 "전국 평균 고정 3번째 도넛"은 없앰. 대신 왼쪽 도넛의 기본값으로 흡수함.
 * ============================================================================
 * ⚠ 팀장님 리뷰용 안내 (병합 시 참고):
 *   - "임시" 표시된 부분:
 *       (1) fetch('/data/region_data.json') — DB 연동 전 임시 정적 JSON.
 *           나중에 MapController가 만들어지면 fetch URL을 API 엔드포인트로 바꾸거나,
 *           서버가 model로 직접 전달하는 방식으로 교체 예정.
 *       (2) [2026-09-30] compareLeft/compareRight — 자바스크립트 변수가 아니라
 *           sessionStorage에 저장함 (키 이름: selectedRegionA, selectedRegionB).
 *           이유: 자바스크립트 변수는 이 파일(map-app.js) 안에서만 살아있어서 새로고침하거나
 *           다른 페이지(상세 데이터 등)로 넘어가면 그냥 사라짐. sessionStorage는 브라우저 탭이
 *           안 닫히는 한 값이 남아있고, 같은 탭이면 어느 페이지에서든
 *           sessionStorage.getItem('selectedRegionA') 처럼 그냥 바로 읽을 수 있어서
 *           4번(상세 데이터)이 URL 파싱 없이 곧바로 갖다 쓸 수 있음. 자세한 키 이름/값 형태는
 *           아래 updateCompareUI() 함수 주석 참고 - 팀 톡방에도 별도로 공지함.
 *   - 이 파일이나 위 임시 부분을 지우실 때는 fragments/map.html에서 이 파일을
 *     로드하는 <script> 태그도 같이 정리해 주세요.
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// sessionStorage 키 이름 (팀 공용 - 다른 페이지/조각에서도 이 이름 그대로 씀)
// ---------------------------------------------------------------------------
const REGION_A_KEY = 'selectedRegionA'; // 첫 번째(왼쪽) 선택 지역의 시도명. 없으면 키 자체가 없음.
const REGION_B_KEY = 'selectedRegionB'; // 두 번째(오른쪽) 선택 지역의 시도명. 없으면 키 자체가 없음.

// ---------------------------------------------------------------------------
// 모듈 전역 상태
// ---------------------------------------------------------------------------
let ALL_RECORDS = [];      // /data/region_data.json에서 로드한 전체 레코드 (2022-01 ~ 2026-07)
let CURRENT_YEAR = null;   // 화면에 그리고 있는 기준 연 (초기값 = JSON meta.latestYear)
let CURRENT_MONTH = null;  // 화면에 그리고 있는 기준 월 (초기값 = JSON meta.latestMonth)
let mapControls = null;    // initRegionMap()이 리턴한 지도 조작 객체 (setCompareSelection 등)

// 비교 슬롯. 순위표 왼쪽·오른쪽 컬럼 + 왼쪽·오른쪽 도넛이 모두 이 두 값을 바라봄.
// 매번 sessionStorage를 직접 읽으면 코드가 지저분해지니, 페이지 로드 시 딱 한 번
// sessionStorage에서 읽어와 이 변수들에 담아두고, 평소엔 이 변수로 계산하다가
// updateCompareUI()에서 바뀐 값을 다시 sessionStorage에 써넣는 방식으로 씀.
// (그래서 새로고침하거나 상세 데이터 페이지로 넘어가도 선택이 유지됨 - null로 리셋 안 됨)
let compareLeft = sessionStorage.getItem(REGION_A_KEY) || null;
let compareRight = sessionStorage.getItem(REGION_B_KEY) || null;


// ---------------------------------------------------------------------------
// 진입점: 페이지 로드가 끝나면 실행됨
// ---------------------------------------------------------------------------
async function bootstrap() {
  // /dashboard 경로에서 상대경로('data/...')로 fetch하면 /dashboard/data/...로
  // 잘못 찾아가므로 절대경로 사용. 이 정적 JSON은 팀 DB 연동 전까지의 임시 데이터.
  const res = await fetch('/data/region_data.json');
  const json = await res.json();

  ALL_RECORDS = json.records;
  CURRENT_YEAR = json.meta.latestYear;
  CURRENT_MONTH = json.meta.latestMonth;

  console.log(
    `[map-app.js] 데이터 로드 완료 (기준월: ${CURRENT_YEAR}-${String(CURRENT_MONTH).padStart(2, '0')}, 레코드 ${ALL_RECORDS.length}건)`
  );

  renderAllForMonth(CURRENT_YEAR, CURRENT_MONTH);
}


// ---------------------------------------------------------------------------
// 데이터 조회 유틸
// ---------------------------------------------------------------------------
function getRecordsForMonth(year, month) {
  return ALL_RECORDS.filter((r) => r.year === year && r.month === month);
}

function getRecord(sido, year, month) {
  return ALL_RECORDS.find((r) => r.sido === sido && r.year === year && r.month === month);
}

function formatYearMonth(year, month) {
  return `${year}년 ${month}월`;
}


// ---------------------------------------------------------------------------
// 특정 연/월 기준으로 지도·도넛·순위표를 한꺼번에 그리는 함수
// ---------------------------------------------------------------------------
function renderAllForMonth(year, month) {
  const monthData = getRecordsForMonth(year, month);

  // 도넛 카드 헤더 오른쪽에 기준월 한 번만 표시 (개별 도넛 캡션에서는 뺌)
  const refEl = document.getElementById('donutRefMonth');
  if (refEl) refEl.textContent = `· ${formatYearMonth(year, month)} 기준`;

  // (1) 지도: 증감률 기준 색칠 + 범례 + 클릭·드래그 이벤트 등록
  mapControls = initRegionMap('mapdiv', {
    regionData: monthData,
    metric: 'yoyRate',
    onRegionClick: selectRegionForCompare,   // 클릭: 첫 클릭=왼쪽, 두번째 클릭=오른쪽, 그 다음부턴 밀기
    onRegionDropToSlot: selectRegionToSlot,  // 드래그: 놓은 칸(왼쪽/오른쪽)에 바로 지정
  });

  // (2) 도넛: 공통 범례(한 번만) + 도넛 2개
  //     왼쪽 = compareLeft(없으면 전국 평균), 오른쪽 = compareRight(없으면 숨김)
  renderContractLegend('donutLegend');
  renderCompareLeftDonut(compareLeft, year, month);
  renderCompareRightDonut(compareRight, year, month);

  // (3) 순위표: 초기 렌더 (둘 다 null이라 "왼쪽"/"오른쪽" 빈 칸으로 뜸)
  updateCompareUI();
}


// ---------------------------------------------------------------------------
// 지도 이벤트 핸들러들
// ---------------------------------------------------------------------------

/**
 * 지도를 "그냥 클릭"했을 때 호출됨 (map.js가 onRegionClick 콜백으로 넘겨줌)
 *
 * 동작 규칙 (2026-09-30 개편, 취소 규칙 추가):
 *   - 이미 선택된 지역을 다시 클릭 : 그 자리만 선택 해제(null)함 (토글) - 다른 쪽은 안 건드림
 *   - 첫 번째 클릭             : compareLeft가 비어있으면 그 자리에 채움 (전국 평균 -> 클릭한 지역)
 *   - 두 번째 클릭             : compareRight가 비어있으면 그 자리에 채움 (오른쪽 도넛이 새로 나타남)
 *   - 세 번째 클릭부터          : 기존 오른쪽을 왼쪽으로 밀어내고, 새로 클릭한 지역이 오른쪽에 들어감
 *                               (계속 "가장 최근에 고른 두 지역"을 비교하는 방식)
 */
function selectRegionForCompare(sidoName) {
  if (sidoName === compareLeft) {
    compareLeft = null;   // 이미 왼쪽에 선택돼 있던 지역을 다시 클릭 -> 취소
  } else if (sidoName === compareRight) {
    compareRight = null;  // 이미 오른쪽에 선택돼 있던 지역을 다시 클릭 -> 취소
  } else if (compareLeft === null) {
    compareLeft = sidoName;
  } else if (compareRight === null) {
    compareRight = sidoName;
  } else {
    compareLeft = compareRight;  // 기존 오른쪽을 왼쪽으로 밀기
    compareRight = sidoName;
  }

  updateCompareUI();
  // 왼쪽·오른쪽 도넛 둘 다 새로 그림 (바뀐 쪽만 갱신해도 되지만, 로직 단순화를 위해 둘 다 갱신)
  renderCompareLeftDonut(compareLeft, CURRENT_YEAR, CURRENT_MONTH);
  renderCompareRightDonut(compareRight, CURRENT_YEAR, CURRENT_MONTH);
}

/**
 * 지도의 지역을 순위표 왼쪽/오른쪽 컬럼 위로 드래그해서 놓았을 때 호출됨
 * (map.js가 document 레벨의 pointerup에서 판단해 onRegionDropToSlot 콜백으로 넘겨줌)
 * 동작 규칙: 놓은 칸에 그 지역이 그대로 들어감 (밀기 없음, 클릭과 달리 순서 규칙을 안 탐).
 * 따라서 놓은 쪽 도넛만 갱신하면 됨.
 */
function selectRegionToSlot(sidoName, slot) {
  if (slot === 'left') {
    compareLeft = sidoName;
    updateCompareUI();
    renderCompareLeftDonut(compareLeft, CURRENT_YEAR, CURRENT_MONTH);
  } else if (slot === 'right') {
    compareRight = sidoName;
    updateCompareUI();
    renderCompareRightDonut(compareRight, CURRENT_YEAR, CURRENT_MONTH);
  }
}


// ---------------------------------------------------------------------------
// 갱신 헬퍼들
// ---------------------------------------------------------------------------

/**
 * 지도에서 왼쪽/오른쪽 선택 지역을 강조 표시 + 하단 순위표를 다시 그리고,
 * "지금 뭘 선택했는지"를 sessionStorage에 저장 + 같은 화면의 칩에도 알려줌.
 * compareLeft/compareRight가 바뀔 때마다(클릭이든 드래그든) 항상 이 함수를 거쳐가므로,
 * 여기 한 곳에만 저장 로직을 넣어두면 어떤 선택 방식이든 다 반영됨.
 *
 * sessionStorage에 넣는 이유: 다른 페이지(상세 데이터 등)에서도 새로고침 없이 그냥
 *   sessionStorage.getItem('selectedRegionA')
 * 한 줄로 지금 선택된 지역을 바로 읽어갈 수 있음 (URL 파라미터 파싱, 서버 컨트롤러 둘 다 불필요).
 */
function updateCompareUI() {
  mapControls.setCompareSelection(compareLeft, compareRight);

  const leftRec  = compareLeft  ? getRecord(compareLeft,  CURRENT_YEAR, CURRENT_MONTH) : null;
  const rightRec = compareRight ? getRecord(compareRight, CURRENT_YEAR, CURRENT_MONTH) : null;

  renderCompareRankTable('compareRankTable', compareLeft, compareRight, leftRec, rightRec);

  // (1) sessionStorage에 저장. 값이 없으면(null) 키 자체를 지움 - "빈 문자열"이 아니라
  //     아예 없는 상태로 둬야, 읽는 쪽에서 `sessionStorage.getItem(...)`이 null을 리턴해서
  //     "선택 안 됨"인지 헷갈리지 않음.
  if (compareLeft)  sessionStorage.setItem(REGION_A_KEY, compareLeft);
  else              sessionStorage.removeItem(REGION_A_KEY);

  if (compareRight) sessionStorage.setItem(REGION_B_KEY, compareRight);
  else              sessionStorage.removeItem(REGION_B_KEY);

  // (2) 같은 화면 안 칩(1번 영역, fragments/chips.html + chip.js)한테도 바로 알려줌.
  //     sessionStorage에 값을 넣는 것만으로는 "같은 탭 안에서" 보고 있는 화면이 저절로
  //     갱신되지 않아서(storage 이벤트는 다른 탭에서 바꿨을 때만 발생함), 커스텀 이벤트로
  //     한 번 더 알려줘야 함. chip.js는 map-app.js 내부를 몰라도 이 이벤트 이름/모양만 알면 됨.
  document.dispatchEvent(new CustomEvent('region:selected', {
    detail: { a: compareLeft, b: compareRight },
  }));
}

/**
 * 전국 평균 도넛 데이터를 계산해서 지정한 캔버스에 그림.
 * 단순 산술평균이 아니라 "총사용량으로 가중평균"함 - 사용량 많은 지역의 계약종별 구성이
 * 전국 평균에 더 크게 반영되게 하기 위함 (인구/사용량 없는 세종 등을 서울과 같은 무게로
 * 취급하면 왜곡됨).
 *
 * [2026-09-30] 예전엔 오른쪽에 항상 고정으로 떠 있는 "3번째 도넛" 전용 함수였는데,
 * 지금은 왼쪽 도넛(#donut-left)이 "지역 미선택 시 기본값"으로 이 함수를 호출하는 구조로 바뀜.
 * 그래서 어느 캔버스에 그릴지(targetCanvasId)를 파라미터로 받도록 함.
 */
function renderNationalAverageDonut(monthData, targetCanvasId) {
  if (!monthData.length) {
    clearDonut(targetCanvasId);
    return;
  }
  const keys = Object.keys(monthData[0].contract);
  const totalUsageSum = monthData.reduce((sum, r) => sum + r.totalUsage, 0);

  const weightedAvg = {};
  keys.forEach((k) => {
    const weightedSum = monthData.reduce((sum, r) => sum + r.contract[k] * r.totalUsage, 0);
    weightedAvg[k] = Math.round((weightedSum / totalUsageSum) * 100) / 100;
  });

  // 캡션(=도넛 정중앙 텍스트)은 "전국 평균"만. 색은 지도에 매칭되는 지역이 없으므로 회색.
  renderContractDonut(targetCanvasId, weightedAvg, '전국 평균', '#666666');
}

/**
 * 왼쪽 도넛: 전국 내 위치 표의 "왼쪽" 지자체(compareLeft).
 * [2026-09-30] compareLeft가 null(아직 아무 지역도 선택 안 함)이면, 비워두는 대신
 * "전국 평균"을 대신 그려서 첫 화면이 텅 비어 보이지 않게 함.
 */
function renderCompareLeftDonut(sidoName, year, month) {
  if (!sidoName) {
    renderNationalAverageDonut(getRecordsForMonth(year, month), 'donut-left');
    return;
  }
  const rec = getRecord(sidoName, year, month);
  if (!rec) {
    clearDonut('donut-left');
    return;
  }
  // 캡션 색상(파랑)은 지도에서 compareLeft 지역 테두리 색·순위표 왼쪽 셀 배지 색과 동일하게 맞춤.
  renderContractDonut('donut-left', rec.contract, sidoName, '#1d4ed8');
}

/**
 * 오른쪽 도넛: 전국 내 위치 표의 "오른쪽" 지자체(compareRight).
 * [2026-09-30] compareRight가 null(두 번째 지역을 아직 안 골랐음)이면, 도넛을 지우는 것뿐
 * 아니라 이 도넛이 들어있는 .donut-compact 슬롯 자체를 숨김(is-empty) -> 그만큼 왼쪽 도넛이
 * 넓게 확대되어 보임. 두 번째 지역을 고르는 순간 다시 나타남.
 */
function renderCompareRightDonut(sidoName, year, month) {
  const slotEl = document.getElementById('donut-right')?.closest('.donut-compact');

  if (!sidoName) {
    clearDonut('donut-right');
    if (slotEl) slotEl.classList.add('is-empty');
    return;
  }

  const rec = getRecord(sidoName, year, month);
  if (!rec) {
    clearDonut('donut-right');
    if (slotEl) slotEl.classList.add('is-empty');
    return;
  }

  if (slotEl) slotEl.classList.remove('is-empty');
  // 캡션 색상(분홍)은 지도에서 compareRight 지역 테두리 색·순위표 오른쪽 셀 배지 색과 동일하게 맞춤.
  renderContractDonut('donut-right', rec.contract, sidoName, '#d6006d');
}


// ---------------------------------------------------------------------------
// 실행 시작
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', bootstrap);
