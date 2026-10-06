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

  //DB는 kWh, 화면은 GWh
  private static final double KWH_PER_GWH = 1000000d;

  private static final String AVG_LABEL = "시도 평균";
  private static final String ALL_LABEL = "전국";

  private final KpiMapper kpiMapper;

  /**
   * 화면에 그릴 "한 줄"의 정의.
   * regionName 이 null 이면 17개 시도 전체를 보는 것이고,
   * 그때 useAvg 가 true 면 시도 평균, false 면 전국 합계를 쓴다.
   */
  private record Series(String name, String regionName, boolean useAvg) {}

  /**
   * 선택 상태를 화면에 그릴 줄 목록으로 바꾼다.
   *   선택 0개 : 전국 합계 한 줄
   *   선택 1개 : 그 시도 + 시도 평균
   *   선택 2개 : 두 시도
   */
  private List<Series> resolveSeries(String a, String b){
    List<Series> list = new ArrayList<>();
    String regionA = blankToNull(a);
    String regionB = blankToNull(b);

    if(regionA == null && regionB == null){
      list.add(new Series(ALL_LABEL, null, false));
      return list;
    }
    //A 가 비고 B 만 있는 경우도 A 자리로 당겨서 처리한다
    if(regionA == null){
      regionA = regionB;
      regionB = null;
    }

    list.add(new Series(shortNameOf(regionA), regionA, false));
    if(regionB != null){
      list.add(new Series(shortNameOf(regionB), regionB, false));
    }else{
      list.add(new Series(AVG_LABEL, null, true));
    }
    return list;
  }

  //요약 카드 4개
  public Map<String, Object> getCardData(String a, String b){
    List<Series> seriesList = resolveSeries(a, b);
    List<Map<String, Object>> cards = new ArrayList<>();

    Map<String, Object> resultMap = new HashMap<>();

    for(Series series : seriesList){
      List<HashMap<String, Object>> rows = kpiMapper.getCard(series.regionName());
      if(rows.isEmpty()) continue;
      HashMap<String, Object> row = rows.get(0);

      //기준 연/월은 어느 줄이든 같으므로 첫 줄 것을 쓴다
      resultMap.putIfAbsent("recentYear", row.get("RECENT_YEAR"));
      resultMap.putIfAbsent("recentMonth", row.get("RECENT_MONTH"));
      resultMap.putIfAbsent("forecastMonth", row.get("FORECAST_MONTH"));

      Map<String, Object> card = new HashMap<>();
      card.put("name", series.name());
      card.put("recentGwh", toGwh(pick(row, "RECENT_TOTAL_KWH", "RECENT_AVG_KWH", series.useAvg())));
      card.put("predictedGwh", toGwh(pick(row, "PREDICTED_TOTAL_KWH", "PREDICTED_AVG_KWH", series.useAvg())));
      card.put("yoyPct", toDouble(row.get("YOY_PCT")));
      card.put("mape", toDouble(row.get("MAPE")));
      cards.add(card);
    }

    resultMap.put("series", cards);
    return resultMap;
  }

  //앞으로 3개월 예측 (막대 차트)
  public Map<String, Object> getForecast3Data(String a, String b){
    List<Series> seriesList = resolveSeries(a, b);
    List<String> labels = new ArrayList<>();
    List<Map<String, Object>> chartSeries = new ArrayList<>();

    for(Series series : seriesList){
      List<HashMap<String, Object>> rows = kpiMapper.getForecastTrend(series.regionName());

      List<Long> predicted = new ArrayList<>();
      List<Long> prevYear = new ArrayList<>();
      List<Double> yoyList = new ArrayList<>();
      boolean needLabels = labels.isEmpty();

      for(HashMap<String, Object> row : rows){
        if(needLabels){
          labels.add( ((Number)row.get("DATA_MONTH")).intValue() + "월" );
        }
        predicted.add(toGwh(pick(row, "TOTAL_KWH", "AVG_KWH", series.useAvg())));
        prevYear.add(toGwh(pick(row, "PREV_TOTAL_KWH", "PREV_AVG_KWH", series.useAvg())));
        yoyList.add(toDouble(row.get("YOY_PCT")));
      }

      Map<String, Object> one = new HashMap<>();
      one.put("name", series.name());
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

  //월별 사용량 추이 (실측 전체 + 앞으로 3개월 예측)
  public Map<String, Object> getTrendData(String a, String b){
    List<Series> seriesList = resolveSeries(a, b);
    List<String> labels = new ArrayList<>();
    List<Map<String, Object>> chartSeries = new ArrayList<>();
    int forecastStart = -1;

    for(Series series : seriesList){
      List<HashMap<String, Object>> actualRows = kpiMapper.getActualTrend(series.regionName());
      List<HashMap<String, Object>> forecastRows = kpiMapper.getForecastTrend(series.regionName());

      List<Long> actual = new ArrayList<>();
      List<Long> forecast = new ArrayList<>();
      boolean needLabels = labels.isEmpty();

      for(HashMap<String, Object> row : actualRows){
        if(needLabels) labels.add(toLabel(row));
        actual.add(toGwh(pick(row, "TOTAL_KWH", "AVG_KWH", series.useAvg())));
        forecast.add(null);
      }
      for(HashMap<String, Object> row : forecastRows){
        if(needLabels) labels.add(toLabel(row));
        actual.add(null);
        forecast.add(toGwh(pick(row, "TOTAL_KWH", "AVG_KWH", series.useAvg())));
      }

      //실측과 예측은 서로 다른 표라서 그냥 이어 붙이면 사이가 끊긴다.
      //마지막 실측값을 예측 배열에도 한 번 더 넣어 두 선을 잇는다.
      int lastActual = actualRows.size() - 1;
      if(lastActual >= 0 && !forecastRows.isEmpty()){
        forecast.set(lastActual, actual.get(lastActual));
        forecastStart = lastActual;
      }

      Map<String, Object> one = new HashMap<>();
      one.put("name", series.name());
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

  //시도별 예측 증감률 (선택한 지역이 없을 때 보여주는 순위 카드)
  // {
  //    year : 2026, month : 8,
  //    names     : ['부산', '대구' ...],
  //    fullNames : ['부산광역시', ...],
  //    yoyList   : [4.2, 4.1 ...]
  // }
  public Map<String, Object> getYoyRankData(){
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

  //전체를 볼 때만 합계/평균이 갈린다. 시도 하나를 걸렀으면 둘이 같은 값이다
  private static Object pick(HashMap<String, Object> row, String totalKey, String avgKey, boolean useAvg){
    return useAvg ? row.get(avgKey) : row.get(totalKey);
  }

  //2026년 7월 -> "2026.07"
  private static String toLabel(HashMap<String, Object> row){
    int year = ((Number)row.get("DATA_YEAR")).intValue();
    int month = ((Number)row.get("DATA_MONTH")).intValue();
    return String.format("%d.%02d", year, month);
  }

  //서울특별시 -> 서울. 못 찾으면 받은 이름을 그대로 쓴다
  private String shortNameOf(String regionName){
    for(HashMap<String, Object> row : kpiMapper.getRegions()){
      if(regionName.equals(row.get("REGION_NAME"))){
        return (String)row.get("SHORT_NAME");
      }
    }
    return regionName;
  }

  private static String blankToNull(String value){
    return (value == null || value.isBlank()) ? null : value;
  }

  private static Long toGwh(Object kwh){
    if(kwh == null) return null;
    return Math.round( ((Number)kwh).doubleValue() / KWH_PER_GWH );
  }

  private static Double toDouble(Object value){
    if(value == null) return null;
    return ((Number)value).doubleValue();
  }

}
