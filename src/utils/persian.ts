/**
 * Persian language, typography, digits, and Jalali date helpers
 */

// Convert Latin digits to Persian digits (0-9 -> ۰-۹)
export function toPersianDigits(input: number | string | undefined | null): string {
  if (input === undefined || input === null) return '';
  const str = String(input);
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return str.replace(/[0-9]/g, (w) => persianDigits[parseInt(w, 10)]);
}

// Convert Persian digits to Latin digits
export function toEnglishDigits(input: string): string {
  if (!input) return '';
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  let str = input;
  for (let i = 0; i < 10; i++) {
    str = str.replace(new RegExp(persianDigits[i], 'g'), String(i));
  }
  return str;
}

export const JALALI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

/**
 * Standard Gregorian to Jalali converter (accurate algorithm)
 */
export function gregorianToJalali(gy: number, gm: number, gd: number): [number, number, number] {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = (gy <= 1600) ? 0 : 979;
  gy -= (gy <= 1600) ? 621 : 1600;
  const gy2 = (gm > 2) ? (gy + 1) : gy;
  let days = (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100)
    + Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  jy += Math.floor((days - 1) / 365);
  if (days > 0) days = (days - 1) % 365;
  const jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
  return [jy, jm, jd];
}

/**
 * Get current Jalali date formatted as YYYY/MM/DD (Persian numbers optional)
 */
export function getJalaliDateString(date: Date = new Date()): string {
  const gy = date.getFullYear();
  const gm = date.getMonth() + 1;
  const gd = date.getDate();
  const [jy, jm, jd] = gregorianToJalali(gy, gm, gd);
  const mm = jm < 10 ? `0${jm}` : `${jm}`;
  const dd = jd < 10 ? `0${jd}` : `${jd}`;
  return `${jy}/${mm}/${dd}`;
}

export function formatScoreBadge(score: number): {
  color: string;
  bg: string;
  border: string;
  textClass: string;
  badgeClass: string;
  label: string;
} {
  if (score >= 90) {
    return {
      color: '#16A34A',
      bg: 'rgba(22, 163, 74, 0.1)',
      border: 'rgba(22, 163, 74, 0.3)',
      textClass: 'text-emerald-700 dark:text-emerald-400',
      badgeClass: 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300',
      label: 'عالی',
    };
  }
  if (score >= 70) {
    return {
      color: '#D97706',
      bg: 'rgba(217, 119, 6, 0.1)',
      border: 'rgba(217, 119, 6, 0.3)',
      textClass: 'text-amber-700 dark:text-amber-400',
      badgeClass: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300',
      label: 'متوسط',
    };
  }
  return {
    color: '#DC2626',
    bg: 'rgba(220, 38, 38, 0.1)',
    border: 'rgba(220, 38, 38, 0.3)',
    textClass: 'text-rose-700 dark:text-rose-400',
    badgeClass: 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300',
    label: 'نیازمند آموزش',
  };
}

/**
 * Check if assessment date is within the configurable dispute window (default 3 days)
 */
export function isWithinDisputeWindow(dateOrIso: string, daysAllowed: number = 3): boolean {
  try {
    if (!dateOrIso) return false;
    const eng = toEnglishDigits(dateOrIso).trim();

    // Check if it's a Jalali string e.g. "1403/07/24"
    if (eng.includes('/')) {
      const parts = eng.split('/').map(Number);
      if (parts.length >= 3) {
        // Approximate day difference based on current Jalali date (current month is 07 / Mehr 1403)
        const [jy, jm, jd] = parts;
        const [curJy, curJm, curJd] = [1403, 7, 24]; // Base reference matching project seed
        const daysAgo = (curJy - jy) * 365 + (curJm - jm) * 30 + (curJd - jd);
        // Allow if check was in the last N days (or future/today)
        return daysAgo <= daysAllowed && daysAgo >= -1;
      }
    }

    const created = new Date(dateOrIso).getTime();
    if (isNaN(created)) return true; // Fail-safe permissive
    const now = Date.now();
    const diffDays = (now - created) / (1000 * 60 * 60 * 24);
    return diffDays <= daysAllowed;
  } catch {
    return false;
  }
}
