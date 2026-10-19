// A viewing preference only: this must not grant dashboard access or change roles.
export function canViewOriginalStaffPortraits(loginCdsid?: string): boolean {
  return loginCdsid?.trim().toUpperCase() === "VCK-ES90";
}
