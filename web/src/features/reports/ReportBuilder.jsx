import { lazy, useEffect, useMemo, useRef, useState } from 'react';
import { ReportBuilderFields } from './ReportBuilderFields.jsx';
import { ReportPreview } from './ReportPreview.jsx';

const LazyEmbeddedMapView = lazy(() => import('../geospatial/EmbeddedMapView.jsx'));

export function ReportBuilder({ api, EmbeddedMapComponent = LazyEmbeddedMapView }) {
  const [sources, setSources] = useState([]); const [sourceKey, setSourceKey] = useState('');
  const [name, setName] = useState(''); const [dimension, setDimension] = useState(''); const [measure, setMeasure] = useState('');
  const [visualization, setVisualization] = useState('table'); const [preview, setPreview] = useState([]); const [status, setStatus] = useState('');
  const [mapViews, setMapViews] = useState([]); const [mapViewId, setMapViewId] = useState(''); const [mapPreview, setMapPreview] = useState(null);
  const [savingGeneration, setSavingGeneration] = useState(null); const generation = useRef(0); const saving = savingGeneration !== null;

  useEffect(() => { let active = true; api.get('/v1/report-sources').then(({ data }) => { if (!active) return; const items = Array.isArray(data) ? data : []; setSources(items); setSourceKey(items[0]?.key ?? ''); setVisualization(items[0]?.visualizations?.[0] ?? 'table'); }).catch(() => { if (active) setStatus('Report sources are unavailable.'); }); return () => { active = false; }; }, [api]);
  useEffect(() => { if (visualization !== 'map') return undefined; let active = true; api.get('/v1/geospatial/views').then(response => { if (!active) return; const items = Array.isArray(response?.data?.items) ? response.data.items : []; setMapViews(items); setMapViewId(current => items.some(item => item.id === current) ? current : (items[0]?.id ?? '')); }).catch(() => { if (active) { setMapViews([]); setMapViewId(''); } }); return () => { active = false; }; }, [api, visualization]);

  const source = useMemo(() => sources.find(item => item.key === sourceKey), [sources, sourceKey]);
  const dimensions = Object.entries(source?.fields ?? {}).filter(([, value]) => value.dimension);
  const measures = Object.entries(source?.fields ?? {}).flatMap(([field, value]) => (value.aggregates ?? []).map(aggregate => [`${field}:${aggregate}`, `${field} · ${aggregate}`]));
  function invalidatePreview() { generation.current += 1; setSavingGeneration(null); setPreview([]); setMapPreview(null); setStatus(''); }
  function updateDefinition(update) { invalidatePreview(); update(); }
  function changeSource(key) { const next = sources.find(item => item.key === key); updateDefinition(() => { setSourceKey(key); setDimension(''); setMeasure(''); setVisualization(next?.visualizations?.[0] ?? 'table'); setMapViewId(''); }); }
  function changeVisualization(next) { updateDefinition(() => { setVisualization(next); if (next === 'map') { setDimension(''); setMeasure(''); } else setMapViewId(''); }); }

  async function save(event) {
    event.preventDefault(); if (saving) return; const requestGeneration = generation.current + 1; generation.current = requestGeneration; setSavingGeneration(requestGeneration); setStatus('Saving…');
    const [field, aggregate] = measure.split(':'); const isMap = visualization === 'map';
    try {
      const definition = { name, sourceKey, dimensions: !isMap && dimension ? [dimension] : [], measures: !isMap && field ? [{ field, aggregate }] : [], visualization: isMap ? { type: 'map', mapViewId } : { type: visualization }, limit: 100 };
      const saved = await api.post('/v1/reports', definition); if (generation.current !== requestGeneration) return;
      const result = await api.post(`/v1/reports/${saved.data.id}/execute`, {}); if (generation.current !== requestGeneration) return;
      const data = result.data.result?.data; if (isMap) { setMapPreview(data ?? null); setPreview([]); } else { setMapPreview(null); setPreview(data?.items ?? data ?? []); } setStatus('Saved');
    } catch (error) { if (generation.current === requestGeneration) setStatus(error.message ?? 'Report could not be saved.'); }
    finally { setSavingGeneration(current => current === requestGeneration ? null : current); }
  }

  return <section className="feature-page">
    <div className="page-heading"><div><span className="eyebrow">Reports</span><h1>Build a report</h1><p>Turn authorized intelligence into reusable tables, charts and operational maps. Viewer scope is enforced every time the report runs.</p></div></div>
    <nav className="report-builder-progress" aria-label="Report creation steps"><span className="active">Data</span><span>Visualization</span><span>Configure</span><span>Review</span></nav>
    <div className="builder-layout report-builder-layout"><form className="panel report-form" onSubmit={save}>
      <ReportBuilderFields name={name} onName={value => updateDefinition(() => setName(value))} sources={sources} sourceKey={sourceKey} onSource={changeSource} dimensions={dimensions} dimension={dimension} onDimension={value => updateDefinition(() => setDimension(value))} measures={measures} measure={measure} onMeasure={value => updateDefinition(() => setMeasure(value))} visualizations={source?.visualizations ?? ['table']} visualization={visualization} onVisualization={changeVisualization} mapViews={mapViews} mapViewId={mapViewId} onMapView={value => updateDefinition(() => setMapViewId(value))} />
      <div className="report-form-actions"><span>Definitions are versioned and reusable on dashboards.</span><button className="primary-button" type="submit" disabled={saving || (visualization === 'map' && !mapViewId)}>{saving ? 'Saving…' : 'Save and preview'}</button></div><output className="form-status">{status}</output>
    </form><ReportPreview api={api} mapPreview={mapPreview} preview={preview} EmbeddedMapComponent={EmbeddedMapComponent} /></div>
  </section>;
}
