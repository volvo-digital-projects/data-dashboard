"use client";

import DashboardHeaderLead from "./DashboardHeaderLead";
import dashboardJson from "./data/showrooms.json";
import vocStaffAnalysisJson from "./data/voc-staff-analysis.json";
import staffCertificationsJson from "./data/staff-certifications.json";

type Showroom = {
  cdsid: string;
  showroom: string;
  dealer: string;
  manager: string;
  region: string;
  size: string;
};
type Certification = {
  year: number;
  name: string;
  showroom: string;
  level: "Grand" | "Advanced" | "Certified";
};
type VocShowroom = {
  dealer: string;
  employees: { name: string }[];
};
const dealerOrder = ["아주", "천하", "에이치", "아이언", "아이비", "코오롱", "태영"];
const years = staffCertificationsJson.sourceYears as number[];
const showrooms = dashboardJson.showrooms as Showroom[];
const certifications = staffCertificationsJson.records as Certification[];
const vocShowrooms = vocStaffAnalysisJson.showrooms as Record<string, VocShowroom>;
const certificationDealerOverrides: Record<string, string> = {
  "2025:장석우": "에이치",
  "2025:주재홍": "에이치",
  "2025:강민성": "코오롱",
  "2025:백승국": "코오롱",
  "2025:이동담": "코오롱",
  "2025:김승곤": "아이비",
};

const showroomAliases: Record<string, string> = {
  대치: "강남대치",
  신사: "강남신사",
  분당서현: "분당",
  판교: "분당판교",
};

function normalizeShowroom(value: string) {
  const normalized = value.replace(/^볼보\s*/, "").replace(/\s+/g, "");
  return showroomAliases[normalized] ?? normalized;
}

const showroomDealer = new Map(
  showrooms.map((showroom) => [normalizeShowroom(showroom.showroom), showroom.dealer]),
);

const currentDealersByName = new Map<string, Set<string>>();
for (const showroom of Object.values(vocShowrooms)) {
  for (const employee of showroom.employees) {
    const dealers = currentDealersByName.get(employee.name) ?? new Set<string>();
    dealers.add(showroom.dealer);
    currentDealersByName.set(employee.name, dealers);
  }
}

function certificationDealer(record: Certification) {
  const verifiedOverride = certificationDealerOverrides[`${record.year}:${record.name}`];
  if (verifiedOverride) return verifiedOverride;
  const mapped = showroomDealer.get(normalizeShowroom(record.showroom));
  if (mapped) return mapped;
  const currentDealers = currentDealersByName.get(record.name);
  return currentDealers?.size === 1 ? [...currentDealers][0] : null;
}

const dealerRows = dealerOrder.map((dealer) => {
  const dealerShowrooms = showrooms.filter((showroom) => showroom.dealer === dealer);
  const currentNames = new Set(
    dealerShowrooms.flatMap((showroom) =>
      (vocShowrooms[showroom.cdsid]?.employees ?? []).map((employee) => employee.name),
    ),
  );
  const dealerCertifications = certifications.filter(
    (record) => certificationDealer(record) === dealer,
  );
  const currentCertified = [...currentNames].filter((name) =>
    certifications.some((record) => record.name === name),
  ).length;
  const levelCounts = {
    Grand: dealerCertifications.filter((record) => record.level === "Grand").length,
    Advanced: dealerCertifications.filter((record) => record.level === "Advanced").length,
    Certified: dealerCertifications.filter((record) => record.level === "Certified").length,
  };
  return {
    dealer,
    showroomCount: dealerShowrooms.length,
    certificationCount: dealerCertifications.length,
    currentCertified,
    levelCounts,
  };
}).sort(
  (a, b) =>
    b.certificationCount - a.certificationCount ||
    dealerOrder.indexOf(a.dealer) - dealerOrder.indexOf(b.dealer),
);

const totalCertifications = certifications.length;
const totalLevels = {
  Grand: certifications.filter((record) => record.level === "Grand").length,
  Advanced: certifications.filter((record) => record.level === "Advanced").length,
  Certified: certifications.filter((record) => record.level === "Certified").length,
};
const totalCurrentCertified = dealerRows.reduce((sum, row) => sum + row.currentCertified, 0);
const unmatchedCertifications = certifications.filter((record) => !certificationDealer(record));

function percentage(value: number, total: number) {
  return total > 0 ? `${((value / total) * 100).toFixed(1)}%` : "0.0%";
}

