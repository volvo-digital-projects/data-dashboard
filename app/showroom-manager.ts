/** Display-only appointments; never changes CDSID login or showroom access. */
export function showroomManagerName(
  showroom: { cdsid: string; manager: string },
  now: number = Date.now(),
): string {
  // Personnel notice: effective 2026-11-01 00:00 Asia/Seoul.
  if (now < Date.parse("2026-11-01T00:00:00+09:00")) return showroom.manager;
  const appointments: Record<string, string> = {
    "6KR6850": "양지승", // 광안: 해운대 영업팀장 → 광안 지점장
    "6KR6863": "김호영", // 김해: 광안 지점장 → 김해 지점장
  };
  return appointments[showroom.cdsid] ?? showroom.manager;
}
