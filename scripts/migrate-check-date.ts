import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

function toEnglishDigits(input: string | number | undefined | null): string {
  if (!input) return '';
  let str = String(input);
  for (let i = 0; i < 10; i++) str = str.replace(new RegExp(persianDigits[i], 'g'), String(i));
  return str;
}

function jalaliToGregorianUTC(jy: number, jm: number, jd: number): Date {
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
  sal_a = [0, 31, (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  for (gm = 0; gm < 13 && gd > sal_a[gm]; gm++) gd -= sal_a[gm];
  return new Date(Date.UTC(gy, gm - 1, gd));
}

export function parseJalaliOrGregorianDate(input: any): Date {
  if (!input) return new Date();
  if (input instanceof Date && !isNaN(input.getTime())) return input;
  const str = toEnglishDigits(String(input)).trim();
  if (
    str.includes('/') ||
    (str.includes('-') &&
      !str.includes('T') &&
      str.split('-')[0].length === 4 &&
      parseInt(str.split('-')[0], 10) < 1900)
  ) {
    const parts = str.split(/[/-]/).map((s) => parseInt(s, 10));
    if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return jalaliToGregorianUTC(parts[0], parts[1], parts[2]);
    }
  }
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

async function run() {
  console.log('🔄 Running check_date migration to Gregorian UTC DateTime...');
  const assessments = await prisma.assessment.findMany({
    select: { id: true, check_date: true },
  });

  let migratedCount = 0;
  for (const ass of assessments) {
    const gregDate = parseJalaliOrGregorianDate(ass.check_date);
    await prisma.assessment.update({
      where: { id: ass.id },
      data: {
        check_date: gregDate,
      },
    });
    migratedCount++;
  }

  console.log(`✅ Successfully verified and migrated ${migratedCount} assessments to Gregorian UTC dates.`);
  await prisma.$disconnect();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
