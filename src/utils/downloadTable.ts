export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
export function csvCell(value: unknown) {
  const text = String(value ?? "");
  return (
    '"' +
    (/^[\s]*[=+@\-]/.test(text) ? "'" + text : text).replaceAll('"', '""') +
    '"'
  );
}
export function downloadCsv(
  headers: unknown[],
  rows: unknown[][],
  filename: string,
) {
  downloadBlob(
    new Blob(
      [
        "\uFEFF" +
          [headers, ...rows]
            .map((row) => row.map(csvCell).join(","))
            .join("\r\n"),
      ],
      { type: "text/csv;charset=utf-8" },
    ),
    filename,
  );
}
