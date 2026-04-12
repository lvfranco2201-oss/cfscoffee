/**
 * CSV Export Utility — CFSCoffee BI
 * Converts an array of objects to a downloadable CSV file.
 * No external dependencies — uses only browser native APIs.
 */

type Row = Record<string, string | number | boolean | null | undefined>;

/**
 * Converts an array of objects to CSV format and triggers a browser download.
 * @param data - Array of row objects
 * @param filename - Desired filename (without .csv extension)
 * @param headers - Optional custom column headers map: { key: 'Label' }
 */
export function exportToCSV(
  data: Row[],
  filename: string,
  headers?: Record<string, string>
): void {
  if (!data.length) return;

  const keys = Object.keys(data[0]);

  // Build header row
  const headerRow = keys
    .map(k => `"${headers?.[k] ?? k}"`)
    .join(',');

  // Build data rows
  const dataRows = data.map(row =>
    keys.map(k => {
      const val = row[k];
      if (val === null || val === undefined) return '""';
      const str = String(val);
      // Escape quotes and wrap in quotes if contains special chars
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return `"${str}"`;
    }).join(',')
  );

  const csv = [headerRow, ...dataRows].join('\r\n');
  const bom = '\uFEFF'; // UTF-8 BOM for proper Excel compatibility with Spanish chars
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
