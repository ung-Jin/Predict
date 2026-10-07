package com.green.Predict.detailchart.mapper;

import org.apache.ibatis.annotations.Mapper;

import java.util.List;
import java.util.Map;

/** SQL은 resources/mapper/DetailChartMapper.xml 에 있음. 결과는 DTO 대신 Map으로 받음. */
@Mapper
public interface DetailChartMapper {

    // ----- 연도별 월평균 (막대 차트). Map의 키: year, avgGwh -----
    List<Map<String, Object>> findYearlyAvg(String name);        // 지역 하나
    List<Map<String, Object>> findNationalYearlyAvg();           // 전국 합계
    List<Map<String, Object>> findAllRegionYearlyAvg();          // 시도 평균

    // ----- 월별 사용량 (계절 패턴, 히트맵). Map의 키: year, month, usageGwh -----
    List<Map<String, Object>> findMonthly(String name);          // 지역 하나
    List<Map<String, Object>> findNationalMonthly();             // 전국 합계
    List<Map<String, Object>> findAllRegionMonthly();            // 시도 평균
}
