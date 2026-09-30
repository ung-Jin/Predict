-- ----------------------------------------------------------------------------
-- 1. region : 시도 목록 (17행)
-- ----------------------------------------------------------------------------
--  무엇     : 시도 17개의 번호와 이름을 모아둔 "기준표"입니다.
--  왜 있나  : 다른 표는 지역 이름 대신 region_id(번호)만 들고 있습니다.
--             화면에 이름이 필요하면 이 표와 JOIN 해서 가져옵니다.
--  쓰는 곳  : 지도(2번), 카드(3번), 상세 표(4번) 모두 JOIN 용도로 사용
--  예시     : 1 | 서울특별시 | 서울
--  주의     : 자바에서 지역을 넘겨줄 때는 region_name(서울특별시)을 씁니다.
--             short_name(서울)은 지도와 칩에 보여줄 때만 씁니다.
-- ----------------------------------------------------------------------------
CREATE TABLE region (
    region_id    INT          PRIMARY KEY,   -- 지역 번호 (다른 표와 연결하는 열쇠)
    region_name  VARCHAR(20)  NOT NULL,      -- 정식 이름: 서울특별시
    short_name   VARCHAR(10)  NOT NULL       -- 짧은 이름: 서울 (지도, 칩에 표시)
);
 
 
-- ----------------------------------------------------------------------------
-- 2. monthly_data : 시도별 월별 실측 데이터 (2022.01 ~ 2026.07, 935행)
-- ----------------------------------------------------------------------------
--  무엇     : 지난 4년 7개월 동안 "실제로 이만큼 썼다"는 기록입니다.
--             사용량 + 그 달 날씨 + 계약종별 비율이 한 줄에 같이 들어 있습니다.
--  한 줄    : 시도 1곳 x 1개월 (17곳 x 55개월 = 935행)
--  쓰는 곳  : 도넛 차트(2번), 월별 추이 차트(3번)
--  주의     : 예측값은 여기에 없습니다. 미래(8~10월)는 forecast 표에 있습니다.
--             계약종별 비율은 가로로 나란히 있어서, 도넛에 쓰려면 세로로
--             바꿔야 합니다 (쿼리 설명서의 findDonut 참고).
-- ----------------------------------------------------------------------------
CREATE TABLE monthly_data (
    region_id            INT     NOT NULL,  -- 지역 번호 (region 표와 연결)
    year                 INT     NOT NULL,  -- 연도: 2022 ~ 2026
    month                INT     NOT NULL,  -- 월: 1 ~ 12
 
    -- [사용량]  단위는 모두 kWh 입니다. 숫자가 커서 BIGINT 를 씁니다.
    usage_kwh            BIGINT  NOT NULL,  -- 그 달 총 전력사용량 (추이 차트의 주인공)
    prev_year_usage_kwh  BIGINT,            -- 1년 전 같은 달 사용량 (증감률 비교용)
    households           INT,               -- 세대수
 
    -- [날씨]  모델이 사용량을 예측할 때 넣은 입력값입니다.
    cooling_degree_days  DECIMAL(6,1),      -- 냉방도일: 더울수록 큰 값 (냉방 전력 수요)
    heating_degree_days  DECIMAL(6,1),      -- 난방도일: 추울수록 큰 값 (난방 전력 수요)
    heatwave_days        DECIMAL(5,1),      -- 폭염일수 (일)
    coldwave_days        DECIMAL(5,1),      -- 한파일수 (일)
    rainfall_mm          DECIMAL(7,1),      -- 강수량 (mm)
    humidity_pct         DECIMAL(5,1),      -- 평균습도 (%)
 
    -- [계약종별 비율]  그 달 사용량 중 각 용도가 차지하는 비율(%) → 도넛 차트
    residential_pct      DECIMAL(5,2),      -- 주택용
    general_pct          DECIMAL(5,2),      -- 일반용 (상가, 사무실 등)
    education_pct        DECIMAL(5,2),      -- 교육용
    industrial_pct       DECIMAL(5,2),      -- 산업용 (공장 등)
    agricultural_pct     DECIMAL(5,2),      -- 농사용   ┐ 도넛에서는 이 셋을
    streetlight_pct      DECIMAL(5,2),      -- 가로등   │ 더해서 "기타"
    night_pct            DECIMAL(5,2),      -- 심야     ┘ 한 조각으로 보여줍니다
 
    PRIMARY KEY (region_id, year, month),   -- 같은 지역/연/월은 한 줄만 존재
    FOREIGN KEY (region_id) REFERENCES region(region_id)
);
 
 
-- ----------------------------------------------------------------------------
-- 3. forecast : 앞으로 3개월 예측 (2026.08 ~ 10, 51행)
-- ----------------------------------------------------------------------------
--  무엇     : 우리 모델이 계산한 "앞으로 이만큼 쓸 것이다"라는 예측값입니다.
--  한 줄    : 시도 1곳 x 1개월 (17곳 x 3개월 = 51행)
--  쓰는 곳  : 지도 색(2번), 카드(3번), 상세 표(4번)
--  증감률   : (predicted_kwh / prev_year_kwh - 1) x 100 으로 계산합니다.
--             예) 예측 1100, 작년 1000 → +10%
--  주의     : 미래 날씨는 알 수 없어서, 과거 같은 달 평균 날씨를 넣고 예측했습니다.
--             (input_cooling_dd, input_heating_dd 가 그 값)
--             그래서 실제 날씨가 평년과 다르면 예측이 빗나갈 수 있습니다.
-- ----------------------------------------------------------------------------
CREATE TABLE forecast (
    region_id         INT          NOT NULL,  -- 지역 번호 (region 표와 연결)
    year              INT          NOT NULL,  -- 예측 연도: 2026
    month             INT          NOT NULL,  -- 예측 월: 8, 9, 10
    predicted_kwh     BIGINT       NOT NULL,  -- 모델 예측값 (kWh) ← 화면에 나오는 예측
    prev_year_kwh     BIGINT,                 -- 작년 같은 달 실측 (kWh) ← 증감률 계산용
    input_cooling_dd  DECIMAL(6,1),           -- 예측에 넣은 냉방도일 (과거 같은 달 평균)
    input_heating_dd  DECIMAL(6,1),           -- 예측에 넣은 난방도일 (과거 같은 달 평균)
    model_version     VARCHAR(20),            -- 모델 이름/버전: RF-v1 (랜덤포레스트 1차)
    PRIMARY KEY (region_id, year, month),
    FOREIGN KEY (region_id) REFERENCES region(region_id)
);
 
 
-- ----------------------------------------------------------------------------
-- 4. backtest : 검증 결과 (2025.08 ~ 2026.07, 204행)
-- ----------------------------------------------------------------------------
--  무엇     : 모델의 "성적표"입니다. 이미 지나간 12개월에 대해
--             모델이 예측한 값과 실제 값을 나란히 놓고 얼마나 맞췄는지 봅니다.
--  한 줄    : 시도 1곳 x 1개월 (17곳 x 12개월 = 204행)
--  쓰는 곳  : 지도 오차율(2번), 카드 오차(3번), 상세 표(4번)
--  오차 계산: MAPE, RMSE, MAE 는 이 표에서 계산합니다. (별도 컬럼 없음)
--               MAPE = 평균 몇 % 틀렸나
--               MAE  = 평균 몇 kWh 틀렸나
--               RMSE = MAE 와 비슷하지만 크게 틀린 달에 벌점을 더 줌
--  baseline : "작년 값을 그대로 쓰면 어떨까"라는 단순한 방법입니다.
--             모델이 이것보다 오차가 작아야 "모델을 쓴 의미가 있다"고 말할 수 있습니다.
--  주의     : forecast(미래)와 달리 이 표는 전부 "과거"라서 실제값이 있습니다.
-- ----------------------------------------------------------------------------
CREATE TABLE backtest (
    region_id      INT     NOT NULL,  -- 지역 번호 (region 표와 연결)
    year           INT     NOT NULL,  -- 연도: 2025, 2026
    month          INT     NOT NULL,  -- 월
    actual_kwh     BIGINT  NOT NULL,  -- 실제 사용량 (kWh)
    predicted_kwh  BIGINT  NOT NULL,  -- 그때 모델이 예측했던 값 (kWh)
    baseline_kwh   BIGINT  NOT NULL,  -- 작년 값 그대로 쓴 경우 (기준선, kWh)
    PRIMARY KEY (region_id, year, month),
    FOREIGN KEY (region_id) REFERENCES region(region_id)
);

COMMIT;