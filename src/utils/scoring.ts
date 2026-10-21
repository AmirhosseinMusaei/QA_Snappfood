/**
 * Pure scoring calculation functions and rubric definition
 */

import type { RubricSection } from '../types/index.ts';

export const SUPPORT_RUBRIC: RubricSection[] = [
  {
    id: 'support_soft_skill',
    title: 'مهارتهای ارتباطی (Soft Skill)',
    maxPoints: 60,
    criteria: [
      {
        id: 'start_standard',
        title: 'استاندارد شروع مکالمه',
        maxPoints: 4,
        items: [
          { id: 'start_greeting', title: 'سلام و وقت بخیر', maxPoints: 1 },
          { id: 'start_agent_name', title: 'معرفی کارشناس', maxPoints: 1 },
          { id: 'start_company_name', title: 'معرفی شرکت', maxPoints: 1 },
          { id: 'start_vendor_check', title: 'چک وندور و نام مجموعه', maxPoints: 1 },
        ],
      },
      {
        id: 'active_listening',
        title: 'گوش دادن فعال',
        maxPoints: 5,
        items: [
          { id: 'active_listening_main', title: 'گوش دادن فعال و عدم حواسپرتی', maxPoints: 5 },
        ],
      },
      {
        id: 'vendor_understanding',
        title: 'درک و اطمینان به وندور',
        maxPoints: 8,
        items: [
          { id: 'vendor_understand_problem', title: 'درک صحیح مشکل', maxPoints: 4 },
          { id: 'vendor_reassurance', title: 'اطمینان‌بخشی به وندور', maxPoints: 4 },
        ],
      },
      {
        id: 'empathy_tone',
        title: 'همدلی، حسن برخورد و تن صدا',
        maxPoints: 15,
        items: [
          { id: 'empathy_sympathy', title: 'همدلی و همدردی موثر', maxPoints: 5 },
          { id: 'polite_warmth', title: 'حسن برخورد، گرمی و صمیمیت', maxPoints: 5 },
          { id: 'tone_of_voice', title: 'تن صدا و ریتم مناسب', maxPoints: 5 },
        ],
      },
      {
        id: 'open_questions',
        title: 'سوال باز پرسیدن',
        maxPoints: 5,
        items: [
          { id: 'open_questions_main', title: 'پرسیدن سوال باز جهت درک نیاز', maxPoints: 5 },
        ],
      },
      {
        id: 'interruption_speed',
        title: 'عدم قطع صحبت وندور و سرعت مکالمه',
        maxPoints: 5,
        items: [
          { id: 'no_interruption', title: 'عدم قطع صحبت وندور', maxPoints: 3 },
          { id: 'speech_speed', title: 'سرعت مکالمه متناسب', maxPoints: 2 },
        ],
      },
      {
        id: 'challenging_calls',
        title: 'مدیریت تماسهای چالشی',
        maxPoints: 6,
        items: [
          { id: 'challenging_calls_main', title: 'مدیریت تماسهای چالشی و معترض', maxPoints: 6 },
        ],
      },
      {
        id: 'hold_silence_time',
        title: 'سکوت بیمورد، هلد و مدیریت زمان',
        maxPoints: 6,
        items: [
          { id: 'no_unneeded_silence', title: 'پرهیز از سکوت بیمورد', maxPoints: 2 },
          { id: 'hold_rules', title: 'رعایت قوانین Hold و اجازه گرفتن', maxPoints: 2 },
          { id: 'time_management', title: 'مدیریت زمان مکالمه', maxPoints: 2 },
        ],
      },
      {
        id: 'call_closing',
        title: 'پایان مکالمه استاندارد',
        maxPoints: 6,
        items: [
          { id: 'closing_query', title: 'پرسش از درخواست دیگری (کوئری)', maxPoints: 2 },
          { id: 'closing_survey', title: 'ارجاع به نظرسنجی', maxPoints: 2 },
          { id: 'closing_farewell', title: 'خداحافظی استاندارد سازمانی', maxPoints: 2 },
        ],
      },
    ],
  },
  {
    id: 'support_knowledge',
    title: 'دانش تخصصی و رعایت پروسه (Knowledge)',
    maxPoints: 40,
    criteria: [
      {
        id: 'accuracy_focus',
        title: 'دقت و تمرکز در انجام امور محوله',
        maxPoints: 6,
        items: [
          { id: 'accuracy_focus_main', title: 'دقت و تمرکز در انجام کار', maxPoints: 6 },
        ],
      },
      {
        id: 'vendor_training',
        title: 'آموزش به وندور',
        maxPoints: 8,
        items: [
          { id: 'vendor_training_main', title: 'راهنمایی و آموزش شفاف به وندور', maxPoints: 8 },
        ],
      },
      {
        id: 'system_process',
        title: 'دانش سیستم و رعایت پروسه',
        maxPoints: 6,
        items: [
          { id: 'system_knowledge', title: 'دانش کار با سیستم و ابزارها', maxPoints: 3 },
          { id: 'process_compliance', title: 'رعایت دقیق فرایند عملیاتی', maxPoints: 3 },
        ],
      },
      {
        id: 'first_ticket_resolution',
        title: 'تشخیص و حل مشکل در اولین تیکت (FTR/FCR)',
        maxPoints: 6,
        items: [
          { id: 'ftr_resolution', title: 'حل قطعی مشکل در اولین تماس', maxPoints: 6 },
        ],
      },
      {
        id: 'confidentiality',
        title: 'رعایت قوانین سازمان و عدم افشای اطلاعات محرمانه',
        maxPoints: 4,
        items: [
          { id: 'confidentiality_main', title: 'حفظ اطلاعات محرمانه وندور و سازمان', maxPoints: 4 },
        ],
      },
      {
        id: 'reason_result_comment',
        title: 'انتخاب ریزن، ریزالت و کامنت',
        maxPoints: 6,
        items: [
          { id: 'reason_result_selection', title: 'انتخاب صحیح ریزن و ریزالت', maxPoints: 3 },
          { id: 'comment_quality', title: 'ثبت کامنت دقیق، خوانا و کاربردی', maxPoints: 3 },
        ],
      },
      {
        id: 'check_previous_tickets',
        title: 'چک کردن تیکتهای قبلی',
        maxPoints: 4,
        items: [
          { id: 'previous_tickets_check', title: 'بررسی تاریخچه و تیکتهای قبلی', maxPoints: 4 },
        ],
      },
    ],
  },
];

