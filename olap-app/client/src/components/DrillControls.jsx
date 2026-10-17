import { ChevronsDown, ChevronsUp } from 'lucide-react';
import { directionLabel } from '../lib/labels.js';

export function Breadcrumbs({ report, drill, onRollTo }) {
  const crumbs = report.levels.slice(0, drill.levelIndex + 1);
  return (
    <nav className="crumbs" aria-label="Drill path">
      <ol>
        {crumbs.map((level, i) => {
          const current = i === drill.levelIndex;
          const member = drill.members[level.id];
          return (
            <li key={level.id}>
              {current ? (
                <span aria-current="location">By {level.label.toLowerCase()}</span>
              ) : (
                <button type="button" className="crumb-btn" onClick={() => onRollTo(i)}>
                  {level.label}: {member !== undefined ? String(member) : 'all'}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function DrillButtons({ report, drill, onDown, onUp, disabled }) {
  const atTop = drill.levelIndex === 0;
  const atBottom = drill.levelIndex >= report.levels.length - 1;
  const down = report.levels[drill.levelIndex + 1];
  const up = report.levels[drill.levelIndex - 1];
  return (
    <div className="drill-buttons">
      <button type="button" className="btn" onClick={onUp} disabled={atTop || disabled}>
        <ChevronsUp size={18} aria-hidden="true" />
        Roll up{up ? ` to ${up.label.toLowerCase()}` : ''}
      </button>
      <button type="button" className="btn" onClick={onDown} disabled={atBottom || disabled}>
        <ChevronsDown size={18} aria-hidden="true" />
        Drill down{down ? ` to ${down.label.toLowerCase()}` : ''}
      </button>
    </div>
  );
}

export function DirectionSwitch({ directions, value, onChange }) {
  return (
    <fieldset className="segmented">
      <legend>Zone to use</legend>
      {directions.map((d) => (
        <label key={d} className={value === d ? 'is-on' : ''}>
          <input type="radio" name="direction" value={d} checked={value === d} onChange={() => onChange(d)} />
          <span>{directionLabel(d)}</span>
        </label>
      ))}
    </fieldset>
  );
}
