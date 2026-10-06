/**
 * (원래 1번 담당, 지도랑 바로 연결돼서 2번이 우선 작업) /static/js/chip.js
 * ----------------------------------------------------------------------------
 * fragments/chips.html의 드롭다운 2개(#chipA, #chipB)를 담당하는 스크립트.
 * map-app.js 내부 코드를 하나도 몰라도 됨 - 이벤트 두 개만 알면 됨.
 *
 * [2026-09-30] 선택된 지역은 sessionStorage에 들어있음 (키: selectedRegionA/B).
 * [2026-10-06] readonly 인풋 -> <select> 드롭다운으로 바뀌면서 "양방향"이 됨:
 *
 *   받는 쪽) 지도에서 지역이 바뀜 -> map-app.js가 'region:selected'를 쏨
 *            -> 여기서 듣고 드롭다운 값만 갱신
 *   보내는 쪽) 사용자가 드롭다운에서 직접 고름
 *            -> 여기서 'region:change-request'를 쏨 -> map-app.js가 듣고 처리
 *
 * 드롭다운에서 골랐을 때 여기서 sessionStorage를 직접 고치지 않는 이유:
 * 그러면 지도·도넛·순위표는 값이 바뀐 걸 모른 채로 있어서 화면끼리 어긋남.
 * 선택 상태를 관리하는 주체(map-app.js)에게 "바꿔달라"고 요청만 하는 구조로 둠.
 */

// 드롭다운 id -> map-app.js가 쓰는 슬롯 이름
const CHIP_SLOT_BY_ID = { chipA: 'left', chipB: 'right' };

/**
 * 드롭다운에 17개 시도 <option>을 채움.
 * 목록은 sido-map-codes.js의 SIDO_CODE_TO_NAME을 그대로 재사용 - 시도명을 여기에
 * 또 적어두면 나중에 표기가 바뀔 때 두 군데를 고쳐야 해서.
 */
function fillChipOptions(selectEl) {
  if (typeof SIDO_CODE_TO_NAME === 'undefined') {
    console.warn('[chip.js] sido-map-codes.js가 로드되지 않아 드롭다운을 못 채웠습니다.');
    return;
  }

  Object.values(SIDO_CODE_TO_NAME).forEach((sido) => {
    const option = document.createElement('option');
    option.value = sido;
    option.textContent = sido;
    selectEl.appendChild(option);
  });
}

/** 현재 선택된 지역 2개를 드롭다운에 표시 (값이 없으면 안내 문구 상태로) */
function fillChipInputs(a, b) {
  const chipA = document.getElementById('chipA');
  const chipB = document.getElementById('chipB');

  if (chipA) {
    chipA.value = a || '';
    chipA.classList.toggle('is-empty', !a); // 안 고른 상태는 흐린 글씨로
  }
  if (chipB) {
    chipB.value = b || '';
    chipB.classList.toggle('is-empty', !b);
  }
}

/** 사용자가 드롭다운에서 직접 골랐을 때 -> map-app.js에 변경 요청 */
function onChipChange(e) {
  document.dispatchEvent(
    new CustomEvent('region:change-request', {
      detail: {
        slot: CHIP_SLOT_BY_ID[e.target.id],   // 'left' 또는 'right'
        sido: e.target.value || null,         // 안내 문구(빈 값)를 고르면 선택 해제
      },
    })
  );
}

// DOMContentLoaded 시점에 처리하는 이유: 이 파일은 지도 조각보다 먼저 로드되기 때문에,
// 지금 당장은 sido-map-codes.js가 아직 없음. 문서가 다 읽힌 뒤에야 목록을 채울 수 있음.
document.addEventListener('DOMContentLoaded', () => {
  Object.keys(CHIP_SLOT_BY_ID).forEach((id) => {
    const selectEl = document.getElementById(id);
    if (!selectEl) return;

    fillChipOptions(selectEl);
    selectEl.addEventListener('change', onChipChange);
  });

  // 새로고침했거나 상세 페이지에서 돌아온 경우, 저장돼 있던 선택을 그대로 복원
  fillChipInputs(sessionStorage.getItem('selectedRegionA'), sessionStorage.getItem('selectedRegionB'));
});

// 지도 클릭/드래그 등으로 선택이 바뀔 때마다 드롭다운 값 갱신
document.addEventListener('region:selected', (e) => {
  fillChipInputs(e.detail.a, e.detail.b);
});