export const SALES_RUBRIC: RubricSection[] = [
  {
    id: 'sales_soft_skill',
    title: 'مهارتهای ارتباطی و رفتاری (Soft Skill)',
    maxPoints: 29,
    criteria: [
      {
        id: 'clear_trust',
        title: 'صحبت شفاف، قابلفهم و ایجاد اعتماد',
        maxPoints: 5,
        items: [
          { id: 'clear_comprehensible', title: 'صحبت شفاف و قابلفهم', maxPoints: 1 },
          { id: 'accurate_info', title: 'ارائه اطلاعات دقیق', maxPoints: 2 },
          { id: 'honesty_details', title: 'صداقت در توضیحات', maxPoints: 1 },
          { id: 'build_trust', title: 'ایجاد حس اعتماد', maxPoints: 1 },
        ],
      },
      {
        id: 'respectful_tone',
        title: 'حفظ لحن محترمانه',
        maxPoints: 5,
        items: [
          { id: 'respectful_manner', title: 'لحن محترمانه', maxPoints: 2 },
          { id: 'voice_eloquence', title: 'فن بیان و تن صدای مناسب', maxPoints: 1 },
          { id: 'call_control_silence', title: 'مدیریت صحیح مکالمه و عدم سکوت/هولد', maxPoints: 2 },
        ],
      },
      {
        id: 'emotion_control',
        title: 'کنترل احساسات و حفظ آرامش هنگام اعتراض',
        maxPoints: 5,
        items: [
          { id: 'calm_on_objection', title: 'حفظ آرامش هنگام اعتراض', maxPoints: 2 },
          { id: 'no_direct_argument', title: 'پرهیز از بحث مستقیم و حفظ ادب', maxPoints: 1 },
          { id: 'emotional_control', title: 'کنترل احساسات', maxPoints: 1 },
          { id: 'no_defensive_behavior', title: 'عدم رفتار تدافعی', maxPoints: 1 },
        ],
      },
      {
        id: 'customer_empathy',
        title: 'همدلی با مشتری',
        maxPoints: 4,
        items: [
          { id: 'empathy_customer', title: 'همدلی با مشتری', maxPoints: 1 },
          { id: 'targeted_questions', title: 'پرسیدن سوال هدفمند', maxPoints: 1 },
          { id: 'understand_customer_needs', title: 'شناخت صحیح نیاز مشتری', maxPoints: 2 },
        ],
      },
      {
        id: 'principled_persuasion',
        title: 'متقاعدسازی اصولی',
        maxPoints: 5,
        items: [
          { id: 'confidence_proposal', title: 'اعتمادبه‌نفس در ارائه پیشنهاد', maxPoints: 1 },
          { id: 'price_presentation', title: 'ارائه مناسب قیمت', maxPoints: 1 },
          { id: 'persuasion_technique', title: 'متقاعدسازی اصولی', maxPoints: 1 },
          { id: 'product_benefits_focus', title: 'تمرکز بر ارزش و مزایای محصول', maxPoints: 2 },
        ],
      },
      {
        id: 'negotiation_flexibility',
        title: 'انعطافپذیری در مذاکره',
        maxPoints: 5,
        items: [
          { id: 'flexibility_flow', title: 'انعطاف در روند مذاکره', maxPoints: 2 },
          { id: 'alternative_solution', title: 'ارائه راهحل یا پیشنهاد جایگزین', maxPoints: 3 },
        ],
      },
    ],
  },
  {
    id: 'sales_script',
    title: 'رعایت اسکریپت و فرایند فروش (Script)',
    maxPoints: 41,
    criteria: [
      {
        id: 'clarity_rules',
        title: 'شفافیت و وضوح در مذاکره',
        maxPoints: 6,
        items: [
          { id: 'clear_product_explanation', title: 'توضیح شفاف محصول', maxPoints: 2 },
          { id: 'complete_details', title: 'ارائه جزئیات کامل', maxPoints: 2 },
          { id: 'rules_compliance', title: 'رعایت قوانین', maxPoints: 1 },
          { id: 'process_compliance_sales', title: 'رعایت فرایندها', maxPoints: 1 },
        ],
      },
      {
        id: 'script_start_finish',
        title: 'شروع و پایان متناسب با استاندارد هر تیم و سازمان',
        maxPoints: 8,
        items: [
          { id: 'standard_start_sales', title: 'شروع استاندارد', maxPoints: 3 },
          { id: 'standard_end_sales', title: 'پایان استاندارد', maxPoints: 3 },
          { id: 'team_framework', title: 'رعایت چارچوب تیم یا سازمان', maxPoints: 2 },
        ],
      },
      {
        id: 'project_script_compliance',
        title: 'رعایت کامل اسکریپت مربوط به پروژه',
        maxPoints: 8,
        items: [
          { id: 'script_structure', title: 'رعایت ساختار اسکریپت', maxPoints: 4 },
          { id: 'no_essential_omission', title: 'عدم حذف بخشهای ضروری', maxPoints: 2 },
          { id: 'project_workflow_execution', title: 'اجرای صحیح روند پروژه', maxPoints: 2 },
        ],
      },
      {
        id: 'key_points_summary',
        title: 'جمعبندی نکات کلیدی',
        maxPoints: 5,
        items: [
          { id: 'summarize_points', title: 'جمعبندی نکات مهم', maxPoints: 2 },
          { id: 'final_confirmation', title: 'تأیید نهایی با مشتری', maxPoints: 1 },
          { id: 'final_clarification', title: 'شفافسازی نهایی', maxPoints: 2 },
        ],
      },
      {
        id: 'negotiation_effort',
        title: 'تلاش موثر برای پیشبرد مذاکره',
        maxPoints: 5,
        items: [
          { id: 'effort_successful_negotiation', title: 'تلاش موثر برای مذاکره موفق', maxPoints: 2 },
          { id: 'maintain_quality', title: 'حفظ کیفیت مذاکره', maxPoints: 2 },
          { id: 'present_product_advantages', title: 'ارائه مزایای محصول', maxPoints: 1 },
        ],
      },
      {
        id: 'no_off_script_promises',
        title: 'عدم ارائه توضیحات خارج از اسکریپت',
        maxPoints: 4,
        items: [
          { id: 'no_unscripted_explanation', title: 'عدم ارائه توضیح خارج از اسکریپت', maxPoints: 2 },
          { id: 'no_unrealistic_expectation', title: 'عدم ایجاد توقع یا اطلاعات غیرواقعی', maxPoints: 2 },
        ],
      },
      {
        id: 'no_wrong_guidance',
        title: 'عدم راهنمایی و ارجاع نادرست',
        maxPoints: 5,
        items: [
          { id: 'no_wrong_referral', title: 'عدم ارجاع اشتباه', maxPoints: 2 },
          { id: 'no_false_promises', title: 'عدم وعده یا راهنمایی نادرست', maxPoints: 2 },
          { id: 'transparent_continuity', title: 'حفظ شفافیت در ادامه مذاکره', maxPoints: 1 },
        ],
      },
    ],
  },
];

