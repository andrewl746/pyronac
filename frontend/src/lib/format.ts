// Number and month formatting. Always en-US and UTC so every panel reads the same.

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const countFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

// Hot spots are counted whole, but harmonized counts are estimates with decimals. From 10 up the
// decimal is noise, so it is dropped; below 10 one decimal stays, so 0.4 does not read as 0.
// 1042.6 -> "1,043", 55.3 -> "55", 3.14 -> "3.1", 61.0 -> "61"
export function formatCount(value: number): string {
  return countFormat.format(Math.abs(value) >= 10 ? Math.round(value) : value);
}

const compactFormat = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

// For axis ticks, where room is short: 950 -> "950", 55000 -> "55K", 1200000 -> "1.2M"
export function formatCompact(value: number): string {
  return compactFormat.format(value);
}

// month is 1 to 12. 7 -> "July"
export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? "";
}

// 7 -> "Jul"
export function monthShort(month: number): string {
  return monthName(month).slice(0, 3);
}

// (2023, 7) -> "July 2023"
export function formatMonthYear(year: number, month: number): string {
  return `${monthName(month)} ${year}`;
}

// "2026-11-06" -> "6 Nov 2026"
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return `${day} ${monthShort(month)} ${year}`;
}
