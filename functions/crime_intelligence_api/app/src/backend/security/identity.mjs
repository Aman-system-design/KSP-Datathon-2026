const statusByCode = {
  UNAUTHENTICATED: 401,
  INACTIVE_ACCESS_PROFILE: 403,
  FORBIDDEN_ACTION: 403,
  INVALID_UNIT_HIERARCHY: 503,
  NOT_FOUND: 404,
};

export class SecurityError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = 'SecurityError';
    this.code = code;
    this.status = statusByCode[code] ?? 403;
  }
}

export const deny = (code, message) => { throw new SecurityError(code, message); };

export function resolveAccess({
  currentUser, profile, requestedPersona, environment, policy,
}) {
  if (!currentUser?.user_id || currentUser.status !== 'ACTIVE') {
    deny('UNAUTHENTICATED');
  }
  if (!profile || profile.Active !== true
    || String(profile.CatalystUserID) !== String(currentUser.user_id)
    || profile.PermissionVersion !== policy?.version) {
    deny('INACTIVE_ACCESS_PROFILE');
  }
  if (!Object.hasOwn(policy?.roles ?? {}, profile.DefaultRole)) {
    deny('INACTIVE_ACCESS_PROFILE');
  }

  let role = profile.DefaultRole;
  let demoPersona = false;
  if (requestedPersona) {
    const personaAllowed = environment === 'Development'
      && profile.DefaultRole === 'DEMO_PRESENTER'
      && profile.DemoPersonaAllowed === true
      && profile.SyntheticData === true
      && policy.personaAllowlist.includes(requestedPersona);
    if (!personaAllowed) deny('FORBIDDEN_ACTION');
    role = requestedPersona;
    demoPersona = true;
  }

  return Object.freeze({
    actualUserId: String(currentUser.user_id),
    employeeId: profile.EmployeeID ?? null,
    role,
    scopeUnitId: profile.ScopeUnitID,
    permissionVersion: policy.version,
    demoPersona,
    actions: Object.freeze([...(policy.roles[role] ?? [])]),
    syntheticData: profile.SyntheticData === true,
  });
}