/**
 * Calculate mistake points for Sales form
 * Default PRD Schedule:
 * 0 mistakes = 30 pts
 * 1 mistake = 25 pts (-5)
 * 2 mistakes = 20 pts (-10)
 * 3 mistakes = 15 pts (-15)
 * 4 mistakes = 10 pts (-20)
 * >= 5 mistakes = 0 pts
 *
 * Reads configurable mistake table from validated settings if provided.
 * Rejects negative and fractional mistake counts.
 */
export function calculateSalesMistakeScore(
  mistakes: number,
  customTable?: Record<number | string, number> | null
): number {
  if (mistakes < 0) {
    throw new Error('تعداد اشتباهات نمی‌تواند منفی باشد (Mistake count cannot be negative)');
  }
  if (!Number.isInteger(mistakes)) {
    throw new Error('تعداد اشتباهات باید عدد صحیح باشد (Mistake count must be an integer)');
  }

  if (customTable && typeof customTable === 'object') {
    if (mistakes in customTable) {
      return Number(customTable[mistakes]);
    }
    if (String(mistakes) in customTable) {
      return Number(customTable[String(mistakes)]);
    }
    if (mistakes >= 5) {
      if (5 in customTable) return Number(customTable[5]);
      if ('5' in customTable) return Number(customTable['5']);
    }
  }

  if (mistakes === 0) return 30;
  if (mistakes === 1) return 25;
  if (mistakes === 2) return 20;
  if (mistakes === 3) return 15;
  if (mistakes === 4) return 10;
  return 0;
}

