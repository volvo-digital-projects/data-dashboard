import { redirect } from "next/navigation";
import CompetitiveAnalysis from "../../../CompetitiveAnalysis";
import dashboardJson from "../../../data/showrooms.json";

export const dynamic = "force-dynamic";

const knownCdsids = new Set(
  (dashboardJson.showrooms as { cdsid: string }[]).map((showroom) =>
    showroom.cdsid.toUpperCase(),
  ),
);

const views = new Set(["dealer", "showroom", "region", "size"]);

export default async function CompetitiveAnalysisPage({
  params,
  searchParams,
}: {
  params: Promise<{ cdsid: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const routeParams = await params;
  const query = await searchParams;
  const cdsid = routeParams.cdsid.trim().toUpperCase();

  if (!cdsid || !knownCdsids.has(cdsid)) {
    redirect("/");
  }

  const initialView = views.has(query.view ?? "")
    ? (query.view as "dealer" | "showroom" | "region" | "size")
    : "dealer";

  return (
    <CompetitiveAnalysis
      initialCdsid={cdsid}
      initialView={initialView}
    />
  );
}
