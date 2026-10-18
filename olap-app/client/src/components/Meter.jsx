import { useEffect, useRef, useState } from 'react';
import { directionLabel } from '../lib/labels.js';
import { formatNumber } from '../lib/result.js';

// Counts up to `target` once when a result lands. Skipped when the viewer prefers reduced motion.
function useCountUp(target, duration = 600) {
  const [value, setValue] = useState(target);
  const frame = useRef(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return undefined;
    }
    const from = 0;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setValue(from + (target - from) * eased);
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [target, duration]);

  return value;
}

// A fare-meter style readout of the result: rows returned and how long the query took.
export default function Meter({ rowCount, ms, levelLabel, direction, runId }) {
  const rows = useCountUp(rowCount);
  const time = useCountUp(ms);

  return (
    <div className="meter" role="group" aria-label="Result summary">
      <div className="meter-cell">
        <span className="meter-label">Rows returned</span>
        <span className="meter-digits" key={`r${runId}`}>{formatNumber(Math.round(rows), 0)}</span>
      </div>
      <div className="meter-cell">
        <span className="meter-label">Execution time</span>
        <span className="meter-digits" key={`t${runId}`}>
          {formatNumber(time, ms < 10 ? 2 : 1)}
          <span className="meter-unit"> ms</span>
        </span>
      </div>
      {levelLabel && (
        <div className="meter-cell meter-cell-text">
          <span className="meter-label">Grouped by</span>
          <span className="meter-text">{levelLabel}</span>
        </div>
      )}
      {direction && (
        <div className="meter-cell meter-cell-text">
          <span className="meter-label">Zone</span>
          <span className="meter-text">{directionLabel(direction)}</span>
        </div>
      )}
      <span className="sr-only">
        {rowCount} rows returned in {ms} milliseconds.
      </span>
    </div>
  );
}
