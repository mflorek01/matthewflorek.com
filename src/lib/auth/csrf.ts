export class CsrfError extends Error {
  constructor(message = 'Request origin could not be verified') {
    super(message);
    this.name = 'CsrfError';
  }
}

export function assertSameOrigin(request: Request) {
  const expected = new URL(request.url).origin;
  const origin = request.headers.get('origin');
  if (origin) {
    if (origin !== expected) throw new CsrfError();
    return;
  }

  const referer = request.headers.get('referer');
  if (referer && new URL(referer).origin !== expected) throw new CsrfError();
  if (!referer) throw new CsrfError('Missing origin for state-changing request');
}

