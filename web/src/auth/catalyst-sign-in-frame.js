export const CATALYST_AUTH_ORIGIN = 'https://accounts.zohoportal.in';

export function normalizeCatalystSignInUrl(source, {
  applicationOrigin = globalThis.location?.origin,
  authOrigin = CATALYST_AUTH_ORIGIN,
} = {}) {
  try {
    const url = new URL(source);
    if (url.origin !== applicationOrigin || !url.pathname.startsWith('/accounts/')) return source;
    const destination = new URL(authOrigin);
    url.protocol = destination.protocol;
    url.hostname = destination.hostname;
    url.port = destination.port;
    return url.href;
  } catch {
    return source;
  }
}

export function normalizeCatalystSignInFrame(frame, options) {
  const normalized = normalizeCatalystSignInUrl(frame?.src, options);
  if (frame && normalized && normalized !== frame.src) frame.src = normalized;
  return normalized;
}
