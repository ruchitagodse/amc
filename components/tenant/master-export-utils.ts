const escapeCsvCell = (value: string) => `"${value.replaceAll('"', '""')}"`;

export const buildCsv = (headers: string[], rows: string[][]) => {
  return [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(",")),
  ].join("\n");
};

export const triggerCsvDownload = (fileName: string, csv: string) => {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};
