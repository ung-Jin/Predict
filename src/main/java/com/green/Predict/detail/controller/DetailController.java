package com.green.Predict.detail.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * [4번 소유] /detail 접근 시 Thymeleaf 템플릿을 돌려주는 페이지 컨트롤러.
 *
 * 데이터는 전부 비동기(fetch)로 /detail-api/* 를 통해 받아오기 때문에
 * 여기서 Model에 값을 담을 필요가 없다. (SPA 식 패턴)
 */
@Controller
public class DetailController {

    @GetMapping("/detail")
    public String detail() {
        return "detail";    // templates/detail.html 을 렌더링
    }
}
