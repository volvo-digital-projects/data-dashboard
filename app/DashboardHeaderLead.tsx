"use client";

import { useState } from "react";
import DscGuideViewer from "./DscGuideViewer";

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
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  return (
    <>
      <div className={`identity-title ${titleClassName}`.trim()}>
        <h1>{title}</h1>
        <div
          className="header-status-row"
          aria-label="DSC 가이드, Q3 평가·집계중, 로그아웃"
        >
          <button
            type="button"
            className="header-status-item header-status-item--guide"
            data-access-date={accessDate}
            aria-haspopup="dialog"
            aria-expanded={isGuideOpen}
            onClick={() => setIsGuideOpen(true)}
          >
            <span
              className="header-status-icon header-status-icon--guide"
              aria-hidden="true"
            />
            <span>DSC 가이드</span>
          </button>
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
      {isGuideOpen ? (
        <DscGuideViewer onClose={() => setIsGuideOpen(false)} />
      ) : null}
    </>
  );
}
