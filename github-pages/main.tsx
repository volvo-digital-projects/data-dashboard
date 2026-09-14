import { StrictMode, useEffect, useMemo, useState } from "react";

// Client-only GitHub Pages entry. Keep this outside Next.js's reserved pages directory.
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import LoginHome from "../app/LoginHome";
import Dashboard, { CriteriaGuide } from "../app/Dashboard";
import CompetitiveAnalysis from "../app/CompetitiveAnalysis";
import DealerAnalysis from "../app/DealerAnalysis";
import MetricDetails from "../app/MetricDetails";
import ReleaseUpdateNotice from "../app/ReleaseUpdateNotice";
import { canAccessDashboard, getDashboardAccess } from "../app/dashboard-access";
import { resetPageScrollToTop } from "../app/pageScroll";
import "../app/globals.css";

const BASE_PATH = "/data-dashboard/";
const SESSION_KEY = "volvo-dashboard-pages-session";
if (/Edg\//.test(navigator.userAgent)) {
  document.documentElement.dataset.browser = "edge-desktop";
}
if ("scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}
const nativeFetch = window.fetch.bind(window);

function apiResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const rawUrl =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  const url = new URL(rawUrl, window.location.href);

  if (url.origin === window.location.origin && url.pathname === "/api/login") {
    try {
      const body = JSON.parse(String(init?.body ?? "{}")) as { cdsid?: unknown };
      const cdsid = String(body.cdsid ?? "").trim().toUpperCase();
      const access = getDashboardAccess(cdsid);
      if (!access) {
        return apiResponse(
          { message: "로그인 권한이 등록된 CDSID를 다시 확인해 주세요." },
          401,
        );
      }
      window.localStorage.setItem(SESSION_KEY, cdsid);
      return apiResponse({
        redirectPath: `${BASE_PATH}#/dashboard/${encodeURIComponent(access.dashboardCdsid)}`,
      });
    } catch {
      return apiResponse({ message: "CDSID를 확인해 주세요." }, 400);
    }
  }

  if (url.origin === window.location.origin && url.pathname === "/api/login-stats") {
    return apiResponse({ today: 0, cumulative: 0 });
  }

  if (
    url.origin === window.location.origin &&
    url.pathname === "/api/dashboard-updates"
  ) {
    if ((init?.method ?? "GET").toUpperCase() === "POST") {
      return apiResponse({ error: "이 배포본에서는 직접 수정을 지원하지 않습니다." }, 403);
    }
    return apiResponse({ update: null });
  }

  if (url.origin === window.location.origin && url.pathname === "/api/one-voice") {
    return apiResponse({ snapshot: null });
  }

  return nativeFetch(input, init);
};

function routeFromHash(hash = window.location.hash) {
  const raw = hash.replace(/^#/, "") || "/";
  const [pathname, query = ""] = raw.split("?", 2);
  return { pathname, query: new URLSearchParams(query) };
}

function useHashRoute() {
  const [route, setRoute] = useState(routeFromHash);
  useEffect(() => {
    let lastCommittedHref = window.location.href;
    const commitRouteAtTop = (nextRoute: ReturnType<typeof routeFromHash>) => {
      flushSync(() => setRoute(nextRoute));
      // The destination and scroll origin are committed in the same browser
      // task, so the previously visited lower page can never paint in between.
      resetPageScrollToTop();
    };
    const update = () => {
      if (window.location.href === lastCommittedHref) return;
      lastCommittedHref = window.location.href;
      commitRouteAtTop(routeFromHash());
    };
    const navigateDashboardRoute = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
      const targetUrl = new URL(anchor.href, window.location.href);
      if (
        targetUrl.origin !== window.location.origin ||
        targetUrl.pathname !== BASE_PATH ||
        !targetUrl.hash.startsWith("#/dashboard/")
      ) {
        return;
      }

      event.preventDefault();
      const nextUrl = new URL(window.location.href);
      nextUrl.hash = targetUrl.hash;
      window.history.pushState(null, "", nextUrl);
      lastCommittedHref = window.location.href;
      commitRouteAtTop(routeFromHash(nextUrl.hash));
    };
    document.addEventListener("click", navigateDashboardRoute, true);
    window.addEventListener("hashchange", update);
    window.addEventListener("popstate", update);
    return () => {
      document.removeEventListener("click", navigateDashboardRoute, true);
      window.removeEventListener("hashchange", update);
      window.removeEventListener("popstate", update);
    };
  }, []);
  return route;
}

function LoginScreen() {
  return <LoginHome initialStats={{ today: 0, cumulative: 0 }} />;
}

function PagesApp() {
  const route = useHashRoute();
  const segments = route.pathname.split("/").filter(Boolean);
  const access = useMemo(() => {
    try {
      return getDashboardAccess(window.localStorage.getItem(SESSION_KEY) ?? "");
    } catch {
      return null;
    }
  }, [route.pathname]);

  useEffect(() => {
    const handleSubmit = (event: SubmitEvent) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const action = new URL(form.action, window.location.href);
      if (action.pathname !== "/api/logout") return;
      event.preventDefault();
      window.localStorage.removeItem(SESSION_KEY);
      window.location.assign(BASE_PATH);
    };

    const handleAnchor = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>('a[href="#weekly-trend"]');
      if (!anchor) return;
      event.preventDefault();
      document.getElementById("weekly-trend")?.scrollIntoView({ behavior: "smooth" });
    };

    document.addEventListener("submit", handleSubmit);
    document.addEventListener("click", handleAnchor);
    return () => {
      document.removeEventListener("submit", handleSubmit);
      document.removeEventListener("click", handleAnchor);
    };
  }, []);

  if (segments[0] !== "dashboard") return <LoginScreen />;
  if (!access) return <LoginScreen />;

  const cdsid = decodeURIComponent(segments[1] ?? "").trim().toUpperCase();
  if (!cdsid || !canAccessDashboard(access, cdsid)) {
    window.location.replace(
      `${BASE_PATH}#/dashboard/${encodeURIComponent(access.dashboardCdsid)}`,
    );
    return null;
  }

  if (segments[2] === "dealer-analysis") {
    if (access.role !== "master") {
      window.location.replace(
        `${BASE_PATH}#/dashboard/${encodeURIComponent(access.dashboardCdsid)}`,
      );
      return null;
    }
    return <DealerAnalysis initialCdsid={cdsid} />;
  }

  if (segments[2] === "analysis") {
    const view = route.query.get("view");
    const initialView =
      view === "showroom" || view === "region" || view === "size"
        ? view
        : "dealer";
    return <CompetitiveAnalysis initialCdsid={cdsid} initialView={initialView} accessRole={access.role} />;
  }

  if (segments[2] === "criteria") return <CriteriaGuide cdsid={cdsid} />;

  if (segments[2] === "details") {
    const metric = segments[3] === "cx" ? "cx" : "voc";
    return <MetricDetails cdsid={cdsid} metric={metric} />;
  }

  return (
    <Dashboard
      initialCdsid={cdsid}
      showroomAccess={{ role: access.role, allowedCdsids: access.allowedCdsids }}
      viewer={{ displayName: "DSC 관리자", email: null, isEditor: false }}
    />
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PagesApp />
    <ReleaseUpdateNotice />
  </StrictMode>,
);
