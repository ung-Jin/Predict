package com.green.Predict.kpi.service;

import com.green.Predict.kpi.dto.SeriesDTO;
import com.green.Predict.kpi.mapper.KpiMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** [3번 소유] KpiMapper로 값을 가져와 화면에 필요한 형태로 가공합니다. */
@Service
@RequiredArgsConstructor
public class KpiService {

  //DB 는 kWh 로 저장돼 있고 화면은 GWh 로 보여준다. 1 GWh = 100만 kWh
  private static final double KWH_PER_GWH = 1000000d;

  /* 월별 사용량 추이 차트에 보여줄 구간 : 2025년 7월 ~ 2026년 12월.
     연과 월을 202507 처럼 숫자 하나로 붙여서 비교한다 (2025*100 + 7).
     이렇게 하면 연도가 바뀌는 구간도 크다/작다 한 번으로 판단된다.
     보여줄 기간을 바꾸려면 이 두 숫자만 고치면 된다. */
  private static final int TREND_FROM = 202507;
  private static final int TREND_TO = 202612;

  //"앞으로 3개월 예측" 카드가 쓸 달 수
  private static final int FORECAST_MONTHS = 3;

  private final KpiMapper kpiMapper;

  /**
   * 지도에서 고른 지역(a, b)을 보고 화면에 몇 줄을 그릴지 정한다.
   *   아무것도 안 골랐으면 : 전국 합계 한 줄
   *   하나 골랐으면        : 그 시도 + 시도 평균 (비교용)
   *   두 개 골랐으면       : 두 시도
   */
  private List<SeriesDTO> makeSeriesList(String a, String b){
    List<SeriesDTO> list = new ArrayList<>();

    String regionA = a;
    String regionB = b;

    //빈 문자열로 들어오면 "안 고른 것"으로 본다
    if(regionA != null && regionA.isBlank()){
      regionA = null;
    }
    if(regionB != null && regionB.isBlank()){
      regionB = null;
    }

    //아무것도 안 골랐을 때
    if(regionA == null && regionB == null){
      list.add( new SeriesDTO("전국", null, false) );
      return list;
    }

    //A 는 비었는데 B 만 골랐으면 B 를 A 자리로 옮겨서 똑같이 처리한다
    if(regionA == null){
      regionA = regionB;
      regionB = null;
    }

    //첫 번째 줄 : 고른 지역
    list.add( new SeriesDTO(toShortName(regionA), regionA, false) );

    //두 번째 줄 : 두 번째 지역이 있으면 그 지역, 없으면 시도 평균
    if(regionB != null){
      list.add( new SeriesDTO(toShortName(regionB), regionB, false) );
    }else{
      list.add( new SeriesDTO("시도 평균", null, true) );
    }

    return list;
  }

  /**
   * 요약 카드 4개.
   * 줄 하나를 만들려면 쿼리 3개(최근 실측 / 3개월 예측 / 검증 오차)를 각각 돌린다.
   */
  public Map<String, Object> getCardData(String a, String b){
    List<SeriesDTO> seriesList = makeSeriesList(a, b);
    List<Map<String, Object>> cards = new ArrayList<>();

    Map<String, Object> resultMap = new HashMap<>();

    for(int i = 0; i < seriesList.size(); i++){
      SeriesDTO series = seriesList.get(i);

      List<HashMap<String, Object>> recentRows = kpiMapper.getRecentUsage(series.getRegionName());
      List<HashMap<String, Object>> forecastRows = kpiMapper.getForecastTrend(series.getRegionName());
      List<HashMap<String, Object>> mapeRows = kpiMapper.getMape(series.getRegionName());

      if(recentRows.isEmpty() || forecastRows.isEmpty()){
        continue;
      }

      HashMap<String, Object> recent = recentRows.get(0);        //가장 최근 실측 달
      HashMap<String, Object> forecast = forecastRows.get(0);    //가장 이른 예측 달 (8월)
      HashMap<String, Object> mape = mapeRows.get(0);

      //기준 연/월은 어느 줄이든 같으므로 첫 줄 것만 담는다
      if(i == 0){
        resultMap.put("recentYear", recent.get("DATA_YEAR"));
        resultMap.put("recentMonth", recent.get("DATA_MONTH"));
        resultMap.put("forecastMonth", forecast.get("DATA_MONTH"));
      }

      //합계를 쓸지 평균을 쓸지 고른다 (시도를 하나만 걸렀으면 둘이 같은 값이다)
      Object recentKwh = recent.get("TOTAL_KWH");
      Object predictedKwh = forecast.get("TOTAL_KWH");

      if(series.isUseAverage()){
        recentKwh = recent.get("AVG_KWH");
        predictedKwh = forecast.get("AVG_KWH");
      }

      Map<String, Object> card = new HashMap<>();
      card.put("name", series.getName());
      card.put("recentGwh", toGwh(recentKwh));
      card.put("predictedGwh", toGwh(predictedKwh));
      card.put("yoyPct", toDouble(forecast.get("YOY_PCT")));
      card.put("mape", toDouble(mape.get("MAPE")));
      cards.add(card);
    }

    resultMap.put("series", cards);
    return resultMap;
  }

