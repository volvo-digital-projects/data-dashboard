import LoginHome from "./LoginHome";
import dashboardJson from "./data/showrooms.json";

export const dynamic = "force-dynamic";

export default async function Home() {
  const knownCdsids = (dashboardJson.showrooms as { cdsid: string }[]).map(
    (showroom) => showroom.cdsid.toUpperCase(),
  );

  return <LoginHome knownCdsids={knownCdsids} />;
}
