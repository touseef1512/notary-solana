const HOLIDAYS_2026 = [
  "2026-01-01", // New Year's Day
  "2026-01-19", // Martin Luther King Jr. Day
  "2026-02-16", // Washington's Birthday
  "2026-04-03", // Good Friday
  "2026-05-25", // Memorial Day
  "2026-06-19", // Juneteenth National Independence Day
  "2026-07-03", // Independence Day (Observed)
  "2026-09-07", // Labor Day
  "2026-11-26", // Thanksgiving Day
  "2026-12-25", // Christmas Day
];

function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr);
  const day = d.getUTCDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

function isHoliday(dateStr: string): boolean {
  return HOLIDAYS_2026.includes(dateStr);
}

function getNextBusinessDay(currentDateStr: string): string {
  const d = new Date(currentDateStr);
  d.setUTCDate(d.getUTCDate() + 1);
  const nextDateStr = d.toISOString().split('T')[0];
  
  if (isWeekend(nextDateStr) || isHoliday(nextDateStr)) {
    return getNextBusinessDay(nextDateStr);
  }
  return nextDateStr;
}

export interface SettlementComparison {
  eventDate: string;
  eventType: "dividend" | "split";
  traditionalSettlementDate: string;
  solanaSettlementDate: string;
  isEventDateWeekendOrHoliday: boolean;
}

export function generateSettlementComparison(
  eventDate: string,
  eventType: "dividend" | "split"
): SettlementComparison {
  // Normalize input date
  const baseDate = new Date(eventDate).toISOString().split('T')[0];
  
  const eventIsNonBusinessDay = isWeekend(baseDate) || isHoliday(baseDate);
  
  let traditionalStart = baseDate;
  if (eventIsNonBusinessDay) {
    // If the event itself happens on a non-business day, 
    // the traditional system won't start processing (T+0) until the next business day.
    traditionalStart = getNextBusinessDay(baseDate);
  }
  
  let traditionalSettlementDate = traditionalStart;
  for (let i = 0; i < 2; i++) {
    traditionalSettlementDate = getNextBusinessDay(traditionalSettlementDate);
  }
  
  return {
    eventDate: baseDate,
    eventType,
    traditionalSettlementDate,
    solanaSettlementDate: baseDate, // 24/7 same-day settlement
    isEventDateWeekendOrHoliday: eventIsNonBusinessDay
  };
}
