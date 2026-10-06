package com.green.Predict.detailchart.controller;

import com.green.Predict.detailchart.service.DetailChartService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;


@RestController
@RequestMapping("/detail/chart")
@RequiredArgsConstructor
public class DetailChartController {

    private final DetailChartService detailChartService;

    // 차트 3종에 필요한 값을 한 번에 돌려줌
    // 예) /detail/chart?a=서울특별시&b=울산광역시   (a, b는 없어도 됨)
    @GetMapping
    public Map<String, Object> chart(
            @RequestParam(required = false) String a,
            @RequestParam(required = false) String b) {
        return detailChartService.selectChart(a, b);
    }
}
