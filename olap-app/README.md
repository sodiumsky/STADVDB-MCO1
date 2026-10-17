# Green Taxi OLAP app

A web dashboard for the NYC Green Taxi 2025 data warehouse. It has four reports with roll-up, drill-down, slice, dice and pivot. No SQL needed to use it.

- `server/`: Node.js, Express, MySQL.
- `client/`: React, Vite, Chart.js.

## Run it

**You need:** Node.js 20+ (check with `node --version`) and a running local MySQL with the warehouse loaded.

1. **Get the code**
   ```bash
   git clone https://github.com/sodiumsky/STADVDB-MCO1.git
   cd STADVDB-MCO1
   git checkout olap
   cd olap-app
   ```
2. **Create `olap-app/.env`** (exactly that name, no `.txt`) with your MySQL details:
   ```
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your-password
   DB_NAME=your-warehouse-database
   PORT=3001
   ```
   `DB_NAME` is the database that holds `fact_trip`, `dim_date` and the other tables. Wrap a password containing `#` or `$` in single quotes. `.env` is git-ignored, so it is never committed.
3. **Install (once):** `npm install`
4. **Start:** `npm run dev`
5. **Open** http://localhost:5173. The top right should say "Connected to" and your database name.
6. **Stop:** `Ctrl+C` in the terminal. Start again later with `npm run dev`.

## Use it

Open a report from the home page, then:

- **Filters (left):** "All" means no filter. Set **Year to 2025**, since the data contains a few trips with wrong dates. Click **Run report**.
- **Drill down / Roll up:** move to a finer or coarser level. You can also **click a bar, point, slice or table name** to drill into it. The breadcrumbs show the path; click one to go back.
- **Slice and dice:** one filter value is a slice. Several filters, or several boroughs ticked, are a dice.
- **Pickup / Drop-off / Combined switch:** picks which zone of the trip the report uses.
- **Pivot:** swaps the table's rows and columns. **Export CSV** saves the table.
- **Measure menu:** appears when a result has more than one number. It picks which one the chart draws.
- **SQL and parameters used:** shows the exact query and values, for checking.

| Report | Question | Operations |
|---|---|---|
| Busiest pickup and drop-off zones | Which zones have the most trips? | Roll-up, drill-down |
| Taxi activity over the year | How do trips and revenue change over the year? | Drill-down, slice |
| Busiest times of day by location | When is each borough busiest? | Pivot, drill-down |
| Fares, distance and payment by location | How do trips differ by place and payment? | Dice, slice |

## Troubleshooting

| You see | Do this |
|---|---|
| "Database offline" | Start MySQL, then click the refresh icon next to the message. |
| "rejected the username or password" | Fix `DB_USER` / `DB_PASSWORD` in `.env`, then restart. |
| "database ... does not exist" | Fix `DB_NAME` in `.env`, then restart. |
| `Unknown column` / `Unknown table` | You connected to a different warehouse. The queries need `year`, `quarter`, `month`, `day`, `hour` in `dim_date` / `dim_time`. |
| Empty or disabled dropdown | Read the small message under it; usually the database is not connected. |
| "The query returned no rows" | Set filters back to "All" (and Year 2025). |
| `Cannot find module` | Run `npm install` in `olap-app`. |
| Port already in use | An old copy is running. Stop it with `Ctrl+C`. |

`.env` is read only at startup, so restart after changing it. Edits to `queries.js` or `reports.js` apply on a browser refresh.

## For the team

**Files:** `server/queries.js` (all SQL), `server/reports.js` (reports, filters, levels, chart types), `server/queries_previos.js` (old queries, not used), `server/scripts/` (test runner).

**Query entries** in `queries.js` look like this:

```js
report1_borough_pickup: {
  sql: `SELECT ... WHERE (? IS NULL OR dim_zone.borough IN (?)) ... LIMIT ?`,
  params: ['borough', 'borough', 'top_n'],
},
```

- Use `?` placeholders only, never build SQL from values. Only `SELECT` / `WITH` runs.
- `params` lists the filter names for each `?`, in order. The counts must match.
  Names: `year`, `quarter`, `month`, `month_from`, `month_to`, `day`, `time_period`, `hour`, `borough`, `zone`, `payment_type`, `top_n`, `level`, `direction`.
- `borough`, `zone` and `payment_type` are lists: write `IN (?)`. An empty list is `null` outside an `IN`, so `(? IS NULL OR col IN (?))` means "no filter".
- `LIMIT ?` with `top_n`. A blank Top N is sent as 1000.
- **First column = label.** Other columns = numbers. An optional `member_value` column is what a click passes to the next level (hidden from view). Lookups return `value` and `label`.
- **Entry names:** `<report>[_<level>][_<direction>]`, for example `report1_borough_pickup`, `report2_month`, `report4`.

**Add a report:** add an object to `REPORTS` in `reports.js` (`id`, `title`, `description`, `operations`, `filters`, `levels`, `directions`, `chart`), then add one `queries.js` entry per level and direction. In `levels`, `filter` is the filter that receives the clicked item when you drill from that level.

**Test runner:** runs reports from a JSON file and writes row count and time to a CSV in `test-results/`.
```bash
npm run run-reports -- scripts/sample-run-config.json
```
Each run: `{ "label", "report", "level", "direction", "filters", "repeat" }`. See the sample file.

**API:** `GET /api/health`, `GET /api/reports`, `GET /api/lookups/:name`, `POST /api/reports/:id/run` with `{ filters, level, direction }`.
