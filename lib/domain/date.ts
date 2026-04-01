export function chicagoToday(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return fmt.format(new Date());
}

export function monthYearForDate(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  return `${mm}${yyyy}`;
}

export function chicagoMonthYearForDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "2-digit",
    year: "numeric"
  }).formatToParts(date);

  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  return `${month}${year}`;
}

export function previousMonthWindow(now: Date): { start: Date; end: Date; monthYear: string } {
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const month = now.getMonth() === 0 ? 11 : now.getMonth() - 1;

  const start = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  const end = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0));

  return {
    start,
    end,
    monthYear: monthYearForDate(start)
  };
}
