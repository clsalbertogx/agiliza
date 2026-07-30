# Spec: Clean Architecture Refactor — Domain/Application/Infrastructure Separation

## Contexto de Negócio

O código atual do backend `agiliza` viola sistematicamente a **Clean Architecture** (Dependency Rule): a camada **Domain** importa de `infrastructure`, a camada **Application** importa de `infrastructure`, e a camada **Presentation** (routes) instancia repositórios e factories de pagamento diretamente. Isso impede testes isolados, troca de provedores (Strategy Pattern) e desacoplamento de eventos de domínio (Observer Pattern).

Esta Spec define os contratos binários entre as 4 camadas para que `qa-engineer` e `fullstack-engineer` possam implementar sem ambiguidade.

---

## Escopo

### Incluído
- Refatoração completa da **Domain Layer**: Entities como classes com VOs, DomainError, Domain Events como classes, IdGeneratorPort no domínio
- Refatoração completa da **Application Layer**: Use Cases com Either, Ports (Gateways/Adapters), UnitOfWork, EventBusPort
- Refatoração da **Infrastructure Layer**: Repositórios Prisma implementando Ports, Strategy Pattern para PaymentGateway, Observer Pattern para Domain Events, UnitOfWork com AsyncLocalStorage
- Refatoração da **Presentation Layer**: Factories singleton, Handlers com Either, Error mapping, Rotas delegando para factories
- Definição explícita de **Strategy Pattern** para PaymentGateway (um provedor por projeto: Asaas)
- Definição explícita de **Observer Pattern** via Domain Events + EventBusPort

### Fora de Escopo
- Migração de banco de dados (Prisma schema permanece)
- Implementação de outros gateways de pagamento (Mercado Pago, PagBank, Polar, Stripe) — apenas Asaas nesta Spec
- Testes de integração E2E (cobertos pelo `qa-engineer` em Spec separada)
- Frontend / mobile

---

## Critérios de Aceitação (ACs)

| ID | Critério | Mensurável |
|----|----------|------------|
| AC1 | **Domain Layer** não importa nada de `application/`, `infrastructure/`, `presentation/` | `grep -r "from '@/infrastructure" apps/backend/src/domain` → 0 resultados |
| AC2 | **Domain Layer** não importa nada de `application/` | `grep -r "from '@/application" apps/backend/src/domain` → 0 resultados |
| AC3 | **Application Layer** não importa nada de `infrastructure/`, `presentation/` | `grep -r "from '@/infrastructure" apps/backend/src/application` → 0 resultados |
| AC4 | **Application Layer** não importa nada de `presentation/` | `grep -r "from '@/presentation" apps/backend/src/application` → 0 resultados |
| AC5 | **Presentation Layer** (routes/handlers) não instancia repositórios diretamente | `grep -r "new Prisma.*Repository" apps/backend/src/routes` → 0 resultados |
| AC6 | **Presentation Layer** não usa `PaymentProviderFactory` diretamente | `grep -r "PaymentProviderFactory" apps/backend/src/routes` → 0 resultados |
| AC7 | **Use Cases** retornam `Either<ApplicationError \| DomainError, Output>` | Todos os use cases existentes e novos seguem a assinatura |
| AC8 | **Entities** são classes com construtor privado + `static create()` / `static instance()`, props protegidas, VOs no construtor | `Client`, `Invoice`, `Tenant`, `Payment` são classes, não Zod schemas |
| AC9 | **Value Objects** validam no construtor privado + `static create()`, têm `value()` e `formatted()` | `Phone`, `Email`, `Money`, `TaxId`, `RiskScore` são VOs |
| AC10 | **Domain Events** são classes imutáveis com `eventId`, `occurredAt`, `eventType`, payload tipado | `PaymentConfirmedEvent`, `InvoiceCreatedEvent`, etc. |
| AC11 | **EventBusPort** na Application define `publish(event)` e `subscribe(type, handler)` | Interface existe em `application/ports/adapters/event-bus.port.ts` |
| AC12 | **PaymentGatewayPort** na Application define `createPixCharge`, `getCharge`, `cancelCharge`, `handleWebhook` | Interface existe em `application/ports/gateways/payment-gateway.port.ts` |
| AC13 | **Strategy Pattern**: `AsaasPaymentGateway` implementa `PaymentGatewayPort`; **nenhum `switch`/`if` por provedor no Use Case** | `PaymentProviderFactory` removido; binding na factory da Presentation |
| AC14 | **Observer Pattern**: Use Cases publicam `DomainEvent` via `EventBusPort`; handlers na Infrastructure assinam via `subscribe()` | `CreateInvoiceUseCase` publica `InvoiceCreatedEvent`; `SendReceiptHandler` assina |
| AC15 | **UnitOfWorkPort** na Application define `run<T>(fn: () => Promise<T>): Promise<T>` | Interface existe em `application/ports/adapters/unit-of-work.port.ts` |
| AC16 | **Repositories** implementam Ports da Application; usam `getTransaction()` do AsyncLocalStorage | `PrismaClientRepository`, `PrismaInvoiceRepository`, `PrismaTenantRepository` |
| AC17 | **Factories** na Presentation são singletons (criam dependências uma vez) | `createCreateClientUseCase`, `createCreateInvoiceUseCase`, etc. |
| AC18 | **Handlers** (routes) usam Zod para validar input, chamam Use Case, mapeiam Either → HTTP | Todos os handlers seguem o padrão |
| AC19 | **Error Mapping**: `DomainError` → 422, `ApplicationError(code)` → 409/404/400/403, desconhecido → 500 | Mapeamento centralizado em `presentation/handler.ts` |
| AC20 | **IdGeneratorPort** no Domain; `UuidV7Generator` na Infrastructure implementa | Interface em `domain/ports/id-generator.port.ts` |

