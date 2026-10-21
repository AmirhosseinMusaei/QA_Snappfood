import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSalesMistakeScore,
  getDefaultSupportScores,
  getDefaultSalesScores,
  getDefaultScoresForRubric,
  calculateSupportTotal,
  calculateSalesTotal,
  calculateAgentMonthlyScore,
  calculateAgentMonthlyScoreDetailed,
  validateRubricDefinition,
  validateScores,
  getAllRubricItems,
  SUPPORT_RUBRIC,
  SALES_RUBRIC,
} from './scoring.ts';

test('Support rubric max points sum to 100 (60 soft skill + 40 knowledge)', () => {
  const soft = SUPPORT_RUBRIC.find(s => s.id === 'support_soft_skill')!;
  const know = SUPPORT_RUBRIC.find(s => s.id === 'support_knowledge')!;

  assert.equal(soft.maxPoints, 60);
  assert.equal(know.maxPoints, 40);

  const softItemsSum = soft.criteria.reduce(
    (acc, c) => acc + c.items.reduce((sum, item) => sum + item.maxPoints, 0),
    0
  );
  const knowItemsSum = know.criteria.reduce(
    (acc, c) => acc + c.items.reduce((sum, item) => sum + item.maxPoints, 0),
    0
  );

  assert.equal(softItemsSum, 60);
  assert.equal(knowItemsSum, 40);
  assert.equal(softItemsSum + knowItemsSum, 100);
});

test('Sales rubric max points sum to 100 (29 soft + 41 script + 30 mistake)', () => {
  const soft = SALES_RUBRIC.find(s => s.id === 'sales_soft_skill')!;
  const script = SALES_RUBRIC.find(s => s.id === 'sales_script')!;

  assert.equal(soft.maxPoints, 29);
  assert.equal(script.maxPoints, 41);

  const softItemsSum = soft.criteria.reduce(
    (acc, c) => acc + c.items.reduce((sum, item) => sum + item.maxPoints, 0),
    0
  );
  const scriptItemsSum = script.criteria.reduce(
    (acc, c) => acc + c.items.reduce((sum, item) => sum + item.maxPoints, 0),
    0
  );

  assert.equal(softItemsSum, 29);
  assert.equal(scriptItemsSum, 41);
  assert.equal(softItemsSum + scriptItemsSum + 30, 100);
});

test('Sales mistake deductions follow exact schedule', () => {
  assert.equal(calculateSalesMistakeScore(0), 30);
  assert.equal(calculateSalesMistakeScore(1), 25);
  assert.equal(calculateSalesMistakeScore(2), 20);
  assert.equal(calculateSalesMistakeScore(3), 15);
  assert.equal(calculateSalesMistakeScore(4), 10);
  assert.equal(calculateSalesMistakeScore(5), 0);
  assert.equal(calculateSalesMistakeScore(8), 0);
});

test('Support default full score calculation produces 100', () => {
  const defaultScores = getDefaultSupportScores();
  const res = calculateSupportTotal(defaultScores, false, false);
  assert.equal(res.total, 100);
  assert.equal(res.softSkill, 60);
  assert.equal(res.knowledge, 40);
});

test('Support deductions reduce total score accurately', () => {
  const scores = getDefaultSupportScores();
  scores['start_greeting'] = 0; // -1 pt
  scores['empathy_sympathy'] = 0; // -5 pts
  scores['vendor_training_main'] = 0; // -8 pts

  const res = calculateSupportTotal(scores, false, false);
  assert.equal(res.total, 86);
  assert.equal(res.softSkill, 54);
  assert.equal(res.knowledge, 32);
});

test('Sales default full score calculation produces 100', () => {
  const defaultScores = getDefaultSalesScores();
  const res = calculateSalesTotal(defaultScores, 0, false, false);
  assert.equal(res.total, 100);
  assert.equal(res.softSkill, 29);
  assert.equal(res.script, 41);
  assert.equal(res.mistakeScore, 30);
});

test('Sales deductions with mistakes produce correct total', () => {
  const scores = getDefaultSalesScores();
  scores['clear_product_explanation'] = 0; // -2 pts from script
  scores['respectful_manner'] = 0; // -2 pts from soft
  const res = calculateSalesTotal(scores, 2, false, false); // mistakes = 2 -> 20 pts (-10)
  assert.equal(res.softSkill, 27);
  assert.equal(res.script, 39);
  assert.equal(res.mistakeScore, 20);
  assert.equal(res.total, 86);
});

