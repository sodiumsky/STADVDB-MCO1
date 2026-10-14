// Swaps rows and columns of a result table, in the browser.
// Each distinct first-column value becomes a column; each other column becomes a row.
export function pivotRows(rows, columns) {
  if (!rows.length || columns.length < 2) return { columns, rows };

  const [labelColumn, ...rest] = columns;
  const heads = rows.map((r, i) => {
    const text = r[labelColumn] === null || r[labelColumn] === undefined ? '(none)' : String(r[labelColumn]);
    return { key: `c${i}`, text };
  });

  // Repeated labels get a numeric suffix so no column is lost.
  const seen = new Map();
  for (const h of heads) {
    const n = (seen.get(h.text) || 0) + 1;
    seen.set(h.text, n);
    if (n > 1) h.text = `${h.text} (${n})`;
  }

  const outColumns = ['Measure', ...heads.map((h) => h.text)];
  const outRows = rest.map((col) => {
    const row = { Measure: col };
    heads.forEach((h, i) => {
      row[h.text] = rows[i][col];
    });
    return row;
  });
  return { columns: outColumns, rows: outRows };
}
