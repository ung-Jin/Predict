/**
 * [2번 소유] /static/js/donut.js
 * -----------------------------------------------------------------
 * fragments/donut.html에서 로드됨. map-app.js보다 먼저 로드되어야 함(대시보드
 * 조립 순서상 자동으로 그렇게 됨: 왼쪽 컬럼의 donut 조각이 오른쪽 컬럼의 map
 * 조각보다 먼저 렌더됨).
 * 노출: CONTRACT_COLOR_MAP, renderContractDonut(...), clearDonut(...),
 *       renderContractLegend(containerId)
 * 이 파일을 지우면 도넛이 안 그려지고, map-app.js가 함수 못 찾아서 죽음.
 * -----------------------------------------------------------------
 *
 * 계약종별 비중 도넛차트 (Chart.js 사용).
 *
 * ▶ 표시 규칙 (요약):
 *   - 주요 4개: 주택용 · 일반용 · 산업용 · 농사용 → 각자의 색으로 그대로 표시
 *   - 나머지 3개(교육용 · 가로등 · 심야): 각각 대체로 비중이 작아서 개별로 그리면
 *     조각도 잘게 쪼개지고 범례만 길어지므로, 하나의 "기타" 조각으로 합쳐서 그림.
 *     (팀에서 개별 표시가 필요하다고 결정 나면 아래 MINOR_CATEGORIES를 []로 비우면 됨)
 *
 * ▶ 색상 규칙:
 *   "사람의 행동/재실 패턴에 영향을 많이 받는 용도"는 온열(따뜻한) 색,
 *   "설비/자동화 위주라 사람 영향이 적은 용도"는 냉방(차가운) 색으로 구분함.
 *
 * ▶ [2026-09-30] 지역명(캡션) 표시 방식 변경:
 *   예전엔 캔버스 위쪽 별도 div(.donut-caption)에 지역명을 텍스트로 썼는데,
 *   "도넛을 최대한 크게" 요청에 따라 그 캡션 줄 자체를 없애고, 대신 아래
 *   centerTextPlugin이 도넛 "정중앙"(가운데 뚫린 구멍)에 직접 캔버스로 그려 넣음.
 *   이 플러그인은 Chart.register()로 전역 등록하지 않고, renderContractDonut 안에서
 *   차트 인스턴스별로만 plugins:[...] 로 넣어줌 -> 다른 팀원분이 만드는 Chart.js
 *   차트(kpi/trend 등)에는 절대 영향 안 줌.
 * -----------------------------------------------------------------
 */

// 화면에 개별로 표시할 카테고리의 색상 매핑 (Chart.js 조각/범례가 이 순서로 나옴).
// "기타"는 위 표시 규칙대로 아래 MINOR_CATEGORIES를 합친 것.
const CONTRACT_COLOR_MAP = {
  '주택용': '#e63946', // 빨강 - 가정 생활 패턴에 직접 좌우됨 (사람 영향 큼)
  '일반용': '#f77f00', // 주황 - 영업시간/사람 활동에 좌우됨 (사람 영향 큼)
  '산업용': '#219ebc', // 파랑 - 공장 설비 가동이 주 원인 (사람 영향 적음)
  '농사용': '#2a9d8f', // 청록 - 관수/시설재배 자동화 위주 (사람 영향 적음)
  '기타':   '#9aa0a6', // 회색 - 교육용/가로등/심야를 합친 소계
};

// "기타"로 합칠 카테고리들. 각각의 원본 색은 이제 화면에 안 쓰이지만 문서화 차원에서 남겨둠:
//   교육용: 노랑 (#fcbf49) - 학교 특성상 지역/월별 편차 커서 개별 표시가 부담
//   가로등: 남색 (#023047) - 완전 자동 점소등, 비중 1% 미만이라 시각적으로 안 보임
//   심야:   연파랑 (#8ecae6) - 심야전력, 비중 1% 미만
// 이 리스트를 []로 비우면 위 3개도 각자 CONTRACT_COLOR_MAP에 추가해서 개별로 그리는 원래
// 모드로 돌아감 (이때 CONTRACT_COLOR_MAP에서 '기타' 항목 지우고 원래 3개 색을 넣어야 함).
const MINOR_CATEGORIES = ['교육용', '가로등', '심야'];

