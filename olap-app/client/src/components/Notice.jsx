import { CircleAlert, Info, RefreshCw } from 'lucide-react';

// variant: 'error' | 'info'
export default function Notice({ variant = 'info', title, children, hint, onRetry }) {
  const Icon = variant === 'error' ? CircleAlert : Info;
  return (
    <div className={`notice notice-${variant}`} role={variant === 'error' ? 'alert' : 'status'}>
      <Icon className="notice-icon" size={20} aria-hidden="true" />
      <div className="notice-body">
        {title && <p className="notice-title">{title}</p>}
        {children && <div className="notice-text">{children}</div>}
        {hint && <p className="notice-hint">{hint}</p>}
        {onRetry && (
          <button type="button" className="btn btn-quiet" onClick={onRetry}>
            <RefreshCw size={16} aria-hidden="true" />
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
