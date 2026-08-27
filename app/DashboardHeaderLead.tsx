type DashboardHeaderLeadProps = {
  title: string;
  accessDate: string;
  titleClassName?: string;
};

export default function DashboardHeaderLead({
  title,
  accessDate,
  titleClassName = "",
}: DashboardHeaderLeadProps) {
  const compactAccessDate = accessDate.replaceAll(".", "").slice(-6);

  return (
    <>
      <div className={`identity-title ${titleClassName}`.trim()}>
        <h1>{title}</h1>
        <div
          className="header-status-row"
          aria-label={`${compactAccessDate} 기준, Q3 평가·집계중, 로그아웃`}
        >
          <div className="header-status-item header-status-item--update">
            <span
              className="header-status-icon header-status-icon--update"
              aria-hidden="true"
            />
            <span>
              <time dateTime={accessDate.replaceAll(".", "-")}>
                {compactAccessDate}
              </time>{" "}
              기준
            </span>
          </div>
          <div className="header-status-item header-status-item--progress">
            <span
              className="header-status-icon header-status-icon--progress"
              aria-hidden="true"
            />
            <span>Q3 평가·집계중</span>
          </div>
          <form className="dashboard-logout-form" action="/api/logout" method="post">
            <button
              className="dashboard-logout-button"
              type="submit"
              title="로그아웃"
              aria-label="로그아웃"
            >
              <span className="dashboard-logout-icon" aria-hidden="true">
                <i />
              </span>
              <span>로그아웃</span>
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
