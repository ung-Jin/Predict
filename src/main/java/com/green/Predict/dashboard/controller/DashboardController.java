package com.green.Predict.dashboard.controller;

import com.green.Predict.common.Selection;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

@Controller
public class DashboardController {

    //대시보드 메인 페이지
    @GetMapping({"/", "/dashboard"})
    public String dashboard(@RequestParam(required = false) String a,
                            @RequestParam(required = false) String b,
                            Model model) {
        model.addAttribute("sel", Selection.of(a, b));

        return "dashboard";
    }
}