---

## Contratos entre Camadas

### Domain Layer (`apps/backend/src/domain/`)

#### Entities (classes, não Zod schemas)

```typescript
// domain/entities/client.ts
export class Client extends Entity<ClientProps> {
  private constructor(props: ClientProps, id?: string) { super(props, id); }
  static create(props: CreateClientProps): Either<DomainError, Client> { ... }
  static instance(props: ClientProps, id: string): Client { ... }
  get name(): string { return this.props.name; }
  get phone(): Phone { return this.props.phone; }
  get email(): Email | undefined { return this.props.email; }
  // ... getters para preferredChannel, riskScore, etc.
  value(): PersistenceClient { ... } // para repositório
  formatted(): ClientViewModel { ... } // para resposta HTTP
}

export interface ClientProps {
  tenantId: string;
  name: string;
  phone: Phone;
  email?: Email;
  document?: TaxId;
  preferredChannel: MessageChannel;
  preferredLeadDays: number;
  riskScore: RiskScore;
  totalInvoices: number;
  paidInvoices: number;
  avgPaymentDelay: number | null;
}
```

```typescript
// domain/entities/invoice.ts
export class Invoice extends Entity<InvoiceProps> {
  private constructor(props: InvoiceProps, id?: string) { super(props, id); }
  static create(props: CreateInvoiceProps): Either<DomainError, Invoice> { ... }
  static instance(props: InvoiceProps, id: string): Invoice { ... }
  get amount(): Money { return this.props.amount; }
  get dueDate(): Date { return this.props.dueDate; }
  get status(): InvoiceStatus { return this.props.status; }
  // métodos de domínio: markAsPaid(), cancel(), isOverdue()
  value(): PersistenceInvoice { ... }
  formatted(): InvoiceViewModel { ... }
}
```

```typescript
// domain/entities/tenant.ts
export class Tenant extends Entity<TenantProps> {
  private constructor(props: TenantProps, id?: string) { super(props, id); }
  static create(props: CreateTenantProps): Either<DomainError, Tenant> { ... }
  static instance(props: TenantProps, id: string): Tenant { ... }
  get paymentProvider(): PaymentProvider { return this.props.paymentProvider; }
  // ...
}
```

```typescript
// domain/entities/payment.ts
export class Payment extends Entity<PaymentProps> {
  private constructor(props: PaymentProps, id?: string) { super(props, id); }
  static create(props: CreatePaymentProps): Either<DomainError, Payment> { ... }
  static instance(props: PaymentProps, id: string): Payment { ... }
  confirm(externalId: string, paidAt: Date): Either<DomainError, void> { ... }
  fail(reason: string): Either<DomainError, void> { ... }
}
```

#### Value Objects

```typescript
// domain/value-objects/phone.ts
export class Phone { private constructor(v: string) {...} static create(v: string): Phone {...} value(): string {...} formatted(): string {...} }

// domain/value-objects/email.ts
export class Email { private constructor(v: string) {...} static create(v: string): Email {...} value(): string {...} get domain(): string {...} }

// domain/value-objects/money.ts
export class Money { private constructor(v: number) {...} static create(v: number): Money {...} static ZERO(): Money {...} value(): number {...} add(other): Money {...} toBRL(): string {...} }

// domain/value-objects/tax-id.ts (CNPJ/CPF)
export class TaxId { private constructor(v: string) {...} static create(v: string): TaxId {...} value(): string {...} formatted(): string {...} }

// domain/value-objects/risk-score.ts
export class RiskScore { private constructor(v: RiskLevel) {...} static create(v: RiskLevel): RiskScore {...} value(): RiskLevel {...} }
```

#### Domain Errors

```typescript
// domain/errors/domain-error.ts
export class DomainError extends Error {
  constructor(message: string) { super(message); this.name = 'DomainError'; }
}
```

#### Domain Events (Classes imutáveis)

```typescript
// domain/events/payment-confirmed.event.ts
export class PaymentConfirmedEvent {
  readonly eventId: string;
  readonly eventType = 'payment.confirmed' as const;
  readonly occurredAt: Date;
  readonly payload: PaymentConfirmedPayload;
  constructor(payload: PaymentConfirmedPayload) { ... }
}

export interface PaymentConfirmedPayload {
  paymentId: string;
  invoiceId: string;
  clientId: string;
  tenantId: string;
  amount: number;
  paidAt: string;
  provider: PaymentProvider;
}

// domain/events/invoice-created.event.ts
export class InvoiceCreatedEvent { ... }

// domain/events/client-created.event.ts
export class ClientCreatedEvent { ... }

// domain/events/domain-event.ts (base)
export interface DomainEvent {
  eventId: string;
  eventType: string;
  occurredAt: Date;
}
```

