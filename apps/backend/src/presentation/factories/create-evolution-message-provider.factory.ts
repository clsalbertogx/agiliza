import { EvolutionMessageProvider } from '@/infrastructure/messaging/evolution/evolution-message.provider';

/**
 * Factory for EvolutionMessageProvider with fail-closed credential handling
 * (S3). The API key must NEVER be defaulted to a hardcoded dev value — if
 * EVOLUTION_API_URL is configured but EVOLUTION_API_KEY is missing, we throw
 * so the misconfiguration surfaces immediately instead of silently sending
 * (or failing to send) unauthenticated WhatsApp messages.
 */
export function createEvolutionMessageProvider(): EvolutionMessageProvider {
  const baseUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
  const apiKey = process.env.EVOLUTION_API_KEY;

  if (!apiKey) {
    throw new Error(
      'EVOLUTION_API_KEY is required when EVOLUTION_API_URL is configured. ' +
        'Set it in .env to enable WhatsApp messaging (S3).',
    );
  }

  return new EvolutionMessageProvider({
    baseUrl,
    apiKey,
    instanceName: 'agiliza',
  });
}
