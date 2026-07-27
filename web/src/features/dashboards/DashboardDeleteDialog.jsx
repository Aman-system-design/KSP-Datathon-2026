import { AlertTriangle } from 'lucide-react';

export function DashboardDeleteDialog({ dashboard, deleting = false, error = '', onCancel = () => {}, onConfirm = () => {} }) {
  if (!dashboard) return null;
  return <div className="command-center-dashboard-delete-backdrop" role="presentation" onMouseDown={event => {
    if (event.target === event.currentTarget && !deleting) onCancel();
  }}>
    <section className="command-center-dashboard-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="dashboard-delete-title">
      <div className="command-center-dashboard-delete-dialog__icon"><AlertTriangle aria-hidden="true" /></div>
      <div>
        <h2 id="dashboard-delete-title">Delete {dashboard.name}?</h2>
        <p>This removes the dashboard and its layout only. Reports used by this dashboard will remain available in Reports.</p>
        {error ? <p className="command-center-dashboard-delete-dialog__error" role="alert">{error}</p> : null}
        <div className="command-center-dashboard-delete-dialog__actions">
          <button type="button" disabled={deleting} onClick={onCancel}>Cancel</button>
          <button className="command-center-dashboard-delete-dialog__danger" type="button" disabled={deleting} onClick={onConfirm}>{deleting ? 'Deleting dashboard…' : 'Delete dashboard'}</button>
        </div>
      </div>
    </section>
  </div>;
}
