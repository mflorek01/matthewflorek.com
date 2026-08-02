export class CsrfError extends Error {
  constructor(message = 'Request origin could not be verified') {
    super(message);
    this.name = 'CsrfError';
  }
}

function firstForwardedValue(value: string | null) {
  return value?.split(',')[0]?.trim() || null;
}

function requestOrigin(request: Request) {
  const internalUrl = new URL(request.url);
  const forwardedProto = firstForwardedValue(request.headers.get('x-forwarded-proto'));
  const forwardedHost = firstForwardedValue(request.headers.get('x-forwarded-host'));
  if (!forwardedProto && !forwardedHost) return internalUrl.origin;

  const protocol = forwardedProto ?? internalUrl.protocol.replace(/:$/, '');
  const host = forwardedHost ?? internalUrl.host;
  return `${protocol}://${host}`;
}

export function assertSameOrigin(request: Request) {
  const expected = requestOrigin(request);
  const origin = request.headers.get('origin');
  if (origin) {
    if (origin !== expected) throw new CsrfError();
    return;
  }

  const referer = request.headers.get('referer');
  if (referer && new URL(referer).origin !== expected) throw new CsrfError();
  if (!referer) throw new CsrfError('Missing origin for state-changing request');
}
