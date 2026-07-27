import { ArrowLeft, ChevronLeft, ChevronRight, Play, Save } from 'lucide-react';
import { lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ConfigureStep, DataStep, fieldLabel, StyleStep, TypeStep } from './ReportBuilderFields.jsx';
import { ReportIntelligenceBar } from './ReportIntelligenceBar.jsx';
import { ReportPreview } from './ReportPreview.jsx';
import { ReportMapAuthoring } from './ReportMapAuthoring.jsx';
import { chartCompatibility, REPORT_VISUALIZATIONS } from './report-visualization-catalog.js';

const LazyEmbeddedMapView = lazy(() => import('../geospatial/EmbeddedMapView.jsx'));
const LazyGeospatialStudio = lazy(() => import('../geospatial/GeospatialStudio.jsx'));
const STEPS = ['Data', 'Type', 'Configure', 'Style', 'Review'];

function parseFilterValue(raw, type, operator) {
  const parse = (value) => {
    const normalized = value.trim();
    if (type === 'number') return Number(normalized);
    if (type === 'boolean' && normalized.toLowerCase() === 'true') return true;
    if (type === 'boolean' && normalized.toLowerCase() === 'false') return false;
    return normalized;
  };
  if (operator === 'in' || operator === 'between') return raw.split(',').map(parse).filter(value => value !== '');
  return parse(raw);
}

