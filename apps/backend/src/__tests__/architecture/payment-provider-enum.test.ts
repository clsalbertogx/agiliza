import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A3 — Structural contract test for the PaymentProvider enum.
 *
 * There must be exactly ONE PaymentProvider definition in the whole backend,
 * located in `domain/contracts/enums.ts` (the canonical wire format), using
 * LOWERCASE values ('asaas', 'mercadopago', ...). Domain entities import from
 * there; the dead value-object duplicate and the entity-local UPPERCASE enums
 * must not exist.
 */
function readDomainFile(relative: string): { file: string; content: string } {
  try {
    return { file: relative, content: readFileSync(join(__dirname, '../../domain', relative), 'utf8') };
  } catch {
    // File removed entirely — contributes no enum declaration. Consistent with the
    // 'the dead value-object duplicate is removed' test below.
    return { file: relative, content: '' };
  }
}

describe('A3 — PaymentProvider canonical definition', () => {
  it('only the canonical enum in domain/contracts/enums.ts declares PaymentProvider', () => {
    const candidates = [
      readDomainFile('contracts/enums.ts'),
      readDomainFile('value-objects/payment-provider.ts'),
      readDomainFile('entities/payment.ts'),
      readDomainFile('entities/tenant.ts'),
    ];
    const declarations = candidates.filter(({ content }) => /export enum PaymentProvider/.test(content));

    expect(declarations).toHaveLength(1);
    expect(declarations[0].file).toBe('contracts/enums.ts');
  });

  it('the canonical enum uses lowercase wire values (matching payment_provider_configs)', () => {
    const { content } = readDomainFile('contracts/enums.ts');
    const block = content.match(/export enum PaymentProvider \{([^}]+)\}/);
    expect(block).not.toBeNull();

    const values = [...(block?.[1]?.matchAll(/=\s*'([^']+)'/g) ?? [])].map((match) => match[1]);
    expect(values).toEqual(['asaas', 'mercadopago', 'stripe', 'pagbank', 'polar']);
    expect(values.every((value) => value === value.toLowerCase())).toBe(true);
  });

  it('the dead value-object duplicate is removed', () => {
    let exists = true;
    let content = '';
    try {
      content = readFileSync(join(__dirname, '../../domain/value-objects/payment-provider.ts'), 'utf8');
    } catch {
      // File removed entirely — acceptable.
      exists = false;
    }

    if (exists) {
      expect(/export enum PaymentProvider/.test(content)).toBe(false);
    }
  });
});
