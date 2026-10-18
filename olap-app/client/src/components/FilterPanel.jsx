import { Lock } from 'lucide-react';
import { useLookup } from '../lib/lookups.js';
import Notice from './Notice.jsx';

function LookupHint({ lookup, name }) {
  if (lookup.status === 'loading') return <span className="field-hint">Loading options</span>;
  if (lookup.status === 'not-written') {
    return <span className="field-hint">Lookup not written yet. Add it under lookups.{name} in queries.js.</span>;
  }
  if (lookup.status === 'error') {
    return (
      <span className="field-hint field-hint-error">
        {lookup.error.message}{' '}
        <button type="button" className="link-btn" onClick={lookup.retry}>Try again</button>
      </span>
    );
  }
  return null;
}

function SelectField({ id, def, name, value, onChange, locked }) {
  const lookup = useLookup(def.lookup);
  const disabled = lookup.status !== 'ready' || locked !== undefined;

  return (
    <div className="field">
      <label htmlFor={id}>{def.label}</label>
      {locked !== undefined ? (
        <div className="locked" id={id}>
          <Lock size={14} aria-hidden="true" />
          <span>{String(locked)}</span>
        </div>
      ) : (
        <select id={id} value={value} disabled={disabled} onChange={(e) => onChange(name, e.target.value)}>
          <option value="">All</option>
          {lookup.options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
      {locked !== undefined ? (
        <span className="field-hint">Set by drill-down. Roll up to change it.</span>
      ) : (
        <LookupHint lookup={lookup} name={name} />
      )}
    </div>
  );
}

function MultiField({ id, def, name, value, onChange, locked }) {
  const lookup = useLookup(def.lookup);
  const disabled = lookup.status !== 'ready' || locked !== undefined;
  const chosen = new Set(value);

  const toggle = (v) => {
    const next = new Set(chosen);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange(name, [...next]);
  };

  const labelOf = (v) => lookup.options.find((o) => o.value === v)?.label ?? v;
  let summary = `All ${def.label.toLowerCase()}s`;
  if (value.length === 1) summary = labelOf(value[0]);
  else if (value.length > 1) summary = `${value.length} selected`;

  if (locked !== undefined) {
    return (
      <div className="field">
        <span className="field-label" id={`${id}-label`}>{def.label}</span>
        <div className="locked" aria-labelledby={`${id}-label`}>
          <Lock size={14} aria-hidden="true" />
          <span>{String(locked)}</span>
        </div>
        <span className="field-hint">Set by drill-down. Roll up to change it.</span>
      </div>
    );
  }

  return (
    <div className="field">
      <span className="field-label" id={`${id}-label`}>{def.label}</span>
      <details className={`multi${disabled ? ' is-disabled' : ''}`} onClick={disabled ? (e) => e.preventDefault() : undefined}>
        <summary aria-labelledby={`${id}-label`} aria-disabled={disabled}>{summary}</summary>
        <div className="multi-menu">
          <ul role="group" aria-labelledby={`${id}-label`}>
            {lookup.options.map((o) => (
              <li key={o.value}>
                <label className="check">
                  <input type="checkbox" checked={chosen.has(o.value)} onChange={() => toggle(o.value)} />
                  <span>{o.label}</span>
                </label>
              </li>
            ))}
          </ul>
          {value.length > 0 && (
            <button type="button" className="link-btn" onClick={() => onChange(name, [])}>
              Clear selection
            </button>
          )}
        </div>
      </details>
      <LookupHint lookup={lookup} name={name} />
    </div>
  );
}

function NumberField({ id, def, name, value, onChange }) {
  return (
    <div className="field">
      <label htmlFor={id}>{def.label}</label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={def.min}
        max={def.max}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
      />
      <span className="field-hint">Leave blank to show up to {def.max} rows.</span>
    </div>
  );
}

export default function FilterPanel({ report, filterDefs, filters, onChange, locked, onRun, running }) {
  if (report.filters.length === 0) {
    return (
      <Notice variant="info">This report has no filters.</Notice>
    );
  }

  return (
    <form
      className="filters"
      onSubmit={(e) => {
        e.preventDefault();
        onRun();
      }}
    >
      <h2 className="panel-title">Filters</h2>
      {report.filters.map((name) => {
        const def = filterDefs[name];
        const id = `filter-${report.id}-${name}`;
        const common = { id, def, name, value: filters[name], onChange, locked: locked[name] };
        if (def.control === 'multi') return <MultiField key={name} {...common} />;
        if (def.control === 'number') return <NumberField key={name} {...common} />;
        return <SelectField key={name} {...common} />;
      })}
      <button type="submit" className="btn btn-primary" disabled={running}>
        {running ? 'Running' : 'Run report'}
      </button>
    </form>
  );
}
