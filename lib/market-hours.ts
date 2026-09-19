// US holidays are not modelled; daylight-saving transition weekends can be off by an hour.

const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  weekday: 'short',
  hour: 'numeric',
  minute: 'numeric',
  hour12: false
});

export function formatDuration(minutes: number): string {
  const d = Math.floor(minutes / (24 * 60));
  const h = Math.floor((minutes % (24 * 60)) / 60);
  const m = Math.floor(minutes % 60);
  
  if (d > 0) {
    return `${d}d ${h}h`;
  }
  if (h > 0) {
    if (m > 0) {
      return `${h}h ${m}m`;
    }
    return `${h}h`;
  }
  return `${m}m`;
}

export function getMarketStatus(now: Date): { isOpen: boolean; minutesUntilChange: number } {
  const check = (d: Date) => {
    const parts = formatter.formatToParts(d);
    
    let weekday = '';
    let hourStr = '';
    let minStr = '';
    
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (p.type === 'weekday') weekday = p.value;
      if (p.type === 'hour') hourStr = p.value;
      if (p.type === 'minute') minStr = p.value;
    }
    
    let hour = parseInt(hourStr, 10);
    if (hour === 24) hour = 0;
    const min = parseInt(minStr, 10);
    
    if (weekday === 'Sat' || weekday === 'Sun') return false;
    
    const hm = hour * 60 + min;
    return hm >= 9 * 60 + 30 && hm < 16 * 60;
  };

  const isOpen = check(now);
  let minutesUntilChange = 0;
  
  const temp = new Date(now.getTime());
  for (let i = 1; i <= 7 * 24 * 60; i++) {
    temp.setTime(now.getTime() + i * 60 * 1000);
    if (check(temp) !== isOpen) {
      minutesUntilChange = i;
      break;
    }
  }

  return { isOpen, minutesUntilChange };
}
