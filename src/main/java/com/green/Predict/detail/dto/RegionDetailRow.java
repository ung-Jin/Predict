package com.green.Predict.detail.dto;

import lombok.Data;

/**
 * [4번 DTO] 상세 데이터 좌측 "지역별 상세" 표 한 행에 담기는 값.
 *
 * - 8월 예측(predictedGwh)과 전년대비(yoyPct)는 forecast 테이블에서,
 *   정확도 3종(mape, rmseGwh, maeGwh)은 backtest 테이블에서 구한다.
 * - 단위는 모두 화면 기준(GWh, %)으로 맞춰서 내보낸다 (DB의 kWh를 서비스에서 변환).
 * - Lombok @Data : getter/setter/toString을 자동 생성 (코드 짧게 쓰려고).
 */
@Data
public class RegionDetailRow {
    // 식별 정보
    private Integer regionId;      // region 테이블의 PK
    private String regionName;     // '서울특별시' 같은 풀네임 (sessionStorage/비교 키)
    private String shortName;      // '서울' 같은 짧은 이름 (표에 표시)

    // 8월 예측 지표
    private Long predictedGwh;     // 8월 예측 전력 사용량 (GWh)
    private Double yoyPct;         // 전년 대비 % (양수=증가, 음수=감소)

    // 검증 정확도 지표 (낮을수록 정확)
    private Double mape;           // 평균 절대 오차율 (%)
    private Double rmseGwh;        // Root Mean Square Error (GWh)
    private Double maeGwh;         // Mean Absolute Error (GWh)
}
