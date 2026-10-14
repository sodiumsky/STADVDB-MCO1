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
//             year, quarter, month, day, time_period, hour,   (single value, or null if not chosen)
//             borough, zone, payment_type,                    (arrays, [] if nothing chosen)
//             top_n                                           (integer, or null)
//             level, direction                                (the current level id / 'pickup' | 'dropoff')
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

const REPORT1_PARAMS = ['year', 'borough', 'payment_type', 'top_n'];
const REPORT2_PARAMS = ['borough', 'payment_type'];
const REPORT3_PARAMS = ['month', 'borough', 'payment_type'];
const REPORT4_PARAMS = ['year', 'quarter', 'borough', 'zone'];
const REPORT5_PARAMS = [
  'year', 'quarter', 'month', 'day', 'time_period', 'hour',
  'borough', 'zone', 'payment_type', 'top_n',
];

// ---------------------------------------------------------------------------------------------
// Filter lookups (dropdown options)
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
  // Report 1: levels borough > zone, pickup / dropoff
  report1_borough_pickup: {
    // written by the team
    sql: '',
    params: REPORT1_PARAMS,
  },
  report1_borough_dropoff: {
    // written by the team
    sql: '',
    params: REPORT1_PARAMS,
  },
  report1_zone_pickup: {
    // written by the team
    sql: '',
    params: REPORT1_PARAMS,
  },
  report1_zone_dropoff: {
    // written by the team
    sql: '',
    params: REPORT1_PARAMS,
  },

  // Report 2: levels year > quarter > month > day, pickup / dropoff
  report2_year_pickup: {
    // written by the team
    sql: '',
    params: REPORT2_PARAMS,
  },
  report2_year_dropoff: {
    // written by the team
    sql: '',
    params: REPORT2_PARAMS,
  },
  report2_quarter_pickup: {
    // written by the team
    sql: '',
    params: REPORT2_PARAMS,
  },
  report2_quarter_dropoff: {
    // written by the team
    sql: '',
    params: REPORT2_PARAMS,
  },
  report2_month_pickup: {
    // written by the team
    sql: '',
    params: REPORT2_PARAMS,
  },
  report2_month_dropoff: {
    // written by the team
    sql: '',
    params: REPORT2_PARAMS,
  },
  report2_day_pickup: {
    // written by the team
    sql: '',
    params: REPORT2_PARAMS,
  },
  report2_day_dropoff: {
    // written by the team
    sql: '',
    params: REPORT2_PARAMS,
  },

  // Report 3: levels time_period > hour, pickup / dropoff
  report3_time_period_pickup: {
    // written by the team
    sql: '',
    params: REPORT3_PARAMS,
  },
  report3_time_period_dropoff: {
    // written by the team
    sql: '',
    params: REPORT3_PARAMS,
  },
  report3_hour_pickup: {
    // written by the team
    sql: '',
    params: REPORT3_PARAMS,
  },
  report3_hour_dropoff: {
    // written by the team
    sql: '',
    params: REPORT3_PARAMS,
  },

  // Report 4: no levels, pickup / dropoff
  report4_pickup: {
    // written by the team
    sql: '',
    params: REPORT4_PARAMS,
  },
  report4_dropoff: {
    // written by the team
    sql: '',
    params: REPORT4_PARAMS,
  },

  // Report 5: levels borough > zone, no direction switch
  report5_borough: {
    // written by the team
    sql: '',
    params: REPORT5_PARAMS,
  },
  report5_zone: {
    // written by the team
    sql: '',
    params: REPORT5_PARAMS,
  },
};

module.exports = { lookups, reports };
