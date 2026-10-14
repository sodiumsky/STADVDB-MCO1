// Helpers that read a result set the way the app expects it (see the top of server/queries.js).

export const MEMBER_COLUMN = 'member_value';

// Columns to show: everything except the hidden member_value column.
export function visibleColumns(rows) {
  if (!rows.length) return [];
  return Object.keys(rows[0]).filter((c) => c !== MEMBER_COLUMN);
}

const isNumeric = (v) => typeof v === 'number' && Number.isFinite(v);

// First column is the label. Numeric columns after it are measures.
export function describeRows(rows) {
  const columns = visibleColumns(rows);
  const labelColumn = columns[0];
  const measures = columns.slice(1).filter((c) => rows.every((r) => r[c] === null || isNumeric(r[c])));
  return { columns, labelColumn, measures };
}

// The value to apply to the next level's filter when a row is chosen.
export function memberOf(row, labelColumn) {
  return row[MEMBER_COLUMN] ?? row[labelColumn];
}

export function formatNumber(value, maximumFractionDigits = 2) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'number') return String(value);
  return new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(value);
}

export function formatCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return formatNumber(value);
  return String(value);
}