test('Fraud flag or critical fault zeroes assessment total score', () => {
  const supportScores = getDefaultSupportScores();
  assert.equal(calculateSupportTotal(supportScores, true, false).total, 0);
  assert.equal(calculateSupportTotal(supportScores, false, true).total, 0);

  const salesScores = getDefaultSalesScores();
  assert.equal(calculateSalesTotal(salesScores, 0, true, false).total, 0);
  assert.equal(calculateSalesTotal(salesScores, 0, false, true).total, 0);
});

test('Monthly score rule: 0 frauds = raw average, 1 fraud = -10, >1 fraud = 0', () => {
  const sampleScores = [90, 85, 95]; // average = 90
  assert.equal(calculateAgentMonthlyScore(sampleScores, 0), 90);
  assert.equal(calculateAgentMonthlyScore(sampleScores, 1), 80);
  assert.equal(calculateAgentMonthlyScore(sampleScores, 2), 0);
  assert.equal(calculateAgentMonthlyScore(sampleScores, 3), 0);
});

test('validateScores returns valid when all items have explicit scores in range [0, maxPoints]', () => {
  const defaultScores = getDefaultSupportScores();
  const res = validateScores(SUPPORT_RUBRIC, defaultScores);
  assert.equal(res.isValid, true);
  assert.equal(res.missingItems.length, 0);
  assert.equal(res.outOfRangeItems.length, 0);
  assert.equal(res.error, undefined);
});

test('validateScores rejects missing items (an item without recorded score is a validation error)', () => {
  const partialScores: Record<string, number> = {
    start_greeting: 1,
    start_agent_name: 1,
  };
  const res = validateScores(SUPPORT_RUBRIC, partialScores);
  assert.equal(res.isValid, false);
  assert.ok(res.missingItems.length > 0);
  assert.ok(res.error?.includes('معیار فاقد نمره ثبت‌شده'));

  // Ensure missing items include specific omitted IDs like 'empathy_sympathy'
  const hasEmpathy = res.missingItems.some((it) => it.id === 'empathy_sympathy');
  assert.equal(hasEmpathy, true);
});

test('validateScores rejects out-of-range scores (> maxPoints or negative)', () => {
  const scores = getDefaultSupportScores();
  // start_greeting maxPoints is 1; set to 5
  scores['start_greeting'] = 5;
  // polite_warmth maxPoints is 5; set to -1
  scores['polite_warmth'] = -1;

  const res = validateScores(SUPPORT_RUBRIC, scores);
  assert.equal(res.isValid, false);
  assert.equal(res.outOfRangeItems.length, 2);
  assert.ok(res.error?.includes('خارج از بازه مجاز'));
});

test('Scoring functions support custom/versioned rubrics', () => {
  // Simulate a version 2 rubric where points differ
  const customRubric = JSON.parse(JSON.stringify(SUPPORT_RUBRIC));
  customRubric[0].criteria[0].items[0].maxPoints = 10; // start_greeting = 10 instead of 1

  const defaultScoresV2 = getDefaultScoresForRubric(customRubric);
  assert.equal(defaultScoresV2['start_greeting'], 10);

  const validation = validateScores(customRubric, defaultScoresV2);
  assert.equal(validation.isValid, true);
});

test('PRD Example 1: Sales totals [100, 0] with one fraud => 40', () => {
  const result = calculateAgentMonthlyScoreDetailed(
    [{ total_score: 100, is_fraud: false }, { total_score: 0, is_fraud: true }],
    'sales'
  );
  assert.equal(result.hasAssessments, true);
  assert.equal(result.assessmentCount, 2);
  assert.equal(result.rawAverage, 50);
  assert.equal(result.fraudCount, 1);
  assert.equal(result.finalMonthlyScore, 40); // 50 - 10 = 40
});

