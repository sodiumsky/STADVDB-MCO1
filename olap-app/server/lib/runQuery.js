const { pool } = require('../db');
const { AppError } = require('./errors');

// Walks the SQL once, skipping quoted text and comments, and rebinds the `?` placeholders.
//  - `IN (?)` with an array value becomes `IN (?, ?, ...)` and every element is bound.
//  - Any other `?` with an array value is bound as null (empty array) or the first element.
//  - Values are only ever bound, never written into the SQL text.
function bindPlaceholders(sql, values) {
  let out = '';
  const bound = [];
  let used = 0;
  let i = 0;

  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (ch === "'" || ch === '"' || ch === '`') {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === '\\' && ch !== '`') j += 2;
        else if (sql[j] === ch && sql[j + 1] === ch) j += 2;
        else if (sql[j] === ch) break;
        else j += 1;
      }
      out += sql.slice(i, j + 1);
      i = j + 1;
    } else if ((ch === '-' && next === '-') || ch === '#') {
      const j = sql.indexOf('\n', i);
      const end = j === -1 ? sql.length : j;
      out += sql.slice(i, end);
      i = end;
    } else if (ch === '/' && next === '*') {
      const j = sql.indexOf('*/', i + 2);
      const end = j === -1 ? sql.length : j + 2;
      out += sql.slice(i, end);
      i = end;
    } else if (ch === '?') {
      if (used >= values.length) {
        throw new AppError(400, 'The SQL has more ? placeholders than the entry lists in params.', {
          code: 'PARAM_MISMATCH',
          hint: 'Make the params list in queries.js match the ? placeholders, in order.',
        });
      }
      const value = values[used++];
      if (Array.isArray(value)) {
        const inContext = /\bIN\s*\(\s*$/i.test(out) && /^\s*\)/.test(sql.slice(i + 1));
        if (inContext) {
          if (value.length === 0) {
            out += 'NULL';
          } else {
            out += value.map(() => '?').join(', ');
            bound.push(...value);
          }
        } else {
          out += '?';
          bound.push(value.length === 0 ? null : value[0]);
        }
      } else {
        out += '?';
        bound.push(value === undefined ? null : value);
      }
      i += 1;
    } else {
      out += ch;
      i += 1;
    }
  }

  if (used !== values.length) {
    throw new AppError(400, `The entry lists ${values.length} params but the SQL has ${used} ? placeholders.`, {
      code: 'PARAM_MISMATCH',
      hint: 'Make the params list in queries.js match the ? placeholders, in order.',
    });
  }
  return { sql: out, params: bound };
}

function startsWithSelect(sql) {
  const stripped = sql.replace(/^(\s+|--[^\n]*\n?|#[^\n]*\n?|\/\*[\s\S]*?\*\/)+/, '');
  return /^(select|with)\b/i.test(stripped);
}

// Runs one prepared statement and times it. `values` is the list of param values in the
// order of entry.params.
async function executeQuery(sql, values) {
  if (!startsWithSelect(sql)) {
    throw new AppError(400, 'Only SELECT or WITH ... SELECT statements can be run from this app.', {
      code: 'READ_ONLY',
    });
  }
  const bound = bindPlaceholders(sql, values);
  const started = process.hrtime.bigint();
  const [rows] = await pool.execute(bound.sql, bound.params);
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  const list = Array.isArray(rows) ? rows : [];
  return {
    rows: list,
    rowCount: list.length,
    ms: Math.round(ms * 100) / 100,
    sql: bound.sql,
    params: bound.params,
  };
}

module.exports = { executeQuery, bindPlaceholders };
