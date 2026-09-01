import { redirect } from "next/navigation";
import MetricDetails from "../../../../MetricDetails";
import { canAccessDashboard } from "../../../../dashboard-access";
import dashboardJson from "../../../../data/showrooms.json";
import { requireDashboardLogin } from "../../../../login-session";

export const dynamic = "force-dynamic";

const knownCdsids = new Set(
  (dashboardJson.showrooms as { cdsid: string }[]).map((showroom) =>
    showroom.cdsid.toUpperCase(),
  ),
);
const knownMetrics = new Set(["voc", "cx"]);

export default async function MetricDetailsPage({
  params,
}: {
  params: Promise<{ cdsid: string; metric: string }>;
}) {
  const routeParams = await params;
  const cdsid = routeParams.cdsid.trim().toUpperCase();
  const metric = routeParams.metric.trim().toLowerCase();

  if (!cdsid || !knownCdsids.has(cdsid) || !knownMetrics.has(metric)) {
    redirect("/");
  }

  const access = await requireDashboardLogin();
  if (!canAccessDashboard(access, cdsid)) {
    redirect(`/dashboard/${access.dashboardCdsid}`);
  }

  return <MetricDetails cdsid={cdsid} metric={metric as "voc" | "cx"} />;
}
