/**
 * compare-rank.js
 * -----------------------------------------------------------------
 * 지도 하단 "지역 비교" 패널.
 *
 * 별도의 "여기로 드래그하세요" 카드를 따로 두지 않고, 이 표 자체의
 * 왼쪽 컬럼 전체 / 오른쪽 컬럼 전체가 곧 드롭 영역(data-slot)이자
 * 결과가 표시되는 자리임 ("왼쪽 표 전체 vs 오른쪽 표 전체" 느낌).
 * 지도에서 지역을 드래그해서 이 컬럼 위에 놓으면 map.js가
 * onRegionDropToSlot(sido, 'left'|'right')을 호출해서 바로 반영됨.
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
      <div class="compare-side compare-col${leftRec ? ' is-filled' : ''}" data-slot="left">
        <div class="compare-col-header side-left">${leftHeader}</div>
        ${leftCells}
      </div>
      <div class="compare-mid">
        <div class="compare-mid-header">vs</div>
        ${midCells}
      </div>
      <div class="compare-side compare-col${rightRec ? ' is-filled' : ''}" data-slot="right">
        <div class="compare-col-header side-right">${rightHeader}</div>
        ${rightCells}
      </div>
    </div>
    <p class="compare-drop-hint">지도에서 지역을 클릭하거나, 이 표의 왼쪽/오른쪽 위로 직접 드래그해서 놓으세요</p>
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