#### Ports no Domain

```typescript
// domain/ports/id-generator.port.ts
export interface IdGeneratorPort {
  generate(): string;
  validate(id: string): boolean;
}
```

---

### Application Layer (`apps/backend/src/application/`)

#### Types

```typescript
// application/types/either.ts
export type Either<L, R> = { success: true; value: R } | { success: false; value: L };
export const success = <R>(v: R) => ({ success: true, value: v } as const);
export const failure = <L>(v: L) => ({ success: false, value: v } as const);
```

```typescript
// application/errors/application-error.ts
export class ApplicationError extends Error {
  constructor(message: string, public readonly code: string, public readonly statusCode: number = 400) {
    super(message); this.name = 'ApplicationError';
  }
  static conflict(msg: string) { return new ApplicationError(msg, 'CONFLICT', 409); }
  static notFound(msg: string) { return new ApplicationError(msg, 'NOT_FOUND', 404); }
  static forbidden(msg: string) { return new ApplicationError(msg, 'FORBIDDEN', 403); }
  static validation(msg: string) { return new ApplicationError(msg, 'VALIDATION_ERROR', 400); }
  static internal(msg: string) { return new ApplicationError(msg, 'INTERNAL_ERROR', 500); }
}
```

#### Ports (Interfaces que a Infrastructure implementa)

```typescript
// application/ports/repositories/client.repository.port.ts
export interface ClientRepositoryPort {
  findById(id: string): Promise<Client | null>;
  findByPhone(phone: string, tenantId: string): Promise<Client | null>;
  findMany(params: { tenantId: string; page?: number; limit?: number; search?: string; status?: string }): Promise<{ data: Client[]; total: number }>;
  create(client: Client): Promise<Client>;
  update(client: Client): Promise<Client>;
  delete(id: string): Promise<void>;
  count(tenantId: string): Promise<number>;
  updateRiskScore(id: string, riskScore: RiskScore, reason?: string): Promise<void>;
}
```

```typescript
// application/ports/repositories/invoice.repository.port.ts
export interface InvoiceRepositoryPort {
  findById(id: string): Promise<Invoice | null>;
  findMany(params: { tenantId: string; page?: number; limit?: number; status?: string; clientId?: string; startDate?: Date; endDate?: Date }): Promise<{ data: Invoice[]; total: number }>;
  create(invoice: Invoice): Promise<Invoice>;
  update(invoice: Invoice): Promise<Invoice>;
  delete(id: string): Promise<void>;
  count(tenantId: string): Promise<number>;
  getStats(tenantId: string): Promise<InvoiceStats>;
  findOverdue(tenantId: string): Promise<Invoice[]>;
}
```

```typescript
// application/ports/repositories/tenant.repository.port.ts
export interface TenantRepositoryPort {
  findById(id: string): Promise<Tenant | null>;
  findBySlug(slug: string): Promise<Tenant | null>;
  findByEmail(email: string): Promise<Tenant | null>;
  findMany(params: { page?: number; limit?: number; search?: string }): Promise<{ data: Tenant[]; total: number }>;
  create(tenant: Tenant): Promise<Tenant>;
  update(tenant: Tenant): Promise<Tenant>;
  delete(id: string): Promise<void>;
  count(): Promise<number>;
}
```

```typescript
// application/ports/gateways/payment-gateway.port.ts
export interface PaymentGatewayPort {
  createPixCharge(input: CreatePixChargeInput): Promise<Either<ApplicationError, PixChargeResponse>>;
  getCharge(providerPaymentId: string): Promise<Either<ApplicationError, PixChargeResponse>>;
  cancelCharge(providerPaymentId: string): Promise<Either<ApplicationError, void>>;
  handleWebhook(payload: unknown): Either<ApplicationError, WebhookResult>;
}

export interface CreatePixChargeInput {
  amount: number;
  description: string;
  customerId?: string;
  externalReference?: string;
}

export interface PixChargeResponse {
  id: string;
  qrCode: string;
  copyPaste: string;
  expiresAt: Date;
  status: string;
}

export interface WebhookResult {
  event: string;
  paymentId: string;
  status: string;
  metadata: Record<string, unknown>;
}
```

```typescript
// application/ports/gateways/webhook-verifier.port.ts
export interface WebhookVerifierPort {
  verify(provider: string, payload: string, signature: string, tenantId: string): Promise<Either<ApplicationError, boolean>>;
}
```

```typescript
// application/ports/adapters/event-bus.port.ts
import type { DomainEvent } from '@/domain/events/domain-event';

export interface EventBusPort {
  publish(event: DomainEvent): void;
  subscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>): void;
}
```

```typescript
// application/ports/adapters/unit-of-work.port.ts
export interface UnitOfWorkPort {
  run<T>(fn: () => Promise<T>): Promise<T>;
}
```

```typescript
// application/ports/adapters/id-generator.port.ts (re-export do domain)
export { IdGeneratorPort } from '@/domain/ports/id-generator.port';
```

#### Use Cases (Interfaces + Implementações)

