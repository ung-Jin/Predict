package com.green.Predict.kpi.dto;

import lombok.Data;

/** [3번 DTO] 요약 카드 한 줄 (지역 하나 또는 전국/평균) */
@Data
public class ForecastCard {
    private String label;
    private Long recentUsageKwh;
    private Long predictedKwh;
    private Long prevYearKwh;
    private Double yoyPct;
    private Double mape;

}
