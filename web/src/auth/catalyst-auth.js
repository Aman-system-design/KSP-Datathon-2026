const LOGIN_PATH = '/__catalyst/auth/login';

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
    async embeddedSignIn(elementId = 'loginDivElementId') {
      const signIn = (await readyAuth())?.signIn;
      if (typeof signIn !== 'function') throw new Error('Catalyst authentication is unavailable.');
      return signIn(elementId, { service_url: '/' });
    },
    async currentUser() {
      const result = await (await readyAuth())?.isUserAuthenticated?.();
      return result?.content ?? null;
    },
    async accessToken() {
      const result = await (await readyAuth())?.generateAuthToken?.();
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
