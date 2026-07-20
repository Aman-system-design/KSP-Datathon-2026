export function createEnvelope({ data, runGroup, access, requestId, generatedAt }) {
  const firstRun = runGroup.runs[0];
  return Object.freeze({
    data,
    meta: Object.freeze({
      requestId,
      scopeUnitId: access.scopeUnitId,
      observationPeriod: Object.freeze({
        from: firstRun.ObservationStart,
        to: firstRun.ObservationEnd,
      }),
      analysisRunId: runGroup.RunGroupID,
      methodVersion: firstRun.EngineVersion,
      dataQualityStatus: 'ACCEPTED',
      syntheticData: access.syntheticData === true,
      generatedAt: generatedAt.toISOString(),
    }),
  });
}
