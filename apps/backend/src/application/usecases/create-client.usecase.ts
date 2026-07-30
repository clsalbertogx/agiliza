import { Either, success, failure } from '../types/either';
import { ApplicationError } from '../errors/application.error';
import { ClientRepositoryPort } from '../ports/repositories/client.repository.port';
import { EventBusPort } from '../ports/adapters/event-bus.port';
import { Client, createClient, MessageChannel, RiskScore } from '../../domain/entities/client';
import { Phone } from '../../domain/value-objects/phone';
import { Email } from '../../domain/value-objects/email';
import { createDomainEvent } from '../../domain/events/domain-events';

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

    const client = createClient({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      name: input.name,
      phone: phoneVO.value(),
      email: emailVO?.value(),
      preferredChannel: channelMap[input.preferredChannel || 'whatsapp'] || MessageChannel.WHATSAPP,
      preferredLeadDays: input.preferredLeadDays || 3,
      riskScore: RiskScore.GREEN,
      totalInvoices: 0,
      paidInvoices: 0,
    });

    // 5. Save
    let saved: Client;
    try {
      saved = await this.clientRepo.create(client);
    } catch (error) {
      return failure(new ApplicationError((error as Error).message, 'INTERNAL_ERROR', 500));
    }

    // 6. Publish event
    const event = createDomainEvent('client.created', {
      clientId: saved.id,
      tenantId: input.tenantId,
      metadata: { name: saved.name, phone: saved.phone },
    });
    this.eventBus.publish(event);

    return success(saved);
  }
}