```typescript
// application/usecases/create-client.usecase.ts
export interface CreateClientInput {
  tenantId: string;
  name: string;
  phone: string;
  email?: string;
  document?: string;
  preferredChannel?: 'whatsapp' | 'sms' | 'email';
  preferredLeadDays?: number;
}

export interface CreateClientOutput {
  client: Client;
}

export class CreateClientUseCase implements Usecase<CreateClientInput, CreateClientOutput> {
  constructor(
    private readonly clientRepo: ClientRepositoryPort,
    private readonly eventBus: EventBusPort,
    private readonly idGenerator: IdGeneratorPort,
  ) {}

  async execute(input: CreateClientInput): Promise<Either<ApplicationError | DomainError, CreateClientOutput>> {
    // 1. VOs validam formato
    // 2. Verifica duplicidade via repo
    // 3. Client.create() retorna Either<DomainError, Client>
    // 4. Repo.create()
    // 5. EventBus.publish(new ClientCreatedEvent(...))
    // 6. return success({ client })
  }
}
```

```typescript
// application/usecases/create-invoice.usecase.ts
export interface CreateInvoiceInput {
  tenantId: string;
  clientId: string;
  amount: number;
  dueDate: Date;
  description?: string;
}

export interface CreateInvoiceOutput {
  invoice: Invoice;
}

export class CreateInvoiceUseCase implements Usecase<CreateInvoiceInput, CreateInvoiceOutput> {
  constructor(
    private readonly invoiceRepo: InvoiceRepositoryPort,
    private readonly clientRepo: ClientRepositoryPort,
    private readonly eventBus: EventBusPort,
    private readonly idGenerator: IdGeneratorPort,
  ) {}

  async execute(input: CreateInvoiceInput): Promise<Either<ApplicationError | DomainError, CreateInvoiceOutput>> {
    // 1. Valida cliente existe e pertence ao tenant
    // 2. Money.create(amount)
    // 3. Invoice.create() → Either<DomainError, Invoice>
    // 4. Repo.create()
    // 5. EventBus.publish(new InvoiceCreatedEvent(...))
    // 6. return success({ invoice })
  }
}
```

```typescript
// application/usecases/process-payment-webhook.usecase.ts
export interface ProcessPaymentWebhookInput {
  provider: string;
  payload: unknown;
  signature: string;
  tenantId: string;
}

export class ProcessPaymentWebhookUseCase implements Usecase<ProcessPaymentWebhookInput, void> {
  constructor(
    private readonly paymentGateway: PaymentGatewayPort,
    private readonly webhookVerifier: WebhookVerifierPort,
    private readonly invoiceRepo: InvoiceRepositoryPort,
    private readonly eventBus: EventBusPort,
    private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(input: ProcessPaymentWebhookInput): Promise<Either<ApplicationError, void>> {
    // 1. webhookVerifier.verify()
    // 2. paymentGateway.handleWebhook() → WebhookResult
    // 3. Se payment.confirmed: uow.run(() => { invoice.markAsPaid(...); repo.update(invoice); eventBus.publish(new PaymentConfirmedEvent(...)) })
    // 4. return success(undefined)
  }
}
```

```typescript
// application/usecases/create-pix-charge.usecase.ts
export interface CreatePixChargeInput {
  tenantId: string;
  invoiceId: string;
}

export interface CreatePixChargeOutput {
  qrCode: string;
  copyPaste: string;
  expiresAt: Date;
  providerPaymentId: string;
}

export class CreatePixChargeUseCase implements Usecase<CreatePixChargeInput, CreatePixChargeOutput> {
  constructor(
    private readonly invoiceRepo: InvoiceRepositoryPort,
    private readonly paymentGateway: PaymentGatewayPort,
    private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(input: CreatePixChargeInput): Promise<Either<ApplicationError, CreatePixChargeOutput>> {
    // 1. Busca invoice
    // 2. paymentGateway.createPixCharge({ amount: invoice.amount.value(), description, externalReference: invoice.id })
    // 3. Atualiza invoice com pixQRCode, pixCopyPaste, pixExpiresAt, externalPaymentId
    // 4. Repo.update(invoice)
    // 5. return success({ qrCode, copyPaste, expiresAt, providerPaymentId })
  }
}
```

---

### Infrastructure Layer (`apps/backend/src/infrastructure/`)

#### Repositories (implementam Ports da Application)

```typescript
// infrastructure/database/repositories/prisma-client-repository.ts
export class PrismaClientRepository implements ClientRepositoryPort {
  private prisma = getPrismaClient();
  private mapper = new ClientMapper();

  async findById(id: string): Promise<Client | null> {
    const row = await this.prisma.client.findUnique({ where: { id } });
    return row ? this.mapper.toDomain(row) : null;
  }

  async findByPhone(phone: string, tenantId: string): Promise<Client | null> {
    const row = await this.prisma.client.findFirst({ where: { tenantId, phone } });
    return row ? this.mapper.toDomain(row) : null;
  }

  async create(client: Client): Promise<Client> {
    const tx = getTransaction(); // AsyncLocalStorage
    const row = await tx.client.create({ data: this.mapper.toPersistence(client) });
    return this.mapper.toDomain(row);
  }
  // ... demais métodos
}
```

