/* =============================================================================
 * [4번 소유] 상세 데이터 페이지의 좌측(표 + 필터 + 모달) 동작.
 *
 * 책임 범위
 *   1) 좌측 "지역별 상세" 표 (/detail-api/table 호출 후 그리기)
 *   2) 상단 필터 바의 지역 chip + 드롭다운 모달
 *   3) sessionStorage(selectedRegionA/B) 로 선택 상태 저장 (팀 규약)
 *      + 선택이 바뀔 때마다 'region:selected' 커스텀 이벤트를 dispatch
 *        → 우측 차트(detail-charts.js, 1번 팀원 소유)는 이 이벤트를 듣고 알아서 갱신한다.
 *
 * 범위 밖 (손대지 않음)
 *   - 우측 차트 3종(detail_charts.html / detail-charts.js / detail-charts.css)
 *
 * 쓰인 기술
 *   - axios          : 비동기 통신(fetch 대신). 404/500 자동 throw, params 자동 조립.
 *   - sessionStorage : 지도(2번)/대시보드(3번)와 같은 키를 써서 선택 상태 공유.
 *   - CustomEvent    : 같은 페이지 안의 다른 스크립트와 느슨하게 연결.
 *
 * 참고
 *   - 함수와 변수 이름 앞에 'detail' 을 붙여 다른 파일(dashboard.js 등)과 겹치지 않게 함.
 *   - 코드 흐름: HTML이 다 그려지면(DOMContentLoaded) startDetailPage() 가 호출된다
 *     → 이벤트 바인딩 → 표 데이터 로드 → 표 그리기.
 * ========================================================================== */


// ===================================================================
// 1. 설정 상수 (코드 처음 읽으시는 분은 여기부터)
// ===================================================================

// 지도(2번)·대시보드(3번)와 똑같은 키를 쓴다 ("규약").
// 다른 페이지가 선택을 바꾸면 여기서도 같은 값을 읽고,
// 여기서 선택을 바꾸면 다른 페이지에서도 같은 값을 읽는다.
const DETAIL_KEY_A = 'selectedRegionA';
const DETAIL_KEY_B = 'selectedRegionB';

// 좌측 표가 데이터를 받아오는 서버 주소. Spring 의 DetailApiController 와 연결.
const DETAIL_API_TABLE = '/detail-api/table';


// ===================================================================
// 2. 전역 상태 (화면 전체에서 공유하는 변수)
// ===================================================================

// /detail-api/table 응답을 통째로 저장해두는 캐시. 17개 시도 데이터가 들어감.
// 지역 선택이 바뀌어도 이 값은 안 바뀌고(=서버 재호출 X), 하이라이트만 다시 그린다.
let detailTableRows = [];


// ===================================================================
// 3. 선택 상태 입출력 (sessionStorage + 커스텀 이벤트)
// ===================================================================

/**
 * 현재 선택된 A, B 지역을 sessionStorage 에서 읽어 객체로 반환.
 * 값이 없으면 null.
 */
function getSelection() {
  // sessionStorage.getItem() 은 값이 없으면 null 을 반환하는데,
  // 혹시 모를 "null" 문자열 저장 사고를 막기 위해 || null 로 한번 더 걸러준다.
  return {
    a: sessionStorage.getItem(DETAIL_KEY_A) || null,
    b: sessionStorage.getItem(DETAIL_KEY_B) || null,
  };
}

/**
 * A, B 를 바꾸고 저장 + 알림 발행.
 * 지역을 새로 고를 때, 지울 때, 교체할 때 모두 이 함수를 거친다 (저장과 이벤트를 한 곳에서 처리).
 *
 * @param {string|null} nextA  새 A 지역 이름 (ex. '서울특별시'). null 이면 해제.
 * @param {string|null} nextB  새 B 지역 이름. null 이면 해제.
 */
