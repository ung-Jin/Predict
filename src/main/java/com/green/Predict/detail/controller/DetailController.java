package com.green.Predict.detail.controller;


import com.green.Predict.detail.service.DetailService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;


/** [4번 소유] 상세 데이터 페이지 컨트롤러. */
@Controller
@RequiredArgsConstructor
public class DetailController {
    private final DetailService detailService;

    @GetMapping("/detail")
    public String detail() {

        return "detail";
    }

}
