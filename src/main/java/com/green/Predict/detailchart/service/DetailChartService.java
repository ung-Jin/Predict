package com.green.Predict.detailchart.service;

import com.green.Predict.detailchart.mapper.DetailChartMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 상세 데이터 우측 차트 3종에 필요한 값을 한 번에 만들어서 보냄.
 * SQL 결과를 리스트로 나눠서 resultMap에 담는 방식.
 *
 * 선택한 지역 개수에 따라 보여줄 줄이 달라짐 (시안 기준)
 *   0개 : 전국 합계
 *   1개 : 선택한 지역 + 시도 평균
 *   2개 : 선택한 지역 A, B
 */
@Service
@RequiredArgsConstructor
public class DetailChartService {

    private final DetailChartMapper detailChartMapper;

    public Map<String, Object> selectChart(String a, String b) {

        // ---------- 1. 어떤 줄(1번, 2번)을 보여줄지 정하고 SQL 결과 가져오기 ----------
        String name1;
        String name2 = null;                                          // 2번 줄은 없을 수도 있음
        List<Map<String, Object>> yearly1;
        List<Map<String, Object>> yearly2 = new ArrayList<>();
        List<Map<String, Object>> monthly1;
        List<Map<String, Object>> monthly2 = new ArrayList<>();

        if (isEmpty(a) && isEmpty(b)) {                               // 0개 선택
            name1 = "전국 합계";
            yearly1 = detailChartMapper.findNationalYearlyAvg();
            monthly1 = detailChartMapper.findNationalMonthly();

        } else if (isEmpty(a) || isEmpty(b)) {                        // 1개 선택
            if (isEmpty(a)) {
                name1 = b;
            } else {
                name1 = a;
            }
            yearly1 = detailChartMapper.findYearlyAvg(name1);
            monthly1 = detailChartMapper.findMonthly(name1);

            name2 = "시도 평균";
            yearly2 = detailChartMapper.findAllRegionYearlyAvg();
            monthly2 = detailChartMapper.findAllRegionMonthly();

        } else {                                                      // 2개 선택
            name1 = a;
            yearly1 = detailChartMapper.findYearlyAvg(a);
            monthly1 = detailChartMapper.findMonthly(a);

            name2 = b;
            yearly2 = detailChartMapper.findYearlyAvg(b);
            monthly2 = detailChartMapper.findMonthly(b);
        }

        // ---------- 2. SQL 결과를 차트에 바로 넣을 수 있는 리스트로 나누기 ----------
        List<String> years = new ArrayList<>();                       // 연도 목록 (막대 가로축, 히트맵 세로축)
        List<Double> bar1 = new ArrayList<>();                        // 막대 값
        List<Double> bar2 = new ArrayList<>();

        for (Map<String, Object> map : yearly1) {
            years.add(String.valueOf(map.get("year")));
            bar1.add(toDouble(map.get("avgGwh")));
        }
        for (Map<String, Object> map : yearly2) {
            bar2.add(toDouble(map.get("avgGwh")));
        }

        // ---------- 3. 보낼 값을 resultMap에 담기 ----------
        Map<String, Object> resultMap = new HashMap<>();
        resultMap.put("name1", name1);
        resultMap.put("name2", name2);
        resultMap.put("years", years);
        resultMap.put("bar1", bar1);
        resultMap.put("bar2", bar2);
        resultMap.put("season1", makeSeason(monthly1));
        resultMap.put("season2", makeSeason(monthly2));
        resultMap.put("heat1", makeHeat(monthly1));
        resultMap.put("heat2", makeHeat(monthly2));
        resultMap.put("heatFoot1", makeHeatFoot(monthly1));
        resultMap.put("heatFoot2", makeHeatFoot(monthly2));

        return resultMap;
    }

