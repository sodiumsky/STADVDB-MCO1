import { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { runReport } from '../api.js';
import { useApp } from '../context.js';
import { downloadCsv } from '../lib/csv.js';
import {
  drillDown, drillInto, effectiveFilters, initialDrill, lockedFilters, rollTo, rollUp,
} from '../lib/hierarchy.js';
import { describeRows, memberOf } from '../lib/result.js';
import FilterPanel from '../components/FilterPanel.jsx';
import { Breadcrumbs, DirectionSwitch, DrillButtons } from '../components/DrillControls.jsx';
import Meter from '../components/Meter.jsx';
import Notice from '../components/Notice.jsx';
import ResultChart from '../components/ResultChart.jsx';
import ResultTable from '../components/ResultTable.jsx';
import SqlPanel from '../components/SqlPanel.jsx';

function initialFilters(report, filterDefs) {
  const out = {};
  for (const name of report.filters) {
    const def = filterDefs[name];
    if (def.control === 'multi') out[name] = [];
    else if (def.control === 'number') out[name] = def.default ?? '';
    else out[name] = '';
  }
  return out;
}

function ReportView({ report, filterDefs }) {
  const [filters, setFilters] = useState(() => initialFilters(report, filterDefs));
  const [direction, setDirection] = useState(report.directions[0] ?? null);
  const [drill, setDrill] = useState(initialDrill);
  const [run, setRun] = useState({ status: 'idle', data: null, error: null, id: 0 });
  const [measureChoice, setMeasureChoice] = useState(null);
  const [pivoted, setPivoted] = useState(false);
  const latest = useRef(0);

  const execute = useCallback(
    async (nextDrill, nextDirection, nextFilters) => {
      const ticket = ++latest.current;
      setRun((prev) => ({ ...prev, status: 'loading', error: null }));
      try {
        const data = await runReport(report.id, {
          filters: effectiveFilters(report, filterDefs, nextFilters, nextDrill),
          level: report.levels[nextDrill.levelIndex]?.id,
          direction: nextDirection ?? undefined,
        });
        if (ticket === latest.current) setRun({ status: 'done', data, error: null, id: ticket });
      } catch (error) {
        if (ticket === latest.current) setRun((prev) => ({ ...prev, status: 'error', data: null, error }));
      }
    },
    [report, filterDefs],
  );

  const hasRun = run.status !== 'idle';
  const level = report.levels[drill.levelIndex];
  const locked = useMemo(() => lockedFilters(report, drill), [report, drill]);

  const setFilter = (name, value) => setFilters((f) => ({ ...f, [name]: value }));

  const applyDrill = (next) => {
    setDrill(next);
    setPivoted(false);
    execute(next, direction, filters);
  };

  const changeDirection = (next) => {
    setDirection(next);
    if (hasRun) execute(drill, next, filters);
  };

  const data = run.data;
  const rows = data && !data.notWritten ? data.rows : [];
  const { columns, labelColumn, measures } = useMemo(() => describeRows(rows), [rows]);
  const measure = measures.includes(measureChoice) ? measureChoice : measures[0];
  const canDrillMore = report.levels.length > 0 && drill.levelIndex < report.levels.length - 1;
  const showChart = report.chart !== 'table' && measure !== undefined;

  const drillFromRow = (index) => {
    if (!canDrillMore) return;
    applyDrill(drillInto(report, drill, memberOf(rows[index], labelColumn)));
  };

  const exportCsv = () => {
    const parts = [report.id, level?.id, direction].filter(Boolean).join('-');
    downloadCsv(`${parts}.csv`, rows, columns);
  };

  const running = run.status === 'loading';

  return (
    <main id="main" className="page">
      <nav className="back" aria-label="Back">
        <Link to="/">All reports</Link>
      </nav>

      <header className="report-head">
        <h1>{report.title}</h1>
        <p className="lede">{report.description}</p>
        {report.operations.length > 0 && (
          <ul className="tags" aria-label="OLAP operations">
            {report.operations.map((op) => <li key={op}>{op}</li>)}
          </ul>
        )}
      </header>

      <div className="report-layout">
        <aside className="report-side" aria-label="Filters">
          <FilterPanel
            report={report}
            filterDefs={filterDefs}
            filters={filters}
            onChange={setFilter}
            locked={locked}
            onRun={() => execute(drill, direction, filters)}
            running={running}
          />
        </aside>

        <div className="report-main">
          {(report.directions.length > 0 || report.levels.length > 1) && (
            <div className="controls">
              {report.directions.length > 0 && (
                <DirectionSwitch directions={report.directions} value={direction} onChange={changeDirection} />
              )}
              {report.levels.length > 1 && (
                <>
                  <DrillButtons
                    report={report}
                    drill={drill}
                    disabled={running}
                    onDown={() => applyDrill(drillDown(report, drill))}
                    onUp={() => applyDrill(rollUp(report, drill))}
                  />
                  <Breadcrumbs report={report} drill={drill} onRollTo={(i) => applyDrill(rollTo(report, drill, i))} />
                </>
              )}
            </div>
          )}

          <div className="results" aria-busy={running}>
            {run.status === 'idle' && (
              <Notice variant="info" title="No results yet">
                Set the filters and choose Run report.
              </Notice>
            )}

            {run.status === 'error' && (
              <Notice
                variant="error"
                title={run.error.message}
                hint={run.error.hint}
                onRetry={() => execute(drill, direction, filters)}
              />
            )}

            {run.status === 'loading' && !data && <p className="muted" role="status">Running the query</p>}

            {data && data.notWritten && (
              <Notice variant="info" title="Query not written yet">
                {data.reason === 'missing-entry' ? (
                  <>There is no entry named <code>{data.key}</code> in <code>queries.js</code>. Add it under <code>reports</code>.</>
                ) : (
                  <>Fill in the <code>sql</code> of <code>{data.key}</code> in <code>olap-app/server/queries.js</code>.</>
                )}
              </Notice>
            )}

            {data && !data.notWritten && (
              <div className={`results-body${running ? ' is-stale' : ''}`}>
                <Meter
                  rowCount={data.rowCount}
                  ms={data.ms}
                  levelLabel={level?.label}
                  direction={direction}
                  runId={run.id}
                />

                {data.rowCount === 0 ? (
                  <Notice variant="info" title="The query returned no rows">
                    Try loosening the filters.
                  </Notice>
                ) : (
                  <>
                    {report.chart !== 'table' && (
                      <section className="chart-section" aria-labelledby="chart-title">
                        <div className="section-head">
                          <h2 id="chart-title">Chart</h2>
                          {measures.length > 1 && (
                            <div className="field field-inline">
                              <label htmlFor="measure">Measure</label>
                              <select id="measure" value={measure} onChange={(e) => setMeasureChoice(e.target.value)}>
                                {measures.map((m) => <option key={m} value={m}>{m}</option>)}
                              </select>
                            </div>
                          )}
                        </div>
                        {showChart ? (
                          <ResultChart
                            type={report.chart}
                            rows={rows}
                            labelColumn={labelColumn}
                            measure={measure}
                            drillable={canDrillMore}
                            onSelect={drillFromRow}
                          />
                        ) : (
                          <Notice variant="info" title="Nothing to chart">
                            The result has no numeric column after the first one. The table below shows it.
                          </Notice>
                        )}
                      </section>
                    )}

                    <ResultTable
                      rows={rows}
                      columns={columns}
                      labelColumn={labelColumn}
                      pivoted={pivoted}
                      onTogglePivot={() => setPivoted((p) => !p)}
                      drillable={canDrillMore}
                      onDrill={drillFromRow}
                      onExport={exportCsv}
                      caption={`${report.title} results`}
                    />
                  </>
                )}
              </div>
            )}
          </div>

          <SqlPanel data={data} />
        </div>
      </div>
    </main>
  );
}

export default function ReportPage() {
  const { id } = useParams();
  const { status, reports, filterDefs, error, reload } = useApp();

  if (status === 'loading') return <main id="main" className="page"><p className="muted" role="status">Loading</p></main>;
  if (status === 'error') {
    return (
      <main id="main" className="page narrow">
        <Notice variant="error" title={error.message} hint={error.hint} onRetry={reload} />
      </main>
    );
  }

  const report = reports.find((r) => r.id === id);
  if (!report) {
    return (
      <main id="main" className="page narrow">
        <h1>Report not found</h1>
        <p className="lede">There is no report with the id “{id}”. <Link to="/">Go to the report list</Link>.</p>
      </main>
    );
  }
  // key resets all state when moving between reports.
  return <ReportView key={report.id} report={report} filterDefs={filterDefs} />;
}
