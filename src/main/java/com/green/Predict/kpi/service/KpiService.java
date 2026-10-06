package com.green.Predict.kpi.service;

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

  private final KpiMapper kpiMapper;

  /**
   * 화면에 그릴 "한 줄"의 정보를 담아두는 클래스.
   * 카드도, 막대도, 선도 전부 이 한 줄 단위로 그린다.
   */
  private static class Series {
    String name;          //화면에 보여줄 이름 (전국 / 서울 / 시도 평균)
    String regionName;    //DB 에서 걸러낼 시도명. null 이면 17개 시도 전체
    boolean useAverage;   //true 면 17개 시도의 평균, false 면 합계를 쓴다

    Series(String name, String regionName, boolean useAverage){
      this.name = name;
      this.regionName = regionName;
      this.useAverage = useAverage;
    }
  }

  /**
   * 지도에서 고른 지역(a, b)을 보고 화면에 몇 줄을 그릴지 정한다.
   *   아무것도 안 골랐으면 : 전국 합계 한 줄
   *   하나 골랐으면        : 그 시도 + 시도 평균 (비교용)
   *   두 개 골랐으면       : 두 시도
   */
  private List<Series> makeSeriesList(String a, String b){
    List<Series> list = new ArrayList<>();

    String regionA = emptyToNull(a);
    String regionB = emptyToNull(b);

    //아무것도 안 골랐을 때
    if(regionA == null && regionB == null){
      list.add(new Series("전국", null, false));
      return list;
    }

    //A 는 비었는데 B 만 골랐으면 B 를 A 자리로 옮겨서 똑같이 처리한다
    if(regionA == null){
      regionA = regionB;
      regionB = null;
    }

    //첫 번째 줄 : 고른 지역
    list.add(new Series(toShortName(regionA), regionA, false));

    //두 번째 줄 : 두 번째 지역이 있으면 그 지역, 없으면 시도 평균
    if(regionB != null){
      list.add(new Series(toShortName(regionB), regionB, false));
    }else{
      list.add(new Series("시도 평균", null, true));
    }

    return list;
  }

  /**
   * 요약 카드 4개.
   * 줄 하나를 만들려면 쿼리 3개(최근 실측 / 3개월 예측 / 검증 오차)를 각각 돌린다.
   */
  public Map<String, Object> getCardData(String a, String b){
    List<Series> seriesList = makeSeriesList(a, b);
    List<Map<String, Object>> cards = new ArrayList<>();

    Map<String, Object> resultMap = new HashMap<>();

    for(int i = 0; i < seriesList.size(); i++){
      Series series = seriesList.get(i);

      List<HashMap<String, Object>> recentRows = kpiMapper.getRecentUsage(series.regionName);
      List<HashMap<String, Object>> forecastRows = kpiMapper.getForecastTrend(series.regionName);
      List<HashMap<String, Object>> mapeRows = kpiMapper.getMape(series.regionName);

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

      Map<String, Object> card = new HashMap<>();
      card.put("name", series.name);
      card.put("recentGwh", toGwh(pickValue(recent, series)));
      card.put("predictedGwh", toGwh(pickValue(forecast, series)));
      card.put("yoyPct", toDouble(forecast.get("YOY_PCT")));
      card.put("mape", toDouble(mape.get("MAPE")));
      cards.add(card);
    }

    resultMap.put("series", cards);
    return resultMap;
  }

  /** 앞으로 3개월 예측 (막대 차트) */
  public Map<String, Object> getForecast3Data(String a, String b){
    List<Series> seriesList = makeSeriesList(a, b);

    List<String> labels = new ArrayList<>();
    List<Map<String, Object>> chartSeries = new ArrayList<>();

    for(int i = 0; i < seriesList.size(); i++){
      Series series = seriesList.get(i);
      List<HashMap<String, Object>> rows = kpiMapper.getForecastTrend(series.regionName);

      List<Long> predicted = new ArrayList<>();
      List<Long> prevYear = new ArrayList<>();
      List<Double> yoyList = new ArrayList<>();

      for(HashMap<String, Object> row : rows){
        //x축 이름(8월, 9월, 10월)은 첫 번째 줄을 돌 때만 만들면 된다
        if(i == 0){
          labels.add( toInt(row.get("DATA_MONTH")) + "월" );
        }
        predicted.add(toGwh(pickValue(row, series)));
        prevYear.add(toGwh(pickPrevValue(row, series)));
        yoyList.add(toDouble(row.get("YOY_PCT")));
      }

      Map<String, Object> one = new HashMap<>();
      one.put("name", series.name);
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

  /** 월별 사용량 추이 (실측 전체 + 앞으로 3개월 예측) */
  public Map<String, Object> getTrendData(String a, String b){
    List<Series> seriesList = makeSeriesList(a, b);

    List<String> labels = new ArrayList<>();
    List<Map<String, Object>> chartSeries = new ArrayList<>();
    int forecastStart = -1;

    for(int i = 0; i < seriesList.size(); i++){
      Series series = seriesList.get(i);

      List<HashMap<String, Object>> actualRows = kpiMapper.getActualTrend(series.regionName);
      List<HashMap<String, Object>> forecastRows = kpiMapper.getForecastTrend(series.regionName);

      List<Long> actual = new ArrayList<>();
      List<Long> forecast = new ArrayList<>();

      //실측 구간 : 실측 값만 채우고 예측 자리는 비워둔다(null)
      for(HashMap<String, Object> row : actualRows){
        if(i == 0){
          labels.add(toLabel(row));
        }
        actual.add(toGwh(pickValue(row, series)));
        forecast.add(null);
      }

      //예측 구간 : 반대로 예측만 채운다
      for(HashMap<String, Object> row : forecastRows){
        if(i == 0){
          labels.add(toLabel(row));
        }
        actual.add(null);
        forecast.add(toGwh(pickValue(row, series)));
      }

      //실측과 예측은 서로 다른 표라서 그냥 이어 붙이면 두 선 사이가 끊긴다.
      //마지막 실측값을 예측 배열에도 한 번 더 넣어 선을 이어준다.
      int lastActual = actualRows.size() - 1;
      if(lastActual >= 0 && !forecastRows.isEmpty()){
        forecast.set(lastActual, actual.get(lastActual));
        forecastStart = lastActual;
      }

      Map<String, Object> one = new HashMap<>();
      one.put("name", series.name);
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

  /** 합계를 쓸지 평균을 쓸지 고른다 (시도를 하나만 걸렀으면 둘이 같은 값이다) */
  private static Object pickValue(HashMap<String, Object> row, Series series){
    if(series.useAverage){
      return row.get("AVG_KWH");
    }
    return row.get("TOTAL_KWH");
  }

  /** 위와 같지만 "작년 같은 달" 값을 고른다 (3개월 예측의 얇은 막대용) */
  private static Object pickPrevValue(HashMap<String, Object> row, Series series){
    if(series.useAverage){
      return row.get("PREV_AVG_KWH");
    }
    return row.get("PREV_TOTAL_KWH");
  }

  /** 2026년 7월 -> "2026.07" (추이 차트 x축 이름) */
  private static String toLabel(HashMap<String, Object> row){
    int year = toInt(row.get("DATA_YEAR"));
    int month = toInt(row.get("DATA_MONTH"));
    return String.format("%d.%02d", year, month);
  }

  /** '서울특별시' -> '서울'. 목록에 없으면 받은 이름을 그대로 쓴다 */
  private String toShortName(String regionName){
    for(HashMap<String, Object> row : kpiMapper.getRegions()){
      if(regionName.equals(row.get("REGION_NAME"))){
        return (String)row.get("SHORT_NAME");
      }
    }
    return regionName;
  }

  /** 빈 문자열은 null 과 같이 취급한다 */
  private static String emptyToNull(String value){
    if(value == null || value.isBlank()){
      return null;
    }
    return value;
  }

  /** kWh -> GWh (100만으로 나누고 반올림) */
  private static Long toGwh(Object kwh){
    if(kwh == null){
      return null;
    }
    return Math.round( ((Number)kwh).doubleValue() / KWH_PER_GWH );
  }

  /** DB 에서 온 숫자를 Double 로 바꾼다 */
  private static Double toDouble(Object value){
    if(value == null){
      return null;
    }
    return ((Number)value).doubleValue();
  }

  /** DB 에서 온 숫자를 int 로 바꾼다 */
  private static int toInt(Object value){
    return ((Number)value).intValue();
  }

}
