import { fail } from '../services/errors.mjs';
import { provenanceFields } from '../services/result-provenance.mjs';

const DAY_MS = 86_400_000;
const KARNATAKA_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const ANALYTICS_LIMIT = 5000;
const OPEN_LIFECYCLE_STATUSES = new Set([
  'under investigation',
  'chargesheet filed',
  'synthetic under investigation',
  'synthetic chargesheet filed',
]);

const KARNATAKA_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?)?$/u;
const KARNATAKA_CIVIL = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

function karnatakaInstant(value) {
  if (value === null || value === undefined || value === '') return Number.NaN;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return Number.isFinite(value) ? value : Number.NaN;
  if (typeof value !== 'string') return Number.NaN;
  const civil = value.match(KARNATAKA_TIMESTAMP);
  if (civil) {
    const [year, month, day, hour = '0', minute = '0', second = '0', fraction = '0'] = civil.slice(1);
    const milliseconds = Date.UTC(
      Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second),
      Number(fraction.slice(0, 3).padEnd(3, '0')),
    );
    const check = new Date(milliseconds);
    if (check.getUTCFullYear() !== Number(year) || check.getUTCMonth() !== Number(month) - 1
      || check.getUTCDate() !== Number(day) || check.getUTCHours() !== Number(hour)
      || check.getUTCMinutes() !== Number(minute) || check.getUTCSeconds() !== Number(second)) return Number.NaN;
    return milliseconds - KARNATAKA_OFFSET_MS;
  }
  const milliseconds = Date.parse(value.replace(' ', 'T'));
  return Number.isFinite(milliseconds) ? milliseconds : Number.NaN;
}

function karnatakaCivilParts(milliseconds) {
  if (!Number.isFinite(milliseconds)) return null;
  const parts = Object.fromEntries(KARNATAKA_CIVIL.formatToParts(new Date(milliseconds))
    .filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
  return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour };
}

export function karnatakaCalendarAgeDays(registeredAt, now) {
  const registered = karnatakaCivilParts(karnatakaInstant(registeredAt));
  const current = karnatakaCivilParts(karnatakaInstant(now));
  if (!registered || !current) return null;
  const registeredDay = Date.UTC(registered.year, registered.month - 1, registered.day) / DAY_MS;
  const currentDay = Date.UTC(current.year, current.month - 1, current.day) / DAY_MS;
  return Math.max(0, currentDay - registeredDay);
}

export function karnatakaIncidentHour(incidentAt) {
  return karnatakaCivilParts(karnatakaInstant(incidentAt))?.hour ?? null;
}

export function ageInDays(registeredAt, now) {
  return karnatakaCalendarAgeDays(registeredAt, now) ?? 0;
}

function registeredAgeInDays(registeredAt, now) {
  const registeredMilliseconds = karnatakaInstant(registeredAt);
  const nowMilliseconds = karnatakaInstant(now);
  if (!Number.isFinite(registeredMilliseconds) || !Number.isFinite(nowMilliseconds)
    || registeredMilliseconds > nowMilliseconds) return null;
  return karnatakaCalendarAgeDays(registeredAt, now);
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
    incidentHour: karnatakaIncidentHour(row.incidentAt),
    majorHead: row.majorHead,
    minorHead: row.minorHead,
    syntheticData: row.syntheticData === true,
    ageDays,
    registeredAgeDays: registeredAgeInDays(row.registeredAt, currentTime),
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
  const leftTime = karnatakaInstant(left.registeredAt);
  const rightTime = karnatakaInstant(right.registeredAt);
  const leftValid = Number.isFinite(leftTime);
  const rightValid = Number.isFinite(rightTime);
  if (leftValid && rightValid && leftTime !== rightTime) return rightTime - leftTime;
  if (leftValid !== rightValid) return leftValid ? -1 : 1;
  const leftId = String(left.caseId);
  const rightId = String(right.caseId);
  return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
};

export function createStationCaseService({ repository, now = () => new Date() }) {
  const authorizedUnits = access => new Set(
    [...(access?.authorizedUnitIds ?? [])].map(Number).filter(Number.isSafeInteger),
  );
  const allowed = (row, units) => units.has(Number(row.unitId));
  const requireAccess = (access) => {
    if (!access?.actions?.includes('READ_CASE')) fail('FORBIDDEN_ACTION');
  };
  return Object.freeze({
    async list({ access, query = {} }) {
      requireAccess(access);
      const openOnly = normalizeOpenOnly(query);
      const currentTime = now();
      const units = authorizedUnits(access);
      const projected = (await repository.listStationCaseRows({ unitIds: access.authorizedUnitIds }))
        .filter(row => allowed(row, units))
        .map(row => project(row, currentTime));
      const filtered = (openOnly ? projected.filter(row => row.isOpen) : projected)
        .sort(compareCases);
      const items = filtered.slice(0, boundedLimit(query.limit));
      return { data: { items }, ...provenanceFields(items) };
    },
    async listForReport({ access }) {
      requireAccess(access);
      const currentTime = now();
      const units = authorizedUnits(access);
      const projected = (await repository.listStationCaseRows({ unitIds: access.authorizedUnitIds }))
        .filter(row => allowed(row, units))
        .map(row => project(row, currentTime))
        .sort(compareCases);
      if (projected.length > ANALYTICS_LIMIT) fail('DATA_NOT_READY');
      return { data: { items: projected }, ...provenanceFields(projected) };
    },
    async get({ access, caseId }) {
      requireAccess(access);
      const row = await repository.getStationCaseRow(caseId);
      if (!row || !allowed(row, authorizedUnits(access))) fail('NOT_FOUND');
      const data = project(row, now());
      return { data, ...provenanceFields([data]) };
    },
  });
}