/**
 * Get all flat sub-items from a rubric definition
 */
export function getAllRubricItems(rubric: RubricSection[]): Array<{
  id: string;
  title: string;
  maxPoints: number;
  sectionId: string;
  criterionId: string;
}> {
  const items: Array<{
    id: string;
    title: string;
    maxPoints: number;
    sectionId: string;
    criterionId: string;
  }> = [];

  rubric.forEach((section) => {
    section.criteria.forEach((crit) => {
      crit.items.forEach((item) => {
        items.push({
          id: item.id,
          title: item.title,
          maxPoints: item.maxPoints,
          sectionId: section.id,
          criterionId: crit.id,
        });
      });
    });
  });

  return items;
}

/**
 * Build default full scores object for any given rubric (all items checked/full score)
 */
export function getDefaultScoresForRubric(rubric: RubricSection[]): Record<string, number> {
  const scores: Record<string, number> = {};
  rubric.forEach((section) => {
    section.criteria.forEach((crit) => {
      crit.items.forEach((item) => {
        scores[item.id] = item.maxPoints;
      });
    });
  });
  return scores;
}

/**
 * Build default full scores object for Support form (all items checked/full score)
 */
export function getDefaultSupportScores(rubric: RubricSection[] = SUPPORT_RUBRIC): Record<string, number> {
  return getDefaultScoresForRubric(rubric);
}