function setSelection(nextA, nextB) {
  // --- (1) sessionStorage 에 저장 ---
  // nextA 가 null 이면 setItem 대신 removeItem 으로 아예 키를 삭제한다.
  // (setItem(key, null) 하면 "null" 이라는 문자열이 저장되는 함정이 있음)
  if (nextA) {
    sessionStorage.setItem(DETAIL_KEY_A, nextA);
  } else {
    sessionStorage.removeItem(DETAIL_KEY_A);
  }
  if (nextB) {
    sessionStorage.setItem(DETAIL_KEY_B, nextB);
  } else {
    sessionStorage.removeItem(DETAIL_KEY_B);
  }

  // --- (2) "지역이 바뀌었어!" 알림 발사 ---
  // document 에 커스텀 이벤트를 쏘면 같은 페이지의 모든 리스너가 받는다.
  //   - 이 파일의 onSelectionChanged() 가 받아서 표/칩/모달 갱신
  //   - 1번 팀원의 detail-charts.js 도 같은 이벤트를 들어서 차트 갱신
  const event = new CustomEvent('region:selected', {
    detail: { a: nextA, b: nextB }
  });
  document.dispatchEvent(event);
}

/**
 * 지역 하나를 토글(체크 ↔ 해제).
 *
 * 규칙:
 *   - 이미 A 라면 → A 해제 (B 가 있으면 B 가 A 자리로 올라옴)
 *   - 이미 B 라면 → B 해제
 *   - A 자리가 비었으면 → A 자리에 추가
 *   - A 는 있고 B 가 비었으면 → B 자리에 추가
 *   - 둘 다 꽉 찼으면 → 기존 A 가 밀려나고, 기존 B 가 A 자리로, 새 지역이 B 자리로
 */
function toggleRegion(regionName) {
  const sel = getSelection();  // { a, b } 객체를 받음
  const a = sel.a;
  const b = sel.b;

  if (a === regionName) {
    setSelection(b, null);     // A 를 다시 눌러서 해제
    return;
  }
  if (b === regionName) {
    setSelection(a, null);     // B 를 다시 눌러서 해제
    return;
  }
  if (!a) {
    setSelection(regionName, b);  // A 자리가 비었으니 A 로
    return;
  }
  if (!b) {
    setSelection(a, regionName);  // B 자리가 비었으니 B 로
    return;
  }
  // 둘 다 꽉 참: 기존 A 를 버리고, 기존 B 를 A 로, 새 지역을 B 로
  setSelection(b, regionName);
}


// ===================================================================
// 4. 상단 필터 바의 지역 chip 그리기
// ===================================================================

/**
 * 상단 필터의 "지역" 자리에 선택된 지역을 chip 형태로 그린다.
 * 선택 상태에 따라 보여주는 모양이 세 가지.
 */
function renderFilterChips() {
  const { a, b } = getSelection();           // 구조 분해: const a = sel.a; const b = sel.b; 와 같음
  const chipsBox = document.getElementById('dfSelectedChips');
  if (!chipsBox) return;                     // 혹시 HTML 이 아직 안 그려졌으면 그냥 끝냄

  chipsBox.innerHTML = '';                    // 기존 내용 비우기

  // --- 경우 1: 선택이 하나도 없음 → "전국 (지역을 선택하세요)" 플레이스홀더 ---
  if (!a && !b) {
    const placeholder = document.createElement('span');
    placeholder.className = 'df-chip-empty';
    placeholder.textContent = '전국 (지역을 선택하세요)';
    chipsBox.appendChild(placeholder);
    return;
  }

  // --- 경우 2, 3: 1개 또는 2개 선택 → chip 그리기 ---
  // [a, b].filter(Boolean) : null 인 자리를 제거하고 실제 선택된 것만 남긴다.
  // forEach 의 두 번째 인자 idx 는 반복 횟수 번호 (0부터).
  [a, b].filter(Boolean).forEach(function (name, idx) {
    const letter = idx === 0 ? 'A' : 'B';
    const chip = document.createElement('span');
    chip.className = idx === 0 ? 'df-chip df-chip-a' : 'df-chip df-chip-b';

    // chip 안쪽: 색점 + 이름 + × 닫기 버튼
    chip.innerHTML =
      '<span class="df-chip-dot"></span>' +
      letter + ' ' + name +
      '<button type="button" class="df-chip-x" aria-label="해제">×</button>';

    // × 버튼 클릭 → 해당 chip 하나만 제거
    const closeBtn = chip.querySelector('.df-chip-x');
    closeBtn.addEventListener('click', function (e) {
      e.stopPropagation();  // chip 자체 클릭(모달 열기) 이벤트가 터지지 않게 막기
      const current = getSelection();
      if (idx === 0) {
        setSelection(current.b, null);  // A 지우면 B 가 A 자리로
      } else {
        setSelection(current.a, null);
      }
    });

    chipsBox.appendChild(chip);
  });

  // --- 1개만 선택된 상태에선 "+ 비교 지역 추가" 안내 추가 ---
  if ((a && !b) || (!a && b)) {
    const addLabel = document.createElement('span');
    addLabel.className = 'df-add-more';
    addLabel.textContent = '+ 비교 지역 추가';
    chipsBox.appendChild(addLabel);
  }
}


