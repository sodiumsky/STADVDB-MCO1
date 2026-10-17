// All warehouse SQL for the app goes in this file, and only in this file.
//
// Every `sql` below is deliberately EMPTY. The team writes them.
// An empty `sql` makes the UI show "Query not written yet" instead of an error.
//
// HOW AN ENTRY WORKS
//   sql     One SELECT (or WITH ... SELECT) statement. Use `?` placeholders only. Never build the
//           string with values.
//   params  The filter names that fill the `?` placeholders, in the order the `?` appear in `sql`.
//           A name can appear more than once. Available names:
//             year, quarter, month, month_from, month_to, day,   (single value, or null if not chosen)
//             time_period, hour,                                 (single value, or null if not chosen)
//             borough, zone, payment_type,                       (arrays, [] if nothing chosen)
//             top_n                                              (integer, or null)
//             level, direction                                   (the current level id / direction)
//           The lists below are a starting point: edit them to match the `?` in your SQL.
//           Deeper drill levels list the filters set by the drill (for example report2_day lists
//           quarter and month, because clicking a quarter and then a month sets them).
//
// MULTI-SELECT FILTERS (borough, zone, payment_type)
//   Write `IN (?)`. The server expands that one `?` into one `?` per chosen value and binds every
//   value. Nothing is concatenated into the SQL.
//   An empty selection means "no filter" and is passed as null wherever the name appears outside an
//   `IN (?)`, so you can write:  (? IS NULL OR some_column IN (?))  with params [..., 'borough', 'borough'].
//   Outside an `IN (?)`, a non-empty selection is bound as its first value (never null).
//   Inside `IN (?)`, an empty selection becomes `IN (NULL)`, which matches nothing.
//
// TOP N
//   Write `LIMIT ?` and list 'top_n'. The server sends it in a form MySQL accepts for LIMIT.
//   A blank Top N is sent as 1000, the largest allowed value, so it never returns zero rows.
//
// WHAT THE RESULT SHOULD LOOK LIKE
//   First column: the label for each row (a bar's category, a line's x value, a pie slice).
//   Other columns: numbers. If there are several, the chart gets a measure picker. The table shows all.
//   Optional column `member_value`: the value to apply to the next level's filter when a row is
//   clicked, if it differs from the label (for example label 'January', member_value 1).
//   It is hidden from the chart and table.
//
// KEYS
//   reports: <reportId>[_<levelId>][_<direction>], built by queryKey() in reports.js.
//   lookups: the filter name. A lookup returns rows with columns `value` and `label`
//   (or, if those are missing, the first column as the value and the second as the label).

// ---------------------------------------------------------------------------------------------
// Filter lookups (dropdown options)
// Used by: borough (reports 1-4), zone (report 2), payment_type (report 4), month (report 4,
// as both From month and To month). The rest are not shown by any report yet but are kept so a
// report can start using them without a registry change.
// ---------------------------------------------------------------------------------------------
const lookups = {
  year: {
    // written by the team
    sql: `SELECT DISTINCT year_number AS value, CAST(year_number AS CHAR) AS label FROM dim_date ORDER BY year_number DESC`,
    params: [],
  },
  quarter: {
    // written by the team
    sql: `SELECT DISTINCT quarter_number AS value, CONCAT('Q', quarter_number) AS label FROM dim_date ORDER BY quarter_number ASC`,
    params: [],
  },
  month: {
    // written by the team
    sql: `SELECT DISTINCT month_number AS value, month_name AS label FROM dim_date ORDER BY month_number ASC`,
    params: [],
  },
  day: {
    // written by the team
    sql: `SELECT DISTINCT day_number AS value, CAST(day_number AS CHAR) AS label FROM dim_date ORDER BY day_number ASC`,
    params: [],
  },
  time_period: {
    // written by the team
    sql: `SELECT time_period AS value, time_period AS label FROM dim_time GROUP BY time_period ORDER BY MIN(hour_number) ASC`,
    params: [],
  },
  hour: {
    // written by the team
    sql: `SELECT DISTINCT hour_number AS value, CONCAT(CAST(hour_number AS CHAR), ':00') AS label FROM dim_time ORDER BY hour_number ASC`,
    params: [],
  },
  borough: {
    // written by the team
    sql: `SELECT DISTINCT borough AS value, borough AS label FROM dim_zone WHERE borough IS NOT NULL AND borough != 'Unknown' ORDER BY borough ASC`,
    params: [],
  },
  zone: {
    // written by the team
    sql: `SELECT zone_key AS value, zone_name AS label FROM dim_zone WHERE zone_name IS NOT NULL AND zone_name != 'Unknown' ORDER BY zone_name ASC`,
    params: [],
  },
  payment_type: {
    // written by the team
    sql: `SELECT DISTINCT payment_key AS value, payment_description AS label FROM dim_payment ORDER BY payment_description ASC`,
    params: [],
  },
};

