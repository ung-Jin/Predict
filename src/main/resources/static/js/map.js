/**
 * [2번 소유] /static/js/map.js
 * -----------------------------------------------------------------
 * fragments/map.html에서 sido-map-codes.js 다음에 로드됨.
 * 노출 함수: initRegionMap(containerId, options), renderDivergingLegend(...)
 * 사용처: map-app.js가 두 함수를 호출해서 지도/범례 초기화. 지우면 지도 안 그려짐.
 * -----------------------------------------------------------------
 *
 * 시도별 색칠(증감률 기준, % 값이면 뭐든 상관없음 - 어떤 증감률을 넘길지는 호출하는 쪽
 *   (map-app.js)이 결정함. [2026-10-07] 현재는 "8월 예측 증감률"을 넘겨받아 씀 - 처음엔
 *   "전년동월대비(실측) 증감률"이었는데, 예측 대시보드 취지에 안 맞는다는 피드백으로 바뀜.
 *   이 파일(map.js)은 어느 쪽이든 그대로 동작하므로 이 변경에 손댈 필요 없었음.) + 범례 +
 *   2개 지역 비교용 클릭 선택
 * 사용 라이브러리: amCharts 5 (지도 전용) - am5geodata_southKoreaLow 에
 *   17개 시도 좌표가 이미 들어있어서 별도 GeoJSON을 구할 필요가 없음.
 *
 * [2026-09-30] 세종특별자치시 클릭 안 되는 문제 대응: 세종시(2012년 신설)는
 *   amCharts5의 이 저해상도 지도 데이터(am5geodata_southKoreaLow)에 폴리곤이 아예 없음.
 *   [2026-10-06 손 폴리곤 추가 시도 → 되돌림] 정확한 행정구역 GeoJSON이 없어서 손으로
 *   그린 모양으론 대전 침범/크기 어느 쪽도 못 맞춰서 폐기.
 *   [2026-10-06 최종] 세종시 좌표에 투명한 원(마커)을 얹고, 반지름은 줌 레벨에 비례시킴
 *   (처음 줌 4일 때 10px, 최소 6 ~ 최대 36). 아래 "세종특별자치시 보정" 참고.
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
// 색상 계산 유틸 (증감률 값 -> 색)
// ------------------------------------------------------------------

// hexA -> hexB 로 t(0~1) 비율만큼 선형보간한 색을 '#rrggbb' 문자열로 리턴
function lerpHex(hexA, hexB, t) {
  const ar = (hexA >> 16) & 255, ag = (hexA >> 8) & 255, ab = hexA & 255;
  const br = (hexB >> 16) & 255, bg = (hexB >> 8) & 255, bb = hexB & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const b = Math.round(ab + (bb - ab) * t);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function clamp01(t) {
  return Math.max(0, Math.min(1, t));
}

/**
 * 증감률 값 -> diverging 색('#rrggbb' 문자열).
 *
 * [2026-10-06] 원래 initRegionMap 안쪽에만 있던 색 계산을 바깥으로 꺼냄.
 * 이유: 지도 아래 "전국 증감률 분포" 스트립(national-strip.js)도 똑같은 색 규칙을
 * 써야 하는데, 같은 계산을 두 파일에 복사해두면 나중에 색을 바꿀 때 한쪽만 고치는
 * 실수가 생김. 색을 바꾸려면 이 함수 하나만 고치면 지도·세종 마커·분포 스트립이 전부 같이 바뀜.
 *
 * @param {number|null} value              - 증감률(%). null이면 데이터 없음(회색)
 * @param {number} scaleMinDecrease        - 이번 달 최대 감소폭(음수)
 * @param {number} scaleMaxIncrease        - 이번 달 최대 증가폭(양수)
 */
