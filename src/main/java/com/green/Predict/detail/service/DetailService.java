package com.green.Predict.detail.service;

import com.green.Predict.detail.dto.RegionDetailRow;
import com.green.Predict.detail.mapper.DetailMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * [4번 소유] 좌측 "지역별 상세" 표 전용 서비스.
 *
 * 우측 차트 3종은 1번 팀원이 담당하므로 이 서비스는 손대지 않는다.
 * (지금은 단순 passthrough이지만, 추후 가공/캐싱이 필요하면 이 자리에 추가)
 */
@Service
@RequiredArgsConstructor
public class DetailService {

    private final DetailMapper detailMapper;

    /** 17개 시도의 요약 지표 (8월 예측 내림차순). */
    public List<RegionDetailRow> getTableRows() {
        return detailMapper.findAllRegionRows();
    }
}