```typescript
// infrastructure/database/repositories/prisma-invoice-repository.ts
export class PrismaInvoiceRepository implements InvoiceRepositoryPort { ... }
```

```typescript
// infrastructure/database/repositories/prisma-tenant-repository.ts
export class PrismaTenantRepository implements TenantRepositoryPort { ... }
```

#### Mappers (Domain ↔ Persistence)

```typescript
// infrastructure/database/mappers/client.mapper.ts
export class ClientMapper {
  toDomain(row: PersistenceClient): Client {
    return Client.instance({
      tenantId: row.tenantId,
      name: row.name,
      phone: Phone.create(row.phone).value, // VO já validado na persistência
      email: row.email ? Email.create(row.email).value : undefined,
      // ...
    }, row.id);
  }

  toPersistence(client: Client): PersistenceClient {
    return {
      id: client.id,
      tenantId: client.tenantId,
      name: client.name,
      phone: client.phone.value(),
      email: client.email?.value(),
      // ...
    };
  }
}
```

#### Payment Gateway (Strategy Pattern — Asaas)

```typescript
// infrastructure/payment/asaas-payment-gateway.ts
export class AsaasPaymentGateway implements PaymentGatewayPort {
  constructor(private readonly config: AsaasConfig) {}

  async createPixCharge(input: CreatePixChargeInput): Promise<Either<ApplicationError, PixChargeResponse>> {
    // Chama Asaas API, mapeia resposta para PixChargeResponse
  }

  async getCharge(providerPaymentId: string): Promise<Either<ApplicationError, PixChargeResponse>> { ... }

  async cancelCharge(providerPaymentId: string): Promise<Either<ApplicationError, void>> { ... }

  handleWebhook(payload: unknown): Either<ApplicationError, WebhookResult> {
    // Parse payload Asaas → WebhookResult padronizado
  }
}
```

#### Webhook Verifier

```typescript
// infrastructure/webhook/per-tenant-hmac-verifier.ts
export class PerTenantHmacVerifier implements WebhookVerifierPort {
  async verify(provider: string, payload: string, signature: string, tenantId: string): Promise<Either<ApplicationError, boolean>> {
    // Busca secret no DB por tenantId+provider, HMAC-SHA256, timingSafeEqual
  }
}
```

#### Event Bus (Observer Pattern)

```typescript
// infrastructure/event-bus/redis-event-bus.ts (ou in-memory para dev)
export class RedisEventBus implements EventBusPort {
  private handlers = new Map<string, Array<(event: DomainEvent) => Promise<void>>>();

  publish(event: DomainEvent): void {
    const handlers = this.handlers.get(event.eventType) || [];
    handlers.forEach(h => h(event).catch(console.error));
  }

  subscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>): void {
    const arr = this.handlers.get(eventType) || [];
    arr.push(handler);
    this.handlers.set(eventType, arr);
  }
}
```

#### Unit of Work (AsyncLocalStorage)

```typescript
// infrastructure/database/unit-of-work.ts
export class PrismaUnitOfWork implements UnitOfWorkPort {
  constructor(private readonly prisma: PrismaClient) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      return transactionStorage.run(tx, () => fn());
    });
  }
}
```

```typescript
// infrastructure/database/transaction-context.ts
export const transactionStorage = new AsyncLocalStorage<PrismaClient>();
export function getTransaction(): PrismaClient {
  const tx = transactionStorage.getStore();
  if (!tx) throw new Error('No active transaction');
  return tx;
}
```

#### ID Generator

```typescript
// infrastructure/uuid/uuid-v7-generator.ts
export class UuidV7Generator implements IdGeneratorPort {
  generate(): string { return uuidv7(); }
  validate(id: string): boolean { return uuidRegex.test(id); }
}
```

#### Event Handlers (Infrastructure — consomem Domain Events)

```typescript
// infrastructure/event-handlers/send-receipt-handler.ts
export class SendReceiptHandler {
  constructor(private readonly queue: QueuePort) {}

  async handle(event: PaymentConfirmedEvent): Promise<void> {
    await this.queue.add('send-receipt', { paymentId: event.payload.paymentId, tenantId: event.payload.tenantId });
  }
}
```

```typescript
// infrastructure/event-handlers/update-risk-score-handler.ts
export class UpdateRiskScoreHandler {
  constructor(private readonly clientRepo: ClientRepositoryPort) {}

  async handle(event: PaymentConfirmedEvent): Promise<void> {
    // Recalcula risk score do cliente baseado no pagamento
  }
}
```

---

### Presentation Layer (`apps/backend/src/presentation/`)

#### Factories (Singletons)

```typescript
// presentation/factories/create-client.factory.ts
import { CreateClientUseCase } from '@/application/usecases/create-client.usecase';
import { PrismaClientRepository } from '@/infrastructure/database/repositories/prisma-client-repository';
import { RedisEventBus } from '@/infrastructure/event-bus/redis-event-bus';
import { UuidV7Generator } from '@/infrastructure/uuid/uuid-v7-generator';

const clientRepo = new PrismaClientRepository();
const eventBus = new RedisEventBus();
const idGenerator = new UuidV7Generator();

export const createClientUseCase = new CreateClientUseCase(clientRepo, eventBus, idGenerator);
```

