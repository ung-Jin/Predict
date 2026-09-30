/**
 * [2번 소유] /static/js/map.js
 * -----------------------------------------------------------------
 * fragments/map.html에서 sido-map-codes.js 다음에 로드됨.
 * 노출 함수: initRegionMap(containerId, options), renderDivergingLegend(...)
 * 사용처: map-app.js가 두 함수를 호출해서 지도/범례 초기화. 지우면 지도 안 그려짐.
 * -----------------------------------------------------------------
 *
 * 시도별 색칠(전년동월대비 증감률 기준) + 범례 + 2개 지역 비교용 클릭 선택
 * 사용 라이브러리: amCharts 5 (지도 전용) - am5geodata_southKoreaLow 에
 *   17개 시도 좌표가 이미 들어있어서 별도 GeoJSON을 구할 필요가 없음.
 *
 * 색상 규칙(증감률 기준, 0%를 중심으로 양쪽으로 갈라지는 "diverging" 색상):
 *   - 감소(음수)  : 0%에 가까우면 하늘색 -> 감소폭이 클수록 진한 파란색
 *   - 증가(양수)  : 0%에 가까우면 연분홍색 -> 증가폭이 클수록 진한 분홍색
 *   - 0% 또는 데이터 없음 : 흰색/회색
 * amCharts의 heatRules는 "한쪽 방향" 그라데이션만 지원해서, 여기서는
 * adapter(fill을 직접 계산해서 리턴하는 함수)로 우리가 원하는 diverging 색상을 직접 계산함.
 *
 * 중요: 이 모듈은 "선택 상태"를 최종적으로 관리하는 주체가 아님! 클릭이 발생했다는
 *       사실만 바깥(app.js, 나중엔 1번의 선택 규칙)으로 알려주는 역할까지만 함.
 * -----------------------------------------------------------------
 */

// ------------------------------------------------------------------
// 색상 계산 유틸 (증감률 값 -> am5 Color)
// ------------------------------------------------------------------

// hexA -> hexB 로 t(0~1) 비율만큼 선형보간한 색을 리턴
function lerpColor(hexA, hexB, t) {
  const ar = (hexA >> 16) & 255, ag = (hexA >> 8) & 255, ab = hexA & 255;
  const br = (hexB >> 16) & 255, bg = (hexB >> 8) & 255, bb = hexB & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const b = Math.round(ab + (bb - ab) * t);
  return am5.color((r << 16) | (g << 8) | b);
}

function clamp01(t) {
  return Math.max(0, Math.min(1, t));
}

/**
 * 지도를 그리고, 바깥에서 조작할 수 있는 control 객체를 리턴함.
 *
 * @param {string} containerId - 지도를 그릴 div의 id
 * @param {Object} options
 * @param {Array}  options.regionData - [{ sido, yoyRate, totalUsage, ... }, ...] (보통 특정 연/월 데이터)
 * @param {string} options.metric - 색칠 기준 필드명 (기본값: 'yoyRate' = 전년동월대비 증감률)
 * @param {function} options.onRegionClick - 지역을 "그냥 클릭"했을 때 호출할 콜백(sidoName: string) => void
 * @param {function} options.onRegionDropToSlot - 지역을 지도 밑 "지역 비교" 패널까지 드래그해서
 *        왼쪽 또는 오른쪽 칸에 떨어뜨렸을 때 호출할 콜백(sidoName: string, slot: 'left'|'right') => void
 * @returns {Object} controls - { applyData, setCompareSelection(leftName, rightName), root }
 */
