package com.green.Predict.map.dto;

import lombok.Data;

import java.util.List;

/** [2번 DTO] 대시보드 model에 mapData 라는 이름으로 올리는 묶음 */
@Data
public class MapData {
    private List<RegionSummary> regions;
    private List<RegionSummary> selectedRegions;
    private List<DonutSlice> donutA;
    private List<DonutSlice> donutB;

}
