import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Database, RefreshCw } from 'lucide-react';
import { getHealth } from '../api.js';

function useHealth() {
  const [health, setHealth] = useState({ status: 'checking' });

  const check = useCallback(() => {
    setHealth({ status: 'checking' });
    getHealth()
      .then((info) => setHealth({ status: 'ok', info }))
      .catch((error) => setHealth({ status: 'down', error }));
  }, []);

  useEffect(check, [check]);
  return [health, check];
}

export default function Header() {
  const [health, check] = useHealth();

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link to="/" className="brand">
          <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="currentColor" />
            <rect x="6" y="13" width="20" height="9" rx="2" fill="var(--cab)" />
            <rect x="12" y="8" width="8" height="5" rx="1.5" fill="var(--amber)" />
          </svg>
          <span>Green Taxi OLAP</span>
        </Link>

        <div className={`db-status db-${health.status}`} aria-live="polite">
          <Database size={16} aria-hidden="true" />
          {health.status === 'checking' && <span>Checking database</span>}
          {health.status === 'ok' && (
            <span title={`MySQL ${health.info.version} at ${health.info.host}:${health.info.port}`}>
              Connected to <strong>{health.info.database || 'no database selected'}</strong>
            </span>
          )}
          {health.status === 'down' && (
            <span>
              Database offline
              <span className="db-reason">
                {' '}
                {health.error.message}
                {health.error.hint ? ` ${health.error.hint}` : ''}
              </span>
            </span>
          )}
          {health.status !== 'checking' && (
            <button type="button" className="icon-btn" onClick={check} aria-label="Check database connection again">
              <RefreshCw size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
