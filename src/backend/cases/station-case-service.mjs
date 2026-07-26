import { fail } from '../services/errors.mjs';

const DAY_MS = 86_400_000;
const OPEN_LIFECYCLE_STATUSES = new Set([
  'under investigation',
  'chargesheet filed',
  'synthetic under investigation',
  'synthetic chargesheet filed',
]);

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

const normalizedStatus = value => String(value ?? '').trim().replace(/\s+/gu, ' ').toLowerCase();
const isOpenStatus = value => OPEN_LIFECYCLE_STATUSES.has(normalizedStatus(value));

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

const normalizeOpenOnly = (query) => {
  if (!Object.hasOwn(query, 'openOnly')) return true;
  if (query.openOnly === true || query.openOnly === 'true') return true;
  if (query.openOnly === false || query.openOnly === 'false') return false;
  fail('INVALID_REQUEST');
};

const compareCases = (left, right) => {
  const leftTime = instant(left.registeredAt);
  const rightTime = instant(right.registeredAt);
  const leftValid = Number.isFinite(leftTime);
  const rightValid = Number.isFinite(rightTime);
  if (leftValid && rightValid && leftTime !== rightTime) return rightTime - leftTime;
  if (leftValid !== rightValid) return leftValid ? -1 : 1;
  const leftId = String(left.caseId);
  const rightId = String(right.caseId);
  return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
};

export function createStationCaseService({ repository, now = () => new Date() }) {
  const allowed = (row, access) => access?.authorizedUnitIds?.has(Number(row.unitId)) === true;
  return Object.freeze({
    async list({ access, query = {} }) {
      const openOnly = normalizeOpenOnly(query);
      const currentTime = now();
      const projected = (await repository.listStationCaseRows())
        .filter(row => allowed(row, access))
        .map(row => project(row, currentTime));
      const filtered = (openOnly ? projected.filter(row => row.isOpen) : projected)
        .sort(compareCases);
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