test('PRD Example 2: Sales totals [100, 0, 0] with two frauds => 0', () => {
  const result = calculateAgentMonthlyScoreDetailed(
    [
      { total_score: 100, is_fraud: false },
      { total_score: 0, is_fraud: true },
      { total_score: 0, is_fraud: true },
    ],
    'sales'
  );
  assert.equal(result.hasAssessments, true);
  assert.equal(result.assessmentCount, 3);
  assert.equal(result.fraudCount, 2);
  assert.equal(result.finalMonthlyScore, 0); // >1 fraud = 0
});

test('Support versus Sales fraud behavior: Support does not deduct -10 at monthly level', () => {
  const supportResult = calculateAgentMonthlyScoreDetailed(
    [{ total_score: 100, is_fraud: false }, { total_score: 0, is_fraud: true }],
    'support'
  );
  assert.equal(supportResult.rawAverage, 50);
  assert.equal(supportResult.finalMonthlyScore, 50); // no extra monthly penalty for Support

  const salesResult = calculateAgentMonthlyScoreDetailed(
    [{ total_score: 100, is_fraud: false }, { total_score: 0, is_fraud: true }],
    'sales'
  );
  assert.equal(salesResult.rawAverage, 50);
  assert.equal(salesResult.finalMonthlyScore, 40); // 50 - 10 = 40
});

test('Empty month returns hasAssessments: false, null scores, and no fabricated 92', () => {
  const result = calculateAgentMonthlyScoreDetailed([], 'sales');
  assert.equal(result.hasAssessments, false);
  assert.equal(result.assessmentCount, 0);
  assert.equal(result.rawAverage, null);
  assert.equal(result.finalMonthlyScore, null);
  assert.equal(result.status, 'no_assessments');
});

test('Mistake scoring validates non-negative integer and supports custom settings table', () => {
  // Negative mistakes throws
  assert.throws(() => calculateSalesMistakeScore(-1), /cannot be negative/);
  // Fractional mistakes throws
  assert.throws(() => calculateSalesMistakeScore(1.5), /must be an integer/);

  // Custom table from settings
  const customTable = { 0: 30, 1: 20, 2: 10, 3: 0 };
  assert.equal(calculateSalesMistakeScore(0, customTable), 30);
  assert.equal(calculateSalesMistakeScore(1, customTable), 20);
  assert.equal(calculateSalesMistakeScore(2, customTable), 10);
  assert.equal(calculateSalesMistakeScore(3, customTable), 0);
});

test('validateRubricDefinition validates Support (100) and Sales (70) rubrics recursively', () => {
  // Standard Support rubric (100 pts)
  const supRes = validateRubricDefinition('support', SUPPORT_RUBRIC);
  assert.equal(supRes.isValid, true);
  assert.equal(supRes.totalSectionPoints, 100);

  // Standard Sales rubric (70 pts criteria + 30 mistake = 100)
  const salesRes = validateRubricDefinition('sales', SALES_RUBRIC);
  assert.equal(salesRes.isValid, true);
  assert.equal(salesRes.totalSectionPoints, 70);

  // Sales rubric invalid if section criteria don't match section maxPoints
  const invalidSales = JSON.parse(JSON.stringify(SALES_RUBRIC));
  invalidSales[0].maxPoints = 50; // criteria sum is 29, section is 50
  const invalidRes = validateRubricDefinition('sales', invalidSales);
  assert.equal(invalidRes.isValid, false);
  assert.ok(invalidRes.error?.includes('با سقف نمره بخش'));

  // Sales rubric with balanced criteria but wrong total (e.g. 80 instead of 70)
  const wrongTotalSales = JSON.parse(JSON.stringify(SALES_RUBRIC));
  wrongTotalSales[0].maxPoints = 39;
  wrongTotalSales[0].criteria[0].maxPoints = 15;
  wrongTotalSales[0].criteria[0].items[0].maxPoints = 11;
  const wrongTotalRes = validateRubricDefinition('sales', wrongTotalSales);
  assert.equal(wrongTotalRes.isValid, false);
  assert.ok(wrongTotalRes.error?.includes('۷۰'));

  // Duplicate ID detection
  const duplicateRubric = JSON.parse(JSON.stringify(SUPPORT_RUBRIC));
  duplicateRubric[0].criteria[0].items[1].id = duplicateRubric[0].criteria[0].items[0].id;
  const dupRes = validateRubricDefinition('support', duplicateRubric);
  assert.equal(dupRes.isValid, false);
  assert.ok(dupRes.error?.includes('تکراری'));
});