/**
 * Build default full scores object for Sales form (all soft/script items checked)
 */
export function getDefaultSalesScores(rubric: RubricSection[] = SALES_RUBRIC): Record<string, number> {
  return getDefaultScoresForRubric(rubric);
}

export interface ScoreValidationResult {
  isValid: boolean;
  missingItems: Array<{ id: string; title: string; maxPoints: number }>;
  outOfRangeItems: Array<{ id: string; title: string; score: number; maxPoints: number }>;
  error?: string;
}

/**
 * Validate that every rubric item has an explicit recorded score and that all scores are in [0, maxPoints].
 * Items without a recorded score or with out-of-range values are flagged as errors.
 */
export function validateScores(
  rubric: RubricSection[],
  scores: Record<string, number> | undefined | null
): ScoreValidationResult {
  const missingItems: Array<{ id: string; title: string; maxPoints: number }> = [];
  const outOfRangeItems: Array<{ id: string; title: string; score: number; maxPoints: number }> = [];

  if (!scores || typeof scores !== 'object') {
    const all = getAllRubricItems(rubric);
    return {
      isValid: false,
      missingItems: all.map((it) => ({ id: it.id, title: it.title, maxPoints: it.maxPoints })),
      outOfRangeItems: [],
      error: 'هیچ نمره‌ای برای ارزیابی ثبت نشده است (Scores object is missing)',
    };
  }

  rubric.forEach((section) => {
    section.criteria.forEach((crit) => {
      crit.items.forEach((item) => {
        const val = scores[item.id];
        // Must be an explicit recorded number (not undefined, null, or NaN)
        if (val === undefined || val === null || typeof val !== 'number' || Number.isNaN(val)) {
          missingItems.push({ id: item.id, title: item.title, maxPoints: item.maxPoints });
        } else if (val < 0 || val > item.maxPoints) {
          outOfRangeItems.push({
            id: item.id,
            title: item.title,
            score: val,
            maxPoints: item.maxPoints,
          });
        }
      });
    });
  });

  if (missingItems.length > 0) {
    const titles = missingItems.map((m) => `"${m.title}"`).slice(0, 3).join('، ');
    const extra = missingItems.length > 3 ? ` و ${missingItems.length - 3} مورد دیگر` : '';
    return {
      isValid: false,
      missingItems,
      outOfRangeItems,
      error: `تعداد ${missingItems.length} معیار فاقد نمره ثبت‌شده هستند: ${titles}${extra}`,
    };
  }

  if (outOfRangeItems.length > 0) {
    const details = outOfRangeItems
      .map((o) => `"${o.title}" (نمره: ${o.score} / سقف: ${o.maxPoints})`)
      .slice(0, 3)
      .join('، ');
    return {
      isValid: false,
      missingItems,
      outOfRangeItems,
      error: `نمره خارج از بازه مجاز برای معیارهای: ${details}`,
    };
  }

  return {
    isValid: true,
    missingItems: [],
    outOfRangeItems: [],
  };
}

/**
 * Calculate total score for Support form.
 * Validates that every item has an explicit recorded score within [0, maxPoints].
 */
export function calculateSupportTotal(
  scores: Record<string, number>,
  isFraud: boolean,
  isCriticalFault: boolean,
  rubric: RubricSection[] = SUPPORT_RUBRIC
): { total: number; softSkill: number; knowledge: number } {
  if (isFraud || isCriticalFault) {
    return { total: 0, softSkill: 0, knowledge: 0 };
  }

  const validation = validateScores(rubric, scores);
  if (!validation.isValid) {
    throw new Error(validation.error || 'خطای اعتبارسنجی نمرات فرم پشتیبانی');
  }

  let softSkill = 0;
  let knowledge = 0;

  rubric.forEach((section) => {
    let sectionSum = 0;
    section.criteria.forEach((crit) => {
      crit.items.forEach((item) => {
        sectionSum += scores[item.id];
      });
    });
    if (section.id === 'support_soft_skill' || section.id.includes('soft')) {
      softSkill += sectionSum;
    } else {
      knowledge += sectionSum;
    }
  });

  const total = Math.max(0, softSkill + knowledge);
  return { total, softSkill, knowledge };
}

