type DashboardInsight = {
  key: string;
  label: string;
  message: string;
};

type DashboardHeaderLeadProps = {
  title: string;
  accessDate: string;
  status: string;
  insights: readonly DashboardInsight[];
  insightLabel: string;
  titleClassName?: string;
};

export default function DashboardHeaderLead({
  title,
  accessDate,
  status,
  insights,
  insightLabel,
  titleClassName = "",
}: DashboardHeaderLeadProps) {
  return (
    <>
      <div className={`identity-title ${titleClassName}`.trim()}>
        <h1>{title}</h1>
        <div className="update-status">
          <div className="update-status-line">
            <i aria-hidden="true" />
            <time dateTime={accessDate.replaceAll(".", "-")}>
              업데이트 {accessDate} 기준
            </time>
          </div>
          <div className="update-status-line">
            <i aria-hidden="true" />
            <span>{status}</span>
            <form className="dashboard-logout-form" action="/api/logout" method="post">
              <button className="dashboard-logout-button" type="submit">
                로그아웃
                <span className="dashboard-logout-icon" aria-hidden="true">
                  <i />
                </span>
              </button>
            </form>
          </div>
        </div>
      </div>
      <aside className="identity-insights" aria-label={insightLabel}>
        {insights.map((insight) => (
          <p className={`identity-insight-row ${insight.key}`} key={insight.key}>
            <b>{insight.label}</b>
            <span title={insight.message}>{insight.message}</span>
          </p>
        ))}
      </aside>
    </>
  );
}
