package com.green.Predict.kpi.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * [3번 소유] 화면에 그릴 "한 줄"의 정보.
 *
 * 요약 카드의 한 줄, 3개월 예측의 막대 한 묶음, 추이 차트의 선 하나가 전부 이 단위다.
 * 지도에서 고른 지역 수에 따라 1줄 또는 2줄이 만들어진다.
 *   0개 : 전국
 *   1개 : 고른 지역 + 시도 평균
 *   2개 : 지역A + 지역B
 */
@Data
@AllArgsConstructor
public class SeriesDTO {

  /** 화면에 보여줄 이름 (전국 / 경북 / 시도 평균) */
  private String name;

  /** DB 에서 걸러낼 시도명. null 이면 17개 시도 전체 */
  private String regionName;

  /** true 면 17개 시도의 평균, false 면 합계를 쓴다 */
  private boolean useAverage;

}
