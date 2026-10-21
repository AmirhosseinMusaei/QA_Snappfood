/**
 * Persian language, typography, digits, and Jalali date helpers
 * Native Intl-powered Gregorian UTC <-> Jalali conversion
 */

// Convert Latin digits to Persian digits (0-9 -> ۰-۹)
export function toPersianDigits(
  input: number | string | undefined | null,
): string {
  if (input === undefined || input === null) return "";
  const str = String(input);
  const persianDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return str.replace(/[0-9]/g, (w) => persianDigits[parseInt(w, 10)]);
}

// Convert Persian digits to Latin digits
export function toEnglishDigits(
  input: string | number | undefined | null,
): string {
  if (input === undefined || input === null) return "";
  const persianDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  let str = String(input);
  for (let i = 0; i < 10; i++) {
    str = str.replace(new RegExp(persianDigits[i], "g"), String(i));
  }
  return str;
}

export const JALALI_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

/**
 * Standard Gregorian to Jalali converter (accurate algorithm)
 */
export function gregorianToJalali(
  gy: number,
  gm: number,
  gd: number,
): [number, number, number] {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = gy <= 1600 ? 0 : 979;
  gy -= gy <= 1600 ? 621 : 1600;
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) -
    80 +
    gd +
    g_d_m[gm - 1];
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  jy += Math.floor((days - 1) / 365);
  if (days > 0) days = (days - 1) % 365;
  const jm =
    days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return [jy, jm, jd];
}

/**
 * Standard Jalali to Gregorian UTC converter
 */
