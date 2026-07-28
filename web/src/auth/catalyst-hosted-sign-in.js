export const CATALYST_AUTH_ORIGIN = 'https://accounts.zohoportal.in';

export function toCatalystHostedSignInUrl(source, {
  applicationOrigin = globalThis.location?.origin,
  authOrigin = CATALYST_AUTH_ORIGIN,
} = {}) {
  try {
    const url = new URL(source);
    if (url.origin !== applicationOrigin || !url.pathname.startsWith('/accounts/p/')) return null;

    const destination = new URL(authOrigin);
    url.protocol = destination.protocol;
    url.hostname = destination.hostname;
    url.port = destination.port;
    return url.href;
  } catch {
    return null;
  }
}
