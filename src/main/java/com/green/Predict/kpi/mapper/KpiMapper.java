package com.green.Predict.kpi.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.HashMap;
import java.util.List;

/** [3번 소유] SQL은 resources/mapper/KpiMapper.xml 에 작성합니다. */
@Mapper
public interface KpiMapper {

  //regionName 이 null 이면 17개 시도 전체를 집계한다 (합계/평균을 같이 돌려줌)

  //요약 카드 4개에 필요한 값 (한 행)
  List<HashMap<String, Object>> getCard(@Param("regionName") String regionName);

  //월별 실측 추이 (2022.01 ~ 데이터 끝)
  List<HashMap<String, Object>> getActualTrend(@Param("regionName") String regionName);

  //앞으로 3개월 예측 (작년 같은 달 실적 포함)
  List<HashMap<String, Object>> getForecastTrend(@Param("regionName") String regionName);

  //가장 이른 예측 달의 시도별 전년 동월 대비 증감률 (선택 0개일 때 쓰는 순위 카드)
  List<HashMap<String, Object>> getForecastByRegion();

  //시도명 -> 짧은 이름 변환에 쓸 목록
  List<HashMap<String, Object>> getRegions();

}