// 서버가 넘겨준 원본 계약종별 비중(7개 카테고리)을 위 표시 규칙(주요 4 + 기타)에 맞게 접어줌.
// 입력: { 주택용: 13.27, 일반용: 30.63, 교육용: 1.42, 산업용: 54.05, 농사용: 14.67, 가로등: 0.77, 심야: 0.44 }
// 출력: { 주택용: 13.27, 일반용: 30.63, 산업용: 54.05, 농사용: 14.67, 기타: 2.63 }
function collapseToDisplayCategories(contractObj) {
  const collapsed = {};
  let etcSum = 0;
  Object.entries(contractObj).forEach(([label, value]) => {
    if (MINOR_CATEGORIES.includes(label)) {
      etcSum += value;
    } else {
      collapsed[label] = value;
    }
  });
  if (etcSum > 0) {
    collapsed['기타'] = Math.round(etcSum * 100) / 100;
  }
  return collapsed;
}

// chartjs-plugin-datalabels: 파이(도넛) 조각 위에 직접 "몇 %"인지 숫자를 써주는 플러그인
// (fragments/donut.html에서 CDN으로 chartjs-plugin-datalabels를 먼저 불러온 뒤 여기서 등록함)
// 이건 우리 카드뿐 아니라 다른 팀원분들 차트에도 필요할 수 있는 범용 플러그인이라 그대로 전역 등록함.
if (typeof ChartDataLabels !== 'undefined') {
  Chart.register(ChartDataLabels);
}

// containerId(캔버스 id)별로 만들어둔 Chart 인스턴스를 기억해뒀다가,
// 같은 캔버스에 다시 그릴 때 먼저 destroy 해줌
// (Chart.js는 같은 canvas에 두 번 그리면 "Canvas is already in use" 에러가 남)
const _donutInstances = {};

/**
 * 도넛 "정중앙"(가운데 뚫린 구멍 부분)에 지역명/"전국 평균" 텍스트를 직접 그려주는
 * 커스텀 Chart.js 플러그인. Chart.register()로 전역 등록하지 않고, 아래
 * renderContractDonut에서 이 차트 인스턴스의 plugins 배열에만 넣어서 쓰므로
 * 다른 팀원분 차트에는 전혀 영향이 없음.
 *
 * pluginOptions는 options.plugins.donutCenterText = { text, color } 로 전달됨
 * (Chart.js 규칙: plugin.id와 options.plugins의 키 이름이 같아야 연결됨).
 */
const centerTextPlugin = {
  id: 'donutCenterText',
  afterDraw(chart, args, pluginOptions) {
    const text = pluginOptions && pluginOptions.text;
    if (!text) return;

    const { ctx, chartArea } = chart;
    const cx = (chartArea.left + chartArea.right) / 2;
    const cy = (chartArea.top + chartArea.bottom) / 2;
    // 도넛 안쪽 구멍 지름 대략치 (cutout 비율과 맞춰 둠) - 이보다 글자가 넓어지면 글자를 줄임
    const holeDiameter =
      Math.min(chartArea.right - chartArea.left, chartArea.bottom - chartArea.top) * 0.42;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = pluginOptions.color || '#333333';

    let fontSize = 13;
    ctx.font = `bold ${fontSize}px sans-serif`;
    while (ctx.measureText(text).width > holeDiameter && fontSize > 9) {
      fontSize -= 1;
      ctx.font = `bold ${fontSize}px sans-serif`;
    }

    ctx.fillText(text, cx, cy);
    ctx.restore();
  },
};

// [2026-09-30] canvas-wrap을 "폭과 같은 높이(정사각형)"로 만드는 함수. CSS 트릭
// (aspect-ratio, padding-bottom)은 Chart.js가 높이를 반토막으로 오인식해서 도넛이
// 쭈그러드는 버그가 있어 폐기, JS로 폭을 재서 height에 직접 박아넣는 방식.
// ResizeObserver로 폭 변화 추적 (중복 등록 방지 WeakSet).
const _squareWrapObserved = new WeakSet();
function keepCanvasWrapSquare(wrapEl) {
  if (!wrapEl) return;

  // Chart.js가 뒤이어 바로 크기를 잴 것이므로, 우선 동기적으로 한 번 폭을 재서 높이를 맞춤
  const currentWidth = wrapEl.getBoundingClientRect().width;
  if (currentWidth > 0) {
    wrapEl.style.height = `${currentWidth}px`;
  }

  // 이후 폭이 바뀔 때마다(레이아웃 변화) 계속 따라가도록 감시 등록 (최초 1번만)
  if (!_squareWrapObserved.has(wrapEl) && typeof ResizeObserver !== 'undefined') {
    _squareWrapObserved.add(wrapEl);
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) wrapEl.style.height = `${w}px`;
      }
    });
    ro.observe(wrapEl);
  }
}

