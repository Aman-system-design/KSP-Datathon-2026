import { Busy, Failure } from '../../app/AsyncStates.jsx';
import { useLoad } from '../../app/useLoad.js';
import { CommandCentre } from './CommandCentre.jsx';

export function CommandCentrePage({ api, workspace }) {
  const state = useLoad(async () => {
    const [brief, anomalies, hotspots] = await Promise.all([
      api.get('/v1/intelligence/brief'), api.get('/v1/anomalies?limit=8'), api.get('/v1/hotspots?limit=8'),
    ]);
    return {
      brief: brief.data,
      anomalies: (anomalies.data?.items ?? []).map(item => ({
        id: item.id ?? item.anomalyId, label: item.label ?? item.signalType ?? item.seriesId ?? 'Crime trend anomaly',
        observed: item.observed ?? item.observedValue, expected: item.expected ?? item.baselineValue,
        confidence: item.confidence ?? item.severity,
      })),
      hotspots: (hotspots.data?.items ?? []).map(item => ({
        id: item.id ?? item.hotspotId, area: item.area ?? item.areaId ?? 'Authorized area',
        caseCount: item.caseCount ?? item.magnitude, severity: item.severity ?? item.confidence,
      })),
    };
  }, [api]);
  if (state.loading) return <main className="command-centre"><Busy label="Loading presentation-safe intelligence…" /></main>;
  if (state.error) return <main className="command-centre"><Failure error={state.error} /></main>;
  return <CommandCentre data={state.data} synthetic={workspace.syntheticData} freshness={workspace.freshness} />;
}
