import loginAccessJson from "./data/login-access.json";
import dashboardJson from "./data/showrooms.json";

export type DashboardRole = "master" | "dealerHead" | "manager";

export type DashboardAccess = {
  loginCdsid: string;
  dashboardCdsid: string;
  role: DashboardRole;
  dealer: string | null;
  allowedCdsids: string[];
};

type LoginAccount = {
  cdsid: string;
  dashboardCdsid: string;
};

type DealerHeadAccount = {
  cdsid: string;
  dealer: string;
};

type ShowroomAccessRecord = {
  cdsid: string;
  dealer: string;
};

const accounts = new Map(
  (loginAccessJson.accounts as LoginAccount[]).map((account) => [
    account.cdsid.toUpperCase(),
    {
      cdsid: account.cdsid.toUpperCase(),
      dashboardCdsid: account.dashboardCdsid.toUpperCase(),
    },
  ]),
);

const masterCdsids = new Set(
  (loginAccessJson.masterCdsids as string[]).map((cdsid) => cdsid.toUpperCase()),
);

const dealerHeads = new Map(
  (loginAccessJson.dealerHeadAccounts as DealerHeadAccount[]).map((account) => [
    account.cdsid.toUpperCase(),
    account.dealer,
  ]),
);

const showrooms = dashboardJson.showrooms as ShowroomAccessRecord[];
const allShowroomCdsids = showrooms.map((showroom) => showroom.cdsid.toUpperCase());

export function getDashboardAccess(loginCdsid: string): DashboardAccess | null {
  const normalizedCdsid = loginCdsid.trim().toUpperCase();
  const account = accounts.get(normalizedCdsid);
  if (!account) return null;

  if (masterCdsids.has(normalizedCdsid)) {
    return {
      loginCdsid: normalizedCdsid,
      dashboardCdsid: account.dashboardCdsid,
      role: "master",
      dealer: null,
      allowedCdsids: allShowroomCdsids,
    };
  }

  const dealer = dealerHeads.get(normalizedCdsid);
  if (dealer) {
    return {
      loginCdsid: normalizedCdsid,
      dashboardCdsid: account.dashboardCdsid,
      role: "dealerHead",
      dealer,
      allowedCdsids: showrooms
        .filter((showroom) => showroom.dealer === dealer)
        .map((showroom) => showroom.cdsid.toUpperCase()),
    };
  }

  return {
    loginCdsid: normalizedCdsid,
    dashboardCdsid: account.dashboardCdsid,
    role: "manager",
    dealer: null,
    allowedCdsids: [account.dashboardCdsid],
  };
}

export function canAccessDashboard(
  access: DashboardAccess,
  dashboardCdsid: string,
): boolean {
  return access.allowedCdsids.includes(dashboardCdsid.trim().toUpperCase());
}