/**
 * Calculate total score for Sales form.
 * Validates that every item has an explicit recorded score within [0, maxPoints].
 * Rejects negative and fractional mistake counts.
 * Uses configurable mistake table from settings if provided.
 */
export function calculateSalesTotal(
  scores: Record<string, number>,
  mistakes: number,
  isFraud: boolean,
  isCriticalFault: boolean,
  rubric: RubricSection[] = SALES_RUBRIC,
  customMistakeTable?: Record<number | string, number> | null
): { total: number; softSkill: number; script: number; mistakeScore: number } {
  const mistakeScore = calculateSalesMistakeScore(mistakes, customMistakeTable);

  if (isFraud || isCriticalFault) {
    return { total: 0, softSkill: 0, script: 0, mistakeScore };
  }

  const validation = validateScores(rubric, scores);
  if (!validation.isValid) {
    throw new Error(validation.error || 'خطای اعتبارسنجی نمرات فرم فروش');
  }

  let softSkill = 0;
  let script = 0;

  rubric.forEach((section) => {
    let sectionSum = 0;
    section.criteria.forEach((crit) => {
      crit.items.forEach((item) => {
        sectionSum += scores[item.id];
      });
    });
    if (section.id === 'sales_soft_skill' || section.id.includes('soft')) {
      softSkill += sectionSum;
    } else {
      script += sectionSum;
    }
  });

  const total = Math.max(0, softSkill + script + mistakeScore);
  return { total, softSkill, script, mistakeScore };
}

export interface RubricValidationResult {
  isValid: boolean;
  error?: string;
  totalSectionPoints: number;
  expectedSectionPoints: number;
}

/**
 * Recursively validates a full rubric definition:
 * - Checks uniqueness of section, criterion, and item IDs across the entire rubric.
 * - Checks non-empty titles.
 * - Checks that item maxPoints are positive integers (> 0).
 * - Checks that sum of item maxPoints equals criterion maxPoints.
 * - Checks that sum of criterion maxPoints equals section maxPoints.
 * - Checks final section sum:
 *     Support sections must sum to exactly 100.
 *     Sales sections must sum to exactly 70 (plus 30 mistake pool = 100 total form points).
 * - Does not clamp scores to hide invalid totals.
 */
