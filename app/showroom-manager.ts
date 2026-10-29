/** Display-only appointments; never changes CDSID login or showroom access. */
export function showroomManagerName(
  showroom: { cdsid: string; manager: string },
): string {
  // Personnel notice dated November 1; user requested immediate display.
  const appointments: Record<string, string> = {
    "6KR6850": "양지승", // 광안: 해운대 영업팀장 → 광안 지점장
    "6KR6863": "김호영", // 김해: 광안 지점장 → 김해 지점장
  };
  return appointments[showroom.cdsid] ?? showroom.manager;
}
