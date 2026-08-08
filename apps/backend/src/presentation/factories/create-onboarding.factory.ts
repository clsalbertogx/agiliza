import { OnboardingService } from '@/application/services/onboarding.service';
import { PrismaClientRepository } from '@/infrastructure/database/repositories/client.repository';
import { PrismaEventRepository } from '@/infrastructure/database/repositories/event.repository';
import { UuidV7Generator } from '@/infrastructure/uuid/uuid-v7-generator';
import { createEvolutionMessageProvider } from './create-evolution-message-provider.factory';

export function createOnboardingService(): OnboardingService {
  const clientRepo = new PrismaClientRepository();
  const eventRepo = new PrismaEventRepository();
  // S3: throws when EVOLUTION_API_KEY is missing — never defaults a credential.
  const messageProvider = createEvolutionMessageProvider();

  return new OnboardingService(clientRepo, eventRepo, messageProvider, new UuidV7Generator());
}
