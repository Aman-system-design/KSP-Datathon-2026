const LOGIN_PATH = '/__catalyst/auth/login';

export function createCatalystAuth({
  catalyst,
  location = globalThis.location,
  authOrigin = '',
} = {}) {
  const loginUrl = `${authOrigin}${LOGIN_PATH}`;
  const sdk = () => catalyst ?? globalThis.catalyst;

  return Object.freeze({
    loginUrl,
    embeddedSignIn(elementId = 'loginDivElementId') {
      const signIn = sdk()?.auth?.signIn;
      if (typeof signIn !== 'function') throw new Error('Catalyst authentication is unavailable.');
      return signIn(elementId, { service_url: '/' });
    },
    async currentUser() {
      const result = await sdk()?.auth?.isUserAuthenticated?.();
      return result?.content ?? null;
    },
    async accessToken() {
      const result = await sdk()?.auth?.generateAuthToken?.();
      return typeof result?.access_token === 'string' && result.access_token ? result.access_token : null;
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
