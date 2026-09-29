package com.green.Predict.detail.mapper;

import com.green.Predict.detail.dto.RegionDetailRow;
import org.apache.ibatis.annotations.Mapper;
import java.util.List;

/** [4번 소유] SQL은 resources/mapper/DetailMapper.xml 에 작성합니다. */
@Mapper
public interface DetailMapper {
    List<RegionDetailRow> findAllDetail();
}