  /** 앞으로 3개월 예측 (막대 차트) */
  public Map<String, Object> getForecast3Data(String a, String b){
    List<SeriesDTO> seriesList = makeSeriesList(a, b);

    List<String> labels = new ArrayList<>();
    List<Map<String, Object>> chartSeries = new ArrayList<>();

    for(int i = 0; i < seriesList.size(); i++){
      SeriesDTO series = seriesList.get(i);
      List<HashMap<String, Object>> rows = kpiMapper.getForecastTrend(series.getRegionName());

      List<Long> predicted = new ArrayList<>();
      List<Long> prevYear = new ArrayList<>();
      List<Double> yoyList = new ArrayList<>();

      //"앞으로 3개월" 카드라서 가장 이른 3개월만 쓴다.
      //예측 표에 11월, 12월이 더 들어와도 이 카드는 3칸으로 유지된다.
      for(int m = 0; m < rows.size() && m < FORECAST_MONTHS; m++){
        HashMap<String, Object> row = rows.get(m);

        //x축 이름(8월, 9월, 10월)은 첫 번째 줄을 돌 때만 만들면 된다
        if(i == 0){
          int month = ((Number)row.get("DATA_MONTH")).intValue();
          labels.add( month + "월" );
        }

        //합계를 쓸지 평균을 쓸지 고른다
        Object predictedKwh = row.get("TOTAL_KWH");
        Object prevKwh = row.get("PREV_TOTAL_KWH");

        if(series.isUseAverage()){
          predictedKwh = row.get("AVG_KWH");
          prevKwh = row.get("PREV_AVG_KWH");
        }

        predicted.add( toGwh(predictedKwh) );
        prevYear.add( toGwh(prevKwh) );
        yoyList.add( toDouble(row.get("YOY_PCT")) );
      }

      Map<String, Object> one = new HashMap<>();
      one.put("name", series.getName());
      one.put("predicted", predicted);
      one.put("prevYear", prevYear);
      one.put("yoyPct", yoyList);
      chartSeries.add(one);
    }

    Map<String, Object> resultMap = new HashMap<>();
    resultMap.put("unit", "GWh");
    resultMap.put("labels", labels);
    resultMap.put("series", chartSeries);
    return resultMap;
  }

