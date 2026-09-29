package com.green.Predict.kpi.dto;

import lombok.Data;
import java.util.List;
import java.util.Map;

/** [3번 DTO] 대시보드 model에 kpiData 라는 이름으로 올리는 묶음 */
@Data
public class KpiData {
    private List<ForecastCard> cards;
    private Map<String, List<TrendPoint>> trendByTarget;

}
