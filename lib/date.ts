export function getUTCStartOfDay(date: Date = new Date()): Date {
  const utc = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    0, 0, 0, 0
  ));
  return utc;
}

export function getUTCDate(
  year: number,
  month: number,
  day: number
): Date {
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
}

export function subtractMonthsUTC(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  result.setUTCMonth(result.getUTCMonth() - months);
  return result;
}

export function subtractYearsUTC(date: Date, years: number): Date {
  const result = new Date(date.getTime());
  result.setUTCFullYear(result.getUTCFullYear() - years);
  return result;
}

export function formatDateUTC(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    ...options,
    timeZone: "UTC",
  }).format(d);
}

export function formatDateTimeUTC(date: Date | string): string {
  return formatDateUTC(date, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatShortDateUTC(date: Date | string): string {
  return formatDateUTC(date, {
    month: "short",
    day: "numeric",
  });
}

export function formatLongDateUTC(date: Date | string): string {
  return formatDateUTC(date, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
