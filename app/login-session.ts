import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const LOGIN_COOKIE_NAME = "volvo-dashboard-access";
export const LOGIN_COOKIE_VALUE = "vck-manager-session-260825-login-reset-f31a72";

export async function requireDashboardLogin(): Promise<void> {
  const cookieStore = await cookies();
  if (cookieStore.get(LOGIN_COOKIE_NAME)?.value !== LOGIN_COOKIE_VALUE) {
    redirect("/");
  }
}
