import { redirect } from "next/navigation";
import DealerAnalysis from "../../../DealerAnalysis";
import dashboardJson from "../../../data/showrooms.json";
import { requireDashboardLogin } from "../../../login-session";

export const dynamic = "force-dynamic";

const knownCdsids = new Set(
  (dashboardJson.showrooms as { cdsid: string }[]).map(({ cdsid }) => cdsid.toUpperCase()),
);

export default async function DealerAnalysisPage({
  params,
}: {
  params: Promise<{ cdsid: string }>;
}) {
  const { cdsid: rawCdsid } = await params;
  const cdsid = rawCdsid.trim().toUpperCase();
  if (!knownCdsids.has(cdsid)) redirect("/");

  const access = await requireDashboardLogin();
  if (access.role !== "master") redirect(`/dashboard/${access.dashboardCdsid}`);

  return <DealerAnalysis initialCdsid={cdsid} />;
}
