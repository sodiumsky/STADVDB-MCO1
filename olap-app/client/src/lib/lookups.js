import { useEffect, useState } from 'react';
import { getLookup } from '../api.js';

// One request per lookup per page load, shared by every filter that uses it.
const cache = new Map();

function load(name, force) {
  if (force || !cache.has(name)) {
    const p = getLookup(name).catch((err) => {
      cache.delete(name);
      throw err;
    });
    cache.set(name, p);
  }
  return cache.get(name);
}

// Lookup rows have `value` and `label`, or fall back to the first and second columns.
function toOptions(rows) {
  return rows.map((row) => {
    const cols = Object.keys(row);
    const value = row.value ?? row[cols[0]];
    const label = row.label ?? (cols.length > 1 ? row[cols[1]] : value);
    return { value: String(value), label: String(label ?? value) };
  });
}

// status: 'loading' | 'ready' | 'not-written' | 'error'
export function useLookup(name) {
  const [state, setState] = useState({ status: 'loading', options: [], error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setState({ status: 'loading', options: [], error: null });
    load(name, attempt > 0)
      .then((res) => {
        if (!live) return;
        if (res.notWritten) setState({ status: 'not-written', options: [], error: null });
        else setState({ status: 'ready', options: toOptions(res.rows), error: null });
      })
      .catch((error) => live && setState({ status: 'error', options: [], error }));
    return () => {
      live = false;
    };
  }, [name, attempt]);

  return { ...state, retry: () => setAttempt((n) => n + 1) };
}
