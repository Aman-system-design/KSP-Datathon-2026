import { deny } from '../../security/identity.mjs';
import { sanitizeCatalystSdkError } from './sdk-errors.mjs';

function assertDependencies({ request, sdk, policyVersion }) {
  if (!request || typeof request !== 'object') throw new TypeError('Catalyst request is required.');
  if (!sdk || typeof sdk.initialize !== 'function') throw new TypeError('Catalyst SDK is required.');
  if (typeof policyVersion !== 'string' || !policyVersion) throw new TypeError('Policy version is required.');
}

export function createCatalystSdkContext({ request, sdk, policyVersion }) {
  assertDependencies({ request, sdk, policyVersion });
  let userApplication;
  try {
    userApplication = sdk.initialize(request, { scope: 'user' });
  } catch (error) {
    throw sanitizeCatalystSdkError(error, { operation: 'INITIALIZE_USER_SCOPE' });
  }

  let currentUserPromise;
  let adminApplication;

  async function getCurrentUser() {
    if (!currentUserPromise) {
      currentUserPromise = (async () => {
        try {
          const user = await userApplication.userManagement().getCurrentUser();
          if (!user?.user_id || user.status !== 'ACTIVE') deny('UNAUTHENTICATED');
          return Object.freeze({ user_id: String(user.user_id), status: 'ACTIVE' });
        } catch (error) {
          if (error?.code === 'UNAUTHENTICATED') throw error;
          throw sanitizeCatalystSdkError(error, { operation: 'GET_CURRENT_USER' });
        }
      })();
    }
    return currentUserPromise;
  }

  async function authorize(profile) {
    const currentUser = await getCurrentUser();
    if (!profile || profile.Active !== true
      || String(profile.CatalystUserID) !== currentUser.user_id
      || profile.PermissionVersion !== policyVersion) {
      deny('INACTIVE_ACCESS_PROFILE');
    }
    if (!adminApplication) {
      try {
        adminApplication = sdk.initialize(request, { scope: 'admin' });
      } catch (error) {
        throw sanitizeCatalystSdkError(error, { operation: 'INITIALIZE_ADMIN_SCOPE' });
      }
    }
    return adminApplication;
  }

  return Object.freeze({ getCurrentUser, authorize });
}
