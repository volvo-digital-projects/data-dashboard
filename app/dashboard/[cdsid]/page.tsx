import { redirect } from "next/navigation";
import Dashboard from "../../Dashboard";
import { getChatGPTUser } from "../../chatgpt-auth";
import dashboardJson from "../../data/showrooms.json";
import { isEditorEmail } from "../../permissions";

export const dynamic = "force-dynamic";

const knownCdsids = new Set(
  (dashboardJson.showrooms as { cdsid: string }[]).map((showroom) =>
    showroom.cdsid.toUpperCase(),
  ),
);

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ cdsid: string }>;
}) {
  const routeParams = await params;
  const cdsid = routeParams.cdsid.trim().toUpperCase();

  if (!cdsid || !knownCdsids.has(cdsid)) {
    redirect("/");
  }

  const user = await getChatGPTUser();
  const isLocalPreview = !user;

  return (
    <Dashboard
      initialCdsid={cdsid}
      viewer={{
        displayName: user?.displayName ?? "관리자 미리보기",
        email: user?.email ?? null,
        isEditor: user ? isEditorEmail(user.email) : isLocalPreview,
      }}
    />
  );
}
