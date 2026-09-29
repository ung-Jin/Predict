package com.green.Predict.kpi.dto;

import lombok.Data;

/** [3번 DTO] 추이 차트의 점 하나 */
@Data
public class TrendPoint {
    private Integer year;
    private Integer month;
    private Long usageKwh;

}
