import { Suspense } from 'react';
import { KSP_GEOSPATIAL_CONFIG } from '../geospatial/geospatial-config.js';

export function ReportMapAuthoring({ Composer, api, onCancel, onViewSaved, sourceKey }) {
  return <section className="report-map-authoring" aria-label="Map view authoring">
    <header>
      <button className="secondary-button" type="button" onClick={onCancel}>Back to report</button>
    </header>
    <Suspense fallback={<div className="report-map-authoring-loading" role="status">Loading map utility…</div>}>
      <Composer
        api={api} mode="authoring" onCancel={onCancel} onViewSaved={onViewSaved}
        organizationConfig={KSP_GEOSPATIAL_CONFIG}
        defaultDatasetIds={sourceKey ? [sourceKey] : []}
      />
    </Suspense>
  </section>;
}

export default ReportMapAuthoring;
