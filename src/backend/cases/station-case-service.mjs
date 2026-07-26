import { fail } from '../services/errors.mjs';

const DAY_MS = 86_400_000;
const CLOSED_LIFECYCLE = /closed|disposed|acquitted|convicted|false|mistake/iu;

const instant = (value) => {
  if (value === null || value === undefined || value === '') return Number.NaN;
  const milliseconds = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(milliseconds) ? milliseconds : Number.NaN;
};

export function ageInDays(registeredAt, now) {
  const registeredMilliseconds = instant(registeredAt);
  const nowMilliseconds = instant(now);
  if (!Number.isFinite(registeredMilliseconds) || !Number.isFinite(nowMilliseconds)) return 0;
  return Math.max(0, Math.floor((nowMilliseconds - registeredMilliseconds) / DAY_MS));
}

export function ageingBucket(value) {
  const days = Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
  if (days <= 7) return '0–7 days';
  if (days <= 30) return '8–30 days';
  if (days <= 60) return '31–60 days';
  return '60+ days';
}

const isOpenStatus = value => !CLOSED_LIFECYCLE.test(String(value ?? ''));

const project = (row, currentTime) => {
  const ageDays = ageInDays(row.registeredAt, currentTime);
  return Object.freeze({
    caseId: row.caseId,
    caseNumber: row.caseNumber,
    unitId: row.unitId,
    unitName: row.unitName,
    status: row.status,
    registeredAt: row.registeredAt,
    incidentAt: row.incidentAt,
    majorHead: row.majorHead,
    minorHead: row.minorHead,
    syntheticData: row.syntheticData === true,
    ageDays,
    ageingBucket: ageingBucket(ageDays),
    isOpen: isOpenStatus(row.status),
    recordCount: 1,
  });
};

const boundedLimit = (value) => {
  if (value === undefined || value === null || value === '') return 200;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return 200;
  return Math.max(1, Math.min(200, Math.floor(numeric)));
};

export function createStationCaseService({ repository, now = () => new Date() }) {
  const allowed = (row, access) => access?.authorizedUnitIds?.has(Number(row.unitId)) === true;
  return Object.freeze({
    async list({ access, query = {} }) {
      const currentTime = now();
      const projected = (await repository.listStationCaseRows())
        .filter(row => allowed(row, access))
        .map(row => project(row, currentTime));
      const filtered = query.openOnly === false
        ? projected
        : projected.filter(row => row.isOpen);
      return {
        data: { items: filtered.slice(0, boundedLimit(query.limit)) },
        syntheticData: true,
      };
    },
    async get({ access, caseId }) {
      const row = await repository.getStationCaseRow(caseId);
      if (!row || !allowed(row, access)) fail('NOT_FOUND');
      return { data: project(row, now()), syntheticData: true };
    },
  });
}
