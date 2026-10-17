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
    sql: '',
    params: [],
  },
  quarter: {
    // written by the team
    sql: '',
    params: [],
  },
  month: {
    // written by the team
    sql: '',
    params: [],
  },
  day: {
    // written by the team
    sql: '',
    params: [],
  },
  time_period: {
    // written by the team
    sql: '',
    params: [],
  },
  hour: {
    // written by the team
    sql: '',
    params: [],
  },
  borough: {
    // written by the team
    sql: '',
    params: [],
  },
  zone: {
    // written by the team
    sql: '',
    params: [],
  },
  payment_type: {
    // written by the team
    sql: '',
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
    // written by the team (first version, not optimized, no ? placeholders yet)
    sql: `select 'Borough' as level_type, dim_zone.borough as location_name, 'ALL' as zone_name, count(*) as total_trips
from fact_trip, dim_zone
where fact_trip.pickup_zone_key = dim_zone.zone_key
group by dim_zone.borough`,
    params: [],
  },
  report1_borough_dropoff: {
    // written by the team
    sql: '',
    params: ['borough', 'top_n'],
  },
  report1_borough_combined: {
    // written by the team
    sql: '',
    params: ['borough', 'top_n'],
  },
  report1_zone_pickup: {
    // written by the team (first version, not optimized, no ? placeholders yet)
    sql: `select 'Zone' as level_type, dim_zone.borough as location_name, dim_zone.zone_name as zone_name, count(*) as total_trips
from fact_trip, dim_zone
where fact_trip.pickup_zone_key = dim_zone.zone_key
group by dim_zone.borough, dim_zone.zone_name`,
    params: [],
  },
  report1_zone_dropoff: {
    // written by the team
    sql: '',
    params: ['borough', 'top_n'],
  },
  report1_zone_combined: {
    // written by the team (first version, not optimized, no ? placeholders yet)
    sql: `select 'Combined' as level_type, z.borough, z.zone_name, sum(t.cnt) as total_trips
from (
    select pickup_zone_key as zk, count(*) as cnt from fact_trip group by pickup_zone_key
    union all
    select dropoff_zone_key as zk, count(*) as cnt from fact_trip group by dropoff_zone_key
) t, dim_zone z
where t.zk = z.zone_key
group by z.borough, z.zone_name
order by total_trips desc`,
    params: [],
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
