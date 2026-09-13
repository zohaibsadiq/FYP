/**
 * The API sends plain days as "YYYY-MM-DD". Passing that straight to
 * `new Date()` parses it as midnight UTC, which lands on the previous day
 * anywhere west of Greenwich, so every day here is built from its parts.
 */

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** "2026-09-14" as midnight in the reader's own timezone. */
export function parseDay(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function toIso(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayIso(): string {
  return toIso(new Date());
}

export function addDays(iso: string, days: number): string {
  const date = parseDay(iso);
  date.setDate(date.getDate() + days);
  return toIso(date);
}

/** Whole days from `iso` until today. Negative for a day still to come. */
export function daysAgo(iso: string, from = todayIso()): number {
  const ms = parseDay(from).getTime() - parseDay(iso).getTime();
  return Math.round(ms / 86_400_000);
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const WEEKDAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

/**
 * How a person would say the date out loud. Recent days get a word rather than
 * numbers, because "Yesterday" is read faster than "13 Sep" and needs no
 * arithmetic from the reader.
 */
export function friendlyDay(iso: string, from = todayIso()): string {
  const gap = daysAgo(iso, from);
  if (gap === 0) return "Today";
  if (gap === 1) return "Yesterday";
  if (gap === -1) return "Tomorrow";

  const date = parseDay(iso);
  if (gap > 1 && gap < 7) return `Last ${WEEKDAYS[date.getDay()]}`;

  const stamp = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return date.getFullYear() === parseDay(from).getFullYear()
    ? stamp
    : `${stamp} ${date.getFullYear()}`;
}

/** "Not worn for 3 months" reads better than "not worn for 94 days". */
export function spanInWords(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "1 day";
  if (days < 14) return `${days} days`;
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  if (days < 365) return `${Math.round(days / 30)} months`;
  const years = Math.floor(days / 365);
  return years === 1 ? "over a year" : `over ${years} years`;
}

export function monthLabel(iso: string): string {
  const date = parseDay(iso);
  const names = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${names[date.getMonth()]} ${date.getFullYear()}`;
}