export function validateRubricDefinition(
  formType: 'support' | 'sales',
  sections: RubricSection[]
): RubricValidationResult {
  if (!Array.isArray(sections) || sections.length === 0) {
    return {
      isValid: false,
      error: 'ساختار رابریک نامعتبر است یا فاقد بخش می‌باشد',
      totalSectionPoints: 0,
      expectedSectionPoints: formType === 'support' ? 100 : 70,
    };
  }

  const seenIds = new Set<string>();
  let totalSectionPoints = 0;
  const expectedSectionPoints = formType === 'support' ? 100 : 70;

  for (const [secIdx, section] of sections.entries()) {
    if (!section.id || typeof section.id !== 'string' || !section.id.trim()) {
      return {
        isValid: false,
        error: `شناسه بخش شماره ${secIdx + 1} نامعتبر یا خالی است`,
        totalSectionPoints,
        expectedSectionPoints,
      };
    }
    if (seenIds.has(section.id)) {
      return {
        isValid: false,
        error: `شناسه بخش "${section.id}" تکراری است (Duplicate Section ID)`,
        totalSectionPoints,
        expectedSectionPoints,
      };
    }
    seenIds.add(section.id);

    if (!section.title || typeof section.title !== 'string' || !section.title.trim()) {
      return {
        isValid: false,
        error: `عنوان بخش "${section.id}" خالی است`,
        totalSectionPoints,
        expectedSectionPoints,
      };
    }

    if (!Array.isArray(section.criteria) || section.criteria.length === 0) {
      return {
        isValid: false,
        error: `بخش "${section.title}" فاقد هرگونه معیار است`,
        totalSectionPoints,
        expectedSectionPoints,
      };
    }

    let criterionSum = 0;
    for (const [critIdx, crit] of section.criteria.entries()) {
      if (!crit.id || typeof crit.id !== 'string' || !crit.id.trim()) {
        return {
          isValid: false,
          error: `شناسه معیار شماره ${critIdx + 1} در بخش "${section.title}" خالی است`,
          totalSectionPoints,
          expectedSectionPoints,
        };
      }
      if (seenIds.has(crit.id)) {
        return {
          isValid: false,
          error: `شناسه معیار "${crit.id}" تکراری است (Duplicate Criterion ID)`,
          totalSectionPoints,
          expectedSectionPoints,
        };
      }
      seenIds.add(crit.id);

      if (!crit.title || typeof crit.title !== 'string' || !crit.title.trim()) {
        return {
          isValid: false,
          error: `عنوان معیار "${crit.id}" در بخش "${section.title}" خالی است`,
          totalSectionPoints,
          expectedSectionPoints,
        };
      }

      if (!Array.isArray(crit.items) || crit.items.length === 0) {
        return {
          isValid: false,
          error: `معیار "${crit.title}" در بخش "${section.title}" فاقد آیتم‌های نمره‌دهی است`,
          totalSectionPoints,
          expectedSectionPoints,
        };
      }

      let itemSum = 0;
      for (const [itemIdx, item] of crit.items.entries()) {
        if (!item.id || typeof item.id !== 'string' || !item.id.trim()) {
          return {
            isValid: false,
            error: `شناسه آیتم شماره ${itemIdx + 1} در معیار "${crit.title}" خالی است`,
            totalSectionPoints,
            expectedSectionPoints,
          };
        }
        if (seenIds.has(item.id)) {
          return {
            isValid: false,
            error: `شناسه آیتم "${item.id}" تکراری است (Duplicate Item ID)`,
            totalSectionPoints,
            expectedSectionPoints,
          };
        }
        seenIds.add(item.id);

        if (!item.title || typeof item.title !== 'string' || !item.title.trim()) {
          return {
            isValid: false,
            error: `عنوان آیتم "${item.id}" در معیار "${crit.title}" خالی است`,
            totalSectionPoints,
            expectedSectionPoints,
          };
        }

        const maxP = Number(item.maxPoints);
        if (isNaN(maxP) || maxP <= 0 || !Number.isInteger(maxP)) {
          return {
            isValid: false,
            error: `سقف نمره آیتم "${item.title}" باید عدد صحیح مثبت باشد (مقدار فعلی: ${item.maxPoints})`,
            totalSectionPoints,
            expectedSectionPoints,
          };
        }
        itemSum += maxP;
      }

      const critMaxP = Number(crit.maxPoints);
      if (itemSum !== critMaxP) {
        return {
          isValid: false,
          error: `مجموع نمرات آیتم‌های معیار "${crit.title}" (${itemSum}) با سقف نمره معیار (${critMaxP}) برابر نیست`,
          totalSectionPoints,
          expectedSectionPoints,
        };
      }
      criterionSum += critMaxP;
    }

    const secMaxP = Number(section.maxPoints);
    if (criterionSum !== secMaxP) {
      return {
        isValid: false,
        error: `مجموع نمرات معیارهای بخش "${section.title}" (${criterionSum}) با سقف نمره بخش (${secMaxP}) برابر نیست`,
        totalSectionPoints,
        expectedSectionPoints,
      };
    }

    totalSectionPoints += secMaxP;
  }

  if (totalSectionPoints !== expectedSectionPoints) {
    const unitName = formType === 'support' ? 'پشتیبانی' : 'فروش';
    const explanation =
      formType === 'sales'
        ? ` (بخش‌های مهارتی و اسکریپت فروش باید ۷۰ باشد و ۳۰ امتیاز باقی‌مانده از جدول اشتباهات محاسبه می‌شود)`
        : '';
    return {
      isValid: false,
      error: `مجموع سقف نمرات بخش‌های فرم ${unitName} برابر ${totalSectionPoints} است در حالی که باید دقیقاً ${expectedSectionPoints} باشد${explanation}`,
      totalSectionPoints,
      expectedSectionPoints,
    };
  }

  return {
    isValid: true,
    totalSectionPoints,
    expectedSectionPoints,
  };
}