export function jalaliToGregorianUTC(jy: number, jm: number, jd: number): Date {
  let sal_a, gy, gm, gd, days;
  jy += 1595;
  days =
    -355668 +
    365 * jy +
    Math.floor(jy / 33) * 8 +
    Math.floor(((jy % 33) + 3) / 4) +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  gy = 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  gd = days + 1;
  sal_a = [
    0,
    31,
    (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  for (gm = 0; gm < 13 && gd > sal_a[gm]; gm++) gd -= sal_a[gm];
  return new Date(Date.UTC(gy, gm - 1, gd));
}

/**
 * Universal date parser: parses Gregorian ISO strings, Date objects, epoch numbers,
 * or Jalali strings e.g. "۱۴۰۳/۰۷/۲۲" or "1403/07/22"
 * Returns null if the input is missing, empty, or cannot be parsed as a valid date.
 */
export function parseJalaliOrGregorianDate(input: any): Date | null {
  if (input instanceof Date)
    return Number.isFinite(input.getTime()) ? input : null;
  if (typeof input !== "string") return null;
  const str = toEnglishDigits(input).trim();
  const match = /^(\d{4})[/-](\d{2})[/-](\d{2})(.*)$/.exec(str);
  if (!match) return null;
  const y = +match[1],
    m = +match[2],
    d = +match[3],
    tail = match[4];
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  if (y < 1900) {
    if (y < 1200 || y > 1600 || tail) return null;
    const date = jalaliToGregorianUTC(y, m, d);
    const parts = new Intl.DateTimeFormat("en-US-u-ca-persian", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      timeZone: "UTC",
    }).formatToParts(date);
    const part = (type: string) =>
      +(parts.find((p) => p.type === type)?.value || 0);
    return part("year") === y && part("month") === m && part("day") === d
      ? date
      : null;
  }
  const plain = new Date(Date.UTC(y, m - 1, d));
  if (
    plain.getUTCFullYear() !== y ||
    plain.getUTCMonth() !== m - 1 ||
    plain.getUTCDate() !== d
  )
    return null;
  if (!tail) return plain;
  if (!/^T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(tail))
    return null;
  const parsed = new Date(str);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

export function jalaliMonthRange(year: number, month: number) {
  if (
    !Number.isInteger(year) ||
    year < 1200 ||
    year > 1600 ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  )
    throw new Error("ماه یا سال نامعتبر است");
  // Tehran has used UTC+03:30 without DST since 2022. Reporting years supported by UI are >=1402.
  // For historical DST, derive the offset at each boundary using Intl, not a fixed offset.
  const boundary = (y: number, m: number) => {
    const utc = jalaliToGregorianUTC(y, m, 1);
    let instant = utc.getTime();
    for (let i = 0; i < 3; i++) {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Tehran",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      }).formatToParts(new Date(instant));
      const val = (t: string) => +(parts.find((p) => p.type === t)?.value || 0);
      const projected = Date.UTC(
        val("year"),
        val("month") - 1,
        val("day"),
        val("hour"),
        val("minute"),
        val("second"),
      );
      instant -= projected - utc.getTime();
    }
    return new Date(instant);
  };
  return {
    gte: boundary(year, month),
    lt: boundary(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1),
  };
}

export interface DerivedJalaliDate {
  year: number;
  month: number;
  day: number;
  monthName: string;
  jalaliStr: string; // "1405/07/27"
  persianJalaliStr: string; // "۱۴۰۵/۰۷/۲۷"
  isoUtc: string;
}

/**
 * Standard business reporting timezone for Snappfood QA Portal: Asia/Tehran (UTC+3:30)
 * All timestamps stored in UTC are consistently projected to official Tehran business calendar dates.
 */
export const REPORTING_TIMEZONE = "Asia/Tehran";

/**
 * Derive Jalali date, month, and formatted display strings on the fly from a Gregorian UTC DateTime
 */
export function dateToJalali(dateInput: any): DerivedJalaliDate {
  const d = parseJalaliOrGregorianDate(dateInput);
  if (!d) throw new Error("تاریخ نامعتبر است");
  try {
    const parts = new Intl.DateTimeFormat("en-US-u-ca-persian", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      timeZone: REPORTING_TIMEZONE,
    }).formatToParts(d);
    let year = 1405;
    let month = 7;
    let day = 1;
    for (const p of parts) {
      if (p.type === "year") year = parseInt(p.value, 10);
      if (p.type === "month") month = parseInt(p.value, 10);
      if (p.type === "day") day = parseInt(p.value, 10);
    }
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    const jalaliStr = `${year}/${mm}/${dd}`;
    const persianJalaliStr = `${toPersianDigits(year)}/${toPersianDigits(mm)}/${toPersianDigits(dd)}`;
    return {
      year,
      month,
      day,
      monthName: JALALI_MONTHS[month - 1] || `ماه ${month}`,
      jalaliStr,
      persianJalaliStr,
      isoUtc: d.toISOString(),
    };
  } catch {
    // Algorithmic fallback
    const gy = d.getUTCFullYear();
    const gm = d.getUTCMonth() + 1;
    const gd = d.getUTCDate();
    const [year, month, day] = gregorianToJalali(gy, gm, gd);
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    return {
      year,
      month,
      day,
      monthName: JALALI_MONTHS[month - 1] || `ماه ${month}`,
      jalaliStr: `${year}/${mm}/${dd}`,
      persianJalaliStr: `${toPersianDigits(year)}/${toPersianDigits(mm)}/${toPersianDigits(dd)}`,
      isoUtc: d.toISOString(),
    };
  }
}

/**
 * Format a date into Persian Jalali date string
 */
export function formatJalaliDate(
  dateInput: any,
  withPersianDigits = true,
): string {
  const info = dateToJalali(dateInput);
  return withPersianDigits ? info.persianJalaliStr : info.jalaliStr;
}

/**
 * Get the current Jalali year dynamically (no hardcoded 1403)
 */
export function getCurrentJalaliYear(): number {
  return dateToJalali(new Date()).year;
}

/**
 * Get current Jalali date string YYYY/MM/DD
 */
export function getJalaliDateString(date: Date = new Date()): string {
  return dateToJalali(date).jalaliStr;
}

export function formatScoreBadge(
  score: number,
  thresholds?: { high?: number; low?: number },
): {
  color: string;
  bg: string;
  border: string;
  textClass: string;
  badgeClass: string;
  label: string;
} {
  const highThreshold = thresholds?.high ?? 90;
  const lowThreshold = thresholds?.low ?? 70;

  if (score >= highThreshold) {
    return {
      color: "#16A34A",
      bg: "rgba(22, 163, 74, 0.1)",
      border: "rgba(22, 163, 74, 0.3)",
      textClass: "text-emerald-700 dark:text-emerald-400",
      badgeClass:
        "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300",
      label: "عالی (High Quality)",
    };
  }
  if (score >= lowThreshold) {
    return {
      color: "#D97706",
      bg: "rgba(217, 119, 6, 0.1)",
      border: "rgba(217, 119, 6, 0.3)",
      textClass: "text-amber-700 dark:text-amber-400",
      badgeClass:
        "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300",
      label: "استاندارد (Standard)",
    };
  }
  return {
    color: "#DC2626",
    bg: "rgba(220, 38, 38, 0.1)",
    border: "rgba(220, 38, 38, 0.3)",
    textClass: "text-rose-700 dark:text-rose-400",
    badgeClass:
      "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300",
    label: "کیفیت پایین (Low Quality)",
  };
}

/**
 * Check if assessment date is within the configurable dispute window
 */
export function isWithinDisputeWindow(
  dateOrIso: any,
  daysAllowed: number = 3,
): boolean {
  try {
    if (!dateOrIso) return false;
    const checkDate = parseJalaliOrGregorianDate(dateOrIso);
    if (!checkDate || isNaN(checkDate.getTime())) return true;
    const now = Date.now();
    const diffMs = now - checkDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    // Allow if within dispute window days (or future/today)
    return diffDays <= daysAllowed && diffDays >= -1;
  } catch {
    return false;
  }
}

/**
 * Returns UTC Date range bounds for a full Jalali month in Asia/Tehran timezone.
 * Used for database date queries.
 */
export function getJalaliMonthUtcBounds(
  year: number,
  month: number,
): { startUtc: Date; endUtc: Date } {
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  // Day 1 of month in Gregorian UTC
  const d1 = jalaliToGregorianUTC(year, month, 1);
  // Asia/Tehran is UTC+3:30 -> midnight in Tehran corresponds to 20:30 UTC on the previous Gregorian day
  const startUtc = new Date(d1.getTime() - 3.5 * 60 * 60 * 1000);

  const d2 = jalaliToGregorianUTC(nextYear, nextMonth, 1);
  const endUtc = new Date(d2.getTime() - 3.5 * 60 * 60 * 1000);

  return { startUtc, endUtc };
}