// ---------------------------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------------------------
const reports = {
  // Report 1: Busiest pickup and drop-off zones. Levels borough > zone; pickup, dropoff, combined.
  // 'combined' = pickups and drop-offs added together per location.
  report1_borough_pickup: {
    sql: `SELECT
            dim_zone.borough AS label,
            COUNT(*) AS total_trips
          FROM fact_trip, dim_zone
          WHERE fact_trip.pickup_zone_key = dim_zone.zone_key
            AND dim_zone.borough IS NOT NULL
            AND dim_zone.borough != 'Unknown'
            AND (? IS NULL OR dim_zone.borough IN (?))
          GROUP BY dim_zone.borough
          ORDER BY total_trips DESC
          LIMIT ?`,
    params: ['borough', 'borough', 'top_n'],
  },
  report1_borough_dropoff: {
    sql: `SELECT
            dim_zone.borough AS label,
            COUNT(*) AS total_trips
          FROM fact_trip, dim_zone
          WHERE fact_trip.dropoff_zone_key = dim_zone.zone_key
            AND dim_zone.borough IS NOT NULL
            AND dim_zone.borough != 'Unknown'
            AND (? IS NULL OR dim_zone.borough IN (?))
          GROUP BY dim_zone.borough
          ORDER BY total_trips DESC
          LIMIT ?`,
    params: ['borough', 'borough', 'top_n'],
  },
  report1_borough_combined: {
    sql: `SELECT
            z.borough AS label,
            SUM(t.cnt) AS total_trips
          FROM (
            SELECT pickup_zone_key AS zk, COUNT(*) AS cnt FROM fact_trip GROUP BY pickup_zone_key
            UNION ALL
            SELECT dropoff_zone_key AS zk, COUNT(*) AS cnt FROM fact_trip GROUP BY dropoff_zone_key
          ) t, dim_zone z
          WHERE t.zk = z.zone_key
            AND z.borough IS NOT NULL
            AND z.borough != 'Unknown'
            AND (? IS NULL OR z.borough IN (?))
          GROUP BY z.borough
          ORDER BY total_trips DESC
          LIMIT ?`,
    params: ['borough', 'borough', 'top_n'],
  },
  report1_zone_pickup: {
    sql: `SELECT
            dim_zone.zone_name AS label,
            COUNT(*) AS total_trips
          FROM fact_trip, dim_zone
          WHERE fact_trip.pickup_zone_key = dim_zone.zone_key
            AND dim_zone.zone_name IS NOT NULL
            AND dim_zone.zone_name != 'Unknown'
            AND (? IS NULL OR dim_zone.borough IN (?))
          GROUP BY dim_zone.zone_key, dim_zone.zone_name
          ORDER BY total_trips DESC
          LIMIT ?`,
    params: ['borough', 'borough', 'top_n'],
  },
  report1_zone_dropoff: {
    sql: `SELECT
            dim_zone.zone_name AS label,
            COUNT(*) AS total_trips
          FROM fact_trip, dim_zone
          WHERE fact_trip.dropoff_zone_key = dim_zone.zone_key
            AND dim_zone.zone_name IS NOT NULL
            AND dim_zone.zone_name != 'Unknown'
            AND (? IS NULL OR dim_zone.borough IN (?))
          GROUP BY dim_zone.zone_key, dim_zone.zone_name
          ORDER BY total_trips DESC
          LIMIT ?`,
    params: ['borough', 'borough', 'top_n'],
  },
  report1_zone_combined: {
    sql: `SELECT
            z.zone_name AS label,
            SUM(t.cnt) AS total_trips
          FROM (
            SELECT pickup_zone_key AS zk, COUNT(*) AS cnt FROM fact_trip GROUP BY pickup_zone_key
            UNION ALL
            SELECT dropoff_zone_key AS zk, COUNT(*) AS cnt FROM fact_trip GROUP BY dropoff_zone_key
          ) t, dim_zone z
          WHERE t.zk = z.zone_key
            AND z.zone_name IS NOT NULL
            AND z.zone_name != 'Unknown'
            AND (? IS NULL OR z.borough IN (?))
          GROUP BY z.zone_key, z.zone_name
          ORDER BY total_trips DESC
          LIMIT ?`,
    params: ['borough', 'borough', 'top_n'],
  },

  // Report 2: Taxi activity over the year. Levels quarter > month > day; no direction switch.
  report2_quarter: {
    // written by the team
    sql: '',
    params: ['borough', 'zone'],
  },
  report2_month: {
    // written by the team
    sql: '',
    params: ['quarter', 'borough', 'zone'],
  },
  report2_day: {
    // written by the team
    sql: '',
    params: ['quarter', 'month', 'borough', 'zone'],
  },

  // Report 3: Busiest times of day by location. Levels time_period > hour; no direction switch.
  report3_time_period: {
    // written by the team
    sql: '',
    params: ['borough'],
  },
  report3_hour: {
    // written by the team
    sql: '',
    params: ['time_period', 'borough'],
  },

  // Report 4: Fares, distance and payment by location. No levels, no direction switch.
  report4: {
    // written by the team
    sql: '',
    params: ['borough', 'month_from', 'month_to', 'payment_type'],
  },
};

module.exports = { lookups, reports };
