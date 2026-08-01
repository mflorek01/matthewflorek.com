import { timingSafeEqual } from 'node:crypto';
import { getAiConfig } from './config';

export function isAiAdminAuthorized(value: string | null) {
  const expected = getAiConfig().adminToken;
  if (!expected || !value) return false;
  const supplied = Buffer.from(value);
  const configured = Buffer.from(expected);
  return supplied.length === configured.length && timingSafeEqual(supplied, configured);
}
