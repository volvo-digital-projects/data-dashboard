import { NextResponse } from "next/server";
import loginAccessJson from "../../data/login-access.json";
import {
  createLoginCookieValue,
  LOGIN_COOKIE_NAME,
} from "../../login-session";
import { recordLoginVisit } from "../../login-stats";

type LoginAccount = {
  cdsid: string;
  dashboardCdsid: string;
};

const loginTargets = new Map(
  (loginAccessJson.accounts as LoginAccount[]).map((account) => [
    account.cdsid.toUpperCase(),
    account.dashboardCdsid.toUpperCase(),
  ]),
);

const countedCdsids = new Set(
  (loginAccessJson.countedCdsids as string[]).map((cdsid) => cdsid.toUpperCase()),
);

export async function POST(request: Request) {
  let body: { cdsid?: unknown };
  try {
    body = (await request.json()) as { cdsid?: unknown };
  } catch {
    return NextResponse.json({ message: "CDSID를 확인해 주세요." }, { status: 400 });
  }

  const cdsid = String(body.cdsid ?? "").trim().toUpperCase();
  const dashboardCdsid = loginTargets.get(cdsid);
  if (!dashboardCdsid) {
    return NextResponse.json(
      { message: "로그인 권한이 등록된 CDSID를 다시 확인해 주세요." },
      { status: 401 },
    );
  }

  if (countedCdsids.has(cdsid)) {
    await recordLoginVisit(cdsid);
  }

  const response = NextResponse.json({
    redirectPath: `/dashboard/${encodeURIComponent(dashboardCdsid)}`,
  });
  response.cookies.set(LOGIN_COOKIE_NAME, createLoginCookieValue(cdsid), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return response;
}