    /**
     * 히트맵 칸 목록을 만든다. 칸 하나 = {x: 월, y: 연도, value: 사용량, opacity: 진하기}
     * 진하기는 가장 적게 쓴 달이 0.12, 가장 많이 쓴 달이 0.95 (시안)
     */
    private List<Map<String, Object>> makeHeat(List<Map<String, Object>> monthly) {
        // 가장 큰 값, 가장 작은 값 찾기
        double max = 0;
        double min = Double.MAX_VALUE;
        for (Map<String, Object> map : monthly) {
            double value = toDouble(map.get("usageGwh"));
            if (value > max) {
                max = value;
            }
            if (value < min) {
                min = value;
            }
        }

        // 칸 만들기
        List<Map<String, Object>> heat = new ArrayList<>();
        for (Map<String, Object> map : monthly) {
            double value = toDouble(map.get("usageGwh"));

            double ratio = 0;                                         // 0(가장 적음) ~ 1(가장 많음)
            if (max != min) {
                ratio = (value - min) / (max - min);
            }
            double opacity = 0.12 + 0.83 * ratio;

            Map<String, Object> point = new HashMap<>();
            point.put("x", String.valueOf(map.get("month")));         // 가로 위치: "1" ~ "12"
            point.put("y", String.valueOf(map.get("year")));          // 세로 위치: "2022" ...
            point.put("value", value);
            point.put("opacity", Math.round(opacity * 100) / 100.0);  // 소수 2자리
            heat.add(point);
        }
        return heat;
    }

    /** 히트맵 아래 문구. 예) 최대 5,547.9 (2025.8) · 최소 3,471.2 (2024.5) */
    private String makeHeatFoot(List<Map<String, Object>> monthly) {
        if (monthly.isEmpty()) {
            return "";
        }

        double max = 0;
        double min = Double.MAX_VALUE;
        String maxWhen = "";                                          // 가장 많이 쓴 연.월
        String minWhen = "";

        for (Map<String, Object> map : monthly) {
            double value = toDouble(map.get("usageGwh"));
            String when = map.get("year") + "." + map.get("month");
            if (value > max) {
                max = value;
                maxWhen = when;
            }
            if (value < min) {
                min = value;
                minWhen = when;
            }
        }

        // %,.1f : 천 단위 쉼표 + 소수 1자리
        return "최대 " + String.format("%,.1f", max) + " (" + maxWhen + ") · "
             + "최소 " + String.format("%,.1f", min) + " (" + minWhen + ")";
    }

    /**
     * 계절 패턴 12개 값(1월~12월)을 만든다.
     * 계산: 월 사용량 / 그 해 월평균 * 100 을 구하고, 여러 해의 값을 평균. (100 = 평소 수준)
     *
     * SQL 결과가 첫 해 1월부터 순서대로 와서, 12개씩 끊으면 1년치가 됨.
     * 12개가 안 되는 마지막 해(예: 2026년 1~7월)는 계산에서 뺌.
     */
    private List<Double> makeSeason(List<Map<String, Object>> monthly) {
        // 월별 값만 순서대로 꺼내기
        List<Double> values = new ArrayList<>();
        for (Map<String, Object> map : monthly) {
            values.add(toDouble(map.get("usageGwh")));
        }

        List<Double> season = new ArrayList<>();
        int fullYears = values.size() / 12;                           // 12개월이 다 있는 해의 수
        if (fullYears == 0) {
            return season;
        }

        for (int month = 0; month < 12; month++) {
            double sum = 0;

            for (int year = 0; year < fullYears; year++) {
                // 이 해의 월평균 구하기
                double yearTotal = 0;
                for (int k = 0; k < 12; k++) {
                    yearTotal += values.get(year * 12 + k);
                }
                double yearAvg = yearTotal / 12;

                sum += values.get(year * 12 + month) / yearAvg * 100;
            }

            double value = sum / fullYears;                           // 여러 해의 평균
            season.add(Math.round(value * 10) / 10.0);                // 소수 1자리
        }
        return season;
    }

    // SQL 결과의 숫자를 double로 바꿈. 숫자 종류가 여러 가지라서 글자로 바꿨다가 다시 double로 읽음
    private double toDouble(Object value) {
        return Double.parseDouble(String.valueOf(value));
    }

    // null, 빈 문자열(""), 공백은 모두 "선택 안 함"
    private boolean isEmpty(String s) {
        return s == null || s.isBlank();
    }
}
