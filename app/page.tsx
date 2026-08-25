import LoginHome from "./LoginHome";
import { getLoginStats } from "./login-stats";

export const dynamic = "force-dynamic";

export default async function Home() {
  const initialStats = await getLoginStats();
  return <LoginHome initialStats={initialStats} />;
}
