import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const LOGIN_COOKIE_NAME = "volvo-dashboard-access";
export const LOGIN_COOKIE_VALUE = "vck-manager-260825-6c2488";

export async function requireDashboardLogin(): Promise<void> {
  const cookieStore = await cookies();
  if (cookieStore.get(LOGIN_COOKIE_NAME)?.value !== LOGIN_COOKIE_VALUE) {
    redirect("/");
  }
}