/**
 * 계약종별 비중 도넛차트를 그림.
 *
 * @param {string} containerId - <canvas id="..."> 의 id
 * @param {Object} contractObj - 서버 원본 { 주택용, 일반용, 교육용, 산업용, 농사용, 가로등, 심야 } (단위 %)
 * @param {string} [titleText] - 도넛 정중앙에 표시할 캡션 (지역명 또는 "전국 평균").
 *                                centerTextPlugin이 캔버스에 직접 그려 넣음.
 * @param {string} [centerColor] - 중앙 캡션 글자색. 지도 테두리/순위표 배지 색과 맞춰서
 *                                 왼쪽=파랑(#1d4ed8), 오른쪽=분홍(#d6006d), 전국평균=회색(#666666) 사용.
 */
function renderContractDonut(containerId, contractObj, titleText, centerColor = '#333333') {
  const canvas = document.getElementById(containerId);
  if (!canvas) {
    console.warn('[donut.js] canvas를 찾을 수 없음:', containerId);
    return null;
  }

  // Chart.js가 캔버스 크기를 재기 전에, 감싸는 박스를 먼저 정사각형으로 맞춰둠
  keepCanvasWrapSquare(canvas.closest('.donut-canvas-wrap'));

  // 이미 그려진 차트가 있으면 먼저 정리
  if (_donutInstances[containerId]) {
    _donutInstances[containerId].destroy();
  }

  // 7개 → 5개(주요 4 + 기타)로 접기
  const displayObj = collapseToDisplayCategories(contractObj);
  const labels = Object.keys(displayObj);
  const values = Object.values(displayObj);
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
    // centerTextPlugin을 이 차트 인스턴스에만 적용 (전역 Chart.register 아님)
    plugins: [centerTextPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      // Chart.js가 차트 주변에 기본으로 넣는 여백을 0으로 없앰 (도넛을 캔버스 박스
      // 끝까지 최대한 채우기 위함 - map.css에서 캔버스 박스 자체를 정사각형으로
      // 고정해뒀으므로, 이 안에서 또 여백이 생기지 않게 함).
      layout: { padding: 0 },
      // cutout: 안쪽 구멍 크기. 너무 좁으면 중앙 텍스트가 들어갈 자리가 없고,
      // 너무 넓으면 링이 얇아져서 % 라벨이 안 들어감 - 42%가 적당한 절충점.
      cutout: '42%',
      // 캔버스 박스가 이제 정사각형으로 고정돼 있으므로(map.css), 도넛을 거의
      // 박스 끝까지(100%에 가깝게) 채움.
      radius: '99%',
      plugins: {
        title: { display: false },   // 캡션은 donutCenterText 플러그인으로 대체
        legend: { display: false },  // 범례는 공통 범례(#donutLegend) 하나만
        tooltip: {
          callbacks: {
            // 툴팁에서는 원본 소수점까지 그대로 보여줌 (예: "산업용: 35.15%")
            label: (ctx) => `${ctx.label}: ${ctx.parsed}%`,
          },
        },
        // 파이 조각 위 % 라벨 (정수로 반올림, 링 중앙에 배치)
        datalabels: {
          color: '#fff',
          font: { weight: 'bold', size: 11 },
          anchor: 'center',   // 조각의 중심선(centroid)에 앵커
          align: 'center',    // 앵커에서 벗어나지 않고 정중앙에 배치 → 링 밖으로 안 나감
          clamp: true,        // 만약 계산상 밖으로 나가려 하면 강제로 안쪽으로 당김
          formatter: (value) => `${Math.round(value)}%`,
          // 조각이 너무 작으면 라벨끼리 겹치므로 6% 미만은 숫자 생략
          display: (ctx) => {
            const val = ctx.dataset.data[ctx.dataIndex];
            return val >= 6;
          },
        },
        // 위 centerTextPlugin(id: 'donutCenterText')에 전달되는 옵션
        donutCenterText: {
          text: titleText || '',
          color: centerColor,
        },
      },
    },
  });

  _donutInstances[containerId] = chart;
  return chart;
}

/**
 * 선택된 지역이 없을 때(예: 오른쪽 슬롯이 아직 빈 상태) 이전에 그려진 도넛을 지움.
 */
function clearDonut(containerId) {
  if (_donutInstances[containerId]) {
    _donutInstances[containerId].destroy();
    delete _donutInstances[containerId];
  }
}

/**
 * 계약종별 공통 범례를 한 번만 그림 (왼쪽/오른쪽 도넛이 색이 같으므로 범례를 두 번 반복할 필요 없음).
 * CONTRACT_COLOR_MAP에 있는 카테고리를 등록된 순서 그대로 보여줌 = 화면과 완전히 동일한 색.
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