```typescript
// presentation/factories/create-invoice.factory.ts
import { CreateInvoiceUseCase } from '@/application/usecases/create-invoice.usecase';
import { PrismaInvoiceRepository } from '@/infrastructure/database/repositories/prisma-invoice-repository';
import { PrismaClientRepository } from '@/infrastructure/database/repositories/prisma-client-repository';
import { RedisEventBus } from '@/infrastructure/event-bus/redis-event-bus';
import { UuidV7Generator } from '@/infrastructure/uuid/uuid-v7-generator';

const invoiceRepo = new PrismaInvoiceRepository();
const clientRepo = new PrismaClientRepository();
const eventBus = new RedisEventBus();
const idGenerator = new UuidV7Generator();

export const createInvoiceUseCase = new CreateInvoiceUseCase(invoiceRepo, clientRepo, eventBus, idGenerator);
```

```typescript
// presentation/factories/create-pix-charge.factory.ts
import { CreatePixChargeUseCase } from '@/application/usecases/create-pix-charge.usecase';
import { PrismaInvoiceRepository } from '@/infrastructure/database/repositories/prisma-invoice-repository';
import { AsaasPaymentGateway } from '@/infrastructure/payment/asaas-payment-gateway';
import { PrismaUnitOfWork } from '@/infrastructure/database/unit-of-work';
import { getPrismaClient } from '@/infrastructure/database/prisma.service';

const invoiceRepo = new PrismaInvoiceRepository();
const paymentGateway = new AsaasPaymentGateway({ apiKey: env.ASAAS_API_KEY, environment: env.ASAAS_ENV });
const uow = new PrismaUnitOfWork(getPrismaClient());

export const createPixChargeUseCase = new CreatePixChargeUseCase(invoiceRepo, paymentGateway, uow);
```

```typescript
// presentation/factories/process-webhook.factory.ts
import { ProcessPaymentWebhookUseCase } from '@/application/usecases/process-payment-webhook.usecase';
import { AsaasPaymentGateway } from '@/infrastructure/payment/asaas-payment-gateway';
import { PerTenantHmacVerifier } from '@/infrastructure/webhook/per-tenant-hmac-verifier';
import { PrismaInvoiceRepository } from '@/infrastructure/database/repositories/prisma-invoice-repository';
import { RedisEventBus } from '@/infrastructure/event-bus/redis-event-bus';
import { PrismaUnitOfWork } from '@/infrastructure/database/unit-of-work';
import { getPrismaClient } from '@/infrastructure/database/prisma.service';

const paymentGateway = new AsaasPaymentGateway({ apiKey: env.ASAAS_API_KEY, environment: env.ASAAS_ENV });
const webhookVerifier = new PerTenantHmacVerifier();
const invoiceRepo = new PrismaInvoiceRepository();
const eventBus = new RedisEventBus();
const uow = new PrismaUnitOfWork(getPrismaClient());

export const processPaymentWebhookUseCase = new ProcessPaymentWebhookUseCase(
  paymentGateway, webhookVerifier, invoiceRepo, eventBus, uow
);
```

#### Handlers (Routes delegam para factories)

```typescript
// presentation/routes/client.routes.ts
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createClientUseCase } from '@/presentation/factories/create-client.factory';
import { errorHandler } from '@/presentation/handler';

const createClientSchema = z.object({
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(255),
  phone: z.string().min(10).max(15),
  email: z.string().email().optional(),
  document: z.string().optional(),
  preferredChannel: z.enum(['WHATSAPP', 'EMAIL', 'SMS']).optional().default('WHATSAPP'),
  preferredLeadDays: z.number().int().min(1).max(14).optional().default(3),
});

export async function clientRoutes(app: FastifyInstance) {
  app.post('/api/clients', async (request, reply) => {
    const parsed = createClientSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Validation error', details: parsed.error.flatten() });

    const result = await createClientUseCase.execute(parsed.data);

    if (!result.success) {
      return errorHandler(result.value, reply);
    }

    return reply.code(201).send({ data: result.value.client.formatted() });
  });

  // GET /api/clients, GET /api/clients/:id, PATCH /api/clients/:id
  // delegam para repositórios via factory se necessário (ou use cases de query)
}
```

```typescript
// presentation/routes/invoice.routes.ts
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createInvoiceUseCase } from '@/presentation/factories/create-invoice.factory';
import { createPixChargeUseCase } from '@/presentation/factories/create-pix-charge.factory';
import { errorHandler } from '@/presentation/handler';

const createInvoiceSchema = z.object({
  tenantId: z.string().uuid(),
  clientId: z.string().uuid(),
  amount: z.number().positive(),
  dueDate: z.string().datetime(),
  description: z.string().optional(),
});

export async function invoiceRoutes(app: FastifyInstance) {
  app.post('/api/invoices', async (request, reply) => {
    const parsed = createInvoiceSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Validation error', details: parsed.error.flatten() });

    const result = await createInvoiceUseCase.execute({
      ...parsed.data,
      dueDate: new Date(parsed.data.dueDate),
    });

    if (!result.success) return errorHandler(result.value, reply);
    return reply.code(201).send({ data: result.value.invoice.formatted() });
  });

  app.post('/api/invoices/:id/pix-charge', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await createPixChargeUseCase.execute({ tenantId: request.tenantId!, invoiceId: id });
    if (!result.success) return errorHandler(result.value, reply);
    return reply.send({ data: result.value });
  });

  // GET /api/invoices, GET /api/invoices/:id, GET /api/invoices/stats
}
```

