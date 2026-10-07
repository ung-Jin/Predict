package com.green.Predict.detail.controller;

import com.green.Predict.detail.dto.RegionDetailRow;
import com.green.Predict.detail.service.DetailService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * [4번 소유] 상세 데이터 페이지 좌측 표가 axios로 호출하는 JSON API.
 *
 * 우측 차트 3종은 1번 팀원이 담당하므로 이 컨트롤러에는 관련 엔드포인트가 없다.
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/detail-api")
public class DetailApiController {

    private final DetailService detailService;

    /** 좌측 표: 17개 시도의 요약 (8월 예측 + 전년대비 + MAPE/RMSE/MAE). */
    @GetMapping("/table")
    public List<RegionDetailRow> table() {
        return detailService.getTableRows();
    }
}
