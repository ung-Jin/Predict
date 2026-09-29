package com.green.Predict.map.dto;

import lombok.Data;

/** [2번 DTO] 지도 한 시도의 색칠에 필요한 값. */
@Data
public class RegionSummary {
    private Integer regionId;
    private String regionName;
    private String shortName;
    private Double yoyPct;
    private Double mape;
    private String clickUrl;

}
