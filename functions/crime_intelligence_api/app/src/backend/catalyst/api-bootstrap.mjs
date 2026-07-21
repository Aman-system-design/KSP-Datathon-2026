import { createDispatcher, isDeclaredApiRoute } from '../http/dispatch.mjs';
import { CatalystIntelligenceRepository } from '../repository/catalyst/catalyst-repository.mjs';
import { createCatalystSdkContext } from '../repository/catalyst/sdk-context.mjs';
import { createAccessAuditService } from '../security/access-audit.mjs';
import { resolveAccess } from '../security/identity.mjs';
import { buildAuthorizedUnitSet, buildEscalationUnitSet } from '../security/scope.mjs';
import { createReadServices } from '../services/read-services.mjs';
import { createWorkspaceServices } from '../reporting/workspace-services.mjs';
import { createCommandService } from '../workflow/command-service.mjs';

const EXPECTED_PROJECT = '43492000000013049';

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
}) {
  if (config?.environment !== 'Development' || config.projectId !== EXPECTED_PROJECT
    || config.permissionVersion !== policy?.version || !config.auditKey || !config.auditKeyVersion) {
    throw new Error('Catalyst API runtime config is invalid.');
  }
  if (typeof idFactory !== 'function') throw new TypeError('idFactory is required.');
  const now = isoClock(clock);

  return async function handle(httpRequest) {
    const requestId = idFactory('REQ');
    const request = normalizeRequest(httpRequest, requestId);
    if (!isDeclaredApiRoute(request.method, request.path)) return safeFailure('NOT_FOUND', requestId);
    let context;
    let currentUser;
    try {
      context = createCatalystSdkContext({ request: httpRequest, sdk, policyVersion: config.permissionVersion });
      currentUser = await context.getCurrentUser();
      const profileApplication = await context.getProfileApplication();
      const repository = repositoryFactory(profileApplication);
      const profile = await repository.getAccessProfile(currentUser.user_id);
      await context.authorize(profile);

      const readServices = createReadServices({ repository, clock: () => new Date(now()), idFactory: () => idFactory('REQ') });
      const resourceServices = createWorkspaceServices({ repository, readServices, now, idFactory });
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
          authorizedUnitIds: buildAuthorizedUnitSet({ scopeUnitId: base.scopeUnitId, units }),
          escalationUnitIds: buildEscalationUnitSet({ scopeUnitId: base.scopeUnitId, units }),
          assignments,
        });
      };
      const dispatcher = createDispatcher({
        readServices, resourceServices, commandService, accessResolver,
        profileRepository: repository, auditService, environment: config.environment,
      });
      return dispatcher({ request, currentUser });
    } catch (error) {
      return safeFailure(error?.code, requestId);
    }
  };
}
