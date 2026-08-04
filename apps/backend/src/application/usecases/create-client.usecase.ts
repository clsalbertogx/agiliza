import { ApplicationError } from '@/application/errors/application.error';
import type { EventBusPort } from '@/application/ports/adapters/event-bus.port';
import type { ClientRepositoryPort } from '@/application/ports/repositories/client.repository.port';
import { type Either, failure, success } from '@/application/types/either';
import { type Client, createClient, MessageChannel } from '@/domain/entities/client';
import { createDomainEvent } from '@/domain/events/domain-events';
import type { IdGeneratorPort } from '@/domain/ports/id-generator.port';
import { Email } from '@/domain/value-objects/email';
import { Phone } from '@/domain/value-objects/phone';

export interface CreateClientInput {
  tenantId: string;
  name: string;
  phone: string;
  email?: string;
  preferredChannel?: 'whatsapp' | 'sms' | 'email';
  preferredLeadDays?: number;
}

export class CreateClientUseCase {
  constructor(
    private readonly clientRepo: ClientRepositoryPort,
    private readonly eventBus: EventBusPort,
    private readonly idGenerator: IdGeneratorPort,
  ) {}

  async execute(input: CreateClientInput): Promise<Either<ApplicationError, Client>> {
    // 1. Validate phone format via VO
    let phoneVO: Phone;
    try {
      phoneVO = Phone.create(input.phone);
    } catch (error) {
      return failure(new ApplicationError((error as Error).message, 'INVALID_PHONE', 400));
    }

    // 2. Validate email if provided
    let emailVO: Email | undefined;
    if (input.email !== undefined) {
      try {
        emailVO = Email.create(input.email);
      } catch (error) {
        return failure(new ApplicationError((error as Error).message, 'INVALID_EMAIL', 400));
      }
    }

    // 3. Check for duplicate phone in tenant
    const existing = await this.clientRepo.findByPhone(phoneVO.value(), input.tenantId);
    if (existing) {
      return failure(new ApplicationError('Client with this phone already exists', 'CONFLICT', 409));
    }

    // 4. Create Client entity
    const channelMap: Record<string, MessageChannel> = {
      whatsapp: MessageChannel.WHATSAPP,
      sms: MessageChannel.SMS,
      email: MessageChannel.EMAIL,
    };

    const clientResult = createClient({
      id: this.idGenerator.generate(),
      tenantId: input.tenantId,
      name: input.name,
      phone: phoneVO.value(),
      email: emailVO?.value(),
      preferredChannel: channelMap[input.preferredChannel || 'whatsapp'] || MessageChannel.WHATSAPP,
      preferredLeadDays: input.preferredLeadDays || 3,
    });

    if (!clientResult.success) {
      return failure(new ApplicationError(clientResult.value.message, 'INVALID_CLIENT', 400));
    }

    // 5. Save
    let saved: Client;
    try {
      saved = await this.clientRepo.create(clientResult.value);
    } catch (error) {
      return failure(new ApplicationError((error as Error).message, 'INTERNAL_ERROR', 500));
    }

    // 6. Publish event
    const event = createDomainEvent(
      'client.created',
      {
        clientId: saved.id,
        tenantId: input.tenantId,
        metadata: { name: saved.name, phone: saved.phone },
      },
      this.idGenerator.generate(),
    );
    this.eventBus.publish(event);

    return success(saved);
  }
}
