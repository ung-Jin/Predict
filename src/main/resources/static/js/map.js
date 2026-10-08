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
  // [2026-10-08] 0% 베이스 색 흐름:
  //   흰빛(#F5F7FB, 초기) → 진한 회색(#E3E7EE, 중간값 구분 목적) → 밝은 회색(#EEF1F6, 현재).
  //   #E3E7EE 는 0% 지역이 "낮은 수치" 지역과 거의 같은 톤이라 구분이 안 됐다. 흰색 쪽으로
  //   살짝 끌어올려(0%≈거의 흰) 작은 변화도 lerp 결과가 뚜렷하게 보이도록 함.
  if (value == null) return '#EEF1F6';
  if (value === 0) return '#EEF1F6';

  if (value < 0) {
    // 감소 쪽: 밝은 회색(0%에 가까움) -> 파란색(감소폭 최대)
    const t = scaleMinDecrease !== 0 ? clamp01(value / scaleMinDecrease) : 0;
    return lerpHex(0xEEF1F6, 0x6E99D2, t);
  }
  // 증가 쪽: 밝은 회색(0%에 가까움) -> 살구색(증가폭 최대)
  const t = scaleMaxIncrease !== 0 ? clamp01(value / scaleMaxIncrease) : 0;
  return lerpHex(0xEEF1F6, 0xE68B5F, t);
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

  // 처음 보여줄 줌 레벨/중심점.
  // [2026-10-07] 예전엔 이 두 값을 눈대중으로 잡아서 썼는데, 실제 데이터 범위와 어긋나
  // 지도가 오른쪽으로 치우쳐 보였다(화면 한가운데에 육지 중심보다 서쪽 지점이 와서).
  // 이제는 아래 HOME_BOUNDS 로 "데이터에 맞춰" 자동 fit 하고, 그 결과를 이 두 변수에
  // 다시 넣는다(let 인 이유). 홈 버튼(ZoomControl)은 chart 의 homeZoomLevel/homeGeoPoint
  // 설정을 보므로, 그것도 같은 값으로 맞춰야 "처음 화면 == 홈 버튼 누른 화면"이 된다.
  // HOME_ZOOM_LEVEL 은 세종시 원 마커 반지름 계산(sejongRadiusForZoom)의 기준값이기도 해서
  // 지우면 안 되고, fit 이후의 실제 줌으로 갱신해 줘야 마커 크기가 어긋나지 않는다.
  const HOME_ZOOM_LEVEL = 1.3;
  const HOME_GEO_POINT = { longitude: 127.55, latitude: 36.40 };

  // 처음에 담아 보여줄 지리 범위. geodata 를 직접 계산해서 뽑은 값이다.
  //
  //   전체(울릉도 포함)   가로 5.53 x 세로 5.42도
  //   울릉도 뺌           가로 4.20 x 세로 5.42도  (제주까지 담음, 남단 33.19)
  //   울릉도+제주 뺌      가로 4.20 x 세로 4.50도  (본토 남단 34.11)
  //
  // #mapdiv 는 446x560(비율 0.80)이다. 다만 Mercator 투영이라 "위도 1도"가 화면에서
  // 경도 1도보다 길게(이 위도대에서 약 1.24배) 그려지므로, 위 도수 비율을 그대로
  // 비교하면 안 된다. 실제 화면 비율로 환산하면:
  //   제주 포함  4.20 / (5.42 x 1.24) = 약 0.63  -> 세로가 길어 세로에 맞춰지고 본토가 작아짐
  //   본토만     4.20 / (4.50 x 1.24) = 약 0.75  -> 0.80 에 가까워 상자를 꽉 채움
  // 그래서 본토 기준으로 잡는다.
  //
  // 빠지는 두 섬은 "폴리곤이 사라지는" 게 아니라 "처음 보이는 범위"에서만 벗어난다
  // (휠로 축소하거나 드래그하면 보이고, 지역비교 드롭다운으로는 그대로 선택된다):
  //   - 울릉도: 경상북도(KR-47)의 ring 0, 경도 130.79~130.92  -> right 129.58 로 잘림
  //   - 제주:   북단 위도 33.57                               -> bottom 34.11 로 잘림
  // 제주까지 처음부터 보이게 하려면 bottom 을 33.19 로 바꾸면 된다 (대신 본토가 작아짐).
  // [2026-10-07] zoomToGeoBounds() 는 쓰지 않는다.
  // 이 amCharts 빌드에서는 어떤 bounds 를 넣어도 zoomLevel 이 0 이 되어 지도가 아예 안 그려졌다
  // (키 순서를 바꿔도, geoBounds() 형식을 그대로 넣어도 동일). 그래서 중심점 + 줌 방식을 쓴다.
  //
  // 값은 실제 화면을 보면서 맞췄다.
  //   경도 127.55 : 본토 경도 범위(125.4~129.6)의 가운데쯤. 예전 127.37 은 서쪽으로 치우쳐
  //                 있어서 육지가 화면 오른쪽으로 밀려 보였다 - 그래서 조금 동쪽으로 옮김.
  //   위도 36.40  : 본토 중심.
  //   줌   1.3    : 본토가 상자를 꽉 채운다. 1.5 면 좌우가 잘려서 라벨(인천/부산 등)이
  //                 화면 밖으로 밀린다. 제주/울릉은 화면 밖으로 나가지만
  //                 (휠로 축소하거나 지역비교 드롭다운으로는 그대로 선택된다) 속도를 택했다.
  //
  // 제주까지 담으려면 줌을 1.2 로, 위도를 35.6 으로 내리면 되는데, 그러면 홈 위치를
  // 데이터 도착 전에 미리 잡아야 구도가 유지돼서 지도 첫 렌더가 1초 더 늦어진다(실측).

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
    // HOME_BOUNDS 범위로 지도를 맞추고, 그 결과를 "홈 버튼이 돌아올 자리"로도 저장한다.
    //
    // 순서가 중요하다: 아래 root.resize() 가 캔버스 크기를 다시 재면 줌이 또 바뀌므로,
    // resize 가 끝난 뒤에 fit 하고 그 값을 캡처해야 한다. 반대로 하면 "처음 화면"보다
    // 홈 버튼이 더 축소된 화면으로 돌아간다(실제로 그랬다).
    // 처음 화면을 HOME_GEO_POINT / HOME_ZOOM_LEVEL 자리로 맞춘다.
    //
    // chart 생성 시 homeZoomLevel/homeGeoPoint 에 같은 값을 넣어뒀으므로
    // "처음 화면 == 홈 버튼(집 아이콘) 누른 화면" 이 된다.
    function applyHomeView() {
      chart.zoomToGeoPoint(HOME_GEO_POINT, HOME_ZOOM_LEVEL, true, 0);
    }

    // ---- 시도 이름 라벨 ----
    // [2026-10-07] amCharts5 는 폴리곤에 라벨을 직접 못 붙인다. 아래 세종시 마커
    // (sejongPointSeries)와 같은 방식으로, 각 시도 중심에 점을 찍고 그 자리에 글자를 그린다.
    //
    // 좌표는 polygon.visualCentroid() 를 쓴다. MultiPolygon 이어도 "가장 큰 도형" 기준이라
    // 섬이 아니라 본토에 찍힌다 (전남처럼 섬이 35개여도 라벨은 육지 한가운데).
    // 글자는 지도 색 위에 올라가므로 흰 테두리(stroke)를 둘러 어떤 색 위에서도 읽히게 한다.
    const labelSeries = chart.series.push(am5map.MapPointSeries.new(root, {}));

    // 광역시/특별시는 도형이 작아 라벨끼리 겹치기 쉬우므로 한 단계 작게 그린다.
    const SMALL_LABEL_CODES = ['KR-11', 'KR-26', 'KR-27', 'KR-28', 'KR-29', 'KR-30', 'KR-31', 'KR-36'];

    // 라벨 위치 미세 조정 (px). 중심(visualCentroid)에 그대로 찍으면 겹치는 곳만 손본다.
    //   경기: 도형 한가운데가 서울과 거의 같은 자리라 서울 라벨과 겹친다 -> 우측 아래로 비킴
    const LABEL_OFFSET = {
      'KR-41': { dx: 16, dy: 14 },   // 경기
    };

    // [2026-10-08] 선택된 지역은 "캡슐 라벨"로 표시한다. 테두리로만 표시하던 예전 방식은
    // 섬 많은 지역(전남 35개)의 모든 섬에 테두리가 그려져 지저분했는데, 라벨에 색 배경을
    // 깔면 지도 fill 과 분리되어 깔끔하다. 안 선택된 라벨은 기존 모습(흰 테두리 + 어두운 글자).
    // [2026-10-08] 원본과 똑같은 arrow function 형태. 함수형 분기(if 블록) 로 바꾸니
    // amCharts 가 bullets 콜백을 아예 호출하지 않는 현상이 있어서, 분기는 inline
    // ternary 로만 처리하고 Label 생성 후 setAll 로 bullets 가 실제로 반영되는 패턴을 유지.
    //
    // 캡슐(선택 지역 강조)은 아래 fillRegionLabels 가 data 를 넣고 "렌더 완료 후" 에
    // labelSeries.bullets 를 돌면서 sprite.set('background', ...) 로 입히는 방식으로 처리.
    labelSeries.bullets.push((root, series, dataItem) =>
      am5.Bullet.new(root, {
        sprite: am5.Label.new(root, {
          text: '{name}',
          populateText: true,
          centerX: am5.p50,
          centerY: am5.p50,
          fontSize: dataItem && dataItem.dataContext && dataItem.dataContext.small ? 9.5 : 12,
          dx: (dataItem && dataItem.dataContext && dataItem.dataContext.dx) || 0,
          dy: (dataItem && dataItem.dataContext && dataItem.dataContext.dy) || 0,
          fontWeight: '700',
          fill: am5.color(0x2A3654),   // common.css --ink
          stroke: am5.color(0xffffff), // 색칠된 지역 위에서도 읽히도록 흰 테두리
          strokeWidth: 3,
          strokeOpacity: 0.85,
          // 글자가 클릭을 가로채면 그 지역을 못 고르게 되므로 통과시킨다
          interactive: false,
        }),
      })
    );

    // 선택된 라벨에 캡슐(색 배경 + 흰 글자) 입히기 / 벗기기.
    // bullets 콜백은 "데이터가 들어온 뒤" 에만 생성되므로, 반드시 data.setAll() 호출
    // 다음 프레임에 실행해야 한다 (아래 fillRegionLabels 가 setTimeout 으로 호출).
    function applyCapsuleStyles() {
      labelSeries.dataItems.forEach((di) => {
        const bullets = di.bullets;
        if (!bullets || bullets.length === 0) return;
        const sprite = bullets[0].get('sprite');
        if (!sprite) return;
        const sel = di.dataContext && di.dataContext.selected;
        const isSelected = sel === 'left' || sel === 'right';
        if (isSelected) {
          // [2026-10-08 재설계] A/B 색 배경은 지도 색과 섞여 헷갈려서,
          // "흰 배경 + A/B 색 테두리 + 진한 남색 글자" 캡슐로 변경.
          // [2026-10-08 추가] 선택 테두리(섬 포함) 제거 후, 캡슐에 미세 drop-shadow 로
          //   "떠오름" 느낌만 더해서 선택 상태를 식별 가능하게 함.
          sprite.setAll({
            fill: am5.color(0x2A3654),      // --ink 진한 남색 글자
            strokeOpacity: 0,                // 글자 외곽선 끔 (배경이 글자를 받쳐주므로 필요 없음)
            paddingTop: 2, paddingBottom: 2, paddingLeft: 8, paddingRight: 8,
            background: am5.RoundedRectangle.new(sprite.root, {
              fill: am5.color(0xffffff),
              fillOpacity: 0.9,              // 85~90% - 뒤 지도 색이 살짝 비치게
              // [2026-10-08] A/B 색을 쓰면 지도 fill 과 겹쳐 헷갈림. 연한 회색 하나로 통일.
              // A/B 구분은 드롭다운·칩·비교표에서만. 캡슐은 "선택됐다"는 사실만 보여준다.
              stroke: am5.color(0xD8DEE8),
              strokeWidth: 1.5,
              cornerRadiusTL: 999, cornerRadiusTR: 999,
              cornerRadiusBL: 999, cornerRadiusBR: 999,
              // 미세 그림자: 선택된 캡슐이 "살짝 떠있다"는 느낌만 전달
              shadowColor: am5.color(0x000000),
              shadowBlur: 4,
              shadowOffsetX: 0,
              shadowOffsetY: 1,
              shadowOpacity: 0.18,
            }),
          });
        } else {
          // 선택 해제 시 기본 스타일 복원
          sprite.setAll({
            fill: am5.color(0x2A3654),
            strokeOpacity: 0.85,
            paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0,
            background: undefined,
          });
        }
      });
    }

    // [2026-10-08] 라벨 캡슐을 그리는 데 쓰는 "현재 선택" 상태. setCompareSelection 이 갱신.
    let selectedLeftName = null;
    let selectedRightName = null;

    // 폴리곤이 다 만들어진 뒤에야 visualCentroid() 가 값을 준다 -> datavalidated 에서 채운다.
    function fillRegionLabels() {
      const points = [];
      polygonSeries.mapPolygons.each((polygon) => {
        const code = polygon.dataItem && polygon.dataItem.get('id');
        const short = SIDO_CODE_TO_SHORT[code];
        if (!short) return;
        const c = polygon.visualCentroid();
        if (!c) return;
        const offset = LABEL_OFFSET[code] || {};
        const regionName = SIDO_CODE_TO_NAME[code];
        points.push({
          geometry: { type: 'Point', coordinates: [c.longitude, c.latitude] },
          name: short,
          small: SMALL_LABEL_CODES.includes(code),
          dx: offset.dx || 0,
          dy: offset.dy || 0,
          selected: regionName === selectedLeftName ? 'left'
                  : regionName === selectedRightName ? 'right'
                  : null,
        });
      });

      // 세종시는 geodata 에 폴리곤이 없어서 위 순회에 안 걸린다 (별도 원 마커로 그리는 중).
      // 라벨만 따로 같은 좌표에 찍어준다.
      points.push({
        geometry: { type: 'Point', coordinates: SEJONG_LONLAT },
        name: SIDO_CODE_TO_SHORT['KR-36'],
        small: true,
        selected: SEJONG_NAME === selectedLeftName ? 'left'
                : SEJONG_NAME === selectedRightName ? 'right'
                : null,
      });

      // 선택된 라벨을 배열 마지막으로 옮긴다. amCharts 는 데이터 순서대로 그리므로
      // 뒤에 있는 라벨이 위에 그려져 다른 라벨과 겹칠 때도 가려지지 않는다.
      points.sort((a, b) => (a.selected ? 1 : 0) - (b.selected ? 1 : 0));

      labelSeries.data.setAll(points);
      // bullets 는 setAll 직후가 아니라 "그 다음 프레임" 에 만들어진다 (amCharts 내부 비동기).
      // 그래서 캡슐 스타일은 한 틱 미뤄서 입힌다.
      setTimeout(applyCapsuleStyles, 0);
    }

    // [2026-10-06] amCharts5는 polygon series에 데이터가 들어오면 "그 지역이 다 보이게"
    // 자동 fit 하면서 우리가 맞춰둔 화면을 덮어쓴다. 데이터는 비동기로(map-app.js의 fetch)
    // 들어오므로 아래 resize 타이머(100ms)보다 늦을 수 있다. 그래서 데이터가 들어온 뒤에도
    // 한 번 더 홈 범위를 맞춰준다. once 라서 첫 로드 때만 - 이후 월 변경으로 데이터가
    // 다시 들어올 때는 사용자가 움직여둔 뷰를 유지해야 하므로 건드리지 않는다.
    // [2026-10-07] 여기서 applyHomeView() 를 미리 부르지 않는다.
    // 데이터가 오기 전에 zoomToGeoPoint 를 호출하면 투영을 두 번 하게 되어
    // 지도가 처음 그려지는 시점이 1초 가까이 밀린다(원본 1초 -> 2초, 실측).
    // 홈 위치는 아래 datavalidated 에서 한 번만 잡는다 - 원본도 같은 방식이었다.

    // 사용자가 직접 지도를 움직였는지. 움직인 뒤에는 홈 위치를 억지로 되돌리지 않는다
    // (홈 버튼은 chart 의 homeGeoPoint/homeZoomLevel 로 따로 동작하므로 영향 없음).
    let userMovedMap = false;
    chart.events.on('panended', () => { userMovedMap = true; });
    chart.events.on('wheelended', () => { userMovedMap = true; });

    // once 가 아니라 on 인 이유:
    // map-app.js 가 시작할 때 데이터를 한 번만 넣지 않는다(콘솔에 "데이터 로드 완료"가 여러 번
    // 찍힌다). amCharts 는 데이터가 들어올 때마다 "그 지역이 다 보이게" 자동 fit 해서 우리가
    // 맞춰둔 화면을 덮어쓰는데, once 로 걸면 첫 번째 데이터에만 반응하고 그 뒤 fit 에 밀린다.
    // 그래서 매번 다시 맞추되, 사용자가 손댄 뒤에는(userMovedMap) 건드리지 않는다.
    let labelsFilled = false;
    let homeViewTimer = null;

    polygonSeries.events.on('datavalidated', () => {
      if (userMovedMap) return;

      // 디바운스로 "데이터가 다 들어온 뒤 한 번만" 처리한다.
      // 데이터가 비동기로 여러 번 들어오는데, 그때마다 amCharts 가 자동 fit 하므로
      // 중간에 끼어들면 뒤따라오는 fit 에 밀린다.
      clearTimeout(homeViewTimer);
      homeViewTimer = setTimeout(() => {
        // 순서 중요: 라벨을 먼저 채우고 그다음에 위치를 잡는다.
        // labelSeries.data.setAll() 자체가 재배치를 유발해서, 반대로 하면
        // 라벨이 유발한 fit 이 우리가 맞춘 위치를 덮어쓴다.
        if (!labelsFilled) {
          fillRegionLabels();
          labelsFilled = true;
        }
        // [2026-10-07] 여기서 applyHomeView() 를 부르지 않는다.
        // 지도는 1초쯤에 amCharts 자동 fit 으로 먼저 그려지는데, 그 뒤에 줌을 바꾸면
        // 화면이 툭 순간이동한다. 처음 그려진 게 곧 최종 화면이 되도록 그냥 둔다.
        // (홈 버튼은 chart 의 homeGeoPoint/homeZoomLevel 로 따로 동작하므로,
        //  누르면 아래 상수로 맞춰둔 구도로 간다)
      }, 400);
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

    // [2026-10-08] hover 효과를 "색 변경" → "살짝 떠오름(scale)"으로 교체.
    // 지역 fill 은 데이터 기반 색이므로 바꾸지 않음. tooltipText 도 제거.
    // [2026-10-08] hover 효과: 색/명도 변경 없이 scale 1.01 + 아주 약한 drop-shadow 로만 표현.
    polygonSeries.mapPolygons.template.states.create('hover', {
      scale: 1.01,
      shadowColor: am5.color(0x000000),
      shadowBlur: 3,
      shadowOffsetX: 0,
      shadowOffsetY: 1,
      shadowOpacity: 0.12,
    });

    // 모든 지역 공통 베이스 테두리 (지역간 경계선 역할).
    // [2026-10-08] 선택 시의 비교색 테두리(파랑/살구) 로직은 제거함 - geodata 가
    //   MultiPolygon(전남은 섬까지 35개 도형)이라 "모든 섬에 각각" 그려지는 문제가 있었고,
    //   선택 표시는 라벨 캡슐(흰 배경 + 그림자)이 전담하게 되어 테두리는 더 이상 선택
    //   상태를 표현할 필요가 없어졌다. 세종시 원 bullets 생성에서 DEFAULT_STROKE_WIDTH 를
    //   사용하므로 상수는 유지.
    const DEFAULT_STROKE = am5.color(0xffffff);
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
        // 평소엔 안 보이게 투명하게 둠 - 지도 위에 이질적인 동그라미가 튀어 보인다는
        // 피드백 반영. 눈에는 안 보여도 도형(원) 자체는 그대로 있어서 그 위치를
        // 클릭하는 건 여전히 됨 - "안 보이는 클릭 영역"이 된 것뿐.
        // [2026-10-08] tooltipText 제거(지도 전체 툴팁 제거 방침과 통일).
        // 세종시 식별은 상단 캡슐 라벨로 처리됨.
        fillOpacity: 0,
        strokeOpacity: 0,
      });

      // 폴리곤과 완전히 똑같은 diverging 색상 규칙을 그대로 재사용 (마우스 올렸을 때만 드러남)
      circle.adapters.add('fill', (fill, target) => {
        const ctx = target.dataItem && target.dataItem.dataContext;
        return ctx ? divergingColor(ctx.value) : fill;
      });

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

    // [2026-10-08] 비교 선택 표시는 라벨 캡슐(흰 배경 + 미세 drop-shadow)만 담당.
    // 지도 폴리곤 fill 과 stroke 는 데이터 기반/베이스 상태 그대로 유지해서 색상 구분이
    // 흐려지지 않게 한다. 세종시 원도 평소 투명 상태 그대로 두고, 선택 식별은 캡슐로만.
    controls.setCompareSelection = function (leftName, rightName) {
      // 라벨 캡슐에도 반영하려고 전역 변수를 갱신 (아래 fillRegionLabels 호출이 읽음)
      selectedLeftName = leftName || null;
      selectedRightName = rightName || null;

      // 라벨 캡슐만 다시 입힌다.
      // selected 필드는 dataItem 에 그대로 남아 있어서 fillRegionLabels (data.setAll) 를
      // 다시 부를 필요가 없다 - 한번 더 setAll 하면 bullets 가 전부 재생성돼 깜빡인다.
      // 대신 selected 를 아래에서 dataContext 에 직접 꽂고 applyCapsuleStyles 로 반영.
      labelSeries.dataItems.forEach((di) => {
        const ctx = di.dataContext;
        if (!ctx) return;
        const regionName =
          ctx.name === SIDO_CODE_TO_SHORT['KR-36'] ? SEJONG_NAME
          : Object.keys(SIDO_CODE_TO_SHORT).find((c) => SIDO_CODE_TO_SHORT[c] === ctx.name);
        // 위에서 regionName 은 "KR-XX" 코드가 나올 수 있으니 한글 시도명으로 변환
        const fullName = regionName && regionName.startsWith('KR-')
          ? SIDO_CODE_TO_NAME[regionName]
          : regionName;
        ctx.selected = fullName === leftName ? 'left'
                     : fullName === rightName ? 'right'
                     : null;
      });
      applyCapsuleStyles();
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
