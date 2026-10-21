/** Exports are authorized and calculated on the server, never from a partial UI page. */
export function exportAssessmentsToExcel(
  _assessments?: any,
  _agents?: any,
  _filename?: string,
) {
  window.location.assign("/api/export/assessments.xlsx");
}
export function exportMonthlyScoresToExcel(..._args: any[]) {
  window.location.assign("/api/export/monthly-scores.xlsx");
}
export function exportReportToExcel(..._args: any[]) {
  window.location.assign("/api/export/monthly-scores.xlsx");
}
