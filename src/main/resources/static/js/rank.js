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
 *
 * 17개를 다 보여주면 글자가 작아져서 읽기 힘들다.
 * 그래서 "증가 지역" 과 "감소 지역" 을 각각 5개씩만 뽑아서 두 칸으로 보여준다.
 */

//증가 / 감소 각각 몇 개까지 보여줄지
const RANK_TOP_COUNT = 5;

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

/* 증가 지역 5개 골라내기.
   받은 목록이 "증가가 큰 순서"로 정렬돼 있으므로 앞에서부터 차례로 보면 된다. */
function pickUpRows(chartData){
  const rows = [];

  for(let i = 0; i < chartData.names.length; i++){
    const yoy = chartData.yoyList[i];

    //0 이거나 감소한 지역은 이 칸에 넣지 않는다
    if(yoy <= 0){
      continue;
    }

    rows.push({
      name : chartData.names[i],
      fullName : chartData.fullNames[i],
      yoy : yoy
    });

    //5개를 채웠으면 그만 본다
    if(rows.length === RANK_TOP_COUNT){
      break;
    }
  }

  return rows;
}

/* 감소 지역 5개 골라내기.
   "많이 줄어든 순서"로 보여줘야 하는데 목록은 증가가 큰 순서라서,
   i 를 맨 뒤(length - 1)에서 시작해 1 씩 줄이며 거꾸로 본다. */
function pickDownRows(chartData){
  const rows = [];

  for(let i = chartData.names.length - 1; i >= 0; i--){
    const yoy = chartData.yoyList[i];

    //0 이거나 증가한 지역은 이 칸에 넣지 않는다
    if(yoy >= 0){
      continue;
    }

    rows.push({
      name : chartData.names[i],
      fullName : chartData.fullNames[i],
      yoy : yoy
    });

    if(rows.length === RANK_TOP_COUNT){
      break;
    }
  }

  return rows;
}

//막대 길이를 정할 때 쓸, 가장 큰 변화폭을 찾는 함수
function getRankMaxValue(rows){
  let maxValue = 0;

  for(let i = 0; i < rows.length; i++){
    const size = Math.abs(rows[i].yoy);   //부호를 떼고 크기만 본다
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

/* 한 칸(증가 지역 / 감소 지역) 을 통째로 만드는 함수.
     title    : 칸 머리말 ('증가 지역' / '감소 지역')
     rows     : pickRankRows 가 골라준 줄 목록
     maxValue : 선 길이를 100% 로 칠 기준값 (두 칸이 같은 값을 쓴다) */
function makeRankGroup(title, rows, maxValue){
  //머리말 점 색은 그 칸의 첫 줄 색을 따라간다 (증가=분홍, 감소=파랑)
  let groupColor = 'var(--rank-zero)';
  if(rows.length > 0){
    groupColor = getRankBarColor(rows[0].yoy);
  }

  let html = '';
  html += '<div class="rank-group">';
  html += '  <p class="rank-group-title">';
  html += '    <i class="rank-group-dot" style="background:' + groupColor + '"></i>' + title;
  html += '  </p>';

  for(let i = 0; i < rows.length; i++){
    const one = rows[i];

    const lineWidth = Math.abs(one.yoy) / maxValue * 100;   //0 ~ 100 사이의 숫자
    const lineColor = getRankBarColor(one.yoy);
    const valueText = getRankValueText(one.yoy);

    html += '<div class="rank-row" title="' + one.fullName + ' ' + valueText + '">';
    html += '  <span class="rank-name">' + one.name + '</span>';
    html += '  <span class="rank-bar"><i class="rank-line" style="width:' + lineWidth + '%; background:' + lineColor + '"></i></span>';
    html += '  <span class="rank-value">' + valueText + '</span>';
    html += '</div>';
  }

  html += '</div>';
  return html;
}

//시도별 증감률 목록 그리기
function drawRank(chartData){
  //그릴 영역을 선택
  const rankList = document.querySelector('#rank-list');
  const rankMonth = document.querySelector('#rank-month');

  //제목의 "8월" 부분을 데이터에 맞춘다
  rankMonth.textContent = chartData.month;

  //보여줄 줄만 고른다
  const upRows = pickUpRows(chartData);
  const downRows = pickDownRows(chartData);

  /* 두 칸이 같은 기준으로 길어져야 길이를 서로 비교할 수 있다.
     칸마다 따로 100% 를 잡으면 -6.6% 와 +4.2% 가 같은 길이로 보여서 잘못 읽힌다. */
  const maxValue = getRankMaxValue(upRows.concat(downRows));

  //만든 HTML 을 한 번에 집어넣는다
  rankList.innerHTML = makeRankGroup('증가 지역', upRows, maxValue)
                     + makeRankGroup('감소 지역', downRows, maxValue);
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
