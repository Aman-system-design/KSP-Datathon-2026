import { useParams } from 'react-router-dom';
import { Busy, Failure } from '../../app/AsyncStates.jsx';
import { useLoad } from '../../app/useLoad.js';
import { AlertDetail } from './AlertDetail.jsx';
import { AlertInbox } from './AlertInbox.jsx';

export function AlertsPage({ api }) {
  const state = useLoad(() => api.get('/v1/alerts').then(result => result.data?.items ?? []), [api]);
  if (state.loading) return <Busy label="Loading scoped alerts…" />;
  if (state.error) return <Failure error={state.error} />;
  return <AlertInbox alerts={state.data} />;
}

export function AlertPage({ api }) {
  const { alertId } = useParams();
  const state = useLoad(() => api.get(`/v1/alerts/${alertId}`).then(result => result.data), [api, alertId]);
  if (state.loading) return <Busy label="Loading evidence pack…" />;
  if (state.error) return <Failure error={state.error} />;
  return <AlertDetail api={api} alert={state.data} />;
}
