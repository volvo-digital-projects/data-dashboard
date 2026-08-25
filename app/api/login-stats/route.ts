import { getLoginStats } from "../../login-stats";

export const dynamic = "force-dynamic";

export async function GET() {
  const stats = await getLoginStats();
  return Response.json(stats, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
