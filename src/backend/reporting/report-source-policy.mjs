export const STATION_REPORT_SOURCES = Object.freeze(['alerts', 'stationCases']);

const stationSources = new Set(STATION_REPORT_SOURCES);

export function isReportSourceAllowed(access, sourceKey) {
  return access?.role !== 'STATION_OPERATIONS' || stationSources.has(sourceKey);
}

export function visibleReportSources(access, sources) {
  return access?.role === 'STATION_OPERATIONS'
    ? sources.filter(source => stationSources.has(source.key))
    : sources;
}