// ===================================================================
// 5. 지역 선택 모달
// ===================================================================

/** 모달 열기 (지역 선택 트리거 바로 아래에 띄움) */
function openRegionModal() {
  const modal = document.getElementById('dfRegionModal');
  const panel = modal.querySelector('.df-modal-panel');
  const trigger = document.getElementById('dfRegionTrigger');

  // 트리거의 화면상 위치를 재서 패널을 그 바로 아래에 놓는다.
  // Math.min(..., rect.left) 로 화면 밖으로 나가는 걸 막는다.
  const rect = trigger.getBoundingClientRect();
  panel.style.left = Math.min(window.innerWidth - 400, rect.left) + 'px';
  panel.style.top = (rect.bottom + 6) + 'px';

  modal.hidden = false;      // 모달 보이기

  renderRegionList('');       // 리스트 그리기 (검색어 없이)

  // 검색창에 자동 포커스. setTimeout(0) 은 DOM이 업데이트된 다음 tick 에 실행.
  const search = document.getElementById('dfRegionSearch');
  search.value = '';
  setTimeout(function () { search.focus(); }, 0);
}

/** 모달 닫기 */
function closeRegionModal() {
  document.getElementById('dfRegionModal').hidden = true;
}

/**
 * 모달 안의 지역 리스트를 그린다.
 * @param {string} filterText 검색어 (비어 있으면 전체)
 */