```typescript
// presentation/routes/webhook.routes.ts
import { FastifyInstance } from 'fastify';
import { processPaymentWebhookUseCase } from '@/presentation/factories/process-webhook.factory';
import { errorHandler } from '@/presentation/handler';

export async function webhookRoutes(app: FastifyInstance) {
  app.post('/api/webhooks/payment/:provider', async (request, reply) => {
    const { provider } = request.params as { provider: string };
    const signature = request.headers['asaas-signature'] as string; // header varia por provider
    const rawBody = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
    const tenantId = extractTenantId(request.body); // helper

    const result = await processPaymentWebhookUseCase.execute({
      provider,
      payload: request.body,
      signature,
      tenantId,
    });

    if (!result.success) return errorHandler(result.value, reply);
    return reply.send({ received: true });
  });
}
```

#### Error Handler Centralizado

```typescript
// presentation/handler.ts
import { FastifyReply } from 'fastify';
import { ApplicationError } from '@/application/errors/application-error';
import { DomainError } from '@/domain/errors/domain-error';

export function errorHandler(error: ApplicationError | DomainError | Error, reply: FastifyReply) {
  if (error instanceof DomainError) {
    return reply.code(422).send({ error: 'Domain validation error', message: error.message });
  }
  if (error instanceof ApplicationError) {
    return reply.code(error.statusCode).send({ error: error.code, message: error.message });
  }
  console.error('Unhandled error:', error);
  return reply.code(500).send({ error: 'Internal server error' });
}
```

---

## Requisitos Não-Funcionais

| ID | Requisito | Detalhe |
|----|-----------|---------|
| NFR1 | **Performance** | Use Cases executam em < 200ms (p95) sem I/O externo; chamadas externas (Asaas) < 2s |
| NFR2 | **Segurança** | Webhook HMAC-SHA256 com timing-safe comparison; secrets por tenant no DB; rate limit 10 req/s por IP |
| NFR3 | **Observabilidade** | EventBus publica eventos estruturados; logs estruturados (pino) com correlationId |
| NFR4 | **Testabilidade** | Domain testável sem mocks; Application testável com mocks de Ports; Infrastructure testável com Testcontainers |
| NFR5 | **Troca de Provedor** | Trocar Asaas → Mercado Pago = nova classe implementando `PaymentGatewayPort` + binding na factory; **zero mudança em Use Cases** |

---

## Definition of Done

- [ ] AC1–AC20 todos passando (verificação via `grep` automatizada no CI)
- [ ] Todos os Use Cases existentes (`CreateClientUseCase`, `CreateInvoiceUseCase`, `CreatePixChargeUseCase`, `ProcessPaymentWebhookUseCase`) refatorados para seguir os contratos
- [ ] Novos Use Cases: `UpdateClientUseCase`, `GetClientUseCase`, `ListInvoicesUseCase`, `GetInvoiceStatsUseCase`
- [ ] Domain Events: `ClientCreatedEvent`, `InvoiceCreatedEvent`, `PaymentConfirmedEvent`, `PaymentFailedEvent`, `InvoiceOverdueEvent`
- [ ] Event Handlers registrados na factory: `SendReceiptHandler`, `UpdateRiskScoreHandler`, `NotifyOverdueHandler`
- [ ] Strategy Pattern: `AsaasPaymentGateway` implementa `PaymentGatewayPort`; `PaymentProviderFactory` removido
- [ ] Observer Pattern: `EventBusPort` + `RedisEventBus` + handlers assíncronos
- [ ] UnitOfWork: `PrismaUnitOfWork` com `AsyncLocalStorage`; repositórios usam `getTransaction()`
- [ ] Zero violação de camada (CI falha se `grep` encontrar imports proibidos)
- [ ] Testes unitários de Domain (VOs, Entities, DomainEvents) ≥ 90% coverage
- [ ] Testes de contrato de Application (Use Cases com mocks de Ports) ≥ 80% coverage
- [ ] Testes de integração de Infrastructure (Repositórios, PaymentGateway, EventBus) com Testcontainers

---

## Design Patterns Declarados Explicitamente

| Padrão | Onde Aplicado | Justificativa |
|--------|---------------|---------------|
| **Strategy** | `PaymentGatewayPort` + `AsaasPaymentGateway` | Provedor de pagamento intercambiável sem `if/else` no Use Case |
| **Observer** | `EventBusPort` + `DomainEvent` classes + handlers na Infrastructure | Efeitos colaterais desacoplados (e-mail, risk score, nota fiscal) |
| **Repository** | `*RepositoryPort` (Application) + `Prisma*Repository` (Infrastructure) | Persistência desacoplada do domínio |
| **Unit of Work** | `UnitOfWorkPort` + `PrismaUnitOfWork` | Transações atômicas sem vazar `db` para Application |
| **Factory** | `presentation/factories/*.factory.ts` (singletons) | Injeção de dependência única na inicialização |
| **Mapper** | `*Mapper` (Infrastructure) | Conversão Domain ↔ Persistence isolada |
| **Value Object** | `Phone`, `Email`, `Money`, `TaxId`, `RiskScore` | Auto-validação, imutabilidade, sem primitivos no domínio |
| **Entity** | `Client`, `Invoice`, `Tenant`, `Payment` (classes com `Entity` base) | Identidade, ciclo de vida, comportamento de domínio |

