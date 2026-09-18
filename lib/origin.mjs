const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Validate the browser origin without trusting forwarded-host headers. */
export function isAllowedOrigin(request, { appOrigin = '', production = false } = {}) {
  const origin = request.headers.get('origin');
  if (!origin || origin === 'null') return false;
  try {
    const internalUrl = new URL(request.url);
    let expected = appOrigin.trim() ? new URL(appOrigin.trim()).origin : internalUrl.origin;
    // Next dev can normalize request.url to localhost although the browser used
    // 127.0.0.1. Only in development, use the actual Host for loopback requests
    // on the same protocol and port. Arbitrary/forwarded hosts stay untrusted.
    if (!appOrigin.trim() && !production && loopbackHosts.has(internalUrl.hostname)) {
      const host = request.headers.get('host');
      if (host) {
        const browserUrl = new URL(`${internalUrl.protocol}//${host}`);
        if (browserUrl.host === host.toLowerCase() && loopbackHosts.has(browserUrl.hostname) && browserUrl.port === internalUrl.port) {
          expected = browserUrl.origin;
        }
      }
    }
    return origin === expected;
  } catch {
    return false;
  }
}