function initRegionMap(containerId, options) {
  const { regionData, metric = 'yoyRate', onRegionClick, onRegionDropToSlot } = options;

  // am5.ready 콜백 밖에서 미리 만들어두고, 안에서 채워 넣음
  const controls = {};

  // 이번 달 데이터의 감소/증가 최대폭 (색상 스케일 계산용, applyData에서 갱신됨)
  // 감소/증가 폭이 서로 다를 수 있어서(비대칭) 각각 따로 스케일링함
  let scaleMinDecrease = 0; // 가장 큰 감소폭 (음수, 예: -12.3)
  let scaleMaxIncrease = 0; // 가장 큰 증가폭 (양수, 예: 8.7)

  function divergingColor(value) {
    if (value == null) return am5.color(0xe0e0e0); // 데이터 없음: 회색
    if (value === 0) return am5.color(0xffffff); // 변화 없음: 흰색

    if (value < 0) {
      // 감소 쪽: 하늘색(0%에 가까움) -> 파란색(감소폭 최대)
      const t = scaleMinDecrease !== 0 ? clamp01(value / scaleMinDecrease) : 0;
      return lerpColor(0xcfe8ff, 0x0b3d91, t);
    }
    // 증가 쪽: 연분홍색(0%에 가까움) -> 진분홍색(증가폭 최대)
    const t = scaleMaxIncrease !== 0 ? clamp01(value / scaleMaxIncrease) : 0;
    return lerpColor(0xffd6e8, 0xd6006d, t);
  }

  am5.ready(function () {
    const root = am5.Root.new(containerId);
    root.setThemes([am5themes_Animated.new(root)]);

    const chart = root.container.children.push(
      am5map.MapChart.new(root, {
        // panX/panY를 'none'으로 꺼둠: 기본값(rotateX)이면 지도 위에서 드래그할 때
        // "지도 전체를 이동(팬)"하는 동작이랑 우리가 만들 "드래그로 2개 지역 비교" 제스처가
        // 서로 충돌해서, 드래그 비교 기능을 쓰려면 지도 자체는 고정해두는 게 맞음
        panX: 'none',
        panY: 'none',
        wheelable: false, // 마우스 휠 확대/축소도 같이 꺼서 조작을 단순하게 유지
        projection: am5map.geoMercator(),
        homeZoomLevel: 1,
      })
    );

    // 혹시 amCharts geodata 버전이 바뀌어서 코드가 안 맞으면 콘솔에 경고 띄움
    validateSidoCodes(am5geodata_southKoreaLow);

    const polygonSeries = chart.series.push(
      am5map.MapPolygonSeries.new(root, {
        geoJSON: am5geodata_southKoreaLow,
        valueField: 'value',
      })
    );

    polygonSeries.mapPolygons.template.setAll({
      tooltipText: "{name}: {value.formatNumber('+#,##0.0|#,##0.0')}%",
      interactive: true,
      strokeWidth: 1,
      stroke: am5.color(0xffffff),
      cursorOverStyle: 'pointer',
    });

    // ---- 색칠: heatRules 대신 adapter로 diverging 색상을 직접 계산해서 적용 ----
    polygonSeries.mapPolygons.template.adapters.add('fill', (fill, target) => {
      const ctx = target.dataItem && target.dataItem.dataContext;
      return ctx ? divergingColor(ctx.value) : fill;
    });

    // 마우스 올렸을 때 스타일
    polygonSeries.mapPolygons.template.states.create('hover', {
      fill: am5.color(0xffb703),
    });

    // 비교 왼쪽/오른쪽으로 선택된 지역의 테두리 색상 상수.
    // fill(색칠)은 데이터 기반 diverging 색을 그대로 유지 (fill adapter가 계속 처리).
    // 테두리만 순위표 왼쪽/오른쪽 셀의 배지 색과 똑같이 맞춰서 굵게 그림.
    //   왼쪽 = 파랑(#1d4ed8, 차가운 색) = 순위표 왼쪽 셀 색상과 매칭
    //   오른쪽 = 분홍(#d6006d, 따뜻한 색) = 순위표 오른쪽 셀 색상과 매칭
    // 이 값들을 실제로 폴리곤에 어떻게 적용하는지는 아래 setCompareSelection 참고.
    const COMPARE_LEFT_STROKE = am5.color(0x1d4ed8);
    const COMPARE_RIGHT_STROKE = am5.color(0xd6006d);
    const DEFAULT_STROKE = am5.color(0xffffff);
    const COMPARE_STROKE_WIDTH = 5;
    const DEFAULT_STROKE_WIDTH = 1;

    // ---- 클릭 이벤트 (제자리에서 누르고 뗀 경우: 단순 클릭) ----
    // 여기서는 상태를 안 바꾸고, 바깥(app.js -> 나중엔 1번 선택 규칙)으로 위임(콜백 호출)만 함
    polygonSeries.mapPolygons.template.events.on('click', (ev) => {
      const code = ev.target.dataItem.get('id');
      const sidoName = SIDO_CODE_TO_NAME[code];

      if (!sidoName) {
        console.warn('[map.js] 매핑되지 않은 지역 코드 클릭됨:', code);
        return;
      }

      if (typeof onRegionClick === 'function') {
        onRegionClick(sidoName);
      } else {
        console.log('[map.js] onRegionClick 콜백이 없어서 아무 동작도 안 함:', sidoName);
      }
    });

    // ---- 드래그 앤 드롭: 지도의 지역을 "지도 하단 지역 비교 패널"까지 끌어다 놓기 ----
    // amCharts 지도(SVG)와 그 밑의 일반 HTML 카드(compare-left-card / compare-right-card)는
    // 서로 다른 영역이라서, amCharts 자체 드래그 기능 대신 document 레벨의
    // pointermove/pointerup으로 직접 좌표를 추적해서 "어디에 떨어뜨렸는지" 판단함.
    let draggingSido = null;
    let dragGhostEl = null;

    // 마우스/손가락을 따라다니는 작은 라벨(고스트)을 만듦
    function createDragGhost(label, x, y) {
      const el = document.createElement('div');
      el.className = 'region-drag-ghost';
      el.textContent = label;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      document.body.appendChild(el);
      return el;
    }

    function onDocPointerMove(e) {
      if (dragGhostEl) {
        dragGhostEl.style.left = `${e.clientX}px`;
        dragGhostEl.style.top = `${e.clientY}px`;
      }

      // 드롭 가능한 칸(왼쪽/오른쪽 카드) 위에 있으면 하이라이트 표시
      document.querySelectorAll('[data-slot]').forEach((el) => el.classList.remove('drag-over'));
      const hoverEl = document.elementFromPoint(e.clientX, e.clientY);
      const zoneEl = hoverEl && hoverEl.closest('[data-slot]');
      if (zoneEl) zoneEl.classList.add('drag-over');
    }

    function onDocPointerUp(e) {
      document.removeEventListener('pointermove', onDocPointerMove);
      document.querySelectorAll('[data-slot]').forEach((el) => el.classList.remove('drag-over'));

      if (dragGhostEl) {
        dragGhostEl.remove();
        dragGhostEl = null;
      }

      // 손을 뗀 지점에 어떤 엘리먼트가 있는지 확인해서, 그게 왼쪽/오른쪽 카드인지 판단
      const dropEl = document.elementFromPoint(e.clientX, e.clientY);
      const zoneEl = dropEl && dropEl.closest('[data-slot]');

      if (zoneEl && draggingSido) {
        const slot = zoneEl.getAttribute('data-slot'); // 'left' 또는 'right'
        if (typeof onRegionDropToSlot === 'function') {
          onRegionDropToSlot(draggingSido, slot);
        } else {
          console.log('[map.js] onRegionDropToSlot 콜백이 없어서 아무 동작도 안 함:', draggingSido, '->', slot);
        }
      }
      // 카드가 아닌 곳(지도 위 다른 지역, 빈 공간 등)에 놓으면 그냥 취소 - 아무 것도 안 바뀜

      draggingSido = null;
    }

    polygonSeries.mapPolygons.template.events.on('pointerdown', (ev) => {
      const code = ev.target.dataItem.get('id');
      const sidoName = SIDO_CODE_TO_NAME[code];
      if (!sidoName) return;

      draggingSido = sidoName;
      const native = ev.originalEvent; // 실제 브라우저 PointerEvent/MouseEvent
      dragGhostEl = createDragGhost(sidoName, native.clientX, native.clientY);

      document.addEventListener('pointermove', onDocPointerMove);
      document.addEventListener('pointerup', onDocPointerUp, { once: true });
    });

    // 시도명 -> 지도 데이터(id, value) 형태로 변환해서 넣어주는 내부 함수
    function applyData(regionDataForMonth, metricKey) {
      const dataForMap = regionDataForMonth
        .map((r) => ({
          id: SIDO_NAME_TO_CODE[r.sido],
          name: r.sido,
          value: r[metricKey],
        }))
        .filter((d) => d.id); // 코드 매칭 안 되는 항목은 방어적으로 제외

      if (dataForMap.length !== regionDataForMonth.length) {
        console.warn('[map.js] 일부 시도명이 코드와 매칭되지 않아 제외됨');
      }

      // 이번 달 값들 중 최대 감소폭 / 최대 증가폭을 구해서 색상 스케일 갱신
      const values = dataForMap.map((d) => d.value).filter((v) => v != null);
      scaleMinDecrease = values.length ? Math.min(0, ...values) : 0;
      scaleMaxIncrease = values.length ? Math.max(0, ...values) : 0;

      // setAll은 매번 데이터를 완전히 새로 그리기 때문에, 그 과정에서
      // fill adapter도 다시 호출돼서 (위에서 갱신한) 새 스케일 기준으로 색이 다시 계산됨
      polygonSeries.data.setAll(dataForMap);

      renderDivergingLegend('mapLegend', scaleMinDecrease, scaleMaxIncrease);
    }

    // 최초 렌더
    applyData(regionData, metric);

    // ---- 바깥에서 쓸 수 있게 controls에 채워넣기 ----
    controls.root = root;
    controls.applyData = applyData;

    // 비교 왼쪽/오른쪽 지역을 지도에서 강조 표시.
    //
    // 이전 시도(실패한 방식): template의 'compareLeft'/'compareRight' state를 만들어서
    //   apply하는 방식. 문제는 amCharts가 hover가 끝나면 자동으로 'default' state를
    //   복원해서, 우리가 걸어둔 굵은 테두리가 마우스 벗어날 때마다 사라짐. setTimeout으로
    //   재적용을 시도해도 amCharts 애니메이션/타이밍과 충돌해서 오른쪽(분홍) 쪽은
    //   특히 자주 사라지는 버그가 남아있었음.
    //
    // 현재 방식(견고함): polygon.setAll()로 base value(stroke, strokeWidth)를 직접
    //   변경 + 그 polygon의 'default' state 자체를 새로 만들어서 우리 값으로 덮어씀.
    //   이렇게 하면 hover가 끝나 amCharts가 default state를 자동 복원해도, 그 default가
    //   이미 우리 굵은 테두리를 담고 있으니 테두리가 유지됨. 재적용 로직/setTimeout 불필요.
    //   fill(색칠)은 건드리지 않으므로 데이터 기반 diverging 색이 그대로 유지됨.
    controls.setCompareSelection = function (leftName, rightName) {
      polygonSeries.mapPolygons.each((polygon) => {
        const code = polygon.dataItem.get('id');
        const name = SIDO_CODE_TO_NAME[code];

        let strokeColor, strokeWidth;
        if (name === leftName) {
          strokeColor = COMPARE_LEFT_STROKE;
          strokeWidth = COMPARE_STROKE_WIDTH;
        } else if (name === rightName) {
          strokeColor = COMPARE_RIGHT_STROKE;
          strokeWidth = COMPARE_STROKE_WIDTH;
        } else {
          strokeColor = DEFAULT_STROKE;
          strokeWidth = DEFAULT_STROKE_WIDTH;
        }

        // (1) 현재 값 즉시 갱신 (지금 화면에 반영)
        polygon.setAll({ stroke: strokeColor, strokeWidth: strokeWidth });
        // (2) 이 polygon의 'default' state를 새로 만들어서 hover 이탈 시에도 이 값으로 돌아가게 함
        polygon.states.create('default', {
          stroke: strokeColor,
          strokeWidth: strokeWidth,
        });
      });
    };
  });

  return controls;
}

/**
 * 지도 밑에 표시할 diverging 색상 범례를 순수 HTML/CSS로 그림.
 * (amCharts 기본 HeatLegend는 단방향 그라데이션이라, 감소->0->증가 형태의
 *  양방향 범례는 직접 그리는 게 더 정확하고 간단함)
 */
function renderDivergingLegend(containerId, minDecrease, maxIncrease) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const minText = minDecrease < 0 ? `${minDecrease.toFixed(1)}%` : '0.0%';
  const maxText = maxIncrease > 0 ? `+${maxIncrease.toFixed(1)}%` : '0.0%';

  el.innerHTML = `
    <div class="diverging-legend">
      <div class="diverging-bar"></div>
      <div class="diverging-labels">
        <span>${minText} (최대 감소)</span>
        <span>0%</span>
        <span>${maxText} (최대 증가)</span>
      </div>
    </div>
  `;
}
