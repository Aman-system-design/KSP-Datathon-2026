export const REQUIRED_ANALYSIS_TYPES = Object.freeze([
  'FEATURE_BUILD', 'HOTSPOT', 'ANOMALY', 'PATTERN', 'AREA_RISK', 'NETWORK',
  'IDENTITY_RESOLUTION',
]);

export function isCompletePublishedGroup(runs) {
  if (!Array.isArray(runs) || runs.length !== REQUIRED_ANALYSIS_TYPES.length) return false;
  const [first] = runs;
  const types = new Set(runs.map(row => row.AnalysisType));
  const keys = new Set(runs.map(row => row.RunTypeKey));
  if (types.size !== REQUIRED_ANALYSIS_TYPES.length || keys.size !== runs.length) return false;
  if (REQUIRED_ANALYSIS_TYPES.some(type => !types.has(type))) return false;
  return runs.every(row => row.RunGroupID === first.RunGroupID
    && row.RunTypeKey === `${row.RunGroupID}:${row.AnalysisType}`
    && row.InputManifestHash === first.InputManifestHash
    && row.ObservationStart === first.ObservationStart
    && row.ObservationEnd === first.ObservationEnd
    && row.EngineVersion === first.EngineVersion
    && row.PublishedAt === first.PublishedAt
    && row.Status === 'COMPLETED'
    && row.PublishStatus === 'PUBLISHED');
}

export function selectCurrentRunGroup(runs) {
  const groups = new Map();
  for (const run of runs ?? []) {
    const group = groups.get(run.RunGroupID) ?? [];
    group.push(run);
    groups.set(run.RunGroupID, group);
  }
  return [...groups.entries()]
    .filter(([, group]) => isCompletePublishedGroup(group))
    .map(([RunGroupID, group]) => ({ RunGroupID, PublishedAt: group[0].PublishedAt, runs: structuredClone(group) }))
    .sort((left, right) => right.PublishedAt.localeCompare(left.PublishedAt))[0];
}
