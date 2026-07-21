export function StatusBadge({ tone = 'neutral', children }) {
  return <span className={`status-badge status-badge--${tone}`}>{children}</span>;
}

export function DataState({ title, message, action }) {
  return <section className="data-state" aria-live="polite"><strong>{title}</strong><p>{message}</p>{action}</section>;
}

export function WorkspaceHeader({ eyebrow, title, description, meta }) {
  return <header className="workspace-header"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{meta}</header>;
}
