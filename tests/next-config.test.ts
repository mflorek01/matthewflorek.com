import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';

function readConfiguredOutput() {
  const script = "const config = (await import('./next.config.mjs')).default; process.stdout.write(config.output ?? 'standard');";
  return execFileSync(process.execPath, ['--input-type=module', '-e', script], { cwd: process.cwd(), encoding: 'utf8' }).trim();
}

afterEach(() => vi.unstubAllEnvs());

describe('Next build output mode', () => {
  it('uses standard output for ordinary local builds', () => {
    vi.stubEnv('NEXT_STANDALONE', undefined);
    expect(readConfiguredOutput()).toBe('standard');
  });

  it('enables standalone output only when the container opts in', () => {
    vi.stubEnv('NEXT_STANDALONE', 'true');
    expect(readConfiguredOutput()).toBe('standalone');
  });
});
