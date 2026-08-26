import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDashboardAccess, type DashboardAccess } from "./dashboard-access";

export const LOGIN_COOKIE_NAME = "volvo-dashboard-access";
export const LOGIN_COOKIE_VALUE = "vck-manager-session-260826-role-scope-c83d42";
const LOGIN_COOKIE_SEPARATOR = "--";

export function createLoginCookieValue(cdsid: string): string {
  return `${LOGIN_COOKIE_VALUE}${LOGIN_COOKIE_SEPARATOR}${cdsid.trim().toUpperCase()}`;
}

export async function requireDashboardLogin(): Promise<DashboardAccess> {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(LOGIN_COOKIE_NAME)?.value ?? "";
  const prefix = `${LOGIN_COOKIE_VALUE}${LOGIN_COOKIE_SEPARATOR}`;
  if (!cookieValue.startsWith(prefix)) {
    redirect("/");
  }

  const access = getDashboardAccess(cookieValue.slice(prefix.length));
  if (!access) redirect("/");
  return access;
}
