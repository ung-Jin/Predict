package com.green.Predict.detail.mapper;

import com.green.Predict.detail.dto.RegionDetailRow;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

/**
 * [4번 소유] 상세 데이터 페이지 좌측 표 전용 쿼리 창구.
 * SQL은 resources/mapper/DetailMapper.xml 에 있다.
 *
 * - @Mapper : MyBatis가 이 인터페이스의 메서드를 같은 id의 SQL과 자동 연결한다.
 */
@Mapper
public interface DetailMapper {

    // 좌측 "지역별 상세" 표: 17개 시도의 8월 예측 + 정확도 지표
    List<RegionDetailRow> findAllRegionRows();
}