export interface AgentMonthlyScoreResult {
  hasAssessments: boolean;
  assessmentCount: number;
  scores: number[];
  rawAverage: number | null;
  fraudCount: number;
  finalMonthlyScore: number | null;
  department: 'support' | 'sales';
  status: 'no_assessments' | 'high_quality' | 'standard' | 'low_quality';
}

/**
 * Authoritative Monthly Calculation Service:
 * - Computes raw average and final monthly score for an agent in a selected month.
 * - Excludes soft-deleted assessments.
 * - When an agent has 0 assessments, returns hasAssessments: false and finalMonthlyScore: null.
 *   Never fabricates arbitrary scores like 92.
 * - For Sales:
 *     Calculates the mean of all totals in that agent's selected month (including 0-score fraud cases):
 *     - 0 fraud: uses the mean.
 *     - Exactly 1 fraud: subtracts 10, minimum zero.
 *     - >1 fraud: final monthly score is 0.
 *     Examples:
 *       Sales [100, 0] with 1 fraud => mean is 50, final is 40.
 *       Sales [100, 0, 0] with 2 frauds => final is 0.
 * - For Support:
 *     Calculates the mean of all totals in that agent's selected month.
 *     Does not apply an extra monthly fraud deduction (fraud assessments already evaluate to 0).
 */
export function calculateAgentMonthlyScoreDetailed(
  assessmentList: Array<{ total_score: number; is_fraud?: boolean; deleted_at?: any }>,
  department: 'support' | 'sales',
  thresholds?: { high?: number; low?: number }
): AgentMonthlyScoreResult {
  const activeList = assessmentList.filter((a) => !a.deleted_at);
  if (activeList.length === 0) {
    return {
      hasAssessments: false,
      assessmentCount: 0,
      scores: [],
      rawAverage: null,
      fraudCount: 0,
      finalMonthlyScore: null,
      department,
      status: 'no_assessments',
    };
  }

  const scores = activeList.map((a) => a.total_score);
  const fraudCount = activeList.filter((a) => Boolean(a.is_fraud)).length;
  const rawSum = scores.reduce((sum, s) => sum + s, 0);
  const rawAverage = Math.round((rawSum / scores.length) * 10) / 10;

  let finalMonthlyScore: number;

  if (department === 'sales') {
    if (fraudCount === 0) {
      finalMonthlyScore = rawAverage;
    } else if (fraudCount === 1) {
      finalMonthlyScore = Math.max(0, Math.round((rawAverage - 10) * 10) / 10);
    } else {
      finalMonthlyScore = 0;
    }
  } else {
    // Support monthly rule: raw average (fraud assessments already zeroed)
    finalMonthlyScore = rawAverage;
  }

  const highThreshold = thresholds?.high ?? 95;
  const lowThreshold = thresholds?.low ?? 80;

  let status: 'high_quality' | 'standard' | 'low_quality';
  if (finalMonthlyScore >= highThreshold) {
    status = 'high_quality';
  } else if (finalMonthlyScore < lowThreshold) {
    status = 'low_quality';
  } else {
    status = 'standard';
  }

  return {
    hasAssessments: true,
    assessmentCount: scores.length,
    scores,
    rawAverage,
    fraudCount,
    finalMonthlyScore,
    department,
    status,
  };
}

/**
 * Backward-compatible monthly score calculator.
 * Applies the -10 / 0 fraud deduction specifically to Sales, while preserving Support behavior.
 */
export function calculateAgentMonthlyScore(
  assessmentScores: number[],
  fraudCountInMonth: number,
  department: 'support' | 'sales' = 'sales'
): number {
  if (assessmentScores.length === 0) return 0;

  const rawSum = assessmentScores.reduce((acc, curr) => acc + curr, 0);
  const rawAverage = rawSum / assessmentScores.length;

  if (department === 'sales') {
    if (fraudCountInMonth > 1) return 0;
    let finalAverage = rawAverage;
    if (fraudCountInMonth === 1) {
      finalAverage = Math.max(0, finalAverage - 10);
    }
    return Math.round(finalAverage * 10) / 10;
  }

  // Support department
  return Math.round(rawAverage * 10) / 10;
}