---

## Decisões de Implementação

1. **Um único gateway de pagamento por projeto**: Asaas (conforme `payments-asaas` skill). Não misturar Stripe/Polar/PagBank/MercadoPago na mesma codebase.
2. **Domain Events como classes imutáveis**: Não usar `createDomainEvent()` factory que importa infraestrutura. Cada evento é uma classe com `eventId`, `occurredAt`, `eventType`, `payload`.
3. **EventBusPort na Application**: Use Cases publicam eventos; Infrastructure registra handlers na inicialização (bootstrap).
4. **UnitOfWork obrigatório para escrita**: Qualquer Use Case que escreve em múltiplas tabelas (ex: `ProcessPaymentWebhookUseCase`) usa `uow.run()`.
5. **AsyncLocalStorage para transação**: Repositórios não recebem `tx` no construtor; usam `getTransaction()`.
6. **Error Mapping centralizado**: `presentation/handler.ts` mapeia `DomainError` → 422, `ApplicationError` → code → HTTP status.
7. **Zod apenas na Presentation**: Validação de input HTTP. Domain valida via VOs; Application valida regras de negócio.
8. **IdGeneratorPort no Domain**: `UuidV7Generator` na Infrastructure. Use Cases recebem via construtor.
9. **Singletons nas Factories**: Dependências criadas uma vez no bootstrap; Use Cases são stateless.
10. **Routes não importam Infrastructure**: Apenas `presentation/factories` e `application/*`.

---

## Rastreabilidade (AC → Testes)

| AC | Teste Esperado |
|----|----------------|
| AC1, AC2 | `grep -r "from '@/infrastructure" apps/backend/src/domain` → 0 |
| AC3, AC4 | `grep -r "from '@/infrastructure" apps/backend/src/application` → 0 |
| AC5 | `grep -r "new Prisma.*Repository" apps/backend/src/routes` → 0 |
| AC6 | `grep -r "PaymentProviderFactory" apps/backend/src/routes` → 0 |
| AC7 | Todos os Use Cases retornam `Promise<Either<ApplicationError \| DomainError, Output>>` |
| AC8 | Entities são classes com `private constructor`, `static create`, `static instance` |
| AC9 | VOs têm `private constructor`, `static create`, `value()`, `formatted()` |
| AC10 | Domain Events são classes com `eventId`, `occurredAt`, `eventType`, `payload` tipado |
| AC11 | `EventBusPort` tem `publish(event: DomainEvent)` e `subscribe(type, handler)` |
| AC12 | `PaymentGatewayPort` tem os 4 métodos definidos |
| AC13 | `AsaasPaymentGateway` implementa `PaymentGatewayPort`; sem `switch` no Use Case |
| AC14 | Use Case publica `DomainEvent`; handler na Infrastructure assina via `subscribe()` |
| AC15 | `UnitOfWorkPort` tem `run<T>(fn: () => Promise<T>): Promise<T>` |
| AC16 | Repositórios implementam Ports; usam `getTransaction()` |
| AC17 | Factories exportam instâncias singleton (const) |
| AC18 | Handlers usam Zod → Use Case → `errorHandler` |
| AC19 | `errorHandler` mapeia códigos corretamente |
| AC20 | `IdGeneratorPort` no Domain; `UuidV7Generator` na Infrastructure |

---

## Próximos Passos (para o `scrum-master` quebrar em tickets)

1. **Domain Layer Refactor** — Entities, VOs, DomainError, DomainEvents, IdGeneratorPort
2. **Application Ports** — RepositoryPorts, PaymentGatewayPort, WebhookVerifierPort, EventBusPort, UnitOfWorkPort
3. **Application Use Cases** — Refatorar CreateClient, CreateInvoice; criar CreatePixCharge, ProcessPaymentWebhook, UpdateClient, GetClient, ListInvoices, GetInvoiceStats
4. **Infrastructure Repositories** — PrismaClientRepository, PrismaInvoiceRepository, PrismaTenantRepository + Mappers
5. **Infrastructure Payment** — AsaasPaymentGateway, PerTenantHmacVerifier
6. **Infrastructure Events** — RedisEventBus (ou InMemory para dev), Event Handlers (SendReceipt, UpdateRiskScore, NotifyOverdue)
7. **Infrastructure UoW** — PrismaUnitOfWork + AsyncLocalStorage transaction context
8. **Infrastructure ID Generator** — UuidV7Generator
9. **Presentation Factories** — Singletons para todos os Use Cases
10. **Presentation Routes/Handlers** — Refatorar client.routes, invoice.routes, webhook.routes para usar factories + errorHandler
11. **CI Guardrails** — Scripts de `grep` para bloquear violações de camada
12. **Testes** — Unit (Domain), Contract (Application), Integration (Infrastructure)