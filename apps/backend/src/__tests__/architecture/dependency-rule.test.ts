import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A1 — Structural contract test for the Clean Architecture Dependency Rule.
 *
 * The Application layer must depend ONLY on Domain and its own Ports.
 * It must NEVER import from Infrastructure.
 *
 * This test asserts that NO file under src/application/ imports from @/infrastructure.
 */
function listTsFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return listTsFiles(full);
    return full.endsWith('.ts') ? [full] : [];
  });
}

const APPLICATION_ROOT = join(__dirname, '../../application');

describe('A1 — Dependency Rule', () => {
  it('no application file imports from @/infrastructure', () => {
    const offenders = listTsFiles(APPLICATION_ROOT)
      .map((file) => ({ file, content: readFileSync(file, 'utf8') }))
      .filter(({ content }) => content.includes('@/infrastructure'))
      .map(({ file }) => file.replace(`${APPLICATION_ROOT}/`, ''));

    expect(offenders).toEqual([]);
  });
});
