import { useMemo } from 'react';
import { Download, Rotate3d } from 'lucide-react';
import { pivotRows } from '../lib/pivot.js';
import { formatCell } from '../lib/result.js';

const DISPLAY_LIMIT = 500;

export default function ResultTable({
  rows, columns, labelColumn, pivoted, onTogglePivot, drillable, onDrill, onExport, caption,
}) {
  const view = useMemo(
    () => (pivoted ? pivotRows(rows, columns) : { rows, columns }),
    [pivoted, rows, columns],
  );
  const shown = view.rows.slice(0, DISPLAY_LIMIT);
  const canDrill = drillable && !pivoted;

  return (
    <section className="table-section" aria-labelledby="table-title">
      <div className="section-head">
        <h2 id="table-title">Table</h2>
        <div className="section-actions">
          <button
            type="button"
            className={`btn btn-toggle${pivoted ? ' is-on' : ''}`}
            aria-pressed={pivoted}
            onClick={onTogglePivot}
            disabled={columns.length < 2}
          >
            <Rotate3d size={16} aria-hidden="true" />
            Pivot
          </button>
          <button type="button" className="btn" onClick={onExport}>
            <Download size={16} aria-hidden="true" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="table-scroll" tabIndex={0} role="region" aria-labelledby="table-title">
        <table>
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {view.columns.map((c, i) => (
                <th key={c} scope="col" className={i === 0 ? 'text-col' : 'num-col'}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, r) => (
              <tr key={r}>
                {view.columns.map((c, i) => {
                  const text = formatCell(row[c]);
                  if (i === 0) {
                    return (
                      <th key={c} scope="row" className="text-col">
                        {canDrill ? (
                          <button type="button" className="cell-drill" onClick={() => onDrill(r)} title={`Drill into ${text}`}>
                            {text}
                          </button>
                        ) : text}
                      </th>
                    );
                  }
                  return (
                    <td key={c} className={typeof row[c] === 'number' ? 'num-col' : 'text-col'}>{text}</td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {view.rows.length > DISPLAY_LIMIT && (
        <p className="table-note">Showing the first {DISPLAY_LIMIT} of {view.rows.length} rows. Export CSV has all rows.</p>
      )}
      {pivoted && <p className="table-note">Rows and columns are swapped. Roll-up and drill-down clicks are off while pivoted.</p>}
    </section>
  );
}
