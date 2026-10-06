package com.green.Predict.kpi.controller;

import com.green.Predict.kpi.service.KpiService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * [3번 소유] 요약 카드 / 3개월 예측 / 월별 추이가 axios 로 불러가는 JSON 엔드포인트.
 *
 * a, b 는 지도에서 고른 시도명(예: 서울특별시). 2번의 map-app.js 가
 * sessionStorage 에 넣어둔 selectedRegionA / selectedRegionB 값을 그대로 받는다.
 *   - 둘 다 없음 : 전국 기준
 *   - a 만 있음  : a vs 시도 평균
 *   - a, b 있음  : a vs b
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/chart-api")
public class KpiApiController {
  private final KpiService kpiService;

  //요약 카드 4개 (static/js/kpi.js 가 호출)
  @GetMapping("/card")
  public Map<String, Object> card(@RequestParam(required = false) String a,
                                  @RequestParam(required = false) String b){
    return kpiService.getCardData(a, b);
  }

  //앞으로 3개월 예측 (static/js/forecast3.js 가 호출)
  @GetMapping("/forecast3")
  public Map<String, Object> forecast3(@RequestParam(required = false) String a,
                                       @RequestParam(required = false) String b){
    return kpiService.getForecast3Data(a, b);
  }

  //시도별 예측 증감률 - 선택 0개일 때 (static/js/yoyrank.js 가 호출)
  @GetMapping("/yoyrank")
  public Map<String, Object> yoyrank(){
    return kpiService.getYoyRankData();
  }

  //월별 사용량 추이 (static/js/trend.js 가 호출)
  @GetMapping("/trend")
  public Map<String, Object> trend(@RequestParam(required = false) String a,
                                   @RequestParam(required = false) String b){
    return kpiService.getTrendData(a, b);
  }

}
