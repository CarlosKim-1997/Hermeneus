/** Stable metadata labels: server/browser locale and time zone must not change hydrated text. */
function utcIso(value: string): string | null {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
export function formatDateUtc(value: string): string {
  return utcIso(value)?.slice(0, 10) ?? "날짜 정보 없음";
}
export function formatDateTimeUtc(value: string): string {
  const iso = utcIso(value);
  return iso ? `${iso.slice(0, 10)} ${iso.slice(11, 19)} UTC` : "날짜 정보 없음";
}