export default function DealerAnalysis({ initialCdsid }: { initialCdsid: string }) {
  const selected = showrooms.find((showroom) => showroom.cdsid === initialCdsid) ?? showrooms[0];
  const accessDate = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()).replace(/\.\s?/g, ".").replace(/\.$/, "");

  return (
    <main className="dealer-analysis-page">
      <div className="dealer-analysis-command-shell">
      <header className="dashboard-identity-header analysis-header dealer-analysis-header">
        <DashboardHeaderLead
          title="딜러사별 분석자료"
          accessDate={accessDate}
          titleClassName="analysis-title"
          dashboardReturn={{
            href: `/dashboard/${selected.cdsid}/analysis?view=size`,
            label: "분석자료",
            ariaLabel: "기존 페이지 2 분석자료로 돌아가기",
          }}
        />
      </header>
      </div>

      <section className="dealer-analysis-board" aria-labelledby="dealer-analysis-board-title">
        <div className="dealer-analysis-section-title">
          <div>
            <small>DEALER COMPARISON</small>
            <h2 id="dealer-analysis-board-title">딜러사별 인증 레벨 인원 및 비율</h2>
          </div>
          <p>2021–2026 인증 결과 180명 기준 · 동일 인물의 연도별 수상은 각각 포함</p>
        </div>

        <div className="dealer-certification-table" role="table" aria-label="7개 딜러사 인증 레벨별 인원과 비율">
          <div className="dealer-certification-row dealer-certification-head" role="row">
            <span role="columnheader">딜러사</span>
            <span role="columnheader">전체 인증</span>
            <span role="columnheader">Grand</span>
            <span role="columnheader">Advanced</span>
            <span role="columnheader">Certified</span>
            <span role="columnheader">현재 재직 확인</span>
          </div>
          <article className="dealer-certification-row dealer-certification-aggregate" role="row">
            <div className="dealer-certification-name" role="cell">
              <div><h3>전체</h3></div>
              <b>7개사</b>
            </div>
            <div className="dealer-certification-total" role="cell">
              <strong>{totalCertifications}<i>명</i></strong>
            </div>
            {(["Grand", "Advanced", "Certified"] as const).map((level) => (
              <div className={`dealer-certification-level level-${level.toLowerCase()}`} role="cell" key={level}>
                <span><strong>{totalLevels[level]}</strong><i>명</i><b>{percentage(totalLevels[level], totalCertifications)}</b></span>
              </div>
            ))}
            <div className="dealer-certification-current" role="cell">
              <strong>{totalCurrentCertified}<i>명</i></strong>
            </div>
          </article>
          {dealerRows.map((row) => (
            <article className="dealer-certification-row" role="row" key={row.dealer}>
              <div className="dealer-certification-name" role="cell">
                <div><h3>{row.dealer}</h3></div>
                <b>{row.showroomCount}개소</b>
              </div>
              <div className="dealer-certification-total" role="cell">
                <strong>{row.certificationCount}<i>명</i></strong>
              </div>
              {(["Grand", "Advanced", "Certified"] as const).map((level) => (
                <div className={`dealer-certification-level level-${level.toLowerCase()}`} role="cell" key={level}>
                  <span><strong>{row.levelCounts[level]}</strong><i>명</i><b>{percentage(row.levelCounts[level], row.certificationCount)}</b></span>
                </div>
              ))}
              <div className="dealer-certification-current" role="cell">
                <strong>{row.currentCertified}<i>명</i></strong>
              </div>
            </article>
          ))}
        </div>
        <div className="dealer-certification-reconcile">
          <span>딜러사 확인 <strong>{totalCertifications - unmatchedCertifications.length}명</strong></span>
          <span>딜러사 미확인 <strong>{unmatchedCertifications.length}명</strong> · 윤종현(Advanced), 김형선(Certified)</span>
          <span>전국 총계 <strong>{totalCertifications}명</strong></span>
        </div>
      </section>

      <section className="dealer-analysis-roadmap">
        <div className="dealer-analysis-roadmap-icon" aria-hidden="true">▶</div>
        <div>
          <small>YOUTUBE PERFORMANCE</small>
          <h2>채널 활동 × 판매 추이 분석</h2>
          <p>채널 주소를 연결하면 개설일을 기준으로 롱폼·쇼츠 업로드 수와 판매대수 추이를 딜러사별로 같은 화면에 확장합니다.</p>
        </div>
        <span>데이터 연결 대기</span>
      </section>

      <p className="dealer-analysis-data-note">
        현재 재직 확인은 인증 이력과 현재 Sales-DMS 명단의 이름을 연결한 값이며, 명단에서 확인되지 않는 과거 인증자를 퇴사자로 단정하지 않습니다. 딜러사 미확인 2명은 원자료에 전시장 정보가 없어 별도로 보존했습니다.
      </p>
    </main>
  );
}
