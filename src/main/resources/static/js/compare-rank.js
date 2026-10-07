/**
 * [2번 소유] /static/js/compare-rank.js
 * -----------------------------------------------------------------
 * fragments/map.html에서 map.js 다음, map-app.js 앞에 로드됨.
 * 노출 함수: renderCompareRankTable(containerId, leftSido, rightSido, leftRec, rightRec)
 * 사용처: map-app.js의 updateCompareUI()가 호출. 지우면 순위 비교표 안 그려짐.
 * -----------------------------------------------------------------
 *
 * 지도 하단 "전국 내 위치" 순위 비교표.
 *
 * 구성:
 *  - 헤더: 왼쪽 지역명 vs 오른쪽 지역명 (아직 선택 안 됐으면 "왼쪽"/"오른쪽" 표시)
 *  - 지표별 행(가운데 라벨 컬럼 기준으로 좌우 대칭):
 *        - 총전력사용량
 *        - 전년동월대비 증감률
 *        - 1인당 사용량
 * 순위는 전국 17개 시도 중에서의 순위(1위 = 가장 큰 값)이고,
 * region_data.json 만들 때 이미 계산해서 넣어둔 rankTotalUsage/rankYoy/rankPerCapita를 그대로 씀.
 * -----------------------------------------------------------------
 */

const COMPARE_METRICS = [
  {
    label: '총전력사용량',
    rankKey: 'rankTotalUsage',
    // 억 kWh 단위로 줄여서 표시 (원래 단위 그대로 쓰면 자릿수가 너무 길어서
    // 칸 안에서 줄바꿈이 생기고, 그러면 옆 칸이랑 세로줄이 안 맞게 됨)
    formatValue: (rec) => `${(rec.totalUsage / 1e8).toFixed(1)}억kWh`,
  },
  {
    label: '전년동월대비 증감률',
    rankKey: 'rankYoy',
    formatValue: (rec) => formatSignedPercent(rec.yoyRate),
  },
  {
    label: '1인당 사용량',
    // 원본 인구 데이터가 일부 달에 결측이었던 지역/월은 추정치를 채워 넣었으므로
    // 보통은 값이 있지만, 혹시 모를 결측 대비로 formatPerCapita가 null을 방어함
    rankKey: 'rankPerCapita',
    formatValue: (rec) => formatPerCapita(rec.perCapitaUsage),
  },
];

function renderCompareRankTable(containerId, leftSido, rightSido, leftRec, rightRec) {
  const el = document.getElementById(containerId);
  if (!el) {
    console.warn('[compare-rank.js] container를 찾을 수 없음:', containerId);
    return;
  }

  const leftHeader = leftSido || '왼쪽';
  const rightHeader = rightSido || '오른쪽';

  const leftCells = COMPARE_METRICS.map((m) => renderColCell(m, leftRec)).join('');
  const rightCells = COMPARE_METRICS.map((m) => renderColCell(m, rightRec)).join('');
  const midCells = COMPARE_METRICS.map((m) => `<div class="compare-mid-cell">${m.label}</div>`).join('');

  el.innerHTML = `
    <div class="compare-grid">
      <div class="compare-side compare-col" data-slot="left">
        <div class="compare-col-header side-left">${leftHeader}</div>
        ${leftCells}
      </div>
      <div class="compare-mid">
        <div class="compare-mid-header">vs</div>
        ${midCells}
      </div>
      <div class="compare-side compare-col" data-slot="right">
        <div class="compare-col-header side-right">${rightHeader}</div>
        ${rightCells}
      </div>
    </div>
    <p class="compare-drop-hint">지도 클릭 또는 위쪽 지역비교 칸에서 선택 (최대 2곳)</p>
  `;
}

function renderColCell(metric, rec) {
  if (!rec) {
    return `
      <div class="compare-col-cell is-empty">
        <span class="rank-badge rank-badge-empty">-</span>
        <div class="rank-value">-</div>
      </div>
    `;
  }
  return `
    <div class="compare-col-cell">
      <span class="rank-badge">${formatRank(rec[metric.rankKey])}</span>
      <div class="rank-value">${metric.formatValue(rec)}</div>
    </div>
  `;
}

function formatSignedPercent(value) {
  if (value == null) return '-';
  return `${value > 0 ? '+' : ''}${value}%`;
}

// 순위 값이 없을 수 있음 (예: 인구 데이터가 결측이라 1인당 사용량을 계산 못한 지역/월)
function formatRank(rank) {
  if (rank == null) return '-';
  return `${rank}위`;
}

// 1인당 사용량 값이 없을 수 있음 (인구 데이터 결측)
function formatPerCapita(value) {
  if (value == null) return '-';
  return `${value.toLocaleString('ko-KR', { maximumFractionDigits: 1 })} kWh/인`;
}
