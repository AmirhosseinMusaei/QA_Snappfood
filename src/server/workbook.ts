import ExcelJS from "exceljs";
export async function writeWorkbook(
  name: string,
  rows: any[][],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(name, {
    views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }],
  });
  sheet.addRows(
    rows.map((row) =>
      row.map((value) =>
        typeof value === "string" && /^\s*[=+@\-\t\r]/.test(value)
          ? "'" + value
          : value,
      ),
    ),
  );
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((c) => (c.width = 22));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
