import { createDispatcher, isDeclaredApiRoute } from '../http/dispatch.mjs';
import { CatalystIntelligenceRepository } from '../repository/catalyst/catalyst-repository.mjs';
import { createCatalystSdkContext } from '../repository/catalyst/sdk-context.mjs';
import { createCatalystJobScheduler } from './job-scheduling-adapter.mjs';
import { createIntelligenceRunService } from '../operations/intelligence-run-service.mjs';
import { createIntelligenceRunResources } from '../operations/intelligence-run-resources.mjs';
import { createAccessAuditService } from '../security/access-audit.mjs';
import { resolveAccess } from '../security/identity.mjs';
import { buildAuthorizedUnitSet, buildEscalationUnitSet } from '../security/scope.mjs';
import { createReadServices } from '../services/read-services.mjs';
import { createWorkspaceServices } from '../reporting/workspace-services.mjs';
import { createCommandService } from '../workflow/command-service.mjs';
import { createGeospatialLayerService } from '../geospatial/layer-service.mjs';
import { createMapViewService } from '../geospatial/map-view-service.mjs';
import { createUtilityServices } from '../utilities/utility-services.mjs';

const EXPECTED_PROJECT = '43492000000013049';
const utilityCatalogueServices = createUtilityServices();

function safeFailure(code, requestId) {
  const known = {
    UNAUTHENTICATED: [401, 'Authentication is required.'],
    INACTIVE_ACCESS_PROFILE: [403, 'The access profile is inactive or unavailable.'],
    NOT_FOUND: [404, 'The requested resource was not found.'],
  };
  const [status, message] = known[code] ?? [500, 'The request could not be completed.'];
  return { status, body: { error: { code: known[code] ? code : 'INTERNAL_ERROR', message, requestId } } };
}

function normalizeRequest(input, requestId) {
  if (typeof input?.url !== 'string' || !input.url.startsWith('/')) {
    return { method: input?.method, path: undefined, query: {}, headers: input?.headers ?? {}, body: input?.body, requestId };
  }
  const url = new URL(input.url, 'https://development.invalid');
  return {
    method: String(input.method ?? '').toUpperCase(), path: url.pathname,
    query: Object.fromEntries(url.searchParams.entries()), headers: input.headers ?? {},
    body: input.body ?? null, requestId,
  };
}

function isoClock(clock) {
  return () => {
    const value = clock();
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) throw new Error('Clock returned an invalid value.');
    return date.toISOString();
  };
}

