import { OnboardingService } from '@/application/services/onboarding.service';
import { PrismaClientRepository } from '@/infrastructure/database/repositories/client.repository';
import { PrismaEventRepository } from '@/infrastructure/database/repositories/event.repository';
import { EvolutionMessageProvider } from '@/infrastructure/messaging/evolution/evolution-message.provider';

export function createOnboardingService(): OnboardingService {
  const clientRepo = new PrismaClientRepository();
  const eventRepo = new PrismaEventRepository();
  const messageProvider = new EvolutionMessageProvider({
    baseUrl: process.env.EVOLUTION_API_URL || 'http://localhost:8080',
    apiKey: process.env.EVOLUTION_API_KEY || 'dev-key',
    instanceName: 'agiliza',
  });

  return new OnboardingService(clientRepo, eventRepo, messageProvider);
}
