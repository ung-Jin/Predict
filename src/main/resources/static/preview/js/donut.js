/**
 * donut.js
 * -----------------------------------------------------------------
 * 담당(2번): 계약종별(주택용/일반용/교육용/산업용/농사용/가로등/심야) 비중 도넛차트
 * 사용 라이브러리: Chart.js (팀에서 이미 표준으로 쓰기로 한 차트 라이브러리)
 *
 * 색상 규칙: "사람의 행동/재실 패턴에 영향을 많이 받는 용도"는 온열(따뜻한) 색 계열,
 * "설비/자동화 위주라 사람 영향이 적은 용도"는 냉방(차가운) 색 계열로 구분함.
 *   - 온열 계열(사람 영향 큼): 주택용(생활 패턴), 일반용(영업시간/사람 활동), 교육용(등하교/수업시간)
 *   - 냉방 계열(사람 영향 작음): 산업용(설비 가동 위주), 농사용(자동 관수/난방 등), 가로등(완전 자동),
 *                              심야(심야전력 - 대부분 예약/자동 가동)
 * 이 구분은 "일반적으로 그렇다"는 판단이라, 팀에서 기준이 다르면 아래 맵만 바꾸면 됨.
 * -----------------------------------------------------------------
 */

const CONTRACT_COLOR_MAP = {
  // ---- 온열 계열 (사람 영향 많이 받는 용도) ----
  '주택용': '#e63946', // 빨강 - 가정 생활 패턴에 직접 좌우됨
  '일반용': '#f77f00', // 주황 - 영업시간/사람 활동에 좌우됨
  '교육용': '#fcbf49', // 노랑/앰버 - 등하교, 수업시간표에 좌우됨

  // ---- 냉방 계열 (사람 영향 적은 용도) ----
  '산업용': '#219ebc', // 파랑 - 공장 설비 가동이 주 원인, 개인 행동 영향 적음
  '농사용': '#2a9d8f', // 청록 - 관수/시설재배 자동화 위주
  '가로등': '#023047', // 남색 - 타이머로 완전 자동 점소등, 사람 영향 없음
  '심야': '#8ecae6', // 연파랑 - 심야전력(예약/자동 충전 등), 사람 활동과 무관
};

// chartjs-plugin-datalabels: 파이(도넛) 조각 위에 직접 "몇 %"인지 숫자를 써주는 플러그인
// (index.html에서 CDN으로 chartjs-plugin-datalabels를 먼저 불러온 뒤 여기서 등록함)
if (typeof ChartDataLabels !== 'undefined') {
  Chart.register(ChartDataLabels);
}

// containerId(캔버스 id)별로 만들어둔 Chart 인스턴스를 기억해뒀다가,
// 같은 캔버스에 다시 그릴 때 먼저 destroy 해줌
// (Chart.js는 같은 canvas에 두 번 그리면 "Canvas is already in use" 에러가 남)
const _donutInstances = {};

/**
 * 계약종별 비중 도넛차트를 그림.
 *
 * @param {string} containerId - <canvas id="..."> 의 id
 * @param {Object} contractObj - { 주택용: 13.27, 일반용: 30.63, ... } (단위: %)
 * @param {string} [titleText] - 차트 위에 표시할 제목 (예: "서울특별시 · 2026-07")
 */
function renderContractDonut(containerId, contractObj, titleText) {
  const canvas = document.getElementById(containerId);
  if (!canvas) {
    console.warn('[donut.js] canvas를 찾을 수 없음:', containerId);
    return null;
  }

  // 이미 그려진 차트가 있으면 먼저 정리
  if (_donutInstances[containerId]) {
    _donutInstances[containerId].destroy();
  }

  const labels = Object.keys(contractObj);
  const values = Object.values(contractObj);
  // 카테고리 이름 기준으로 고정 색상 매핑 (못 찾으면 회색으로 방어)
  const colors = labels.map((label) => CONTRACT_COLOR_MAP[label] || '#999999');

  const chart = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: colors,
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: !!titleText,
          text: titleText,
        },
        // 범례는 왼쪽/오른쪽 도넛에 똑같이 두 번 그릴 필요가 없어서 여기서는 끄고,
        // 공통 범례 하나만 renderContractLegend()로 위에 따로 그림
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            // 예: "산업용: 35.15%"
            label: (ctx) => `${ctx.label}: ${ctx.parsed}%`,
          },
        },
        // 파이 조각 위에 직접 퍼센트 숫자 표시 (소수점 없이 정수로, 크게)
        datalabels: {
          color: '#fff',
          font: { weight: 'bold', size: 15 },
          formatter: (value) => `${Math.round(value)}%`,
          // 조각이 너무 작으면 숫자가 겹쳐 보이니까(글자를 키운 만큼 기준도 살짝 올림) 일정 비율 이하는 생략
          display: (ctx) => {
            const val = ctx.dataset.data[ctx.dataIndex];
            return val >= 5;
          },
        },
      },
    },
  });

  _donutInstances[containerId] = chart;
  return chart;
}

/**
 * 선택된 지역이 없을 때(예: 오른쪽 슬롯이 아직 빈 상태) 이전에 그려진 도넛을 지움.
 * @param {string} containerId
 */
function clearDonut(containerId) {
  if (_donutInstances[containerId]) {
    _donutInstances[containerId].destroy();
    delete _donutInstances[containerId];
  }
}

/**
 * 계약종별 공통 범례를 한 번만 그림 (왼쪽/오른쪽 도넛이 색이 같으므로 범례를 두 번 반복할 필요 없음).
 * CONTRACT_COLOR_MAP에 있는 카테고리를 등록된 순서 그대로 보여줌.
 * @param {string} containerId - 범례를 그릴 컨테이너의 id
 */
function renderContractLegend(containerId) {
  const el = document.getElementById(containerId);
  if (!el) {
    console.warn('[donut.js] legend container를 찾을 수 없음:', containerId);
    return;
  }

  el.innerHTML = Object.entries(CONTRACT_COLOR_MAP)
    .map(
      ([label, color]) => `
        <span class="donut-legend-item">
          <span class="donut-legend-swatch" style="background:${color}"></span>${label}
        </span>
      `
    )
    .join('');
}