export function createApiApplication({
  sdk, config, policy, clock = () => new Date(), idFactory,
  repositoryFactory = application => new CatalystIntelligenceRepository({ application }),
  schedulerFactory = (application, jobPoolName) => createCatalystJobScheduler({ app: application, jobPoolName }),
  logger = console,
}) {
  if (config?.environment !== 'Development' || config.projectId !== EXPECTED_PROJECT
    || config.permissionVersion !== policy?.version || config.organizationId !== 'ORG-KSP'
    || !config.auditKey || !config.auditKeyVersion
    || !config.intelligenceJobPool) {
    throw new Error('Catalyst API runtime config is invalid.');
  }
  if (typeof idFactory !== 'function') throw new TypeError('idFactory is required.');
  const now = isoClock(clock);
  const log = (level, event) => {
    try { logger?.[level]?.(JSON.stringify(event)); } catch { /* Logging cannot alter the API result. */ }
  };

  return async function handle(httpRequest) {
    const startedAt = performance.now();
    const durationMs = () => Number((performance.now() - startedAt).toFixed(2));
    const requestId = idFactory('REQ');
    const request = normalizeRequest(httpRequest, requestId);
    if (!isDeclaredApiRoute(request.method, request.path)) {
      const result = safeFailure('NOT_FOUND', requestId);
      log('info', { event: 'api_request_completed', requestId, method: request.method, status: result.status, durationMs: durationMs() });
      return result;
    }
    let context;
    let currentUser;
    let phase = 'SDK_CONTEXT';
    try {
      context = createCatalystSdkContext({ request: httpRequest, sdk, policyVersion: config.permissionVersion });
      phase = 'CURRENT_USER';
      currentUser = await context.getCurrentUser();
      phase = 'PROFILE_APPLICATION';
      const profileApplication = await context.getProfileApplication();
      phase = 'REPOSITORY';
      const repository = repositoryFactory(profileApplication);
      phase = 'ACCESS_PROFILE';
      const profile = await repository.getAccessProfile(currentUser.user_id);
      phase = 'AUTHORIZE';
      await context.authorize(profile);

      phase = 'SERVICE_COMPOSITION';
      const readServices = createReadServices({ repository, clock: () => new Date(now()), idFactory: () => requestId });
      const mapViewServices = createMapViewService({ repository, clock: now });
      const workspaceServices = createWorkspaceServices({
        repository, readServices, mapViewService: mapViewServices, now, idFactory,
      });
      const geospatialServices = createGeospatialLayerService({
        repository, readServices: { ...readServices, ...workspaceServices }, clock: () => new Date(now()),
      });
      let scheduler;
      const lazyScheduler = Object.freeze({
        async submit(input) {
          scheduler ??= schedulerFactory(profileApplication, config.intelligenceJobPool);
          return scheduler.submit(input);
        },
      });
      const runService = createIntelligenceRunService({
        repository, scheduler: lazyScheduler, clock: now, idFactory,
      });
      const utilityRuleServices = createUtilityServices({ repository, idFactory, now });
      const resourceServices = Object.freeze({
        ...workspaceServices, ...createIntelligenceRunResources({ runService }),
        ...utilityCatalogueServices,
        listUtilityAlertRules: utilityRuleServices.listUtilityAlertRules,
        createUtilityAlertRule: utilityRuleServices.createUtilityAlertRule,
        updateUtilityAlertRule: utilityRuleServices.updateUtilityAlertRule,
        listGeospatialDatasets: geospatialServices.listDatasets,
        executeGeospatialLayer: geospatialServices.executeLayer,
        getGeospatialFreshness: geospatialServices.getFreshness,
        ...mapViewServices,
      });
      const commandService = createCommandService({
        repository, clock: now, idFactory,
        auditKeys: { [config.auditKeyVersion]: config.auditKey }, activeAuditKeyVersion: config.auditKeyVersion,
      });
      const auditService = createAccessAuditService({
        repository, clock: now, idFactory,
        auditKeys: { [config.auditKeyVersion]: config.auditKey }, activeAuditKeyVersion: config.auditKeyVersion,
      });
      const accessResolver = async ({ currentUser: user, profile: accessProfile, requestedPersona, units, assignments }) => {
        const base = resolveAccess({
          currentUser: user, profile: accessProfile, requestedPersona,
          environment: config.environment, policy,
        });
        return Object.freeze({
          ...base,
          organizationId: config.organizationId,
          authorizedUnitIds: buildAuthorizedUnitSet({ scopeUnitId: base.scopeUnitId, units }),
          escalationUnitIds: buildEscalationUnitSet({ scopeUnitId: base.scopeUnitId, units }),
          assignments,
        });
      };
      const dispatcher = createDispatcher({
        readServices, resourceServices, commandService, accessResolver,
        profileRepository: repository, auditService, environment: config.environment,
      });
      phase = 'DISPATCH';
      const result = await dispatcher({ request, currentUser });
      const failed = result.status >= 500;
      log(failed ? 'error' : 'info', {
        event: failed ? 'api_request_failed' : 'api_request_completed',
        requestId, method: request.method, status: result.status, durationMs: durationMs(),
        ...(failed ? {
          code: result.body?.error?.code ?? 'INTERNAL_ERROR',
          ...(result.diagnostic ?? {}),
        } : {}),
      });
      return result;
    } catch (error) {
      const result = safeFailure(error?.code, requestId);
      log('error', {
        event: 'api_request_failed', requestId, method: request.method,
        status: result.status, code: result.body.error.code, phase, durationMs: durationMs(),
      });
      return result;
    }
  };
}
