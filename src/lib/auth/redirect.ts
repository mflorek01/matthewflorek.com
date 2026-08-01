export function safeAdminRedirect(value: string | null | undefined, fallback = '/admin') {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;
  try {
    const parsed = new URL(value, 'https://portfolio.invalid');
    if (parsed.origin !== 'https://portfolio.invalid') return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
