package com.green.Predict.kpi.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.HashMap;
import java.util.List;

/** [3번 소유] SQL은 resources/mapper/KpiMapper.xml 에 작성합니다. */
@Mapper
public interface KpiMapper {

  //regionName 이 null 이면 17개 시도 전체를, 값이 있으면 그 시도만 조회한다

  //실측이 있는 가장 최근 달 (한 줄)
  List<HashMap<String, Object>> getRecentUsage(@Param("regionName") String regionName);

  //검증 오차 MAPE (한 줄)
  List<HashMap<String, Object>> getMape(@Param("regionName") String regionName);

  //월별 실측 사용량 (2022년 1월 ~ 데이터 끝)
  List<HashMap<String, Object>> getActualTrend(@Param("regionName") String regionName);

  //앞으로 3개월 예측 (작년 같은 달 실적 포함)
  List<HashMap<String, Object>> getForecastTrend(@Param("regionName") String regionName);

  //시도별 증감률 순위 (지역을 안 골랐을 때 쓰는 카드)
  List<HashMap<String, Object>> getForecastByRegion();

  //시도명 목록 ('서울특별시' -> '서울' 변환용)
  List<HashMap<String, Object>> getRegions();

}
