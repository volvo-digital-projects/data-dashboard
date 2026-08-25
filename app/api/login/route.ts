import { NextResponse } from "next/server";
import loginAccessJson from "../../data/login-access.json";
import {
  LOGIN_COOKIE_NAME,
  LOGIN_COOKIE_VALUE,
} from "../../login-session";

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

  const response = NextResponse.json({
    redirectPath: `/dashboard/${encodeURIComponent(dashboardCdsid)}`,
  });
  response.cookies.set(LOGIN_COOKIE_NAME, LOGIN_COOKIE_VALUE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}
