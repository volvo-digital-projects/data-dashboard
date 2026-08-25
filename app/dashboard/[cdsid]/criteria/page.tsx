import { redirect } from "next/navigation";
import { CriteriaGuide } from "../../../Dashboard";
import dashboardJson from "../../../data/showrooms.json";
import { requireDashboardLogin } from "../../../login-session";

export const dynamic = "force-dynamic";

const knownCdsids = new Set(
  (dashboardJson.showrooms as { cdsid: string }[]).map((showroom) =>
    showroom.cdsid.toUpperCase(),
  ),
);

export default async function CriteriaPage({
  params,
}: {
  params: Promise<{ cdsid: string }>;
}) {
  const routeParams = await params;
  const cdsid = routeParams.cdsid.trim().toUpperCase();

  if (!cdsid || !knownCdsids.has(cdsid)) {
    redirect("/");
  }

  await requireDashboardLogin();

  return <CriteriaGuide cdsid={cdsid} />;
}