export function ReportBuilder({ api, EmbeddedMapComponent = LazyEmbeddedMapView, MapComposerComponent = LazyGeospatialStudio }) {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [sources, setSources] = useState([]); const [sourceKey, setSourceKey] = useState('');
  const [name, setName] = useState(''); const [description, setDescription] = useState('');
  const [dimension, setDimension] = useState(''); const [measure, setMeasure] = useState('');
  const [visualization, setVisualization] = useState('table'); const [preview, setPreview] = useState([]);
  const [mapViews, setMapViews] = useState([]); const [mapViewId, setMapViewId] = useState(''); const [mapPreview, setMapPreview] = useState(null);
  const [mapComposerOpen, setMapComposerOpen] = useState(false);
  const [filter, setFilter] = useState({ field: '', operator: 'eq', value: '' }); const [sortDirection, setSortDirection] = useState(''); const [limit, setLimit] = useState(100);
  const [version, setVersion] = useState(null); const [status, setStatus] = useState(''); const [busy, setBusy] = useState(false);
  const generation = useRef(0);

  useEffect(() => {
    let active = true;
    const requests = [api.get('/v1/report-sources'), reportId ? api.get(`/v1/reports/${reportId}`) : Promise.resolve(null)];
    Promise.all(requests).then(([sourceResponse, reportResponse]) => {
      if (!active) return;
      const items = Array.isArray(sourceResponse.data) ? sourceResponse.data : [];
      setSources(items);
      const report = reportResponse?.data;
      if (report) {
        const definition = report.definition ?? {};
        setName(report.name ?? definition.name ?? ''); setDescription(definition.description ?? ''); setSourceKey(definition.sourceKey ?? '');
        setDimension(definition.dimensions?.[0] ?? '');
        const firstMeasure = definition.measures?.[0]; setMeasure(firstMeasure ? `${firstMeasure.field}:${firstMeasure.aggregate}` : '');
        setVisualization(definition.visualization?.type ?? 'table'); setMapViewId(definition.visualization?.mapViewId ?? '');
        const firstFilter = definition.filters?.[0]; setFilter(firstFilter ? { ...firstFilter, value: Array.isArray(firstFilter.value) ? firstFilter.value.join(', ') : String(firstFilter.value) } : { field: '', operator: 'eq', value: '' });
        setSortDirection(definition.sort?.[0]?.direction ?? ''); setLimit(definition.limit ?? 100); setVersion(report.version);
      } else {
        setSourceKey(items[0]?.key ?? ''); setVisualization(items[0]?.visualizations?.[0] ?? 'table');
      }
    }).catch(() => { if (active) setStatus('Report configuration could not be loaded.'); });
    return () => { active = false; };
  }, [api, reportId]);

  useEffect(() => {
    if (visualization !== 'map') return undefined;
    let active = true;
    api.get('/v1/geospatial/views').then(response => {
      if (!active) return;
      const items = Array.isArray(response?.data?.items) ? response.data.items : [];
      setMapViews(items); setMapViewId(current => items.some(item => item.id === current) ? current : (items[0]?.id ?? ''));
    }).catch(() => { if (active) setMapViews([]); });
    return () => { active = false; };
  }, [api, visualization]);

  const source = useMemo(() => sources.find(item => item.key === sourceKey), [sources, sourceKey]);
  const dimensions = Object.entries(source?.fields ?? {}).filter(([, value]) => value.dimension);
  const measures = Object.entries(source?.fields ?? {}).flatMap(([field, value]) => (value.aggregates ?? []).map(aggregate => [`${field}:${aggregate}`, `${fieldLabel(field)} · ${fieldLabel(aggregate)}`]));
  const choices = REPORT_VISUALIZATIONS.map(item => ({ ...item, ...chartCompatibility({ source, type: item.type }) }));
  const canAdvance = step !== 0 || Boolean(name.trim() && sourceKey);
  const canRun = Boolean(name.trim() && sourceKey && (visualization !== 'map' || mapViewId));

  function invalidate(update) { generation.current += 1; setPreview([]); setMapPreview(null); setStatus(''); update(); }
  function changeSource(key) { const next = sources.find(item => item.key === key); invalidate(() => { setSourceKey(key); setDimension(''); setMeasure(''); setFilter({ field: '', operator: 'eq', value: '' }); setSortDirection(''); setVisualization(next?.visualizations?.[0] ?? 'table'); setMapViewId(''); }); }
  function changeVisualization(next) { invalidate(() => { setVisualization(next); if (next === 'map') { setDimension(''); setMeasure(''); setFilter({ field: '', operator: 'eq', value: '' }); setSortDirection(''); } else setMapViewId(''); }); }
  function acceptMapView(view) {
    if (!view?.id) return;
    setMapViews(previous => previous.some(item => item.id === view.id) ? previous : [...previous, view]);
    invalidate(() => setMapViewId(view.id));
    setMapComposerOpen(false);
  }

  function definition() {
    const [field, aggregate] = measure.split(':');
    const filters = filter.field && filter.value !== '' ? [{ field: filter.field, operator: filter.operator, value: parseFilterValue(filter.value, source?.fields?.[filter.field]?.type, filter.operator) }] : [];
    const sortField = field && aggregate ? `${field}_${aggregate}` : dimension;
    return { name: name.trim(), description: description.trim(), sourceKey, dimensions: visualization !== 'map' && dimension ? [dimension] : [], measures: visualization !== 'map' && field ? [{ field, aggregate }] : [], filters: visualization === 'map' ? [] : filters, sort: visualization !== 'map' && sortDirection && sortField ? [{ field: sortField, direction: sortDirection }] : [], visualization: visualization === 'map' ? { type: 'map', mapViewId } : { type: visualization }, limit };
  }

  async function save({ run = false } = {}) {
    if (busy || !canRun) return;
    const requestGeneration = generation.current + 1; generation.current = requestGeneration; setBusy(true); setStatus(run ? 'Running report…' : 'Saving report…');
    try {
      const saved = reportId
        ? await api.patch(`/v1/reports/${reportId}`, { expectedVersion: version, definition: definition() })
        : await api.post('/v1/reports', definition());
      if (generation.current !== requestGeneration) return;
      const id = saved.data.id ?? reportId; setVersion(saved.data.version ?? version);
      if (!reportId) navigate(`/reports/${encodeURIComponent(id)}`, { replace: true });
      if (run) {
        const result = await api.post(`/v1/reports/${id}/execute`, {}); if (generation.current !== requestGeneration) return;
        const data = result.data.result?.data;
        if (visualization === 'map') { setMapPreview(data ?? null); setPreview([]); } else { setMapPreview(null); setPreview(data?.items ?? data ?? []); }
        setStep(4); setStatus('Report completed.');
      } else setStatus('Report saved.');
    } catch (error) { if (generation.current === requestGeneration) setStatus(error.message ?? 'Report could not be saved.'); }
    finally { setBusy(false); }
  }

  const activeStep = step === 0
    ? <DataStep description={description} name={name} onDescription={value => invalidate(() => setDescription(value))} onName={value => invalidate(() => setName(value))} onSource={changeSource} sourceKey={sourceKey} sources={sources} />
    : step === 1
      ? <TypeStep choices={choices} onVisualization={changeVisualization} visualization={visualization} />
      : step === 2
        ? <ConfigureStep dimension={dimension} dimensions={dimensions} filter={filter} limit={limit} mapViewId={mapViewId} mapViews={mapViews} measure={measure} measures={measures} onCreateMapView={() => setMapComposerOpen(true)} onDimension={value => invalidate(() => setDimension(value))} onFilter={value => invalidate(() => setFilter(value))} onLimit={value => invalidate(() => setLimit(value))} onMapView={value => invalidate(() => setMapViewId(value))} onMeasure={value => invalidate(() => setMeasure(value))} onSortDirection={value => invalidate(() => setSortDirection(value))} sortDirection={sortDirection} source={source} visualization={visualization} />
        : step === 3
          ? <StyleStep visualization={visualization} />
          : <div className="report-stage report-review"><div><h2>Review and run</h2><p>{source?.label ?? 'Authorized source'} · {fieldLabel(visualization)} · Up to {limit} rows</p></div></div>;
  const hasPreview = visualization === 'map'
    ? Boolean(mapPreview)
    : Array.isArray(preview) ? preview.length > 0 : Boolean(preview);

  return <section className="reports-app report-builder-app">
    <header className="report-editor-header"><Link to="/reports"><ArrowLeft size={17} />Reports</Link><div><input aria-label="Report title" onChange={event => invalidate(() => setName(event.target.value))} placeholder="Untitled report" value={name} /><span>{status || 'Not yet run'}</span></div><div><button className="secondary-button" disabled={busy || !canRun} onClick={() => save()} type="button"><Save size={15} />Save</button><button className="primary-button" disabled={busy || !canRun} onClick={() => save({ run: true })} type="button"><Play size={15} />Run</button></div></header>
    <nav className="report-builder-progress" aria-label="Report creation steps">{STEPS.map((label, index) => <button aria-current={step === index ? 'step' : undefined} className={step === index ? 'active' : ''} key={label} onClick={() => setStep(index)} type="button"><span>{index + 1}</span>{label}</button>)}</nav>
    {mapComposerOpen ? <ReportMapAuthoring api={api} Composer={MapComposerComponent} sourceKey={sourceKey} onCancel={() => setMapComposerOpen(false)} onViewSaved={acceptMapView} /> : <form className="report-editor report-builder-workspace" onSubmit={event => event.preventDefault()}>
      <section className="report-builder-authoring" aria-label={`${STEPS[step]} report settings`}>{activeStep}</section>
      <section className="report-builder-preview" aria-label="Report preview workspace">
        <ReportIntelligenceBar />
        <div className="report-builder-preview__canvas">
          {hasPreview
            ? <ReportPreview api={api} EmbeddedMapComponent={EmbeddedMapComponent} mapPreview={mapPreview} preview={preview} visualization={visualization} />
            : <div className="report-builder-preview__empty"><strong>Report preview</strong><span>Run the report to generate its preview.</span></div>}
        </div>
      </section>
    </form>}
    {!mapComposerOpen ? <footer className="report-editor-footer"><button className="secondary-button" disabled={step === 0} onClick={() => setStep(value => Math.max(0, value - 1))} type="button"><ChevronLeft size={15} />Back</button><span>Changes are saved only when you choose Save or Run.</span>{step < STEPS.length - 1 ? <button className="primary-button" disabled={!canAdvance} onClick={() => setStep(value => Math.min(STEPS.length - 1, value + 1))} type="button">Next<ChevronRight size={15} /></button> : <button className="primary-button" disabled={busy || !canRun} onClick={() => save({ run: true })} type="button"><Play size={15} />Run report</button>}</footer> : null}
  </section>;
}
