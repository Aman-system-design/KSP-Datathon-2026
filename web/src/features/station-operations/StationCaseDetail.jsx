import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import { Busy } from '../../app/AsyncStates.jsx';
import { governedAppLocation } from '../../app/runtime.js';
import { useLoad } from '../../app/useLoad.js';
import './station-operations.css';

const UNAVAILABLE = 'Unavailable';
const KARNATAKA_TIME = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric',
  hour: 'numeric', minute: '2-digit', hour12: true,
});

function valueOrUnavailable(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : UNAVAILABLE;
}

function formatKarnatakaTimestamp(value) {
  if (typeof value !== 'string' && typeof value !== 'number' && !(value instanceof Date)) return UNAVAILABLE;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return UNAVAILABLE;
  return KARNATAKA_TIME.format(date).replace(' at ', ', ').replace(/\b(am|pm)\b/gu, match => match.toLowerCase());
}

function caseContract(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && typeof value.caseNumber === 'string' && value.caseNumber.trim();
}

function Fact({ label, children }) {
  return <div className="station-case-detail__fact"><dt>{label}</dt><dd>{children}</dd></div>;
}

function CaseUnavailable() {
  return <section className="station-case-detail station-case-detail--state" aria-labelledby="case-unavailable-title">
    <div role="alert">
      <h1 id="case-unavailable-title">Case unavailable</h1>
      <p>This case cannot be displayed in the current authorized station scope.</p>
      <Link className="station-case-detail__back" to={governedAppLocation('/', { search: '?persona=STATION_OPERATIONS' })}>
        <ArrowLeft aria-hidden="true" />Back to Station Operations
      </Link>
    </div>
  </section>;
}

export function StationCaseDetail({ api }) {
  const { caseId = '' } = useParams();
  const encodedCaseId = encodeURIComponent(caseId);
  const state = useLoad(async () => {
    const result = await api.get(`/v1/cases/${encodedCaseId}`);
    return { caseRecord: result.data, provenance: result.provenance, syntheticData: result.syntheticData };
  }, [api, encodedCaseId]);

  if (state.loading) return <div className="station-case-detail station-case-detail--state"><Busy label="Loading governed case record…" /></div>;
  if (state.error || !caseContract(state.data?.caseRecord)) return <CaseUnavailable />;

  const record = state.data.caseRecord;
  const synthetic = record.syntheticData === true || state.data.syntheticData === true
    || String(state.data.provenance ?? '').toUpperCase() === 'SYNTHETIC';
  const age = Number.isFinite(Number(record.ageDays)) ? `${Math.max(0, Number(record.ageDays))} days` : UNAVAILABLE;

  return <article className="station-case-detail" aria-labelledby="station-case-title">
    <header className="station-case-detail__header">
      <Link className="station-case-detail__back" to={governedAppLocation('/', { search: '?persona=STATION_OPERATIONS' })}>
        <ArrowLeft aria-hidden="true" />Back to Station Operations
      </Link>
      <div className="station-case-detail__heading">
        <div>
          <span className="station-case-detail__eyebrow">Governed station case</span>
          <h1 id="station-case-title">Case {record.caseNumber.trim()}</h1>
        </div>
        <div className="station-case-detail__cues">
          <span className="station-case-detail__status">{valueOrUnavailable(record.status)}</span>
          <span>Read-only case record</span>
          {synthetic ? <span>Synthetic data</span> : state.data.provenance ? <span>Governed source</span> : null}
        </div>
      </div>
    </header>

    <div className="station-case-detail__sections">
      <section aria-labelledby="case-overview-title">
        <h2 id="case-overview-title">Case overview</h2>
        <dl>
          <Fact label="Lifecycle status">{valueOrUnavailable(record.status)}</Fact>
          <Fact label="Case age">{age}</Fact>
          <Fact label="Ageing bucket">{valueOrUnavailable(record.ageingBucket)}</Fact>
        </dl>
      </section>

      <section aria-labelledby="timeline-facts-title">
        <h2 id="timeline-facts-title">Timeline facts</h2>
        <dl>
          <Fact label="Registered date and time">{formatKarnatakaTimestamp(record.registeredAt)}</Fact>
          <Fact label="Incident date and time">{formatKarnatakaTimestamp(record.incidentAt)}</Fact>
        </dl>
        <p className="station-case-detail__timezone">Times shown in Karnataka local time (IST).</p>
      </section>

      <section aria-labelledby="classification-title">
        <h2 id="classification-title">Classification and station context</h2>
        <dl>
          <Fact label="Major crime classification">{valueOrUnavailable(record.majorHead)}</Fact>
          <Fact label="Minor crime classification">{valueOrUnavailable(record.minorHead)}</Fact>
          <Fact label="Station">{valueOrUnavailable(record.unitName)}</Fact>
        </dl>
      </section>
    </div>
  </article>;
}
