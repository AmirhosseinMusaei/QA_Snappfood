/**
 * Utility for exporting data to Microsoft Excel (.xlsx) format using SheetJS (xlsx)
 */
import * as XLSX from 'xlsx';
import type { Assessment, Agent } from '../types/index.ts';
import { dateToJalali, toPersianDigits } from './persian.ts';
import { calculateAgentMonthlyScore } from './scoring.ts';

/**
 * Trigger browser download of an XLSX workbook
 */
export function downloadWorkbook(workbook: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(workbook, filename, { bookType: 'xlsx' });
}

/**
 * Export assessments list to Excel (.xlsx)
 */
export function exportAssessmentsToExcel(
  assessments: Assessment[],
  agents: Agent[] = [],
  filename = 'snappfood_assessments.xlsx'
) {
  const agentMap = new Map<string, Agent>();
  agents.forEach((ag) => agentMap.set(ag.id, ag));

  const headers = [
    'شناسه ارزیابی',
    'نام کارشناس',
    'کد سورس کارشناس',
    'تیم',
    'واحد/دپارتمان',
    'تاریخ بررسی (شمسی)',
    'تاریخ UTC',
    'شناسه وندور',
    'عنوان وندور',
    'نمره کل',
    'نتیجه',
    'نام کنترلر',
    'شماره تیکت / تماس',
    'خطای بحرانی / تقلب',
    'وضعیت اعتراض',
  ];

  const data = assessments.map((a) => {
    const ag = agentMap.get(a.agent_id);
    const jalali = dateToJalali(a.check_date);
    return [
      a.id,
      ag?.name || a.agent_id,
      ag?.source_id || '',
      ag?.team || (ag as any)?.team_name || '',
      a.form_type === 'support' ? 'پشتیبانی' : 'فروش',
      jalali.jalaliStr,
      a.check_date,
      a.vendor_id || '',
      a.vendor_title || '',
      a.total_score,
      a.result,
      a.controller_id,
      a.ticket_number || a.phone_number || '',
      a.is_fraud ? 'تقلب (Fraud)' : a.fault_id ? 'دارای خطا' : 'بدون خطا',
      a.dispute ? (a.dispute.status === 'resolved' ? 'تایید اعتراض' : a.dispute.status === 'in_review' ? 'در حال بررسی' : a.dispute.status === 'rejected' ? 'رد اعتراض' : 'در انتظار بررسی') : 'بدون اعتراض',
    ];
  });

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);

  // Set RTL and column widths
  worksheet['!cols'] = [
    { wch: 14 },
    { wch: 20 },
    { wch: 12 },
    { wch: 16 },
    { wch: 12 },
    { wch: 16 },
    { wch: 22 },
    { wch: 14 },
    { wch: 24 },
    { wch: 10 },
    { wch: 18 },
    { wch: 14 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'ارزیابی‌ها');
  downloadWorkbook(workbook, filename);
}

/**
 * Export monthly scores & roster metrics to Excel (.xlsx)
 */
export function exportMonthlyScoresToExcel(
  dataOrAgents:
    | Array<{
        agent: Agent;
        monthlyScore: number;
        reviewCount: number;
        rawAvg: number;
        fraudCount: number;
        status: string;
        monthName?: string;
      }>
    | Agent[],
  assessmentsOrFilename?: Assessment[] | string,
  teams?: any[],
  settings?: any,
  filename = 'snappfood_monthly_scores.xlsx'
) {
  const headers = [
    'کد کارشناس',
    'نام و نام خانوادگی',
    'تیم',
    'واحد',
    'سرپرست تیم',
    'کنترلر کیفیت',
    'تعداد ارزیابی‌ها',
    'حداقل تارگت ماهانه',
    'میانگین خام',
    'تعداد تقلب',
    'نمره نهایی ماهانه',
    'سطح کیفی',
  ];

  let resolvedData: any[][] = [];
  let finalFilename = filename;

  if (typeof assessmentsOrFilename === 'string') {
    finalFilename = assessmentsOrFilename;
  }

  if (Array.isArray(dataOrAgents) && dataOrAgents.length > 0 && 'agent' in dataOrAgents[0]) {
    // Array of precomputed monthlyData
    const monthlyData = dataOrAgents as Array<{
      agent: Agent;
      monthlyScore: number;
      reviewCount: number;
      rawAvg: number;
      fraudCount: number;
      status: string;
      monthName?: string;
    }>;

    resolvedData = monthlyData.map((row) => [
      row.agent.source_id,
      row.agent.name,
      row.agent.team || (row.agent as any).team_name || '',
      row.agent.department === 'support' ? 'پشتیبانی' : 'فروش',
      row.agent.team_lead,
      row.agent.controller,
      row.reviewCount,
      row.agent.min_monthly_reviews,
      row.rawAvg,
      row.fraudCount,
      row.monthlyScore,
      row.status,
    ]);
  } else if (Array.isArray(dataOrAgents)) {
    // Called with (agents, assessments, teams, settings)
    const agents = dataOrAgents as Agent[];
    const assessments = (Array.isArray(assessmentsOrFilename) ? assessmentsOrFilename : []) as Assessment[];
    const highThreshold = settings?.high_quality_threshold ?? 95;
    const lowThreshold = settings?.low_quality_threshold ?? 80;

    resolvedData = agents.map((ag) => {
      const agentAudits = assessments.filter((a) => a.agent_id === ag.id);
      const scores = agentAudits.map((a) => a.total_score);
      const rawAvg =
        scores.length > 0
          ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
          : 0;
      const fraudCount = agentAudits.filter((a) => a.is_fraud).length;
      const monthlyScore =
        scores.length > 0 ? calculateAgentMonthlyScore(scores, fraudCount) : 0;

      let status = 'بدون ارزیابی';
      if (scores.length > 0) {
        if (monthlyScore >= highThreshold) status = 'کیفیت عالی (High Quality)';
        else if (monthlyScore < lowThreshold) status = 'نیازمند بهبود (Low Quality)';
        else status = 'استاندارد (Acceptable)';
      }

      return [
        ag.source_id,
        ag.name,
        ag.team || (ag as any).team_name || '',
        ag.department === 'support' ? 'پشتیبانی' : 'فروش',
        ag.team_lead,
        ag.controller,
        agentAudits.length,
        ag.min_monthly_reviews,
        rawAvg,
        fraudCount,
        monthlyScore,
        status,
      ];
    });
  }

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...resolvedData]);
  worksheet['!cols'] = [
    { wch: 12 },
    { wch: 22 },
    { wch: 16 },
    { wch: 12 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
    { wch: 12 },
    { wch: 12 },
    { wch: 16 },
    { wch: 22 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'نمرات ماهانه');
  downloadWorkbook(workbook, finalFilename);
}

/**
 * Export custom tabular report to Excel (.xlsx)
 */
export function exportReportToExcel(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  filename = 'snappfood_report.xlsx'
) {
  const worksheet = XLSX.utils.aoa_to_sheet([[title], [], headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'گزارش');
  downloadWorkbook(workbook, filename);
}
