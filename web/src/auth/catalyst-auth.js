const LOGIN_PATH = '/__catalyst/auth/login';
const EMBEDDED_SIGN_IN_PATH = '/login.html?release=20260723-1617';

export function authFailureDiagnostic(error) {
  return Object.freeze({
    name: typeof error?.name === 'string' ? error.name : 'UnknownError',
    code: typeof error?.code === 'string' ? error.code : null,
    status: Number.isInteger(error?.status) ? error.status : null,
  });
}

export function createCatalystAuth({
  catalyst,
  getCatalyst = () => globalThis.catalyst,
  location = globalThis.location,
  authOrigin = '',
  sleep = duration => new Promise(resolve => setTimeout(resolve, duration)),
  sdkAttempts = 25,
} = {}) {
  const loginUrl = `${authOrigin}${LOGIN_PATH}`;
  const sdk = () => catalyst ?? getCatalyst();
  const readyAuth = async () => {
    for (let attempt = 0; attempt < sdkAttempts; attempt += 1) {
      const auth = sdk()?.auth;
      if (auth) return auth;
      await sleep(100);
    }
    return null;
  };

  return Object.freeze({
    loginUrl,
    openSignIn() { location.replace(EMBEDDED_SIGN_IN_PATH); },
    async currentUser() {
      try {
        const result = await (await readyAuth())?.isUserAuthenticated?.();
        return result?.content ?? null;
      } catch (error) {
        console.error('catalyst_auth_session_failed', JSON.stringify(authFailureDiagnostic(error)));
        throw error;
      }
    },
    async accessToken() {
      try {
        const result = await (await readyAuth())?.generateAuthToken?.();
        return typeof result?.access_token === 'string' && result.access_token ? result.access_token : null;
      } catch (error) {
        console.error('catalyst_auth_token_failed', authFailureDiagnostic(error));
        throw error;
      }
    },
    signOut() {
      const auth = sdk()?.auth;
      if (typeof auth?.signOut === 'function') {
        auth.signOut(loginUrl.startsWith('http') ? loginUrl : `${location.origin}${loginUrl}`);
        return;
      }
      location.assign(loginUrl);
    },
  });
}

export const catalystAuth = createCatalystAuth();
