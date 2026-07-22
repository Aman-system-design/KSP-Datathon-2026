const LOGIN_PATH = '/__catalyst/auth/login';

export function loadCatalystInit(document = globalThis.document, source = '/__catalyst/sdk/init.js') {
  if (!document || document.querySelector('script[data-catalyst-init]')) return;
  const script = document.createElement('script');
  script.src = source;
  script.dataset.catalystInit = 'true';
  document.head.append(script);
}

export function createCatalystAuth({
  catalyst = globalThis.catalyst,
  location = globalThis.location,
  authOrigin = '',
} = {}) {
  const loginUrl = `${authOrigin}${LOGIN_PATH}`;

  return Object.freeze({
    loginUrl,
    async currentUser() {
      const result = await catalyst?.auth?.isUserAuthenticated?.();
      return result?.content ?? null;
    },
    signOut() {
      if (typeof catalyst?.auth?.signOut === 'function') {
        catalyst.auth.signOut(loginUrl.startsWith('http') ? loginUrl : `${location.origin}${loginUrl}`);
        return;
      }
      location.assign(loginUrl);
    },
  });
}

export const catalystAuth = createCatalystAuth();
