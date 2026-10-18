// Functional and performance test runner.
//
//   npm run run-reports -- scripts/sample-run-config.json [output.csv]      (from olap-app/)
//   node scripts/run-reports.js scripts/sample-run-config.json [output.csv] (from olap-app/server/)
//
// The input is a JSON array, or an object { "repeat": 3, "runs": [...] }. Each run:
//   { "label": "Q1 Manhattan", "report": "report1", "level": "borough", "direction": "pickup",
//     "filters": { "year": 2025, "borough": ["Manhattan"], "top_n": 10 }, "repeat": 5 }
// `level` and `direction` default to the report's first. `repeat` on a run overrides the global one.
//
// The output CSV has one row per execution: label, report, key, level, direction, filters, run,
// status, rowCount, ms, error. Status is ok, not-written or error.

const fs = require('fs');
const path = require('path');
const { pool } = require('../db');
const { runReport } = require('../lib/reportRunner');
const { describeError } = require('../lib/errors');

function csvCell(value) {
  const s = value === undefined || value === null ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  const [inputArg, outputArg] = process.argv.slice(2);
  if (!inputArg) {
    console.error('Usage: node scripts/run-reports.js <input.json> [output.csv]');
    process.exit(1);
  }

  const inputPath = path.resolve(inputArg);
  const parsed = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const runs = Array.isArray(parsed) ? parsed : parsed.runs;
  const globalRepeat = Array.isArray(parsed) ? 1 : parsed.repeat || 1;
  if (!Array.isArray(runs) || runs.length === 0) {
    console.error('The input file has no runs.');
    process.exit(1);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.resolve(outputArg || path.join(__dirname, '..', '..', 'test-results', `run-${stamp}.csv`));
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const header = ['label', 'report', 'key', 'level', 'direction', 'filters', 'run', 'status', 'rowCount', 'ms', 'error'];
  const lines = [header.join(',')];
  const tally = { ok: 0, 'not-written': 0, error: 0 };

  for (const spec of runs) {
    const repeat = spec.repeat || globalRepeat;
    for (let n = 1; n <= repeat; n += 1) {
      let status;
      let result = {};
      let message = '';
      try {
        result = await runReport(spec.report, { filters: spec.filters, level: spec.level, direction: spec.direction });
        status = result.notWritten ? 'not-written' : 'ok';
      } catch (err) {
        status = 'error';
        message = describeError(err).error.message;
      }
      tally[status] += 1;
      const row = [
        spec.label || '',
        spec.report,
        result.key || '',
        result.level || spec.level || '',
        result.direction || spec.direction || '',
        JSON.stringify(spec.filters || {}),
        n,
        status,
        status === 'ok' ? result.rowCount : '',
        status === 'ok' ? result.ms : '',
        message,
      ];
      lines.push(row.map(csvCell).join(','));
      console.log(`${spec.label || spec.report} run ${n}/${repeat}: ${status}${status === 'ok' ? ` (${result.rowCount} rows, ${result.ms} ms)` : message ? ` - ${message}` : ''}`);
    }
  }

  fs.writeFileSync(outputPath, `${lines.join('\n')}\n`);
  console.log(`\n${tally.ok} ok, ${tally['not-written']} not written yet, ${tally.error} failed.`);
  console.log(`Wrote ${outputPath}`);
  await pool.end();
}

main().catch(async (err) => {
  console.error(err.message);
  await pool.end().catch(() => {});
  process.exit(1);
});
