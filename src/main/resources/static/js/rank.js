/* [3번 소유] 시도별 예측 증감률 순위
 *
 * 지역을 하나도 고르지 않았을 때 보여주는 카드다.
 * 지역을 고르면 1번의 js/dashboard.js 가 이 카드를 숨기고 "앞으로 3개월 예측"을 대신 보여준다.
 *
 * 데이터는 /chart-api/rank 에서 받아온다.
 * 받는 모양 : {
 *   year : 2026,
 *   month : 8,
 *   names : ['부산', '대구', ...],            // 짧은 이름
 *   fullNames : ['부산광역시', ...],          // 정식 이름 (마우스 올렸을 때 보여줌)
 *   yoyList : [4.2, 4.1, ...]                // 전년 동월 대비 증감률(%)
 * }
 * 증가가 큰 순서로 정렬돼서 온다.
 */

//막대 색을 정하는 함수. 증가는 분홍, 감소는 파랑, 변화가 없으면 회색
function getRankBarColor(yoy){
  if(yoy > 0){
    return 'var(--rank-up)';
  }
  if(yoy < 0){
    return 'var(--rank-down)';
  }
  return 'var(--rank-zero)';
}

//숫자에 부호와 % 를 붙여서 글자로 만드는 함수. 4.2 -> '+4.2%', -6.6 -> '-6.6%'
function getRankValueText(yoy){
  if(yoy > 0){
    return '+' + yoy.toFixed(1) + '%';
  }
  //음수는 toFixed 가 이미 '-' 를 붙여준다
  return yoy.toFixed(1) + '%';
}

//막대 길이를 정할 때 쓸, 가장 큰 변화폭을 찾는 함수
function getRankMaxValue(yoyList){
  let maxValue = 0;

  for(let i = 0; i < yoyList.length; i++){
    const size = Math.abs(yoyList[i]);   //부호를 떼고 크기만 본다
    if(size > maxValue){
      maxValue = size;
    }
  }

  //전부 0 이면 아래에서 0 으로 나누게 되므로 1 로 바꿔둔다
  if(maxValue === 0){
    maxValue = 1;
  }
  return maxValue;
}

//시도별 증감률 목록 그리기
function drawRank(chartData){
  //그릴 영역을 선택
  const rankList = document.querySelector('#rank-list');
  const rankMonth = document.querySelector('#rank-month');

  //제목의 "8월" 부분을 데이터에 맞춘다
  rankMonth.textContent = chartData.month;

  //가장 큰 변화폭을 100% 로 두고, 나머지 막대 길이를 거기에 비례시킨다
  const maxValue = getRankMaxValue(chartData.yoyList);

  //17개를 두 열로 나눈다. 한 열에 9줄씩 (17 / 2 를 올림)
  const rowCount = Math.ceil(chartData.names.length / 2);
  rankList.style.gridTemplateRows = 'repeat(' + rowCount + ', auto)';

  //한 줄씩 HTML 을 만들어서 이어 붙인다
  let html = '';

  for(let i = 0; i < chartData.names.length; i++){
    const name = chartData.names[i];
    const fullName = chartData.fullNames[i];
    const yoy = chartData.yoyList[i];

    const barWidth = Math.abs(yoy) / maxValue * 100;   //0 ~ 100 사이의 숫자
    const barColor = getRankBarColor(yoy);
    const valueText = getRankValueText(yoy);

    html += '<div class="rank-row" title="' + fullName + ' ' + valueText + '">';
    html += '  <span class="rank-name">' + name + '</span>';
    html += '  <span class="rank-bar"><i style="width:' + barWidth + '%; background:' + barColor + '"></i></span>';
    html += '  <span class="rank-value">' + valueText + '</span>';
    html += '</div>';
  }

  //만든 HTML 을 한 번에 집어넣는다
  rankList.innerHTML = html;
}

//화면이 열리면 차트 데이터를 조회하는 함수
async function getRankData(){
  let resultData;

  try{
    const response = await axios.get('/chart-api/rank');
    resultData = response.data;   //자바에서 리턴받은 데이터
    console.log(resultData);

  }catch(error){
    console.log('시도별 증감률 조회 시 오류 발생');
    console.log(error);
    return;   //데이터를 못 받았으면 그리지 않는다
  }

  drawRank(resultData);
}

getRankData();
