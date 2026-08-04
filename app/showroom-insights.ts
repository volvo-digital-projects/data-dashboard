export type ShowroomInsightKey = "v3s" | "voc" | "cx";

export type ShowroomInsight = {
  key: ShowroomInsightKey;
  label: string;
  message: string;
};

type ShowroomInsightRecord = {
  cdsid: string;
  v3s: number | null;
  voc: number | null;
  cx: number | null;
  delivery: number | null;
  testDrive: number | null;
  app: number | null;
  q1?: { v3s: number | null } | null;
};

type ShowroomInsightAverages = {
  v3s: number | null;
  voc: number | null;
  delivery: number | null;
  testDrive: number | null;
  app: number | null;
};

export const buildShowroomInsights = (
  showroom: ShowroomInsightRecord,
  averages: ShowroomInsightAverages,
): ShowroomInsight[] => {
  if (showroom.cdsid === "6KR6841") {
    return [
      {
        key: "v3s",
        label: "V3S",
        message:
          "2023년 97.2→2025년 92.5→Q2 84.7점으로 하락세가 이어져, 상담·제안·클로징 롤플레잉 강화가 우선입니다.",
      },
      {
        key: "voc",
        label: "VOC",
        message:
          "Q2 99.3점이나 회신 5/20건(25%)이고 무응답 주차는 딜러 평균 보정—회신률을 높여 성과 신뢰도를 확보해야 합니다.",
      },
      {
        key: "cx",
        label: "CX Index",
        message:
          "출고 100·앱 93.6·관리항목 만점 대비 시승 85점이 병목—니즈 확인과 시승 후 24시간 내 후속 연락을 표준화해야 합니다.",
      },
    ];
  }

  const v3sValue = showroom.v3s ?? 0;
  const v3sQuarterDelta = v3sValue - (showroom.q1?.v3s ?? v3sValue);
  const v3sNationalDelta = v3sValue - (averages.v3s ?? 0);
  const vocValue = showroom.voc ?? 0;
  const vocNationalDelta = vocValue - (averages.voc ?? 0);
  const cxValue = showroom.cx ?? 0;
  const cxComponents = [
    {
      label: "출고 만족도",
      value: showroom.delivery,
      average: averages.delivery,
    },
    {
      label: "시승 만족도",
      value: showroom.testDrive,
      average: averages.testDrive,
    },
    {
      label: "앱 가입률",
      value: showroom.app,
      average: averages.app,
    },
  ]
    .filter(
      (
        item,
      ): item is { label: string; value: number; average: number } =>
        typeof item.value === "number" && typeof item.average === "number",
    )
    .sort((a, b) => a.value - a.average - (b.value - b.average));
  const weakestCx = cxComponents[0];

  return [
    {
      key: "v3s",
      label: "V3S",
      message: `Q1 대비 ${v3sQuarterDelta >= 0 ? "▲" : "▼"}${Math.abs(v3sQuarterDelta).toFixed(1)}점, 전국 평균 대비 ${v3sNationalDelta >= 0 ? "▲" : "▼"}${Math.abs(v3sNationalDelta).toFixed(1)}점—영업 스킬의 분기 변화를 우선 점검하세요.`,
    },
    {
      key: "voc",
      label: "VOC",
      message: `Q2 ${vocValue.toFixed(1)}점, 전국 평균 대비 ${vocNationalDelta >= 0 ? "▲" : "▼"}${Math.abs(vocNationalDelta).toFixed(1)}점—주간 편차와 고객 회신 품질을 함께 관리하세요.`,
    },
    {
      key: "cx",
      label: "CX Index",
      message: `Q2 ${cxValue.toFixed(1)}점이며 ${weakestCx?.label ?? "세부 구성항목"}이 상대적 보완 영역—고객 여정별 실행 편차를 줄이세요.`,
    },
  ];
};
