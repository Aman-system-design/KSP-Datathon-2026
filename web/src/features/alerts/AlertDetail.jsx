import { useState } from 'react';

const readable = value => String(value).replaceAll('_', ' ');

export function AlertDetail({ api, alert }) {
  const [note, setNote] = useState('');
  const [status, setStatus] = useState('');
  async function addNote() {
    const body = { expectedState: alert.status, expectedVersion: alert.version, payload: { noteText: note } };
    try {
      if (api.workflow) await api.workflow(`/v1/alerts/${alert.id}/notes`, body);
      else await api.post(`/v1/alerts/${alert.id}/notes`, body);
      setNote(''); setStatus('Note added to the audited timeline.');
    } catch (error) { setStatus(error.message ?? 'Note could not be added.'); }
  }
  return <section className="alert-detail">
    <div className="page-heading"><div><span className="eyebrow">AI intelligence alert · {alert.status}</span><h1>{alert.title}</h1><p>Investigative signal requiring human verification. This alert is not proof of guilt.</p></div><div className="confidence-ring"><strong>{Math.round((alert.explanation?.confidence ?? 0) * 100)}%</strong><span>confidence</span></div></div>
    <div className="detail-grid">
      <section className="panel"><div className="panel-heading"><h2>Why this surfaced</h2><span>{alert.explanation?.methodVersion}</span></div><p className="method-name">{readable(alert.explanation?.method)}</p><div className="component-bars">{Object.entries(alert.explanation?.components ?? {}).map(([key, value]) => <div key={key}><span>{readable(key)}</span><progress max="1" value={value} /><strong>{Math.round(value * 100)}%</strong></div>)}</div></section>
      <section className="panel"><div className="panel-heading"><h2>Safeguards & limitations</h2></div><ul className="limitation-list">{alert.limitations?.map(item => <li key={item}>{readable(item)}</li>)}</ul></section>
      <section className="panel evidence-panel"><div className="panel-heading"><h2>Authorized evidence</h2><span>{alert.evidence?.length ?? 0} records</span></div><table><thead><tr><th>Case</th><th>Unit</th><th>Station</th><th>Evidence summary</th></tr></thead><tbody>{alert.evidence?.map(item => <tr key={item.caseId}><td><a href={`#case-${item.caseId}`}>{item.caseId}</a></td><td>{item.unitId}</td><td>{item.stationId}</td><td>{item.briefFacts}</td></tr>)}</tbody></table></section>
      <section className="panel note-panel"><div className="panel-heading"><h2>Investigation notes</h2><span>Audited</span></div><label>Add investigation note<textarea aria-label="Add investigation note" value={note} onChange={event => setNote(event.target.value)} /></label><button className="primary-button" onClick={addNote} disabled={!note.trim()}>Add note</button><output>{status}</output></section>
    </div>
  </section>;
}