function renderRegionList(filterText) {
  const list = document.getElementById('dfRegionList');
  if (!list || detailTableRows.length === 0) return;

  const { a, b } = getSelection();

  // 원본 배열을 건드리지 않도록 사본을 뜨고([...]), 가나다 순으로 정렬
  const sorted = [...detailTableRows].sort(function (x, y) {
    return x.regionName.localeCompare(y.regionName, 'ko');
  });

  // 검색어가 있으면 이름에 포함된 항목만 남긴다
  const query = (filterText || '').trim();
  let filtered;
  if (query) {
    filtered = sorted.filter(function (r) {
      return r.regionName.includes(query) || r.shortName.includes(query);
    });
  } else {
    filtered = sorted;
  }

  list.innerHTML = '';
  filtered.forEach(function (row) {
    // 이 지역이 현재 A 인지, B 인지, 선택 안 됐는지 판별
    // indexOf 는 배열에서 값의 위치를 찾는 함수. 없으면 -1.
    const idx = [a, b].indexOf(row.regionName);
    const isSelected = idx >= 0;
    let letter = null;
    if (idx === 0) letter = 'A';
    else if (idx === 1) letter = 'B';

    const li = document.createElement('li');
    li.className = 'df-modal-item';

    // 체크박스 클래스: 상태에 따라 색 다르게
    let checkCls = 'df-modal-check';
    if (idx === 0) checkCls += ' on-a';
    else if (idx === 1) checkCls += ' on-b';

    // 체크 SVG 는 선택된 경우에만 보여줌
    let checkSvg = '';
    if (isSelected) {
      checkSvg =
        '<svg width="9" height="9" viewBox="0 0 12 12">' +
        '<path d="M2 6l3 3 5-5" fill="none" stroke="#fff" stroke-width="2"' +
        ' stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }

    // A/B 뱃지도 선택된 경우에만
    let badge = '';
    if (letter) {
      const badgeCls = letter === 'A' ? 'df-badge df-badge-a' : 'df-badge df-badge-b';
      badge = '<span class="' + badgeCls + '">' + letter + '</span>';
    }

    li.innerHTML =
      '<span class="' + checkCls + '">' + checkSvg + '</span>' +
      '<span class="df-modal-name">' + row.regionName + '</span>' +
      badge;

    // 항목 클릭 → 토글 후 리스트 다시 그리기
    li.addEventListener('click', function () {
      toggleRegion(row.regionName);
      renderRegionList(document.getElementById('dfRegionSearch').value);
    });
    list.appendChild(li);
  });
}


// ===================================================================
// 6. 좌측 "지역별 상세" 표 그리기
//    - renderTable(): 전체 흐름
//    - makeRow(): 한 줄(<tr>) 조립
//    - make___Cell(): 각 셀 하나씩 조립 (셀마다 함수 하나)
// ===================================================================

/**
 * 표의 본문(tbody)을 다시 그린다.
 * - detailTableRows (전역) 에 있는 데이터로 17개 행을 만든다.
 * - 선택 하이라이트는 getSelection() 결과를 보고 결정.
 */
function renderTable() {
  const tbody = document.getElementById('dtTbody');
  if (!tbody) return;

  // 데이터가 없으면 안내 문구만 하나 띄우고 종료
  if (detailTableRows.length === 0) {
    tbody.innerHTML = '<tr class="dt-empty"><td colspan="6">데이터가 없습니다.</td></tr>';
    return;
  }

  const { a, b } = getSelection();

  // 스파크바/MAPE 바의 길이를 비례로 계산하려면 "최댓값"이 필요.
  // 반복문으로 최댓값 구하기 (스프레드 연산자 대신 평범한 for 문)
  let maxFc = 0;
  let maxMape = 1;   // 0 으로 두면 나중에 0으로 나눌 수 있어서 1부터 시작
  for (let i = 0; i < detailTableRows.length; i++) {
    const r = detailTableRows[i];
    if (r.predictedGwh && r.predictedGwh > maxFc) maxFc = r.predictedGwh;
    if (r.mape && r.mape > maxMape) maxMape = r.mape;
  }

  // 각 행의 HTML 조각을 모아서 한 번에 tbody 에 넣음.
  // (한 줄씩 appendChild 하는 것보다 훨씬 빠름)
  let htmlAll = '';
  for (let i = 0; i < detailTableRows.length; i++) {
    const row = detailTableRows[i];
    const idx = [a, b].indexOf(row.regionName);   // -1 / 0 / 1
    htmlAll += makeRow(row, idx, maxFc, maxMape);
  }
  tbody.innerHTML = htmlAll;

  // 생성된 각 <tr> 에 "클릭하면 토글" 이벤트 바인딩
  const rows = tbody.querySelectorAll('tr[data-region]');
  for (let i = 0; i < rows.length; i++) {
    const tr = rows[i];
    tr.addEventListener('click', function () {
      toggleRegion(tr.dataset.region);
    });
  }
}

/**
 * 한 행(<tr>)의 HTML 문자열을 만든다.
 * @param row     표 한 줄 데이터 (서버 응답의 한 객체)
 * @param idx     이 지역이 A(0) / B(1) / 선택안됨(-1) 중 무엇인지
 * @param maxFc   8월 예측 열의 최댓값 (스파크바 비율 계산용)
 * @param maxMape MAPE 열의 최댓값 (MAPE 바 비율 계산용)
 */
function makeRow(row, idx, maxFc, maxMape) {
  // 행 전체에 붙일 CSS 클래스 (A면 파란 배경, B면 주황 배경, 없으면 기본)
  let rowCls = '';
  if (idx === 0) rowCls = 'dt-row-a';
  else if (idx === 1) rowCls = 'dt-row-b';

  // 각 셀을 "셀 전용 함수"에서 받아 하나씩 조립
  return (
    '<tr class="' + rowCls + '" data-region="' + row.regionName + '">' +
      makeSidoCell(row, idx) +
      makeForecastCell(row, idx, maxFc) +
      makeYoyCell(row) +
      makeMapeCell(row, maxMape) +
      '<td>' + fmtNumber(row.rmseGwh) + '</td>' +   // RMSE 는 숫자 하나만
      '<td>' + fmtNumber(row.maeGwh) + '</td>' +    // MAE 도 숫자 하나만
    '</tr>'
  );
}

/** [1열] 시도 셀: 체크박스 + A/B 뱃지 + 이름 */
function makeSidoCell(row, idx) {
  let checkCls = 'dt-check';
  let letter = null;
  if (idx === 0) { checkCls += ' on-a'; letter = 'A'; }
  else if (idx === 1) { checkCls += ' on-b'; letter = 'B'; }

  // 체크 아이콘(흰색 ✓ 모양 SVG). 선택된 경우에만 삽입.
  let checkSvg = '';
  if (idx >= 0) {
    checkSvg =
      '<svg width="9" height="9" viewBox="0 0 12 12">' +
      '<path d="M2 6l3 3 5-5" fill="none" stroke="#fff" stroke-width="2"' +
      ' stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  // A/B 뱃지는 선택된 경우에만.
  let badge = '';
  if (letter) {
    const badgeCls = letter === 'A' ? 'dt-badge dt-badge-a' : 'dt-badge dt-badge-b';
    badge = '<span class="' + badgeCls + '">' + letter + '</span>';
  }

  return (
    '<td class="dt-sido-cell">' +
      '<span class="dt-sido-inner">' +
        '<span class="' + checkCls + '">' + checkSvg + '</span>' +
        badge +
        '<span class="dt-name">' + row.shortName + '</span>' +
      '</span>' +
    '</td>'
  );
}

/** [2열] 8월 예측 셀: 숫자 + 상대적 길이 스파크바 */
function makeForecastCell(row, idx, maxFc) {
  // 선택 상태에 따라 스파크바 색을 다르게
  let sparkCls = 'dt-spark';
  if (idx === 0) sparkCls += ' on-a';
  else if (idx === 1) sparkCls += ' on-b';

  // 스파크바 길이(%) = 이 지역의 예측값 / 전체 최댓값 × 100
  const fc = row.predictedGwh || 0;
  let widthPct = (fc / maxFc) * 100;
  if (widthPct > 100) widthPct = 100;    // 혹시 100 넘으면 100 으로 자름

  return (
    '<td>' +
      '<div class="dt-fc-cell">' +
        '<span class="dt-fc-val">' + fmtNumber(fc) + '</span>' +
        '<div class="' + sparkCls + '">' +
          '<i style="width:' + widthPct + '%"></i>' +
        '</div>' +
      '</div>' +
    '</td>'
  );
}

/** [3열] 전년대비 셀: 색점 + ±X.X% */
function makeYoyCell(row) {
  const yoy = row.yoyPct == null ? 0 : row.yoyPct;

  // 양수(증가) / 음수(감소) / 거의 0(보합) 분류
  let yoyCls;
  if (yoy > 0.5) yoyCls = 'dt-yoy dt-yoy-up';         // 0.5% 넘게 증가
  else if (yoy < -0.5) yoyCls = 'dt-yoy dt-yoy-down'; // 0.5% 넘게 감소
  else yoyCls = 'dt-yoy dt-yoy-flat';                 // 거의 변화 없음

  // 양수에만 '+' 붙이고, 소수점 1자리까지
  let yoyTxt = yoy.toFixed(1) + '%';
  if (yoy > 0) yoyTxt = '+' + yoyTxt;

  return (
    '<td>' +
      '<span class="' + yoyCls + '">' +
        '<span class="dt-yoy-dot"></span>' +
        yoyTxt +
      '</span>' +
    '</td>'
  );
}

/** [4열] MAPE 셀: 상대적 길이 바 + X.X% */
function makeMapeCell(row, maxMape) {
  const mape = row.mape || 0;
  let widthPct = (mape / maxMape) * 100;
  if (widthPct > 100) widthPct = 100;

  const mapeTxt = row.mape == null ? '-' : row.mape.toFixed(1) + '%';

  return (
    '<td>' +
      '<div class="dt-mape-cell">' +
        '<div class="dt-mape-bar">' +
          '<i style="width:' + widthPct + '%"></i>' +
        '</div>' +
        '<span>' + mapeTxt + '</span>' +
      '</div>' +
    '</td>'
  );
}


// ===================================================================
// 7. 비동기 로드 (서버에서 데이터 받아오기)
// ===================================================================

/**
 * /detail-api/table 을 호출해서 표 데이터 17개를 받아오고 화면에 그린다.
 *
 * async/await: 서버 응답을 "기다렸다가" 다음 줄로 넘어가게 하는 문법.
 *   - await 뒤의 작업이 끝날 때까지 그 다음 줄은 실행되지 않는다.
 *   - 비동기지만 코드는 위에서 아래로 읽히게 됨.
 */
async function loadTable() {
  try {
    // axios 는 응답 상태가 200 이 아니면 자동으로 에러를 던진다 → catch 로 떨어짐
    const res = await axios.get(DETAIL_API_TABLE);
    detailTableRows = res.data;    // JSON 파싱도 axios 가 해줘서 res.data 에 그대로 들어 있음
  } catch (e) {
    console.error('[detail] 표 데이터 로드 실패', e);
    detailTableRows = [];           // 실패 시 빈 배열로
  }
  renderTable();
}

/**
 * 선택이 바뀔 때마다 호출되는 핸들러 (region:selected 이벤트의 리스너).
 * 좌측(표+chip+모달)만 다시 그린다. 차트는 1번 팀원 쪽에서 알아서 반응함.
 */
function onSelectionChanged() {
  renderFilterChips();
  renderTable();
  // 모달이 열려 있다면 체크 상태도 갱신
  if (!document.getElementById('dfRegionModal').hidden) {
    renderRegionList(document.getElementById('dfRegionSearch').value);
  }
}


// ===================================================================
// 8. CSV 내보내기
//    브라우저에서 "파일 다운로드"를 하려면 Blob + a 태그 조합이 거의 유일한 방법.
//    아래 각 줄에 "뭘 하는지" 상세 주석을 달았으니 한 줄씩 따라가면 됩니다.
// ===================================================================

function downloadCsv() {
  if (detailTableRows.length === 0) return;  // 데이터가 없으면 아무것도 안 함

  // --- (1) CSV 내용을 한 줄씩 만든다 ---
  // 첫 줄: 헤더
  const header = ['시도', '풀네임', '8월 예측(GWh)', '전년대비(%)',
                  'MAPE(%)', 'RMSE(GWh)', 'MAE(GWh)'];
  const lines = [header.join(',')];   // "시도,풀네임,8월 예측(GWh),..."

  // 나머지 줄: 데이터 한 행씩
  for (let i = 0; i < detailTableRows.length; i++) {
    const r = detailTableRows[i];
    const row = [
      r.shortName,
      r.regionName,
      r.predictedGwh == null ? '' : r.predictedGwh,
      r.yoyPct == null ? '' : r.yoyPct,
      r.mape == null ? '' : r.mape,
      r.rmseGwh == null ? '' : r.rmseGwh,
      r.maeGwh == null ? '' : r.maeGwh,
    ];
    lines.push(row.join(','));   // ","로 묶어서 한 줄 완성
  }
  // 줄바꿈으로 모든 줄을 이어서 하나의 긴 문자열로 만든다
  const csvText = lines.join('\n');

  // --- (2) 문자열을 "파일처럼" 만든다: Blob 사용 ---
  // Blob = Binary Large OBject. 메모리 안의 가짜 파일이라고 생각하면 됨.
  // '﻿' 는 BOM이라는 특수 문자. 엑셀에서 한글이 깨지지 않도록 맨 앞에 붙여준다.
  const blob = new Blob(
    ['﻿' + csvText],
    { type: 'text/csv;charset=utf-8;' }   // MIME 타입: 이게 CSV 라는 표시
  );

  // --- (3) 그 Blob 을 가리키는 임시 주소(URL) 를 만든다 ---
  // 결과는 "blob:http://localhost:8080/abc-123..." 같은 임시 주소.
  // 이 주소는 메모리에만 있고 브라우저를 닫으면 사라진다.
  const url = URL.createObjectURL(blob);

  // --- (4) 보이지 않는 <a> 링크를 만들어 자동으로 클릭 → 다운로드 ---
  // <a href="blob:..." download="파일이름.csv">
  // 를 만들어 click() 하면 브라우저가 "다운로드"로 처리한다.
  const link = document.createElement('a');
  link.href = url;
  link.download = 'detail_regions.csv';
  document.body.appendChild(link);    // 어떤 브라우저는 DOM에 붙어 있어야 click 이 통함
  link.click();                        // "다운로드!" 시작

  // --- (5) 뒷정리: 임시 링크와 URL 을 지운다 (메모리 해제) ---
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}


// ===================================================================
// 9. 유틸
// ===================================================================

/** 숫자를 "1,234" 처럼 콤마가 들어간 문자열로 바꿔준다. null/NaN 이면 '-' 반환. */
function fmtNumber(n) {
  if (n == null || isNaN(n)) return '-';
  return Number(n).toLocaleString();   // 지역 설정에 맞춘 숫자 포맷 (ko-KR 이면 콤마)
}


// ===================================================================
// 10. 이벤트 바인딩 (한 번만 실행)
// ===================================================================

/** 페이지가 처음 열릴 때 모든 이벤트 리스너를 등록. */
function bindDetailEvents() {
  // 지역 트리거(상단 필터의 큰 버튼) 클릭 → 모달 열기
  document.getElementById('dfRegionTrigger')
    .addEventListener('click', openRegionModal);

  // 모달 뒷배경 클릭 → 모달 닫기 (data-modal-close 가 붙은 모든 요소)
  const closeTargets = document.querySelectorAll('[data-modal-close]');
  for (let i = 0; i < closeTargets.length; i++) {
    closeTargets[i].addEventListener('click', closeRegionModal);
  }

  // 키보드 Esc 눌러도 모달 닫기
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeRegionModal();
  });

  // 모달 안 검색창 입력 → 리스트 필터링
  document.getElementById('dfRegionSearch')
    .addEventListener('input', function (e) {
      renderRegionList(e.target.value);
    });

  // 모달 "선택 해제" 버튼 → 전부 해제
  document.getElementById('dfRegionClear')
    .addEventListener('click', function () {
      setSelection(null, null);
    });

  // CSV 내보내기 버튼
  document.getElementById('dfCsvBtn')
    .addEventListener('click', downloadCsv);

  // 커스텀 이벤트: 지역 선택이 바뀔 때 (내가 바꾸든 다른 스크립트가 바꾸든)
  document.addEventListener('region:selected', onSelectionChanged);
}


// ===================================================================
// 11. 진입점 (페이지가 열리면 여기서 시작)
// ===================================================================

/** 페이지 초기화: 이벤트 바인딩 → 칩 초기 그림 → 서버에서 데이터 받아 표 그리기 */
async function startDetailPage() {
  bindDetailEvents();        // 1) 각종 버튼/키보드/이벤트 등록
  renderFilterChips();        // 2) 상단 필터 chip 초기 그림 (아직 데이터 전이라 빈 상태)
  await loadTable();          // 3) 서버에서 표 데이터 받아와 그림
}

// HTML 파싱이 끝나는 순간(DOMContentLoaded) startDetailPage 를 호출.
// 이게 없으면 아직 그려지지 않은 요소에 접근하다가 null 에러가 날 수 있음.
document.addEventListener('DOMContentLoaded', startDetailPage);