function divergingHex(value, scaleMinDecrease, scaleMaxIncrease) {
  if (value == null) return '#e0e0e0'; // 데이터 없음: 회색
  // [2026-10-07] 변화 없음(0%)을 흰색으로 칠했더니 지도/카드 배경이 다 흰색이라 그 지역만
  // 아예 안 보이는 문제가 있었음 - 옅은 하늘색으로 바꿔서 "변화가 거의 없다"는 느낌은
  // 유지하면서도 눈에 보이게 함. 감소 쪽 그라데이션의 가장 연한 색(#cfe8ff)과 같은 값이라,
  // 음수 쪽에서 0%로 다가갈 때 색이 끊기지 않고 자연스럽게 이어짐.
  if (value === 0) return '#cfe8ff';

  if (value < 0) {
    // 감소 쪽: 하늘색(0%에 가까움) -> 파란색(감소폭 최대)
    const t = scaleMinDecrease !== 0 ? clamp01(value / scaleMinDecrease) : 0;
    return lerpHex(0xcfe8ff, 0x0b3d91, t);
  }
  // 증가 쪽: 연분홍색(0%에 가까움) -> 진분홍색(증가폭 최대)
  const t = scaleMaxIncrease !== 0 ? clamp01(value / scaleMaxIncrease) : 0;
  return lerpHex(0xffd6e8, 0xd6006d, t);
}

/**
 * 지도를 그리고, 바깥에서 조작할 수 있는 control 객체를 리턴함.
 *
 * @param {string} containerId - 지도를 그릴 div의 id
 * @param {Object} options
 * @param {Array}  options.regionData - [{ sido, yoyRate, totalUsage, ... }, ...] (보통 특정 연/월 데이터)
 * @param {string} options.metric - 색칠 기준 필드명 (기본값: 'yoyRate' = 전년동월대비 증감률)
 * @param {function} options.onRegionClick - 지역을 클릭했을 때 호출할 콜백(sidoName: string) => void
 * @returns {Object} controls - { applyData, setCompareSelection(leftName, rightName), root }
 */
