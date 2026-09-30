/**
 * (원래 1번 담당, 지도랑 바로 연결돼서 2번이 우선 작업) /static/js/chip.js
 * ----------------------------------------------------------------------------
 * fragments/chips.html의 인풋 2개(#chipA, #chipB)에 "지금 선택된 지역"을 표시만
 * 해주는 아주 단순한 스크립트. map-app.js 내부 코드를 하나도 몰라도 됨.
 *
 * [2026-09-30] 선택된 지역은 sessionStorage에 들어있음 (키: selectedRegionA/B).
 *   1) 페이지를 처음 열었을 때: sessionStorage에 이미 값이 있으면(예: 상세 데이터
 *      보다가 대시보드로 돌아온 경우) 바로 그 값으로 인풋을 채움.
 *   2) 지도를 눌러서 값이 바뀔 때: map-app.js가 sessionStorage에 새로 저장하면서
 *      동시에 'region:selected' 커스텀 이벤트도 쏴줌 - 그걸 듣고 인풋을 갱신함.
 *      (sessionStorage에 값만 넣는 걸로는 "같은 탭 안" 화면이 자동으로 안 바뀌어서,
 *      이벤트로 한 번 더 알려주는 것 - map-app.js 주석 참고)
 */
function fillChipInputs(a, b) {
  const chipA = document.getElementById('chipA');
  const chipB = document.getElementById('chipB');

  if (chipA) chipA.value = a || '';
  if (chipB) chipB.value = b || '';
}

// (1) 페이지 로드 시 초기값
fillChipInputs(sessionStorage.getItem('selectedRegionA'), sessionStorage.getItem('selectedRegionB'));

// (2) 지도 클릭 등으로 값이 바뀔 때
document.addEventListener('region:selected', (e) => {
  fillChipInputs(e.detail.a, e.detail.b);
});
