/**
 * compare-bar.js
 * -----------------------------------------------------------------
 * 지도 하단 "지역 비교" 패널에서 계약종별 도넛 대신 넣기로 한 콘텐츠:
 * 왼쪽/오른쪽으로 고른 두 지역의 총전력사용량을 가로 막대로 나란히 비교.
 * 막대 색은 지도에서 강조하는 색(왼쪽=파랑, 오른쪽=분홍)이랑 맞춰서
 * "이 막대가 지도의 어느 쪽 선택이랑 연결된 건지" 한눈에 보이게 함.
 * -----------------------------------------------------------------
 */

let _compareBarChart = null;

/**
 * @param {string|null} leftSido
 * @param {string|null} rightSido
 * @param {Object|null} leftRec  - getRecord(leftSido, ...) 결과
 * @param {Object|null} rightRec - getRecord(rightSido, ...) 결과
 */
function renderCompareBarChart(leftSido, rightSido, leftRec, rightRec) {
  const canvas = document.getElementById('compareBarChart');
  if (!canvas) {
    console.warn('[compare-bar.js] canvas를 찾을 수 없음: compareBarChart');
    return;
  }

  if (_compareBarChart) {
    _compareBarChart.destroy();
    _compareBarChart = null;
  }

  const labels = [];
  const values = [];
  const colors = [];

  if (leftSido && leftRec) {
    labels.push(leftSido);
    values.push(leftRec.totalUsage);
    colors.push('#1d4ed8'); // 지도의 '왼쪽 선택' 강조색과 동일
  }
  if (rightSido && rightRec) {
    labels.push(rightSido);
    values.push(rightRec.totalUsage);
    colors.push('#d6006d'); // 지도의 '오른쪽 선택' 강조색과 동일
  }

  // 둘 다 비어있으면 그냥 아무것도 안 그림 (초기 화면에서 오른쪽 미선택일 때는 왼쪽 막대 하나만 나옴)
  if (values.length === 0) return;

  _compareBarChart = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: '총전력사용량(kWh)',
          data: values,
          backgroundColor: colors,
        },
      ],
    },
    options: {
      indexAxis: 'y', // 가로 막대: 두 값을 좌우로 나란히 놓고 비교하기 더 직관적임
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.parsed.x.toLocaleString('ko-KR')} kWh`,
          },
        },
      },
      scales: {
        x: { beginAtZero: true },
      },
    },
  });
}
