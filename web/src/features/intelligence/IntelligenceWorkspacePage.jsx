import { Busy, Failure } from '../../app/AsyncStates.jsx';
import { useLoad } from '../../app/useLoad.js';
import { PersonaWorkspace } from '../workspaces/PersonaWorkspace.jsx';

export function IntelligenceWorkspacePage({ api, role }) {
  const state = useLoad(async () => {
    const [brief, anomalies, hotspots, risk] = await Promise.all([
      api.get('/v1/intelligence/brief'), api.get('/v1/anomalies?limit=10'),
      api.get('/v1/hotspots?limit=10'), api.get('/v1/area-risk'),
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
        latitude: item.latitude ?? item.centroid?.latitude, longitude: item.longitude ?? item.centroid?.longitude,
      })),
      risk: {
        score: risk.data?.score, components: risk.data?.components ?? risk.data?.componentScores ?? {},
        limitation: risk.data?.limitation ?? risk.data?.limitations?.[0] ?? 'Area and time risk only.',
      },
    };
  }, [api]);
  if (state.loading) return <Busy />;
  if (state.error) return <Failure error={state.error} />;
  return <PersonaWorkspace role={role} data={state.data} />;
}
