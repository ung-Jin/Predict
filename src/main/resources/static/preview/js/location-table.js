/**
 * location-table.js
 * -----------------------------------------------------------------
 * 담당(2번): "전국 내 위치 표"
 * 지도만으로는 지역별 정확한 수치를 한눈에 비교하기 어려우니까,
 * 17개 시도를 값 기준으로 정렬한 표를 같이 보여줌.
 * 행을 클릭하면 지도를 클릭한 것과 동일하게 동작함(같은 콜백 재사용).
 * -----------------------------------------------------------------
 */

/**
 * @param {string} containerId - 표를 그릴 wrapper div의 id
 * @param {Array} regionData - [{ sido, totalUsage, yoyRate, ... }, ...] (보통 특정 연/월 데이터)
 * @param {Object} options
 * @param {string} options.metric - 정렬/표시 기준 필드명 (기본값: 'totalUsage')
 * @param {function} options.onRowClick - 행 클릭 시 호출할 콜백(sidoName: string) => void
 */
function renderRegionTable(containerId, regionData, options = {}) {
  const { metric = 'totalUsage', onRowClick } = options;
  const wrapper = document.getElementById(containerId);
  if (!wrapper) {
    console.warn('[location-table.js] wrapper를 찾을 수 없음:', containerId);
    return;
  }

  // 값 기준 내림차순 정렬 (많은 지역이 위로)
  const sorted = [...regionData].sort((a, b) => (b[metric] ?? 0) - (a[metric] ?? 0));

  // 표 HTML 생성 (프레임워크 없이 순수 JS로만 구성)
  const rows = sorted
    .map((r, idx) => {
      const value = r[metric] != null ? r[metric].toLocaleString('ko-KR') : '-';
      const yoy = r.yoyRate != null ? `${r.yoyRate > 0 ? '+' : ''}${r.yoyRate}%` : '-';
      return `
        <tr data-sido="${r.sido}" class="region-row">
          <td>${idx + 1}</td>
          <td>${r.sido}</td>
          <td class="num">${value}</td>
          <td class="num ${r.yoyRate > 0 ? 'up' : r.yoyRate < 0 ? 'down' : ''}">${yoy}</td>
        </tr>
      `;
    })
    .join('');

  wrapper.innerHTML = `
    <table class="region-table">
      <thead>
        <tr>
          <th>#</th>
          <th>시도</th>
          <th>총전력사용량(kWh)</th>
          <th>전년동월 대비</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  // 행 클릭 이벤트 연결 (지도 클릭이랑 동일한 콜백을 쓰게 해서, 어디를 눌러도 같은 동작을 하게 함)
  wrapper.querySelectorAll('.region-row').forEach((tr) => {
    tr.addEventListener('click', () => {
      const sido = tr.getAttribute('data-sido');
      if (typeof onRowClick === 'function') {
        onRowClick(sido);
      }
    });
  });
}

/**
 * 현재 선택된 지역(들)에 맞춰 표의 행 하이라이트만 갱신 (표를 통째로 다시 안 그림)
 * @param {string} containerId
 * @param {string[]} sidoNames
 */
function setTableSelected(containerId, sidoNames) {
  const wrapper = document.getElementById(containerId);
  if (!wrapper) return;
  wrapper.querySelectorAll('.region-row').forEach((tr) => {
    const sido = tr.getAttribute('data-sido');
    tr.classList.toggle('selected', sidoNames.includes(sido));
  });
}
