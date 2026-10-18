import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LineElement, LinearScale, PointElement, Tooltip,
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';
import { formatNumber } from '../lib/result.js';

ChartJS.register(ArcElement, BarElement, CategoryScale, Legend, LineElement, LinearScale, PointElement, Tooltip);

// Categorical order from the validated palette, light and dark steps.
const SERIES = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
};
const CHROME = {
  light: { text: '#52514e', muted: '#898781', grid: '#e1e0d9', axis: '#c3c2b7', surface: '#fcfcfb' },
  dark: { text: '#c3c2b7', muted: '#898781', grid: '#2c2c2a', axis: '#383835', surface: '#1a1a19' },
};

const MAX_BARS = 60;
const MAX_POINTS = 400;
const PIE_SLICES = 7; // the rest fold into "Other"

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

function useScheme() {
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  return prefersDark ? 'dark' : 'light';
}

// Labels and values for the chart, with the caps each chart type needs to stay readable.
function shape(type, rows, labelColumn, measure) {
  const all = rows.map((r) => ({ label: String(r[labelColumn] ?? '(none)'), value: r[measure] ?? 0 }));
  if (type === 'pie') {
    const sorted = all.map((p, index) => ({ ...p, index })).sort((a, b) => b.value - a.value);
    if (sorted.length <= PIE_SLICES + 1) return { points: sorted, folded: 0, shown: sorted.length, total: all.length };
    const top = sorted.slice(0, PIE_SLICES);
    const rest = sorted.slice(PIE_SLICES);
    top.push({ label: 'Other', value: rest.reduce((s, p) => s + p.value, 0), index: -1 });
    return { points: top, folded: rest.length, shown: all.length, total: all.length };
  }
  const cap = type === 'bar' ? MAX_BARS : MAX_POINTS;
  const points = all.slice(0, cap).map((p, index) => ({ ...p, index }));
  return { points, folded: 0, shown: points.length, total: all.length };
}

export default function ResultChart({ type, rows, labelColumn, measure, drillable, onSelect }) {
  const scheme = useScheme();
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const chartRef = useRef(null);
  const series = SERIES[scheme];
  const chrome = CHROME[scheme];

  const { points, folded, shown, total } = useMemo(
    () => shape(type, rows, labelColumn, measure),
    [type, rows, labelColumn, measure],
  );

  if (!measure) return null;

  const horizontal = type === 'bar' && points.length > 8;
  const labels = points.map((p) => p.label);
  const values = points.map((p) => p.value);

  const common = {
    responsive: true,
    maintainAspectRatio: false,
    animation: reduceMotion ? false : { duration: 350 },
    onHover: (event, elements) => {
      const el = event.native && event.native.target;
      if (el) el.style.cursor = drillable && elements.length ? 'pointer' : 'default';
    },
    plugins: {
      legend: { display: type === 'pie', position: 'right', labels: { color: chrome.text, boxWidth: 12, boxHeight: 12, padding: 12 } },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${measure}: ${formatNumber(ctx.raw)}`,
        },
      },
    },
  };

  const valueAxis = {
    beginAtZero: true,
    grid: { color: chrome.grid },
    border: { display: false },
    ticks: { color: chrome.muted, callback: (v) => formatNumber(v, 1) },
  };
  const categoryAxis = {
    grid: { display: false },
    border: { color: chrome.axis },
    ticks: { color: chrome.muted, autoSkip: true, maxRotation: 0 },
  };

  let chart;
  if (type === 'bar') {
    const data = {
      labels,
      datasets: [{ label: measure, data: values, backgroundColor: series[0], borderRadius: 4, maxBarThickness: 44 }],
    };
    const options = {
      ...common,
      indexAxis: horizontal ? 'y' : 'x',
      scales: horizontal ? { x: valueAxis, y: { ...categoryAxis, ticks: { ...categoryAxis.ticks, autoSkip: false } } } : { x: categoryAxis, y: valueAxis },
    };
    chart = <Bar ref={chartRef} data={data} options={options} role="img" aria-label={`Bar chart of ${measure} by ${labelColumn}`} />;
  } else if (type === 'line') {
    const data = {
      labels,
      datasets: [{
        label: measure,
        data: values,
        borderColor: series[0],
        backgroundColor: series[0],
        borderWidth: 2,
        pointRadius: points.length > 40 ? 0 : 4,
        pointHoverRadius: 6,
        pointBackgroundColor: series[0],
        pointBorderColor: chrome.surface,
        pointBorderWidth: 2,
        tension: 0,
      }],
    };
    const options = { ...common, interaction: { mode: 'nearest', intersect: false, axis: 'x' }, scales: { x: categoryAxis, y: valueAxis } };
    chart = <Line ref={chartRef} data={data} options={options} role="img" aria-label={`Line chart of ${measure} by ${labelColumn}`} />;
  } else {
    const data = {
      labels,
      datasets: [{
        label: measure,
        data: values,
        backgroundColor: points.map((_, i) => series[i % series.length]),
        borderColor: chrome.surface,
        borderWidth: 2,
      }],
    };
    chart = <Pie ref={chartRef} data={data} options={common} role="img" aria-label={`Pie chart of ${measure} by ${labelColumn}`} />;
  }

  const handleClick = (event) => {
    if (!drillable || !chartRef.current) return;
    const hits = chartRef.current.getElementsAtEventForMode(event.nativeEvent, 'nearest', { intersect: true }, true);
    if (!hits.length) return;
    const point = points[hits[0].index];
    if (point && point.index >= 0) onSelect(point.index);
  };

  const height = horizontal ? Math.min(Math.max(320, points.length * 28 + 60), 1400) : type === 'pie' ? 340 : 360;

  return (
    <figure className="chart">
      <div className="chart-canvas" style={{ height }} onClick={handleClick}>
        {chart}
      </div>
      <figcaption className="chart-note">
        {drillable && 'Click a mark to drill into it. '}
        {type === 'bar' && total > shown && `Showing the first ${shown} of ${total} rows. The table has all of them. `}
        {type === 'line' && total > shown && `Showing the first ${shown} of ${total} rows. `}
        {type === 'pie' && folded > 0 && `The ${folded} smallest of ${total} slices are combined as Other. `}
      </figcaption>
    </figure>
  );
}
