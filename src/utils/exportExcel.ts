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
export async function exportReportToExcel(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string,
) {
  const response = await fetch("/api/export/report-table.xlsx", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, headers, rows }),
  });
  if (!response.ok) {
    if (response.status === 401)
      window.dispatchEvent(new Event("qa-session-expired"));
    const result = await response.json().catch(() => ({}));
    throw new Error(result.message || "دریافت خروجی ناموفق بود");
  }
  const { downloadBlob } = await import("./downloadTable.ts");
  downloadBlob(await response.blob(), filename);
}
