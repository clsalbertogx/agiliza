import { afterEach, describe, expect, it } from 'vitest';
import { createEvolutionMessageProvider } from '@/presentation/factories/create-evolution-message-provider.factory';

/**
 * S3 — outbound credential hardening: the Evolution API key must never be
 * defaulted to a hardcoded dev value. If EVOLUTION_API_URL is configured but
 * EVOLUTION_API_KEY is missing, the factory must fail fast (throw) instead of
 * silently sending unauthenticated messages.
 */

describe('createEvolutionMessageProvider (S3)', () => {
  const previousUrl = process.env.EVOLUTION_API_URL;
  const previousKey = process.env.EVOLUTION_API_KEY;

  afterEach(() => {
    if (previousUrl === undefined) delete process.env.EVOLUTION_API_URL;
    else process.env.EVOLUTION_API_URL = previousUrl;
    if (previousKey === undefined) delete process.env.EVOLUTION_API_KEY;
    else process.env.EVOLUTION_API_KEY = previousKey;
  });

  it('throws when EVOLUTION_API_URL is set but EVOLUTION_API_KEY is missing', () => {
    process.env.EVOLUTION_API_URL = 'http://evolution:8080';
    delete process.env.EVOLUTION_API_KEY;

    expect(() => createEvolutionMessageProvider()).toThrow(/EVOLUTION_API_KEY/);
  });

  it('throws when the key would fall back to a hardcoded dev default', () => {
    // If a dev-key default ever creeps back in, this test must catch it.
    process.env.EVOLUTION_API_URL = 'http://evolution:8080';
    delete process.env.EVOLUTION_API_KEY;

    let created = false;
    try {
      const provider = createEvolutionMessageProvider();
      created = provider !== null;
    } catch {
      created = false;
    }
    expect(created).toBe(false);
  });

  it('returns a provider when EVOLUTION_API_KEY is configured', () => {
    process.env.EVOLUTION_API_URL = 'http://evolution:8080';
    process.env.EVOLUTION_API_KEY = 'evolution-secret-key';

    const provider = createEvolutionMessageProvider();
    expect(provider).toBeDefined();
    expect(typeof provider.sendText).toBe('function');
    expect(typeof provider.sendTemplate).toBe('function');
  });
});
