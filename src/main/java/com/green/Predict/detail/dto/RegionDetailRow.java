package com.green.Predict.detail.dto;

import lombok.Data;

/** [4번 DTO] 상세 데이터 표 한 행 */
@Data
public class RegionDetailRow {
    private Integer regionId;
    private String regionName;
    private String shortName;
    private Long predictedKwh;
    private Double yoyPct;
    private Double mape;
    private Double rmseGwh;
    private Double maeGwh;
    private String clickUrl;

}
