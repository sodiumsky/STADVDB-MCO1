// Report registry. This is configuration only - no SQL lives here.
// The SQL for each report lives in queries.js, under the key built by queryKey().

const CHART_TYPES = ['bar', 'line', 'pie', 'table'];

// Every filter control the UI knows how to draw.
//   control: 'select' (single), 'multi' (multi-select), 'number'
//   lookup:  the name of the entry in queries.js `lookups` that fills the dropdown
const FILTERS = {
  year: { label: 'Year', control: 'select', lookup: 'year' },
  quarter: { label: 'Quarter', control: 'select', lookup: 'quarter' },
  month: { label: 'Month', control: 'select', lookup: 'month' },
  day: { label: 'Day', control: 'select', lookup: 'day' },
  time_period: { label: 'Time period', control: 'select', lookup: 'time_period' },
  hour: { label: 'Hour', control: 'select', lookup: 'hour' },
  borough: { label: 'Borough', control: 'multi', lookup: 'borough' },
  zone: { label: 'Taxi zone', control: 'multi', lookup: 'zone' },
  payment_type: { label: 'Payment type', control: 'multi', lookup: 'payment_type' },
  top_n: { label: 'Top N', control: 'number', min: 1, max: 1000, default: 10 },
};

// Report fields
//   id          used in the URL and as the prefix of the query keys
//   title       shown in the UI (rename freely)
//   description one or two plain sentences
//   operations  OLAP operations the report demonstrates (free text, shown as tags)
//   filters     keys of FILTERS to show, in display order
//   levels      drill-down hierarchy, top (coarsest) to bottom. Each level:
//                 id     part of the query key, e.g. 'borough' -> report1_borough_pickup
//                 label  shown in the UI
//                 filter the FILTERS key that a clicked member is applied to on the next level
//   directions  ['pickup', 'dropoff'] adds a switch and a suffix on the query key; [] for none
//   chart       'bar' | 'line' | 'pie' | 'table'
const REPORTS = [
  {
    id: 'report1',
    title: 'Report 1',
    description: 'Placeholder. Rename it and describe the business question it answers.',
    operations: ['Roll-up', 'Drill-down'],
    filters: ['year', 'borough', 'payment_type', 'top_n'],
    levels: [
      { id: 'borough', label: 'Borough', filter: 'borough' },
      { id: 'zone', label: 'Taxi zone', filter: 'zone' },
    ],
    directions: ['pickup', 'dropoff'],
    chart: 'bar',
  },
  {
    id: 'report2',
    title: 'Report 2',
    description: 'Placeholder. Rename it and describe the business question it answers.',
    operations: ['Drill-down', 'Slice'],
    filters: ['borough', 'payment_type'],
    levels: [
      { id: 'year', label: 'Year', filter: 'year' },
      { id: 'quarter', label: 'Quarter', filter: 'quarter' },
      { id: 'month', label: 'Month', filter: 'month' },
      { id: 'day', label: 'Day', filter: 'day' },
    ],
    directions: ['pickup', 'dropoff'],
    chart: 'line',
  },
  {
    id: 'report3',
    title: 'Report 3',
    description: 'Placeholder. Rename it and describe the business question it answers.',
    operations: ['Slice', 'Dice'],
    filters: ['month', 'borough', 'payment_type'],
    levels: [
      { id: 'time_period', label: 'Time period', filter: 'time_period' },
      { id: 'hour', label: 'Hour', filter: 'hour' },
    ],
    directions: ['pickup', 'dropoff'],
    chart: 'bar',
  },
  {
    id: 'report4',
    title: 'Report 4',
    description: 'Placeholder. Rename it and describe the business question it answers.',
    operations: ['Dice'],
    filters: ['year', 'quarter', 'borough', 'zone'],
    levels: [],
    directions: ['pickup', 'dropoff'],
    chart: 'pie',
  },
  {
    id: 'report5',
    title: 'Report 5',
    description: 'Placeholder. Rename it and describe the business question it answers.',
    operations: ['Pivot', 'Dice'],
    filters: [
      'year', 'quarter', 'month', 'day', 'time_period', 'hour',
      'borough', 'zone', 'payment_type', 'top_n',
    ],
    levels: [
      { id: 'borough', label: 'Borough', filter: 'borough' },
      { id: 'zone', label: 'Taxi zone', filter: 'zone' },
    ],
    directions: [],
    chart: 'table',
  },
];

// The key of the queries.js entry that runs a report at a given level and direction.
//   report1 + borough + pickup -> report1_borough_pickup
//   report4 (no levels) + dropoff -> report4_dropoff
//   report5 + zone (no directions) -> report5_zone
function queryKey(report, levelId, direction) {
  return [report.id, report.levels.length ? levelId : null, report.directions.length ? direction : null]
    .filter(Boolean)
    .join('_');
}

function findReport(id) {
  return REPORTS.find((r) => r.id === id);
}

// Fail fast on a typo in the registry.
for (const r of REPORTS) {
  if (!CHART_TYPES.includes(r.chart)) throw new Error(`reports.js: ${r.id} has unknown chart "${r.chart}"`);
  for (const f of r.filters) {
    if (!FILTERS[f]) throw new Error(`reports.js: ${r.id} lists unknown filter "${f}"`);
  }
  for (const l of r.levels) {
    if (!FILTERS[l.filter]) throw new Error(`reports.js: ${r.id} level "${l.id}" uses unknown filter "${l.filter}"`);
  }
}

module.exports = { CHART_TYPES, FILTERS, REPORTS, queryKey, findReport };
