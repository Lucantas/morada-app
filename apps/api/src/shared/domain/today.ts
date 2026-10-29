export const BUSINESS_TIME_ZONE = 'America/Sao_Paulo';

export function todayIn(now: Date = new Date(), timeZone: string = BUSINESS_TIME_ZONE): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
