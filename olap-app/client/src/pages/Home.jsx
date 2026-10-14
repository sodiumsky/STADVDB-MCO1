import { Link } from 'react-router-dom';
import { BarChart3, LineChart, PieChart, Table2 } from 'lucide-react';
import { useApp } from '../context.js';
import Notice from '../components/Notice.jsx';

const CHARTS = {
  bar: { label: 'Bar chart', Icon: BarChart3 },
  line: { label: 'Line chart', Icon: LineChart },
  pie: { label: 'Pie chart', Icon: PieChart },
  table: { label: 'Table', Icon: Table2 },
};

export default function Home() {
  const { status, reports, error, reload } = useApp();

  return (
    <main id="main" className="page">
      <section className="hero">
        <h1>Green taxi trips, 2025</h1>
        <p className="lede">
          Explore the data warehouse with roll-up, drill-down, slice, dice and pivot.
          Choose a report to see its filters and results.
        </p>
      </section>

      {status === 'loading' && <p className="muted" role="status">Loading reports</p>}
      {status === 'error' && (
        <Notice variant="error" title={error.message} hint={error.hint} onRetry={reload} />
      )}

      {status === 'ready' && (
        <ol className="report-list" aria-label="Reports">
          {reports.map((report) => {
            const chart = CHARTS[report.chart];
            return (
              <li key={report.id}>
                <Link to={`/reports/${report.id}`} className="report-row">
                  <div className="report-row-main">
                    <h2>{report.title}</h2>
                    <p>{report.description}</p>
                    {report.operations.length > 0 && (
                      <ul className="tags" aria-label="OLAP operations">
                        {report.operations.map((op) => <li key={op}>{op}</li>)}
                      </ul>
                    )}
                  </div>
                  <div className="report-row-side">
                    <span className="report-chart">
                      <chart.Icon size={18} aria-hidden="true" />
                      {chart.label}
                    </span>
                    <span className="report-facts">
                      {report.filters.length} {report.filters.length === 1 ? 'filter' : 'filters'}
                    </span>
                    {report.levels.length > 1 && (
                      <span className="report-facts">{report.levels.length} drill levels</span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}
