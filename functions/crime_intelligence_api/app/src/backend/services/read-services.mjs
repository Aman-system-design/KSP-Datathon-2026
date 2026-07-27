import { projectNetwork, projectPattern } from '../security/disclosure.mjs';
import { fail } from './errors.mjs';
import { createEnvelope } from './envelope.mjs';

const actions = {
  brief: 'READ_BRIEF', pattern: 'READ_PATTERN', hotspot: 'READ_HOTSPOT',
  anomaly: 'READ_ANOMALY', risk: 'READ_AREA_RISK', network: 'READ_NETWORK',
  context: 'READ_DISTRICT_CONTEXT',
};

const requireAction = (access, action) => {
  if (!access?.actions?.includes(action)) fail('FORBIDDEN_ACTION');
};
const validateLimit = (query) => {
  if (query.limit === undefined) return 50;
  const limit = Number(query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) fail('INVALID_REQUEST');
  return limit;
};
const evidenceForAccess = (finding, access) => ({
  ...structuredClone(finding),
  evidenceCaseIds: (finding.evidenceCaseIds ?? [])
    .filter(id => access.authorizedUnitIds.has(finding.evidenceUnits?.[id])),
});

export function createReadServices({ repository, clock, idFactory }) {
  async function context(access, action, snapshot) {
    requireAction(access, action);
    const runGroup = snapshot ?? await repository.getCurrentRunGroup();
    if (!runGroup) fail('DATA_NOT_READY');
    return { runGroup, requestId: idFactory(), generatedAt: clock() };
  }
  const wrap = (data, access, request) => createEnvelope({ data, access, ...request });

  return Object.freeze({
    async getBrief({ access }) {
      const request = await context(access, actions.brief);
      const [brief, page] = await Promise.all([
        repository.getBrief(), repository.listPatterns({ limit: 200 }),
      ]);
      const visiblePatterns = [];
      for (const pattern of page.data) {
        try { visiblePatterns.push(projectPattern({ pattern, access })); } catch (error) {
          if (error.code !== 'NOT_FOUND') throw error;
        }
      }
      const data = {
        ...brief,
        patternCount: visiblePatterns.length,
        leadingPatternIds: visiblePatterns.map(({ id }) => id),
        executiveSummary: `Synthetic decision brief: ${visiblePatterns.length} evidence-linked pattern(s) require human review.`,
      };
      return wrap(data, access, request);
    },

    async listPatterns({ access, query = {} }) {
      const request = await context(access, actions.pattern);
      const page = await repository.listPatterns({ limit: validateLimit(query), nextToken: query.nextToken });
      const items = [];
      for (const pattern of page.data) {
        try { items.push(projectPattern({ pattern, access })); } catch (error) {
          if (error.code !== 'NOT_FOUND') throw error;
        }
      }
      return wrap({ items, nextToken: page.nextToken }, access, request);
    },

    async getPattern({ access, params }) {
      const request = await context(access, actions.pattern);
      const pattern = await repository.getPattern(params.patternId);
      if (!pattern) fail('NOT_FOUND');
      return wrap(projectPattern({ pattern, access }), access, request);
    },

    async listHotspots({ access, query = {}, snapshot }) {
      const request = await context(access, actions.hotspot, snapshot);
      const page = await repository.listHotspots({
        limit: validateLimit(query), nextToken: query.nextToken, runGroup: request.runGroup,
      });
      return wrap({ items: page.data.map(row => evidenceForAccess(row, access)), nextToken: page.nextToken }, access, request);
    },

    async listAnomalies({ access, query = {} }) {
      const request = await context(access, actions.anomaly);
      const page = await repository.listAnomalies({ limit: validateLimit(query), nextToken: query.nextToken });
      return wrap({ items: page.data.map(row => evidenceForAccess(row, access)), nextToken: page.nextToken }, access, request);
    },

    async getAreaRisk({ access }) {
      const request = await context(access, actions.risk);
      const risk = await repository.getAreaRisk();
      if (!risk) fail('DATA_NOT_READY');
      return wrap(evidenceForAccess(risk, access), access, request);
    },

    async getNetwork({ access, params }) {
      const request = await context(access, actions.network);
      const network = await repository.getNetwork(params.nodeId);
      if (!network) fail('NOT_FOUND');
      return wrap(projectNetwork({ network, access }), access, request);
    },

    async getDistrictContext({ access, query = {} }) {
      const request = await context(access, actions.context);
      const unitId = Number(query.unitId ?? access.scopeUnitId);
      if (!Number.isInteger(unitId)) fail('INVALID_REQUEST');
      if (!access.authorizedUnitIds.has(unitId)) fail('FORBIDDEN_SCOPE');
      const items = await repository.getDistrictContext(unitId);
      return wrap({ items }, access, request);
    },
  });
}
