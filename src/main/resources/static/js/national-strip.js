/**
 * [2번 소유] /static/js/national-strip.js
 * -----------------------------------------------------------------
 * fragments/map.html에서 compare-rank.js 다음, map-app.js 앞에 로드됨.
 * 노출 함수: renderNationalStrip(containerId, monthData, onSelect)
 * 사용처: map-app.js의 updateCompareUI()가 "아직 아무 지역도 안 골랐을 때" 호출.
 * -----------------------------------------------------------------
 *
 * [2026-10-06 신규] 지도 하단 "전국 내 위치" 자리는 비교 지역을 고르기 전까지 줄곧
 * 빈 표("-"만 가득한 상태)였음. 그 자리를 놀리지 말고, 지역을 고르기 전에도 의미가 있는
 * "전국 증감률 분포"를 보여주기로 함. 지역을 하나라도 고르면 원래 비교표로 교체됨.
 *
 * 무엇을 보여주나:
 *   17개 시도를 전년동월대비 증감률 축(가장 큰 감소 ←→ 가장 큰 증가) 위에 점으로 뿌림.
 *   "이번 달 전국이 대체로 줄었는지 늘었는지, 쏠림이 있는지"가 한눈에 보임.
 *   점 하나를 클릭하면 그 지역이 바로 비교 대상으로 들어감(= 지도 클릭과 동일).
 *
 * 왜 차트 라이브러리를 안 썼나:
 *   점 17개를 가로축 위에 놓는 것뿐이라 순수 HTML/CSS(절대 위치)로 충분하고,
 *   지도 아래 색상 범례(map.js의 renderDivergingLegend)도 이미 같은 방식으로 그리고 있음.
 *   라이브러리를 하나 더 붙이면 로딩 순서만 복잡해짐.
 *
 * 색은 map.js의 divergingHex()를 그대로 호출함 - 지도와 점 색깔이 항상 같은 규칙을 따르도록.
 * (그래서 이 파일은 map.js 뒤에 로드돼야 함)
 * -----------------------------------------------------------------
 */

/**
 * @param {string} containerId - 그려 넣을 div의 id
 * @param {Array}  monthData   - 특정 연/월의 시도별 레코드 배열 [{ sido, yoyRate, ... }, ...]
 * @param {function} onSelect  - 점을 클릭했을 때 호출할 콜백(sidoName: string) => void
 */
function renderNationalStrip(containerId, monthData, onSelect) {
  const el = document.getElementById(containerId);
  if (!el) {
    console.warn('[national-strip.js] container를 찾을 수 없음:', containerId);
    return;
  }

  // 증감률이 있는 지역만, 작은 값(가장 큰 감소) -> 큰 값(가장 큰 증가) 순으로 정렬
  const rows = monthData
    .filter((r) => r.yoyRate != null)
    .slice()
    .sort((a, b) => a.yoyRate - b.yoyRate);

  if (rows.length === 0) {
    el.innerHTML = '<p class="strip-empty">이번 달 증감률 데이터가 없습니다.</p>';
    return;
  }

  // 축 범위. 0을 반드시 포함시켜서 "0% 기준선"이 항상 축 안에 들어오게 함
  // (지도 색 스케일도 map.js에서 같은 방식으로 계산 - 그래야 점 색과 지도 색이 일치)
  const scaleMin = Math.min(0, rows[0].yoyRate);
  const scaleMax = Math.max(0, rows[rows.length - 1].yoyRate);
  const span = scaleMax - scaleMin || 1; // 전부 0%인 경우 0으로 나누기 방지

  const toPercent = (value) => ((value - scaleMin) / span) * 100;

  const decreaseCount = rows.filter((r) => r.yoyRate < 0).length;
  const increaseCount = rows.filter((r) => r.yoyRate > 0).length;

  const lowest = rows[0];                 // 가장 많이 줄어든 지역
  const highest = rows[rows.length - 1];  // 가장 많이 늘어난 지역

  // 0% 라벨이 양 끝 라벨과 겹쳐 보이는 경우(= 거의 모든 지역이 한쪽으로 쏠린 달)에는
  // 선만 남기고 글자는 숨김. 축 길이의 12% 안쪽이면 겹친다고 보고 판단함.
  const zeroAt = toPercent(0);
  const showZeroLabel = zeroAt > 12 && zeroAt < 88;

  // 점. 서로 겹쳐도 덩어리로 읽히도록 흰 테두리를 두르고, 값이 0 근처라 거의 흰색인 점도
  // 보이도록 바깥에 옅은 회색 링을 하나 더 둠(CSS의 box-shadow).
  const dots = rows
    .map((r) => {
      const color = divergingHex(r.yoyRate, scaleMin, scaleMax);
      const label = `${r.sido} ${formatStripPercent(r.yoyRate)}`;
      return `<button type="button" class="strip-dot" data-sido="${r.sido}"
                style="left:${toPercent(r.yoyRate).toFixed(2)}%; background:${color}"
                title="${label}" aria-label="${label}"></button>`;
    })
    .join('');

  el.innerHTML = `
    <div class="strip">
      <div class="strip-summary">
        <span>전국 ${rows.length}개 시도 ·
          <b class="strip-down">감소 ${decreaseCount}곳</b> ·
          <b class="strip-up">증가 ${increaseCount}곳</b>
        </span>
        <span class="strip-hint">점 클릭 = 비교 추가</span>
      </div>

      <div class="strip-track">
        <div class="strip-axis"></div>
        <div class="strip-zero" style="left:${zeroAt.toFixed(2)}%"></div>
        ${dots}
      </div>

      <div class="strip-scale">
        <span class="strip-scale-end">${formatStripPercent(lowest.yoyRate)} ${lowest.sido}</span>
        ${showZeroLabel ? `<span class="strip-scale-zero" style="left:${zeroAt.toFixed(2)}%">0%</span>` : ''}
        <span class="strip-scale-end">${highest.sido} ${formatStripPercent(highest.yoyRate)}</span>
      </div>
    </div>
  `;

  // 점 클릭 -> 지도에서 그 지역을 클릭한 것과 똑같이 처리
  if (typeof onSelect === 'function') {
    el.querySelectorAll('.strip-dot').forEach((dot) => {
      dot.addEventListener('click', () => onSelect(dot.getAttribute('data-sido')));
    });
  }
}

/**
 * 축 라벨/툴팁용 증감률 표기. 소수점 한 자리까지만 (compare-rank.js의
 * formatSignedPercent는 원본 값을 그대로 찍어서 "-22.13%"처럼 길어지는데,
 * 좁은 축 라벨에는 너무 길어서 여기서는 한 자리로 줄임)
 */
function formatStripPercent(value) {
  if (value == null) return '-';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}
