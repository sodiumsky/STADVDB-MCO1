# Green Taxi OLAP app

A web app for exploring the NYC Green Taxi 2025 data warehouse with roll-up, drill-down, slice, dice and pivot.

- `server/` is Node.js, Express and `mysql2/promise`.
- `client/` is React with Vite, React Router and Chart.js (`react-chartjs-2`).

**The app contains no warehouse SQL.** Every `sql` string in `server/queries.js` is empty and is written by the team. Until a query is filled in, its report shows "Query not written yet" and its dropdown shows "Lookup not written yet".

## Setup

You need Node.js 20 or newer and a running local MySQL with the warehouse loaded.

```bash
cd olap-app
# create olap-app/.env first (see below)
npm install              # installs the root, server and client packages
npm run dev              # starts Express on :3001 and Vite on :5173
```

Create `olap-app/.env` with your local MySQL details:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your-password
DB_NAME=green_taxi_dw
PORT=3001
```

`PORT` is the Express API port. Vite proxies `/api` to it.

Open http://localhost:5173. If you change `PORT` in `.env`, restart `npm run dev`.

`.env` is git-ignored. Never commit it.

The header shows which database the app is connected to. If MySQL is down or the credentials are wrong, it says so and tells you which `.env` value to check. The Retry button re-checks the connection.

## Adding a query to `queries.js`

Open `server/queries.js`. It has two groups of entries: `lookups` (dropdown options) and `reports` (one per report, level and direction).

Fill in an entry like this:

```js
report1_borough_pickup: {
  // written by the team
  sql: '...your SELECT with ? placeholders...',
  params: ['year', 'borough', 'payment_type', 'top_n'],
},
```

Rules:

1. **Use `?` placeholders only.** Values are always bound, never put into the SQL text. Only `SELECT` or `WITH ... SELECT` runs.
2. **`params` lists the filter names for the `?` placeholders, in the order the `?` appear.** A name can repeat. Available names: `year`, `quarter`, `month`, `month_from`, `month_to`, `day`, `time_period`, `hour`, `borough`, `zone`, `payment_type`, `top_n`, `level`, `direction`.
3. **Multi-select filters (`borough`, `zone`, `payment_type`) are arrays.** Write `IN (?)`. The server expands it to one `?` per chosen value and binds each one. An empty selection means no filter: outside an `IN (?)` it is passed as `null`, so `(? IS NULL OR col IN (?))` with `params: [..., 'borough', 'borough']` works.
4. **Top N:** write `LIMIT ?` and list `top_n`. A blank Top N is sent as 1000, the largest allowed value, because binding `null` to `LIMIT ?` returns zero rows.
5. **Result shape:**
   - The first column is the label (bar category, line x value, pie slice).
   - The other columns are numbers. If there is more than one, the chart gets a Measure picker (one measure per chart, never two axes).
   - An optional `member_value` column holds the value to apply to the next level's filter when a row is clicked, if it differs from the label, for example label `January` and `member_value` `1`. It is hidden from the chart and table.
6. **Lookups** return `value` and `label` columns. If those are missing, the first column is the value and the second is the label.

The panel under each result shows the exact SQL, the parameter values you were given and the values bound to the `?` placeholders. Use it to debug.

### Query keys

A report's key is built from its id, the current level and the pickup/drop-off switch, skipping the parts the report does not have:

| Report has | Key |
|---|---|
| levels and directions | `report1_borough_pickup` |
| directions only | `report4_dropoff` (no report has this shape right now) |
| levels only | `report2_month` |
| neither | `report4` |

`queryKey()` in `server/reports.js` is the single place that builds these. If a key has no entry in `queries.js`, the UI says which entry is missing.

## Registering a new report

Add an object to `REPORTS` in `server/reports.js`:

```js
{
  id: 'report6',                 // used in the URL and as the key prefix
  title: 'Peak hours by borough',
  description: 'Which hours carry the most trips in each borough.',
  operations: ['Slice', 'Roll-up'],          // shown as tags
  filters: ['year', 'borough', 'top_n'],     // keys of FILTERS, in display order
  levels: [                                  // drill hierarchy, coarsest first; [] for none
    { id: 'time_period', label: 'Time period', filter: 'time_period' },
    { id: 'hour', label: 'Hour', filter: 'hour' },
  ],
  directions: ['pickup', 'dropoff'],         // adds the switch ('combined' is also supported); [] for none
  chart: 'bar',                              // 'bar' | 'line' | 'pie' | 'table'
},
```

Then add one entry to `reports` in `server/queries.js` for every combination of level and direction, using the keys above (here `report6_time_period_pickup`, `report6_time_period_dropoff`, `report6_hour_pickup`, `report6_hour_dropoff`). The report appears on the home page after the server restarts (`npm run dev` restarts it for you).

How drilling works:

- **Drill down** moves to the next level. **Roll up** moves back one.
- **Clicking a bar, slice, point or a first-column table cell** drills into that member. The member is applied to the `filter` named on the level you came from and the next level's query runs.
- The breadcrumbs show the path. Click a crumb to roll up to that level. Filters set by a drill are locked in the filter panel until you roll up.
- Each level has its own query entry, so each one can be written and tuned separately.

A filter only appears for a report if it is in that report's `filters` list. Add a filter control to `FILTERS` only if you need a new kind.

## Pivot, export and the SQL panel

- **Pivot** (above the table) swaps rows and columns in the browser. Nothing is re-queried.
- **Export CSV** downloads the current result's rows as returned by the query.
- **SQL and parameters used** is a collapsible panel under the results.

## Test runner

`server/scripts/run-reports.js` runs reports from a JSON file and writes the row count and time of each run to a CSV. Use it for functional and performance testing.

```bash
npm run run-reports -- scripts/sample-run-config.json            # from olap-app/
# or: cd server && node scripts/run-reports.js scripts/sample-run-config.json out.csv
```

The input is a JSON array, or `{ "repeat": 3, "runs": [...] }`:

```json
{
  "repeat": 3,
  "runs": [
    {
      "label": "Report 1 by zone, drop-off, Manhattan",
      "report": "report1",
      "level": "zone",
      "direction": "dropoff",
      "filters": { "year": 2025, "borough": ["Manhattan"], "top_n": 10 },
      "repeat": 5
    }
  ]
}
```

`level` and `direction` default to the report's first ones. `repeat` on a run overrides the global one. Output goes to `olap-app/test-results/run-<timestamp>.csv` unless you pass a path. Columns: `label, report, key, level, direction, filters, run, status, rowCount, ms, error`. `status` is `ok`, `not-written` or `error`.

## API

| Route | What it does |
|---|---|
| `GET /api/health` | Connection check. Runs `SELECT 1` and `SELECT DATABASE()` only. |
| `GET /api/reports` | The report registry and filter definitions. |
| `GET /api/lookups/:name` | Runs a lookup. |
| `POST /api/reports/:id/run` | Body `{ filters, level, direction }`. Runs a report. |

Lookups and report runs return `rows`, `rowCount`, `ms`, `sql` and `params`, plus `paramNames` (each name with the value it was given) and `notWritten` (`true` when the entry's `sql` is empty).

## Folder layout

```
olap-app/
  .env                  your local MySQL details (git-ignored, you create it)
  server/
    index.js            Express app
    db.js               connection pool
    queries.js          all warehouse SQL (empty, written by the team)
    reports.js          report registry and filter definitions
    routes/api.js
    lib/                query execution, report runner, error mapping
    scripts/            run-reports.js and a sample config
  client/
    vite.config.js      proxies /api to Express
    src/
      pages/            Home, ReportPage
      components/       filters, drill controls, chart, table, meter, SQL panel
      lib/              hierarchy, pivot, csv, lookups, result helpers
      styles/global.css
```
