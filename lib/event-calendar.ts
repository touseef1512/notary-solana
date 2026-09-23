export const CPI_RELEASES: string[] = ["2026-05-12","2026-06-10","2026-07-14","2026-08-12","2026-09-11","2026-10-14","2026-11-10","2026-12-10"];

// source is the BLS CPI release schedule, refresh when the list runs out.
export const CPI_SCHEDULE_CHECKED = "2026-09-24";

export function getNextCpi(now: Date): { date: string; daysUntil: number } | null {
  const nowUtcStr = now.toISOString().split('T')[0];
  const nextDateStr = CPI_RELEASES.find(d => d >= nowUtcStr);
  if (!nextDateStr) return null;
  const nextDate = new Date(nextDateStr + 'T00:00:00Z');
  const today = new Date(nowUtcStr + 'T00:00:00Z');
  const diffTime = nextDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return { date: nextDateStr, daysUntil: diffDays };
}

export function getPastCpi(now: Date, n: number): string[] {
  const nowUtcStr = now.toISOString().split('T')[0];
  const pastDates = CPI_RELEASES.filter(d => d < nowUtcStr);
  return pastDates.slice(-n);
}
