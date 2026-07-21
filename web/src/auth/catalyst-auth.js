const LOGIN_PATH = '/__catalyst/auth/login';

export function loadCatalystInit(document = globalThis.document) {
  if (!document || document.querySelector('script[data-catalyst-init]')) return;
  const script = document.createElement('script');
  script.src = '/__catalyst/sdk/init.js';
  script.dataset.catalystInit = 'true';
  document.head.append(script);
}

export function createCatalystAuth({
  catalyst = globalThis.catalyst,
  location = globalThis.location,
} = {}) {
  const loginUrl = LOGIN_PATH;

  return Object.freeze({
    loginUrl,
    async currentUser() {
      const result = await catalyst?.auth?.isUserAuthenticated?.();
      return result?.content ?? null;
    },
    signOut() {
      if (typeof catalyst?.auth?.signOut === 'function') {
        catalyst.auth.signOut(`${location.origin}${LOGIN_PATH}`);
        return;
      }
      location.assign(LOGIN_PATH);
    },
  });
}

export const catalystAuth = createCatalystAuth();