  /** 월별 사용량 추이 (실측 + 앞으로 3개월 예측) */
  public Map<String, Object> getTrendData(String a, String b){
    List<SeriesDTO> seriesList = makeSeriesList(a, b);

    List<String> labels = new ArrayList<>();
    List<Map<String, Object>> chartSeries = new ArrayList<>();
    int forecastStart = -1;

    for(int i = 0; i < seriesList.size(); i++){
      SeriesDTO series = seriesList.get(i);

      List<HashMap<String, Object>> actualRows = kpiMapper.getActualTrend(series.getRegionName());
      List<HashMap<String, Object>> forecastRows = kpiMapper.getForecastTrend(series.getRegionName());

      List<Long> actual = new ArrayList<>();
      List<Long> forecast = new ArrayList<>();

      //실측 구간 : 실측 값만 채우고 예측 자리는 비워둔다(null)
      for(HashMap<String, Object> row : actualRows){
        int year = ((Number)row.get("DATA_YEAR")).intValue();
        int month = ((Number)row.get("DATA_MONTH")).intValue();
        int yearMonth = year * 100 + month;

        //보여줄 구간(2025.07 ~ 2026.12) 밖이면 건너뛴다
        if(yearMonth < TREND_FROM || yearMonth > TREND_TO){
          continue;
        }

        //x축 이름(2026.07)은 첫 번째 줄을 돌 때만 만들면 된다
        if(i == 0){
          labels.add( String.format("%d.%02d", year, month) );
        }

        Object kwh = row.get("TOTAL_KWH");
        if(series.isUseAverage()){
          kwh = row.get("AVG_KWH");
        }

        actual.add( toGwh(kwh) );
        forecast.add(null);
      }

      //실측이 끝나는 자리. 아래에서 두 선을 이어 붙일 때 쓴다
      int lastActual = actual.size() - 1;

      //예측 구간 : 반대로 예측만 채운다
      for(HashMap<String, Object> row : forecastRows){
        int year = ((Number)row.get("DATA_YEAR")).intValue();
        int month = ((Number)row.get("DATA_MONTH")).intValue();
        int yearMonth = year * 100 + month;

        if(yearMonth < TREND_FROM || yearMonth > TREND_TO){
          continue;
        }

        if(i == 0){
          labels.add( String.format("%d.%02d", year, month) );
        }

        Object kwh = row.get("TOTAL_KWH");
        if(series.isUseAverage()){
          kwh = row.get("AVG_KWH");
        }

        actual.add(null);
        forecast.add( toGwh(kwh) );
      }

      //실측과 예측은 서로 다른 표라서 그냥 이어 붙이면 두 선 사이가 끊긴다.
      //마지막 실측값을 예측 배열에도 한 번 더 넣어 선을 이어준다.
      boolean hasForecast = actual.size() > lastActual + 1;

      if(lastActual >= 0 && hasForecast){
        forecast.set(lastActual, actual.get(lastActual));
        forecastStart = lastActual;
      }

      Map<String, Object> one = new HashMap<>();
      one.put("name", series.getName());
      one.put("actual", actual);
      one.put("forecast", forecast);
      chartSeries.add(one);
    }

    Map<String, Object> resultMap = new HashMap<>();
    resultMap.put("unit", "GWh");
    resultMap.put("labels", labels);
    resultMap.put("forecastStart", forecastStart);
    resultMap.put("series", chartSeries);
    return resultMap;
  }

  /** 시도별 증감률 순위 (지역을 하나도 안 골랐을 때 보여주는 카드) */
  public Map<String, Object> getRankData(){
    List<HashMap<String, Object>> rows = kpiMapper.getForecastByRegion();

    Map<String, Object> resultMap = new HashMap<>();

    if(rows.isEmpty()){
      return resultMap;
    }

    List<String> names = new ArrayList<>();
    List<String> fullNames = new ArrayList<>();
    List<Double> yoyList = new ArrayList<>();

    for(HashMap<String, Object> row : rows){
      names.add( (String)row.get("SHORT_NAME") );
      fullNames.add( (String)row.get("REGION_NAME") );
      yoyList.add( toDouble(row.get("YOY_PCT")) );
    }

    HashMap<String, Object> first = rows.get(0);
    resultMap.put("year", first.get("DATA_YEAR"));
    resultMap.put("month", first.get("DATA_MONTH"));
    resultMap.put("names", names);
    resultMap.put("fullNames", fullNames);
    resultMap.put("yoyList", yoyList);

    return resultMap;
  }

  // ------------------------------------------------------------------
  // 아래는 위에서 쓰는 작은 도구 함수들
  // ------------------------------------------------------------------

  /** '서울특별시' -> '서울'. 목록에 없으면 받은 이름을 그대로 쓴다 */
  private String toShortName(String regionName){
    for(HashMap<String, Object> row : kpiMapper.getRegions()){
      if(regionName.equals(row.get("REGION_NAME"))){
        return (String)row.get("SHORT_NAME");
      }
    }
    return regionName;
  }

  /** kWh -> GWh (100만으로 나누고 반올림). 값이 없으면 null 그대로 돌려준다 */
  private static Long toGwh(Object kwh){
    if(kwh == null){
      return null;
    }
    return Math.round( ((Number)kwh).doubleValue() / KWH_PER_GWH );
  }

  /** DB 에서 온 숫자를 Double 로 바꾼다. 값이 없으면 null 그대로 돌려준다 */
  private static Double toDouble(Object value){
    if(value == null){
      return null;
    }
    return ((Number)value).doubleValue();
  }

}
