import { useState } from 'react';

const readable = value => String(value ?? '').replaceAll('_', ' ');

export function NetworkView({ api }) {
  const [identifier, setIdentifier] = useState('');
  const [network, setNetwork] = useState();
  const [status, setStatus] = useState('');
  async function search(event) {
    event.preventDefault();
    const value = identifier.trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(value)) return setStatus('Enter a valid case or person identifier.');
    setStatus('Loading authorized links…');
    try {
      const result = await api.get(`/v1/networks/${value}`);
      setNetwork(result.data); setStatus('');
    } catch (error) { setNetwork(undefined); setStatus(error.message ?? 'Network is unavailable.'); }
  }
  return <section className="feature-page">
    <div className="page-heading"><div><span className="eyebrow">Evidence graph</span><h1>Criminal network & link analysis</h1><p>Links show evidence-backed appearances for human review. A relationship is an investigative signal, not proof.</p></div></div>
    <form className="panel network-search" onSubmit={search}><label>Person or case identifier<input aria-label="Person or case identifier" value={identifier} onChange={event => setIdentifier(event.target.value)} placeholder="e.g. PERSON:PERSON-008" /></label><button className="primary-button" type="submit">Build network</button><output>{status}</output></form>
    {network && <div className="detail-grid"><section className="panel"><span className="eyebrow">{network.node?.type}</span><h2>{network.node?.id}</h2><strong>{network.repeatAppearanceCount ?? 0} appearances</strong><ul className="limitation-list">{network.limitations?.map(item => <li key={item}>{readable(item)}</li>)}</ul></section><section className="panel evidence-panel"><h2>Evidence-labelled links</h2><table><thead><tr><th>From</th><th>Relationship</th><th>To</th><th>Case evidence</th></tr></thead><tbody>{network.edges?.map((edge, index) => <tr key={`${edge.from}-${edge.to}-${index}`}><td>{edge.from}</td><td>{readable(edge.type)}</td><td>{edge.to}</td><td>{edge.sourceCaseId ?? '—'}</td></tr>)}</tbody></table></section></div>}
  </section>;
}
