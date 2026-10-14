function cell(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows, columns) {
  const cols = columns || (rows.length ? Object.keys(rows[0]) : []);
  const lines = [cols.map(cell).join(',')];
  for (const row of rows) lines.push(cols.map((c) => cell(row[c])).join(','));
  return `${lines.join('\r\n')}\r\n`;
}

export function downloadCsv(filename, rows, columns) {
  // The BOM keeps Excel from mangling non-ASCII zone names.
  const blob = new Blob(['﻿', toCsv(rows, columns)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
