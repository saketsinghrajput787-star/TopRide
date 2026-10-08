/**
 * Date normalization and formatting utilities for TopRide.
 * Enforces canonical ISO YYYY-MM-DD date storage and display formatting.
 */

const MONTHS_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Returns today's date in local YYYY-MM-DD format.
 */
export function getTodayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Converts any date representation (ISO YYYY-MM-DD, legacy "Sat, 10 Oct", etc.)
 * into canonical ISO format: YYYY-MM-DD.
 */
export function toCanonicalIsoDate(input?: string | null): string {
  if (!input || !input.trim()) {
    return getTodayIso();
  }
  const str = input.trim();

  // Already canonical YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // Handle standard ISO timestamps like 2026-10-10T...
  if (str.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.substring(0, 10);
  }

  // Parse legacy strings like "Sat, 10 Oct", "10 Oct", "Sat, 10 Oct 2026"
  const clean = str.replace(/^(mon|tue|wed|thu|fri|sat|sun)[a-z]*,?\s*/i, '');
  const match = clean.match(/(\d{1,2})\s+([a-zA-Z]{3,})(?:\s+(\d{4}))?/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const monKey = match[2].slice(0, 3).toLowerCase();
    const month = MONTHS_MAP[monKey] || '10';
    const year = match[3] || String(new Date().getFullYear());
    return `${year}-${month}-${day}`;
  }

  // Fallback: try JS Date
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return getTodayIso();
}

/**
 * Formats a canonical YYYY-MM-DD into customer display format:
 * "Sat, 10 Oct"
 */
export function formatDisplayDate(isoDate: string): string {
  if (!isoDate) return '';
  const canonical = toCanonicalIsoDate(isoDate);
  const parts = canonical.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    return isoDate;
  }
  const [year, month, day] = parts;
  // Use noon to avoid local timezone edge-cases
  const dateObj = new Date(year, month - 1, day, 12, 0, 0);
  if (isNaN(dateObj.getTime())) return isoDate;

  const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
  const monthName = dateObj.toLocaleDateString('en-US', { month: 'short' });
  return `${weekday}, ${day} ${monthName}`;
}

/**
 * Check if a date string is in the past compared to today (local midnight).
 */
export function isPastDate(isoDate: string): boolean {
  const canonical = toCanonicalIsoDate(isoDate);
  const today = getTodayIso();
  return canonical < today;
}

export { MONTH_NAMES };
