"use client";

import Link from "next/link";
import { useState } from "react";
import type { ReactNode } from "react";
import DscGuideViewer from "./DscGuideViewer";

type DashboardHeaderLeadProps = {
  title: string;
  accessDate: string;
  titleClassName?: string;
  titleAdornment?: ReactNode;
  dashboardReturn?: {
    href: string;
    label: string;
    ariaLabel: string;
  };
};

export default function DashboardHeaderLead({
  title,
  accessDate,
  titleClassName = "",
  titleAdornment,
  dashboardReturn,
}: DashboardHeaderLeadProps) {
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  return (
    <>
      <div className={`identity-title ${titleClassName}`.trim()}>
        {titleAdornment ? (
          <div className="identity-heading-line">
            <h1>{title}</h1>
            {titleAdornment}
          </div>
        ) : (
          <h1>{title}</h1>
        )}
        <div
          className="header-status-row"
          aria-label={dashboardReturn ? `${dashboardReturn.label}, 로그아웃` : "DSC 가이드, 로그아웃"}
        >
          {dashboardReturn ? (
            <Link
              className="header-status-item header-status-item--dashboard-return"
              href={dashboardReturn.href}
              scroll={false}
              aria-label={dashboardReturn.ariaLabel}
            >
              <span className="header-status-icon header-status-icon--dashboard" aria-hidden="true" />
              <span>{dashboardReturn.label}</span>
            </Link>
          ) : (
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
          )}
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
      {!dashboardReturn && isGuideOpen ? (
        <DscGuideViewer onClose={() => setIsGuideOpen(false)} />
      ) : null}
    </>
  );
}
