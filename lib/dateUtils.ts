/**
 * Parse a "YYYY-MM-DD" string as a LOCAL midnight Date.
 * Using `new Date("YYYY-MM-DD")` gives UTC midnight which shifts the day
 * in any timezone behind UTC. This avoids that pitfall.
 */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/**
 * Format a Date as "YYYY-MM-DD" using LOCAL date parts.
 */
export function toLocalDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
