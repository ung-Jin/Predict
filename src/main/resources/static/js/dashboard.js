// [1번] 지도에서 선택한 지역이 있으면 "3개월 예측", 없으면 "시도별 순위"를 보여준다.

function showRankOrForecast() {
  // 선택된 지역 A, B를 sessionStorage에서 읽는다 (없으면 null)
  const a = sessionStorage.getItem('selectedRegionA');
  const b = sessionStorage.getItem('selectedRegionB');

  const rankBox = document.getElementById('rankBox');
  const forecast3Box = document.getElementById('forecast3Box');

  if (a || b) {
    // 하나라도 선택됨 -> 예측을 보여준다
    rankBox.style.display = 'none';
    forecast3Box.style.display = 'contents';
  } else {
    // 아무것도 선택 안 됨 -> 순위를 보여준다
    rankBox.style.display = 'contents';
    forecast3Box.style.display = 'none';
  }
}

// 1) 페이지가 열릴 때 한 번 (새로고침해도 맞는 화면이 나오게)
showRankOrForecast();

// 2) 지도에서 지역을 고르거나 뺄 때마다 (2번이 보내는 알림)
document.addEventListener('region:selected', showRankOrForecast);
