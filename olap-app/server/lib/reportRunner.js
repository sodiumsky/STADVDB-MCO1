const { FILTERS, queryKey, findReport } = require('../reports');
const queries = require('../queries');
const { executeQuery } = require('./runQuery');
const { AppError } = require('./errors');

const MULTI = new Set(Object.keys(FILTERS).filter((k) => FILTERS[k].control === 'multi'));

// Turns the raw value for one param name into what gets bound.
function valueFor(name, ctx) {
  if (name === 'level') return ctx.level ?? null;
  if (name === 'direction') return ctx.direction ?? null;

  const raw = ctx.filters[name];
  if (MULTI.has(name)) {
    if (raw === undefined || raw === null || raw === '') return [];
    return (Array.isArray(raw) ? raw : [raw]).filter((v) => v !== '' && v !== null);
  }
  if (raw === undefined || raw === null || raw === '') return null;
  if (name === 'top_n') {
    const n = Math.floor(Number(raw));
    if (!Number.isFinite(n) || n < 1) return null;
    // mysql2 sends JS numbers as DOUBLE, which MySQL rejects for LIMIT ?. A string is accepted.
    return String(Math.min(n, FILTERS.top_n.max));
  }
  return raw;
}

function describeParams(entry, ctx) {
  const values = entry.params.map((name) => valueFor(name, ctx));
  const named = entry.params.map((name, i) => ({ name, value: values[i] }));
  return { values, named };
}

function notWritten(key, entry, named, reason) {
  return {
    notWritten: true,
    reason,
    key,
    rows: [],
    rowCount: 0,
    ms: 0,
    sql: '',
    params: [],
    paramNames: named || [],
    declaredParams: entry ? entry.params : [],
  };
}

// Runs one report at a level and direction with the given filter values.
async function runReport(reportId, { filters = {}, level, direction } = {}) {
  const report = findReport(reportId);
  if (!report) throw new AppError(404, `No report with id "${reportId}".`, { code: 'UNKNOWN_REPORT' });

  const levelId = report.levels.length ? level || report.levels[0].id : undefined;
  if (report.levels.length && !report.levels.some((l) => l.id === levelId)) {
    throw new AppError(400, `Report "${reportId}" has no level "${levelId}".`, { code: 'UNKNOWN_LEVEL' });
  }
  const dir = report.directions.length ? direction || report.directions[0] : undefined;
  if (report.directions.length && !report.directions.includes(dir)) {
    throw new AppError(400, `Direction must be one of: ${report.directions.join(', ')}.`, { code: 'UNKNOWN_DIRECTION' });
  }

  const key = queryKey(report, levelId, dir);
  const entry = queries.reports[key];
  if (!entry) {
    return {
      ...notWritten(key, null, [], 'missing-entry'),
      level: levelId,
      direction: dir,
    };
  }

  const ctx = { filters: filters || {}, level: levelId, direction: dir };
  const { values, named } = describeParams(entry, ctx);
  if (!entry.sql || !entry.sql.trim()) {
    return { ...notWritten(key, entry, named, 'empty-sql'), level: levelId, direction: dir };
  }

  const result = await executeQuery(entry.sql, values);
  return { notWritten: false, key, level: levelId, direction: dir, paramNames: named, ...result };
}

// Runs one dropdown lookup. `query` may carry values for any params the lookup lists.
async function runLookup(name, query = {}) {
  const entry = queries.lookups[name];
  if (!entry) throw new AppError(404, `No lookup named "${name}".`, { code: 'UNKNOWN_LOOKUP' });

  const ctx = { filters: query };
  const { values, named } = describeParams(entry, ctx);
  if (!entry.sql || !entry.sql.trim()) {
    return notWritten(name, entry, named, 'empty-sql');
  }
  const result = await executeQuery(entry.sql, values);
  return { notWritten: false, key: name, paramNames: named, ...result };
}

module.exports = { runReport, runLookup };
