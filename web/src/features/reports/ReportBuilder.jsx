import { useEffect, useMemo, useState } from 'react';

export function ReportBuilder({ api }) {
  const [sources, setSources] = useState([]);
  const [sourceKey, setSourceKey] = useState('');
  const [name, setName] = useState('');
  const [dimension, setDimension] = useState('');
  const [measure, setMeasure] = useState('');
  const [visualization, setVisualization] = useState('table');
  const [preview, setPreview] = useState([]);
  const [status, setStatus] = useState('');

  useEffect(() => { api.get('/v1/report-sources').then(({ data }) => {
    setSources(data); setSourceKey(data[0]?.key ?? '');
  }).catch(() => setStatus('Report sources are unavailable.')); }, [api]);
  const source = useMemo(() => sources.find(item => item.key === sourceKey), [sources, sourceKey]);
  const dimensions = Object.entries(source?.fields ?? {}).filter(([, value]) => value.dimension);
  const measures = Object.entries(source?.fields ?? {}).flatMap(([field, value]) =>
    (value.aggregates ?? []).map(aggregate => [`${field}:${aggregate}`, `${field} · ${aggregate}`]));

  async function save(event) {
    event.preventDefault(); setStatus('Saving…');
    const [field, aggregate] = measure.split(':');
    try {
      const definition = {
        name, sourceKey, dimensions: dimension ? [dimension] : [],
        measures: field ? [{ field, aggregate }] : [], visualization: { type: visualization }, limit: 100,
      };
      const saved = await api.post('/v1/reports', definition);
      const result = await api.post(`/v1/reports/${saved.data.id}/execute`, {});
      setPreview(result.data.result?.data?.items ?? result.data.result?.data ?? []);
      setStatus('Saved');
    } catch (error) { setStatus(error.message ?? 'Report could not be saved.'); }
  }

  return <section className="feature-page">
    <div className="page-heading"><div><span className="eyebrow">Governed analytics</span><h1>Build a report</h1><p>Compose reusable views from authorized intelligence sources. Data access is evaluated when each viewer runs the report.</p></div></div>
    <div className="builder-layout">
      <form className="panel report-form" onSubmit={save}>
        <label>Report name<input aria-label="Report name" value={name} onChange={event => setName(event.target.value)} required /></label>
        <label>Intelligence source<select aria-label="Intelligence source" value={sourceKey} onChange={event => { setSourceKey(event.target.value); setDimension(''); setMeasure(''); }}>
          {sources.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
        </select></label>
        <div className="form-row">
          <label>Group by<select aria-label="Group by" value={dimension} onChange={event => setDimension(event.target.value)}><option value="">No grouping</option>{dimensions.map(([key]) => <option key={key}>{key}</option>)}</select></label>
          <label>Measure<select aria-label="Measure" value={measure} onChange={event => setMeasure(event.target.value)}><option value="">Choose measure</option>{measures.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        <label>Visualization<select aria-label="Visualization" value={visualization} onChange={event => setVisualization(event.target.value)}>{(source?.visualizations ?? ['table']).map(type => <option key={type}>{type}</option>)}</select></label>
        <button className="primary-button" type="submit">Save and preview</button>
        <output className="form-status">{status}</output>
      </form>
      <section className="panel preview-panel" aria-label="Report preview">
        <div className="panel-heading"><h2>Preview</h2><span>Viewer scoped</span></div>
        {preview.length === 0 ? <div className="empty-state">Configure the report to inspect live governed results.</div> : <div className="bar-list">{preview.map((row, index) => {
          const label = row.unitId !== undefined ? `Unit ${row.unitId}` : Object.values(row)[0];
          const value = row.observed ?? row.value ?? row.caseCount ?? '—';
          return <div className="bar-row" key={index}><span>{label}</span><div><i style={{ width: `${Math.min(100, Number(value) * 5)}%` }} /></div><strong>{value}</strong></div>;
        })}</div>}
      </section>
    </div>
  </section>;
}