function initRegionMap(containerId, options) {
  const { regionData, metric = 'yoyRate', onRegionClick } = options;

  // am5.ready 콜백 밖에서 미리 만들어두고, 안에서 채워 넣음
  const controls = {};

  // 이번 달 데이터의 감소/증가 최대폭 (색상 스케일 계산용, applyData에서 갱신됨)
  // 감소/증가 폭이 서로 다를 수 있어서(비대칭) 각각 따로 스케일링함
  let scaleMinDecrease = 0; // 가장 큰 감소폭 (음수, 예: -12.3)
  let scaleMaxIncrease = 0; // 가장 큰 증가폭 (양수, 예: 8.7)

  // 색 계산 자체는 위의 divergingHex()에 있고, 여기서는 amCharts가 쓰는 색 객체로만 감싸줌
  function divergingColor(value) {
    return am5.color(divergingHex(value, scaleMinDecrease, scaleMaxIncrease));
  }

  // 처음 보여줄 줌 레벨/중심점. 세종시 원 마커 반지름 비례 계산(sejongRadiusForZoom)에서도
  // 기준값으로 쓰기 때문에 상수 하나로 묶어서 어긋나지 않게 함.
  const HOME_ZOOM_LEVEL = 1.5;
  const HOME_GEO_POINT = { longitude: 127.37, latitude: 36.55 }; // 청주-세종 중간쯤

  am5.ready(function () {
    const root = am5.Root.new(containerId);
    root.setThemes([am5themes_Animated.new(root)]);

    // [2026-10-07] 버그 수정: amCharts5는 기본적으로 #mapdiv의 ResizeObserver를 달아두고
    // (root.autoResize = true, 기본값) 컨테이너 크기가 "조금이라도" 바뀔 때마다 줌/투영을
    // 다시 계산함. 그런데 같은 지자체를 반복 클릭하면 그때마다 순위표↔분포스트립 교체,
    // 도넛 재생성(own ResizeObserver 포함) 등으로 페이지 곳곳이 다시 레이아웃되고, 그 여파로
    // #mapdiv 쪽에도 소수점 단위의 미세한 크기 변화가 생길 수 있음 - 실제로 지도 폭이
    // 눈에 보이게 바뀌는 게 아니어도 ResizeObserver는 이 정도 변화에도 반응해서 재투영을
    // 하고, 이게 클릭마다 누적되면서 "미세한 확대 틀어짐" -> (반복되면) "지도가 아예 안
    // 보이는" 현상까지 이어진 것으로 보임.
    // 원인이 된 자동 리사이즈 자체를 끄고, 실제로 지도 크기가 바뀔 수 있는 경우(창 크기
    // 조절)에만 아래에서 직접 resize()를 호출하도록 바꿔서 - 지도 바깥 다른 영역이
    // 아무리 다시 그려져도 지도는 더 이상 반응하지 않게 함.
    root.autoResize = false;

    const chart = root.container.children.push(
      am5map.MapChart.new(root, {
        // 끄는 방향으로 지도가 따라오는, 일반 지도와 같은 드래그 이동
        panX: 'translateX',
        panY: 'translateY',
        wheelable: true, // 마우스 휠로 커서 위치 기준 확대/축소
        projection: am5map.geoMercator(),
        // [2026-10-06] 처음부터 꽤 확대해서 보여줌. 울릉도·제주도는 화면 밖으로 나가도
        // 괜찮다는 결정에 따라 중심을 충청북도(청주 인근) 쪽으로 잡고 줌을 6으로 올림.
        homeZoomLevel: HOME_ZOOM_LEVEL,
        homeGeoPoint: HOME_GEO_POINT,
      })
    );

    // 확대/축소·처음 위치로 되돌리기 버튼 (홈 버튼은 위의 homeZoomLevel/homeGeoPoint로 복귀).
    // [2026-10-07] 이 버튼 묶음이 초기엔 차트 안에서 자기 자리(~38px)를 뺏어서 지도가 좁게
    // 그려지는 문제가 있었는데, 아래 datavalidated 콜백에서 root.resize()를 한 번 호출해주면
    // 레이아웃이 재계산되면서 지도가 박스 전체 폭을 쓰게 됨 (버튼은 여전히 오른쪽 아래
    // 구석에 떠서 지도 위에 겹치는 모양 - 어차피 그 자리엔 울릉도/제주 밖이라 가릴 지역이 없음).
    const zoomControl = chart.set('zoomControl', am5map.ZoomControl.new(root, {}));
    zoomControl.homeButton.set('visible', true);

    // 혹시 amCharts geodata 버전이 바뀌어서 코드가 안 맞으면 콘솔에 경고 띄움
    // (세종시(KR-36)는 이 geodata에 원래 없어서 "못 찾음" 경고가 뜨는 게 정상 -
    //  바로 아래 "세종특별자치시 보정"에서 따로 처리함)
    validateSidoCodes(am5geodata_southKoreaLow);

    const polygonSeries = chart.series.push(
      am5map.MapPolygonSeries.new(root, {
        geoJSON: am5geodata_southKoreaLow,
        valueField: 'value',
      })
    );

    // [2026-10-06] amCharts5는 polygon series에 데이터가 들어오면 "그 지역이 다 보이게"
    // 자동 fit하는데, 이 과정에서 위에 설정한 homeZoomLevel이 덮어씌워져서 숫자를 올려도
    // 지도가 안 커지는 문제가 있음. 그래서 데이터가 들어온 뒤(datavalidated 이벤트) 명시적으로
    // 홈 위치/줌으로 다시 이동시킴. once로 등록해서 첫 로드 때만 실행 (이후 월 변경에
    // 의한 재데이터는 이미 사용자가 움직여둔 뷰를 유지해야 함).
    polygonSeries.events.once('datavalidated', () => {
      chart.zoomToGeoPoint(HOME_GEO_POINT, HOME_ZOOM_LEVEL, true, 0);
    });

    // [2026-10-07] 지도 캔버스가 박스 폭 전체를 못 쓰는 문제 수정:
    // 초기 렌더 시 ZoomControl(확대/축소 버튼)이 chart 내부 레이아웃에서 자기 자리(~38px)를
    // 미리 뺏어가서, 지도 그림이 그만큼 좁게 그려지는 현상이 있었음(사용자 리포트: 왼쪽으로
    // 드래그하면 색깔바 끝보다 훨씬 앞에서 지도가 짤림). 위에서 autoResize를 꺼둬서 자동
    // 재계산이 안 됨. root.resize()를 한 번 호출하면 chart가 다시 측정되면서 캔버스가
    // 박스 폭 전체를 쓰게 되는데, requestAnimationFrame으로는 amCharts의 비동기 draw가
    // 아직 안 끝난 시점이라 효과가 없음 - setTimeout 100ms로 넉넉하게 미뤄서 호출.
    setTimeout(() => root.resize(), 100);

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

      // 세종시는 폴리곤이 아니라 별도 마커(sejongPointSeries)로 표시하므로,
      // 이번 달 값을 찾아서 마커 쪽에도 따로 반영해줌 (매달 색이 새 데이터로 바뀌게).
      const sejongRow = regionDataForMonth.find((r) => r.sido === SEJONG_NAME);
      sejongPointSeries.data.setAll([
        {
          geometry: { type: 'Point', coordinates: SEJONG_LONLAT },
          value: sejongRow ? sejongRow[metricKey] : null,
        },
      ]);

      renderDivergingLegend('mapLegend', scaleMinDecrease, scaleMaxIncrease);
    }

    // ---- 세종특별자치시 보정 (클릭 안 되는 문제 대응) ----
    // 세종시(KR-36)는 geodata에 폴리곤이 없어서 투명한 원(마커)으로 클릭 영역 대신 둠.
    // [2026-10-06] amCharts bullet은 줌을 올려도 화면 픽셀 기준이라 안 커지므로,
    // chart의 'zoomLevel'이 바뀔 때마다 반지름을 직접 비례 계산해서 넣어줌.
    const SEJONG_NAME = '세종특별자치시';
    const SEJONG_LONLAT = [127.2890, 36.4800]; // [경도, 위도] - 세종시청 부근
    const SEJONG_RADIUS_AT_HOME_ZOOM = 10; // HOME_ZOOM_LEVEL(처음 화면)일 때의 반지름(px)
    const SEJONG_MIN_RADIUS = 6;  // 많이 축소해도 클릭이 아예 안 될 정도로 작아지진 않게
    const SEJONG_MAX_RADIUS = 36; // 많이 확대해도 과하게 커지진 않게

    // 현재 줌 레벨 기준으로 세종시 원의 반지름을 계산 (HOME_ZOOM_LEVEL일 때 10px 기준)
    function sejongRadiusForZoom(zoomLevel) {
      const raw = SEJONG_RADIUS_AT_HOME_ZOOM * (zoomLevel / HOME_ZOOM_LEVEL);
      return Math.min(SEJONG_MAX_RADIUS, Math.max(SEJONG_MIN_RADIUS, raw));
    }

    let sejongCircle = null; // setCompareSelection·줌 핸들러에서 반지름/테두리 갱신할 때 쓰려고 참조해둠

    const sejongPointSeries = chart.series.push(am5map.MapPointSeries.new(root, {}));

    sejongPointSeries.bullets.push((root) => {
      const circle = am5.Circle.new(root, {
        radius: sejongRadiusForZoom(chart.get('zoomLevel') || HOME_ZOOM_LEVEL),
        strokeWidth: DEFAULT_STROKE_WIDTH,
        stroke: DEFAULT_STROKE,
        interactive: true,
        cursorOverStyle: 'pointer',
        tooltipText: "세종특별자치시: {value.formatNumber('+#,##0.0|#,##0.0')}%",
        // 평소엔 안 보이게 투명하게 둠 - 지도 위에 이질적인 동그라미가 튀어 보인다는
        // 피드백 반영. 눈에는 안 보여도 도형(원) 자체는 그대로 있어서 그 위치를
        // 클릭하는 건 여전히 됨 - "안 보이는 클릭 영역"이 된 것뿐.
        fillOpacity: 0,
        strokeOpacity: 0,
      });

      // 폴리곤과 완전히 똑같은 diverging 색상 규칙을 그대로 재사용 (마우스 올렸을 때만 드러남)
      circle.adapters.add('fill', (fill, target) => {
        const ctx = target.dataItem && target.dataItem.dataContext;
        return ctx ? divergingColor(ctx.value) : fill;
      });
      // 마우스를 올렸을 때만 살짝 보이게 해서 "여기 세종시 있다"는 힌트만 줌
      circle.states.create('hover', { fillOpacity: 0.6, fill: am5.color(0xffb703) });

      // 폴리곤 클릭과 똑같은 콜백을 그대로 호출 (지역명만 하드코딩해서 넘김)
      circle.events.on('click', () => {
        if (typeof onRegionClick === 'function') onRegionClick(SEJONG_NAME);
      });

      sejongCircle = circle;
      return am5.Bullet.new(root, { sprite: circle });
    });

    // 줌 레벨이 바뀔 때마다(휠로 확대/축소, 홈 버튼, 애니메이션 중에도 계속) 호출됨 ->
    // 그때마다 세종시 원 반지름을 새 줌 기준으로 다시 계산해서 넣어줌.
    chart.on('zoomLevel', (zoomLevel) => {
      if (sejongCircle) {
        sejongCircle.set('radius', sejongRadiusForZoom(zoomLevel));
      }
    });

    // 최초 렌더
    applyData(regionData, metric);

    // ---- 바깥에서 쓸 수 있게 controls에 채워넣기 ----
    controls.root = root;
    controls.applyData = applyData;

    // 비교 왼쪽/오른쪽 지역을 지도에서 강조 표시.
    // 각 polygon의 base value(setAll)와 'default' state를 둘 다 우리 값으로 덮어씀 ->
    // hover 이탈 시 amCharts가 자동 복원하는 default가 이미 우리 테두리를 담고 있어서
    // 테두리가 사라지지 않음. (예전엔 template state 방식으로 했다가 hover 이탈마다
    // 테두리가 벗겨지는 문제가 있어서 이 방식으로 바꿈)
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

      // 세종시는 폴리곤이 아니라 별도 마커(sejongCircle)라서 위 루프에 안 걸림 - 똑같은 규칙을 따로 적용.
      // 평소엔 투명(strokeOpacity:0)해서 안 보이다가, 실제로 비교 지역으로 선택됐을 때만
      // 테두리를 보이게(strokeOpacity:1) 해서 "선택됨" 표시가 나게 함.
      if (sejongCircle) {
        if (leftName === SEJONG_NAME) {
          sejongCircle.setAll({ stroke: COMPARE_LEFT_STROKE, strokeWidth: COMPARE_STROKE_WIDTH, strokeOpacity: 1 });
        } else if (rightName === SEJONG_NAME) {
          sejongCircle.setAll({ stroke: COMPARE_RIGHT_STROKE, strokeWidth: COMPARE_STROKE_WIDTH, strokeOpacity: 1 });
        } else {
          sejongCircle.setAll({ stroke: DEFAULT_STROKE, strokeWidth: DEFAULT_STROKE_WIDTH, strokeOpacity: 0 });
        }
      }
    };

    // autoResize를 꺼둔 대신, 창 크기가 실제로 바뀔 때만 수동으로 재계산하게 함.
    // resize 이벤트는 드래그 중 아주 잦게 발생하므로 디바운스해서 마지막 한 번만 반영.
    let resizeDebounceTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeDebounceTimer);
      resizeDebounceTimer = setTimeout(() => root.resize(), 150);
    });
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
