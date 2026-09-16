// 이 저장소는 KST(UTC+9) 기준으로 "오늘"·"이번 달"을 계산해야 하는데,
// 서버 프로세스는 배포 환경(Vercel 등)에서 보통 UTC로 돈다. `new Date()`의
// getFullYear()/getMonth()/getDate()는 서버 타임존을 그대로 쓰므로, UTC
// 자정~오전 9시(KST로는 이미 다음 날) 구간에 날짜·월이 하루/한 달 밀린다.
// 날짜가 필요한 곳은 전부 이 파일을 거친다 — 각자 `new Date()`로 계산하지
// 않는다(월별 단가 화면 리뷰에서 실제로 이 문제가 재발했었다).

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** `date`(실제 시각)를 KST 달력 날짜 "YYYY-MM-DD"로 정규화한다. */
export function toKstDateString(date: Date): string {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** `date`(실제 시각)를 KST 기준 "YYYY-MM"으로 정규화한다(월별 단가 기본값 등). */
export function toKstYearMonth(date: Date): string {
  return toKstDateString(date).slice(0, 7);
}

/** 두 "YYYY-MM-DD" 날짜 사이의 일수(a - b). 시각 없이 달력 날짜로만 계산한다. */
export function daysBetween(dateStrA: string, dateStrB: string): number {
  const a = Date.parse(`${dateStrA}T00:00:00Z`);
  const b = Date.parse(`${dateStrB}T00:00:00Z`);
  return Math.round((a - b) / DAY_MS);
}

/** ISO 타임스탬프를 KST 기준 "YYYY. M. D." 형식으로 표시한다(화면 표시용). */
export function formatKstDate(iso: string): string {
  const [y, m, d] = toKstDateString(new Date(iso)).split("-");
  return `${y}. ${Number(m)}. ${Number(d)}.`;
}
