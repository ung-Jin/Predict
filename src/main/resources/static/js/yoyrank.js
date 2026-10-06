/* [3번 소유] 시도별 예측 증감률 (지역을 하나도 고르지 않았을 때 보여주는 카드)
 *
 * 데이터는 /chart-api/yoyrank 에서 axios 로 받아온다 (KpiApiController -> KpiService).
 * 응답 형태 : { year : 2026, month : 8,
 *               names : ['부산', ...], fullNames : ['부산광역시', ...], yoyList : [4.2, ...] }
 * 증가가 큰 순으로 정렬돼서 온다.
 *
 * 캔버스 차트가 아니라 HTML 로 그린다. 막대 17줄이면 canvas 보다 다루기 쉽고
 * 글자가 그대로 선택/확대되며, 카드 폭이 바뀌어도 알아서 늘어난다.
 *
 * 지역을 고르면 이 카드는 숨고 "앞으로 3개월 예측"(forecast3)이 대신 뜬다.
 * 그 전환은 1번의 js/dashboard.js 가 맡는다.
 */

//값의 부호에 따라 막대 색을 고른다 (증가=분홍, 감소=파랑, 변화없음=회색)
function yoyrankBarColor(value){
  if(value > 0) return 'var(--yr-up)';
  if(value < 0) return 'var(--yr-down)';
  return 'var(--yr-zero)';
}

//시도별 증감률 목록 그리기
function drawYoyRank(chartData){
  //그릴 영역을 선택
  const box = document.querySelector('#yoyrankList');
  if(!box || !chartData) return;

  const names = chartData.names || [];
  const fullNames = chartData.fullNames || [];
  const yoyList = chartData.yoyList || [];
  if(names.length === 0) return;

  //제목의 "8월" 부분을 데이터에 맞춘다
  const monthLabel = document.querySelector('#yoyrankMonth');
  if(monthLabel && chartData.month != null){
    monthLabel.textContent = chartData.month;
  }

  //막대 길이는 변화폭이 가장 큰 지역을 100% 로 두고 비례시킨다
  let maxAbs = 0;
  for(const value of yoyList){
    maxAbs = Math.max(maxAbs, Math.abs(value));
  }
  if(maxAbs === 0) maxAbs = 1;   //전부 0 일 때 0 으로 나누는 것 방지

  //두 열로 나눈다. 17개면 왼쪽 9줄 + 오른쪽 8줄
  const rowCount = Math.ceil(names.length / 2);
  box.style.gridTemplateRows = 'repeat(' + rowCount + ', auto)';

  box.textContent = '';   //다시 그릴 때를 대비해 비우고 시작

  names.forEach((name, i) => {
    const yoy = yoyList[i];

    const row = document.createElement('div');
    row.className = 'yr-row';
    //짧은 이름만 보이므로, 마우스를 올리면 정식 명칭이 보이게 한다
    row.title = (fullNames[i] || name) + '  ' + kpiSigned(yoy, 1) + '% (전년 동월 대비)';

    const nameEl = document.createElement('span');
    nameEl.className = 'yr-name';
    nameEl.textContent = name;

    const track = document.createElement('span');
    track.className = 'yr-bar';
    const fill = document.createElement('i');
    fill.style.width = (Math.abs(yoy) / maxAbs * 100) + '%';
    fill.style.background = yoyrankBarColor(yoy);
    track.appendChild(fill);

    const valueEl = document.createElement('span');
    valueEl.className = 'yr-val';
    valueEl.textContent = kpiSigned(yoy, 1) + '%';

    row.appendChild(nameEl);
    row.appendChild(track);
    row.appendChild(valueEl);
    box.appendChild(row);
  });
}

//시도별 증감률 데이터 조회 및 그림 그리기
function getYoyRankDataAndDraw(){
  axios.get('/chart-api/yoyrank')
  .then((response)=>{
    //response.data; 자바에서 리턴받은 데이터
    console.log(response.data);
    drawYoyRank(response.data);
  })
  .catch((error)=>{
    console.log('시도별 예측 증감률 조회 시 오류 발생');
    console.log(error);
  });
}

getYoyRankDataAndDraw();
