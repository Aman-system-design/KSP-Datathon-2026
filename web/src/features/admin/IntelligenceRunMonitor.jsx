import { useCallback, useEffect, useState } from 'react';

const settled = new Set(['PUBLISHED', 'FAILED_RETRYABLE', 'FAILED_FINAL']);

export function IntelligenceRunMonitor({ api }) {
  const [runs, setRuns] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [batchKey, setBatchKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    try {
      const result = await api.get('/v1/intelligence-runs');
      const next = result.data ?? [];
      setRuns(next);
      setSelectedId(current => current ?? next[0]?.RunRequestID ?? null);
      setError(null);
    } catch (loadError) { setError(loadError); }
  }, [api]);

  useEffect(() => { load(); }, [load]);
  const hasActiveRun = runs.some(run => !settled.has(run.Status));
  useEffect(() => {
    if (!hasActiveRun) return undefined;
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [hasActiveRun, load]);

  const submit = async event => {
    event.preventDefault();
    setBusy(true); setError(null);
    try {
      const result = await api.workflow('/v1/intelligence-runs', { batchKey: batchKey.trim() });
      setRuns(current => [result.data, ...current.filter(row => row.RunRequestID !== result.data.RunRequestID)]);
      setSelectedId(result.data.RunRequestID);
      setBatchKey('');
    } catch (submitError) { setError(submitError); }
    finally { setBusy(false); }
  };
  const selected = runs.find(run => run.RunRequestID === selectedId) ?? runs[0];

  return <section className="feature-page run-monitor">
    <div className="page-heading"><div><span className="eyebrow">Platform operations</span><h1>Intelligence runs</h1><p>Submit a validated source batch and inspect the persisted Catalyst execution state.</p></div></div>
    <form className="run-submit" onSubmit={submit}>
      <label>Validated source batch<input aria-label="Validated source batch" value={batchKey} onChange={event => setBatchKey(event.target.value)} placeholder="SOURCE-BATCH-YYYYMMDD" required /></label>
      <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Run intelligence refresh'}</button>
    </form>
    {error && <div className="failure-state" role="alert"><strong>Run request failed</strong><span>{error.code ?? 'INTERNAL_ERROR'}</span></div>}
    <div className="run-monitor-layout">
      <div className="panel run-list"><table><thead><tr><th>Request</th><th>Batch</th><th>Status</th><th>Requested</th></tr></thead><tbody>
        {runs.map(run => <tr key={run.RunRequestID} className={selected?.RunRequestID === run.RunRequestID ? 'selected' : ''} onClick={() => setSelectedId(run.RunRequestID)}><td>{run.RunRequestID}</td><td>{run.BatchKey}</td><td><span className={`run-status ${String(run.Status).toLowerCase()}`}>{run.Status}</span></td><td>{run.RequestedAt ?? '—'}</td></tr>)}
        {runs.length === 0 && <tr><td colSpan="4">No intelligence runs have been submitted.</td></tr>}
      </tbody></table></div>
      <aside className="panel run-detail"><h2>Execution details</h2>{selected ? <dl>
        <dt>Request ID</dt><dd>{selected.RunRequestID}</dd><dt>Catalyst job ID</dt><dd>{selected.CatalystJobID ?? 'Not accepted'}</dd>
        <dt>Status</dt><dd>{selected.Status}</dd><dt>Attempt</dt><dd>{selected.Attempt ?? 1}</dd>
        <dt>Failure phase</dt><dd>{selected.FailedPhase ?? '—'}</dd><dt>Failure code</dt><dd>{selected.FailureCode ?? '—'}</dd>
        <dt>Published run group</dt><dd>{selected.CurrentRunGroupID ?? '—'}</dd>
      </dl> : <p>Select a run to inspect its persisted state.</p>}</aside>
    </div>
  </section>;
}
