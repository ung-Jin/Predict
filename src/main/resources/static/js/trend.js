/* [3번 소유] 월별 사용량 추이 차트
 *
 * 지금은 더미 데이터로 화면만 그린다.
 * 서버 연동 시에는 아래 "서버 연동 자리" 주석을 풀고 TrendChart.render(data) 를 호출하면 된다.
 * 차트를 그리는 코드 자체는 데이터 출처를 모른다 = 연동 시 손댈 곳이 한 군데로 좁혀진다.
 */
(function (global) {
  'use strict';

  var CANVAS_ID = 'trendChart';
  var ANIM_MS = 1200;   /* 선이 왼쪽 끝에서 오른쪽 끝까지 그려지는 데 걸리는 시간 */
  var chart = null;

  /* ===== 더미 데이터 (임의값). 서버 연동하면 이 블록은 지운다 ===== */
  var DUMMY = {
    labels: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
    /* 실측: 1~7월 */
    actual: [52100, 48700, 43200, 38900, 37600, 41800, 44063, null, null, null, null, null],
    /* 예측: 7월부터 시작해 실측 끝점과 선이 이어지게 함 */
    forecast: [null, null, null, null, null, null, 44063, 51229, 45300, 39800, 42100, 49600]
  };
  /* ============================================================== */

  /* CSS 변수를 읽는다. 색은 trend.css 의 :root 에 있으므로 JS 에 하드코딩하지 않는다 */
  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name);
    return (v || '').trim() || fallback;
  }

  /* 왼쪽에서 오른쪽으로 선이 그려지는 진입 연출.
     점 좌표를 건드리지 않고, 캔버스를 왼쪽부터 넓혀가며 보여주는 방식이다.
     좌표(x)를 NaN 에서 출발시키는 방식은 창 크기가 바뀌어 차트가 다시 그려질 때
     점이 전부 사라지므로 쓰지 않는다. (지도 로드로 레이아웃이 흔들리면 바로 재현됨)

     축/격자/범례는 클립 밖이라 처음부터 보이고, 선과 점만 왼쪽부터 드러난다. */
  var revealLeftToRight = {
    id: 'revealLeftToRight',

    beforeDatasetsDraw: function (chart) {
      if (chart.$revealDone) return;
      if (!chart.$revealStart) chart.$revealStart = performance.now();

      chart.$revealP = Math.min((performance.now() - chart.$revealStart) / ANIM_MS, 1);

      var a = chart.chartArea;
      var c = chart.ctx;
      c.save();
      c.beginPath();
      c.rect(a.left, a.top, (a.right - a.left) * chart.$revealP, a.bottom - a.top);
      c.clip();
    },

    afterDatasetsDraw: function (chart) {
      if (chart.$revealDone) return;
      chart.ctx.restore();

      if (chart.$revealP >= 1) {
        chart.$revealDone = true;   /* 끝나면 클립을 아예 걸지 않는다 */
        return;
      }
      requestAnimationFrame(function () { chart.draw(); });
    }
  };

  function series(label, data, color, dash) {
    return {
      label: label,
      data: data,
      borderColor: color,
      backgroundColor: color,
      borderWidth: 2,
      borderDash: dash,
      tension: 0.3,
      pointRadius: 4,
      pointHoverRadius: 6,
      pointBackgroundColor: color,
      pointBorderColor: '#fff',
      pointBorderWidth: 2
    };
  }

  function buildOptions() {
    var ink = cssVar('--ink', '#2A3654');
    var mute = cssVar('--mute', '#66789A');
    var line = cssVar('--line', '#E6EEF8');

    return {
      responsive: true,
      /* 높이는 trend.css 의 .trend-chart 가 잡는다. 이 값이 true 면 캔버스가 계속 늘어난다 */
      maintainAspectRatio: false,
      /* 기본 진입 애니메이션(아래에서 솟아오름)은 끄고, revealLeftToRight 플러그인에 맡긴다 */
      animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        /* 2번 donut.js 가 chartjs-plugin-datalabels 를 Chart.register() 로 전역 등록해서
           이 차트 점 위에도 숫자가 찍힌다. 추이 차트에서는 끈다 */
        datalabels: { display: false },
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 8,
            boxHeight: 8,
            padding: 16,
            color: mute,
            font: { size: 12 }
          }
        },
        tooltip: {
          backgroundColor: '#fff',
          titleColor: ink,
          bodyColor: ink,
          borderColor: line,
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
          usePointStyle: true,
          callbacks: {
            label: function (ctx) {
              return ' ' + ctx.dataset.label + '  ' + ctx.parsed.y.toLocaleString() + ' GWh';
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          border: { color: line },
          ticks: { color: mute, font: { size: 11 } }
        },
        y: {
          grid: { color: line, drawTicks: false },
          border: { display: false },
          ticks: {
            color: mute,
            font: { size: 11 },
            maxTicksLimit: 6,
            callback: function (val) { return val.toLocaleString(); }
          }
        }
      }
    };
  }

  /**
   * 차트를 그린다. 이미 그려져 있으면 지우고 다시 그린다.
   * @param {{labels:string[], actual:Array<number|null>, forecast:Array<number|null>}} data
   */
  function render(data) {
    var el = document.getElementById(CANVAS_ID);
    if (!el) return null;
    if (typeof Chart === 'undefined') {
      console.error('[trend] Chart.js 가 로드되지 않았습니다.');
      return null;
    }

    /* 같은 캔버스에 두 번 그리면 Chart.js 가 에러를 낸다. 갱신 전에 반드시 정리 */
    if (chart) chart.destroy();

    chart = new Chart(el, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [
          series('실측', data.actual, cssVar('--trend-actual', '#3F72B5'), []),
          series('예측', data.forecast, cssVar('--trend-forecast', '#C86A1E'), [6, 4])
        ]
      },
      options: buildOptions(),
      plugins: [revealLeftToRight]   /* 전역 Chart.register 아님 */
    });
    return chart;
  }

  /* ===== 서버 연동 자리 =====
   * 1) dashboard.html 에 axios CDN 추가
   * 2) 아래 주석 해제
   * 3) 맨 아래 render(DUMMY) 를 load() 로 교체
   *
   * 응답을 {labels, actual, forecast} 로만 바꿔주면 되고, 차트 코드는 건드릴 필요가 없다.
   * 실측/예측 구분 기준은 API 응답 형태가 정해지면 toChartData 안에서 처리한다.

  function toChartData(points) {
    // points: TrendPoint[] = [{year, month, usageKwh}, ...]
    return {
      labels: points.map(function (p) { return p.month + '월'; }),
      actual: points.map(function (p) { return p.usageKwh; }),
      forecast: []
    };
  }

  function load(params) {
    return axios.get('/api/trend', { params: params })
      .then(function (res) { return render(toChartData(res.data)); })
      .catch(function (err) { console.error('[trend] 조회 실패', err); });
  }
   * ========================= */

  /* 밖에서 다시 그릴 수 있도록 공개 (지역 선택이 바뀔 때 등) */
  global.TrendChart = { render: render };

  document.addEventListener('DOMContentLoaded', function () {
    render(DUMMY);
  });
})(window);
