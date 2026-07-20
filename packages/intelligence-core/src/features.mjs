function timeBand(hour) {
  if (hour < 6) return 'NIGHT';
  if (hour < 12) return 'MORNING';
  if (hour < 18) return 'AFTERNOON';
  return 'EVENING';
}

export function buildCaseFeature(row, featureVersion, asOf) {
  const incident = new Date(row.incidentAt);
  if (!row.synthetic || Number.isNaN(incident.valueOf())) throw new Error(`invalid case ${row.caseId}`);
  const sourceHour = Number(row.incidentAt.match(/T(\d{2}):/)?.[1]);
  const hour = Number.isInteger(sourceHour) ? sourceHour : incident.getUTCHours();
  const completeness = Number(row.quality?.completeness ?? 0);
  return Object.freeze({
    caseId: row.caseId,
    districtId: row.districtId,
    stationId: row.stationId,
    crimeMajor: row.crimeMajor,
    crimeMinor: row.crimeMinor,
    gravity: Number(row.gravity),
    incidentAt: incident.toISOString(),
    latitude: row.latitude,
    longitude: row.longitude,
    acts: [...new Set(row.acts)].sort(),
    sections: [...new Set(row.sections)].sort(),
    accused: structuredClone(row.accused),
    briefFacts: row.briefFacts,
    timeBand: timeBand(hour),
    hourSin: Math.sin(2 * Math.PI * hour / 24),
    hourCos: Math.cos(2 * Math.PI * hour / 24),
    ageDays: Math.max(0, (asOf - incident) / 86_400_000),
    completeness,
    eligible: row.quality?.coordinatesValid === true && row.quality?.relationshipResolved === true && completeness >= 0.6,
    featureVersion,
    synthetic: true,
  });
}

export const buildCaseFeatures = (rows, version, asOf) => rows.map(row => buildCaseFeature(row, version, asOf));
