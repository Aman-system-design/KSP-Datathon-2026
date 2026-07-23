export function Busy({ label = 'Loading authorized intelligence…' }) {
  return <div className="loading-state"><i /><strong>{label}</strong></div>;
}

export function Failure({ error }) {
  const requestId = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/u.test(error?.requestId ?? '') ? error.requestId : null;
  const code = /^[A-Z][A-Z0-9_]{0,63}$/u.test(error?.code ?? '') ? error.code : null;
  return <div className="failure-state">
    <strong>Intelligence is unavailable</strong><span>The request could not be completed.</span>
    {code ? <small>Reference {requestId ? `${requestId} · ` : ''}{code}</small> : null}
    <button onClick={() => globalThis.location?.reload?.()}>Retry</button>
  </div>;
}
