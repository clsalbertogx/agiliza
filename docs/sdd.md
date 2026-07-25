# SDD — Agiliza Platform

> **Specification Driven Development Document**
> Versão: 1.0.0 | Status: Draft | Autor: Architect Agent
> Última atualização: 2026-07-25

---

## Índice

1. [Domain Model & Ubiquitous Language](#1-domain-model--ubiquitous-language)
2. [Bounded Contexts](#2-bounded-contexts)
3. [Architecture & Clean Architecture Layers](#3-architecture--clean-architecture-layers)
4. [API Contracts (Fastify Routes)](#4-api-contracts-fastify-routes)
5. [Event Schema (Data Contracts)](#5-event-schema-data-contracts)
6. [Acceptance Criteria (Measurable)](#6-acceptance-criteria-measurable)
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [Security & Compliance Requirements](#8-security--compliance-requirements)
9. [Out of Scope (MVP)](#9-out-of-scope-mvp)
10. [Design Patterns & Architecture Decisions](#10-design-patterns--architecture-decisions)
11. [Glossary (Ubiquitous Language)](#11-glossary-ubiquitous-language)

---

## 1. Domain Model & Ubiquitous Language

### 1.1 Core Domain: Billing & Subscription Management

O domínio central da Agiliza é **cobrança recorrente assistida por IA preditiva**. O sistema não apenas gera faturas — ele decide *quando*, *como* e *por qual canal* cobrar cada cliente individualmente, aprendendo continuamente com cada interação.

### 1.2 Domain Entities

```
Tenant ──1:N──> Client ──1:N──> Invoice
  │                │               │
  │                │               └──> Payment
  │                │
  │                └──> DecisionLog
  │                └──> Message
  │
  └──> PaymentProviderConfig
  └──> MessageTemplate
  └──> BillingSchedule
```

### 1.3 Entity Definitions

#### Tenant (B2B Client)
- **Descrição**: Estabelecimento que utiliza a Agiliza para gerenciar cobranças (ex: academia, escola, condomínio).
- **Identidade**: UUID v7
- **Propriedades**: `id`, `name`, `taxId` (CNPJ/CPF), `email`, `phone`, `niche` (enum: school|gym|condo|pharmacy|bakery|supermarket|event), `plan` (starter|pro|enterprise), `active`, `createdAt`, `updatedAt`
- **Invariantes**:
  - Tenant ativo deve ter ao menos 1 PaymentProviderConfig válido
  - TaxId deve ser único por tenant
  - Niche é imutável após criação (define benchmarks de IA)

#### Client (End Customer)
- **Descrição**: Cliente final do Tenant — a pessoa física que paga as faturas.
- **Identidade**: UUID v7
- **Propriedades**: `id`, `tenantId`, `name`, `phone` (Phone VO), `email` (Email VO, opcional), `preferredChannel` (whatsapp|email|sms), `preferredTime` (HH:mm, opcional), `preferredLeadDays` (1-15), `riskScore` (green|yellow|red), `onboardingCompleted` (boolean), `metadata` (JSONB, dados custom do tenant), `createdAt`, `updatedAt`
- **Invariantes**:
  - Phone é único por tenant (um cliente não pode ser duplicado no mesmo estabelecimento)
  - preferredTime + preferredLeadDays são coletados no onboarding de 3 perguntas
  - riskScore é calculado pelo Decision Engine, nunca setado manualmente
- **Value Objects associados**: `Phone`, `Email`, `RiskScore`

#### Invoice
- **Descrição**: Fatura gerada para um Client, representando uma cobrança.
- **Identidade**: UUID v7
- **Propriedades**: `id`, `clientId`, `tenantId`, `amount` (Money VO), `dueDate`, `status` (pending|paid|overdue|cancelled|refunded), `paymentMethod` (pix|boleto|credit_card), `paidAt` (opcional), `externalPaymentId` (opcional), `paymentProvider` (asaas|mercadopago|pagbank|polar), `pixQrCode` (opcional, base64), `pixCopiaECola` (opcional), `boletoUrl` (opcional), `boletoBarcode` (opcional), `linkUrl` (opcional), `metadata` (JSONB), `createdAt`, `updatedAt`
- **Invariantes**:
  - Status transita em ordem: pending → (paid | overdue | cancelled) → refunded
  - paidAt só pode ser setado se status = paid
  - externalPaymentId é único por provider (idempotência)
  - Amount deve ser > 0
- **Value Objects associados**: `Money`, `InvoiceStatus`

#### Payment
- **Descrição**: Transação de pagamento associada a uma Invoice.
- **Identidade**: UUID v7
- **Propriedades**: `id`, `invoiceId`, `clientId`, `tenantId`, `amount`, `method`, `provider`, `providerPaymentId`, `status` (pending|confirmed|failed|refunded), `fee` (taxa do gateway), `netAmount` (valor líquido), `paidAt`, `webhookReceivedAt`, `metadata` (JSONB com raw webhook payload), `createdAt`
- **Invariantes**:
  - Uma invoice pode ter múltiplos payments (tentativas), mas apenas um com status = confirmed
  - netAmount = amount - fee (calculado após confirmação do gateway)
  - Raw webhook payload preservado em metadata para auditoria

#### Subscription (opcional no MVP — recorrência)
- **Descrição**: Assinatura/plano que gera invoices automaticamente.
- **Identidade**: UUID v7
- **Propriedades**: `id`, `clientId`, `tenantId`, `planName`, `amount`, `frequency` (monthly|weekly|yearly|custom), `billingDay`, `status` (active|paused|cancelled|expired), `currentPeriodStart`, `currentPeriodEnd`, `cancelledAt`, `metadata`, `createdAt`, `updatedAt`
- **Invariantes**:
  - Se status = cancelled, não pode gerar novas invoices
  - billingDay deve ser 1-31 (ajustado para último dia do mês se maior)

#### DecisionLog
- **Descrição**: Registro de auditoria de cada decisão do Decision Engine (heurística ou ML).
- **Propriedades**: `id`, `clientId`, `tenantId`, `invoiceId` (opcional), `action` (send_message|adjust_time|change_channel|offer_parcel|pause_collection|alert_human), `channel` (whatsapp|email|sms), `templateName` (opcional), `reason` (string com explicação legível), `confidence` (0-1, opcional), `modelVersion` (heuristic-v1|bandit-v1|ml-v1), `features` (JSONB com features usadas na decisão), `outcome` (success|failure|pending, opcional — preenchido após feedback), `createdAt`

#### Message
- **Descrição**: Mensagem enviada para um cliente, com tracking de entrega.
- **Propriedades**: `id`, `clientId`, `tenantId`, `invoiceId` (opcional), `channel`, `templateName`, `providerMessageId`, `status` (queued|sent|delivered|read|clicked|failed), `content` (texto enviado, opcional), `sentAt`, `deliveredAt`, `readAt`, `clickedAt`, `failedAt`, `errorMessage` (opcional), `metadata` (JSONB), `createdAt`

#### PaymentProviderConfig
- **Descrição**: Configuração do gateway de pagamento escolhido por um Tenant.
- **Propriedades**: `id`, `tenantId`, `provider` (asaas|mercadopago|pagbank|polar), `apiKey` (encrypted), `environment` (sandbox|production), `webhookSecret` (encrypted), `config` (JSONB com configurações específicas do provider), `active`, `createdAt`, `updatedAt`
- **Invariantes**:
  - Tenant pode ter múltiplos providers mas apenas um active por vez
  - API keys armazenadas encrypted-at-rest (AES-256-GCM)

#### MessageTemplate
- **Descrição**: Template de mensagem WhatsApp pré-aprovado pelo Meta.
- **Propriedades**: `id`, `tenantId`, `name` (ex: friendly_reminder_d3), `category` (reminder|receipt|retention|offer|onboarding), `language`, `body` (texto com placeholders `{{name}}`, `{{value}}`, `{{dueDate}}`, `{{pixLink}}`, `{{boletoUrl}}`), `status` (approved|pending|rejected), `metaTemplateId`, `createdAt`, `updatedAt`

#### BillingSchedule
- **Descrição**: Configuração de régua de cobrança do Tenant.
- **Propriedades**: `id`, `tenantId`, `name` (ex: "Régua Padrão - Escolas"), `rules` (JSONB array de regras), `active`, `isDefault`, `createdAt`, `updatedAt`
- **Regras (JSONB)**: Array de objetos:
  ```json
  {
    "trigger": "before_due" | "on_due" | "after_due",
    "days": 3,
    "channel": "whatsapp",
    "templateName": "friendly_reminder_d3",
    "time": "19:00",
    "segment": "all" | "green" | "yellow" | "red"
  }
  ```

---

## 2. Bounded Contexts

### 2.1 Context Map

```
┌──────────────────────────┐     ┌──────────────────────────┐
│    Billing Context       │     │   Messaging Context      │
│  (Core - cobranças)      │────>│  (WhatsApp/E-mail/SMS)   │
│                          │     │                          │
│  Invoice, Payment,       │     │  Message, Template,      │
│  Subscription,           │     │  Delivery Tracking       │
│  Reconciliation          │     │                          │
└───────────┬──────────────┘     └────────────┬─────────────┘
            │                                  │
            │                                  │
            ▼                                  ▼
┌──────────────────────────┐     ┌──────────────────────────┐
│   Decision Context       │     │  Notification Context    │
│  (AI/Heuristic Engine)   │     │  (Events & Webhooks)     │
│                          │     │                          │
│  DecisionLog,            │     │  Event Collector,        │
│  Risk Scoring,           │     │  Webhook Router,         │
│  Next Action,            │     │  Outbound Webhooks       │
│  Bandit Learning         │     │                          │
└───────────┬──────────────┘     └────────────┬─────────────┘
            │                                  │
            │                                  │
            ▼                                  ▼
┌──────────────────────────┐     ┌──────────────────────────┐
│ Client Management Context│     │ Tenant Management Context │
│ (Perfil & Segmentação)   │     │ (Multi-tenant B2B)       │
│                          │     │                          │
│  Client, RiskScore,      │     │  Tenant, PaymentProvider,│
│  Onboarding,             │     │  BillingSchedule,        │
│  Segmentação             │     │  Plan/Subscription       │
└──────────────────────────┘     └──────────────────────────┘
```

### 2.2 Context Definitions

| Context | Domain | Responsabilidade | Linguagem |
|---|---|---|---|
| **Billing** (Core) | Invoice, Payment, Subscription, Reconciliation | Gerar faturas, processar pagamentos, conciliar via webhook | `invoice`, `payment`, `charge`, `reconciliation`, `overdue`, `refund` |
| **Messaging** | Message, MessageTemplate, DeliveryTracking | Enviar mensagens multicanal, tracking de entrega/leitura/clique | `message`, `template`, `delivery`, `read receipt`, `channel` |
| **Decision** | DecisionLog, RiskScore, BanditModel | Calcular risco, decidir próxima ação, aprender com feedback | `risk`, `score`, `next action`, `bandit`, `exploration`, `exploitation` |
| **Client Management** | Client, Phone, Email, Onboarding | Gerenciar perfil de clientes finais, onboarding, segmentação | `client`, `profile`, `onboarding`, `segment`, `preference` |
| **Tenant Management** | Tenant, PaymentProviderConfig, BillingSchedule, MessageTemplate | Configuração multi-tenant, provedores de pagamento, schedules | `tenant`, `provider`, `gateway`, `schedule`, `plan`, `niche` |
| **Notification** | Event, WebhookEndpoint, OutboundWebhook | Coletar eventos, rotear webhooks, notificar sistemas externos | `event`, `webhook`, `subscription`, `callback`, `retry` |

### 2.3 Context Interactions

| De | Para | Gatilho | Dados Trocados |
|---|---|---|---|
| Billing | Messaging | Invoice gerada/vence | `{clientId, invoiceId, amount, dueDate, pixLink}` |
| Decision | Messaging | Próxima ação calculada | `{clientId, channel, template, sendAt, payload}` |
| Messaging | Decision | Evento de entrega/leitura/clique | `{messageId, clientId, eventType, timestamp}` |
| Billing | Decision | Pagamento confirmado/falhou | `{invoiceId, clientId, status, amount, timestamp}` |
| Client Management | Decision | Client criado/atualizado | `{clientId, preferences, riskScore}` |
| Notification | Todos | Qualquer evento de domínio | Evento padronizado (ver seção 5) |

---

## 3. Architecture & Clean Architecture Layers

### 3.1 Layer Structure

```
apps/backend/src/
├── domain/                      # Layer 0: Enterprise Business Rules
│   ├── entities/                #   Domain entities
│   │   ├── tenant.entity.ts
│   │   ├── client.entity.ts
│   │   ├── invoice.entity.ts
│   │   ├── payment.entity.ts
│   │   ├── subscription.entity.ts
│   │   ├── message.entity.ts
│   │   ├── decision-log.entity.ts
│   │   └── payment-provider-config.entity.ts
│   ├── value-objects/           #   Value Objects (auto-validáveis)
│   │   ├── phone.vo.ts
│   │   ├── email.vo.ts
│   │   ├── money.vo.ts
│   │   ├── risk-score.vo.ts
│   │   ├── invoice-status.vo.ts
│   │   ├── tax-id.vo.ts
│   │   └── pix-payload.vo.ts
│   ├── events/                  #   Domain Events
│   │   ├── payment-confirmed.event.ts
│   │   ├── invoice-overdue.event.ts
│   │   ├── message-read.event.ts
│   │   └── client-risk-updated.event.ts
│   └── errors/
│       └── domain.error.ts      #   DomainError base
│
├── application/                 # Layer 1: Application Business Rules
│   ├── usecases/                #   Casos de uso
│   │   ├── billing/
│   │   │   ├── create-invoice.usecase.ts
│   │   │   ├── process-payment.usecase.ts
│   │   │   ├── reconcile-payment.usecase.ts
│   │   │   ├── cancel-invoice.usecase.ts
│   │   │   └── generate-billing-report.usecase.ts
│   │   ├── messaging/
│   │   │   ├── send-reminder.usecase.ts
│   │   │   └── track-message-delivery.usecase.ts
│   │   ├── decision/
│   │   │   ├── decide-next-action.usecase.ts
│   │   │   ├── calculate-risk-score.usecase.ts
│   │   │   └── record-feedback.usecase.ts
│   │   ├── client/
│   │   │   ├── create-client.usecase.ts
│   │   │   ├── complete-onboarding.usecase.ts
│   │   │   └── update-client.usecase.ts
│   │   └── tenant/
│   │       ├── configure-tenant.usecase.ts
│   │       ├── set-payment-provider.usecase.ts
│   │       └── configure-schedule.usecase.ts
│   ├── ports/                   #   Interfaces (Ports) — infra implementa
│   │   ├── gateways/
│   │   │   ├── payment-gateway.port.ts     # IPaymentProvider
│   │   │   ├── message-provider.port.ts    # IMessageProvider
│   │   │   └── evolution-api.port.ts       # IEvolutionApiProvider
│   │   ├── repositories/
│   │   │   ├── tenant.repository.ts
│   │   │   ├── client.repository.ts
│   │   │   ├── invoice.repository.ts
│   │   │   ├── payment.repository.ts
│   │   │   ├── message.repository.ts
│   │   │   ├── decision-log.repository.ts
│   │   │   ├── subscription.repository.ts
│   │   │   └── payment-provider-config.repository.ts
│   │   ├── adapters/
│   │   │   ├── hash.adapter.ts
│   │   │   ├── crypto.adapter.ts
│   │   │   └── event-bus.adapter.ts       # EventBusPort
│   │   └── unit-of-work.port.ts
│   ├── services/                #   Domain services (orquestração)
│   │   ├── risk-calculator.service.ts
│   │   ├── next-action-decider.service.ts
│   │   └── benchmark.service.ts
│   ├── dto/                     #   Data Transfer Objects
│   │   ├── create-client.dto.ts
│   │   ├── create-invoice.dto.ts
│   │   ├── process-payment.dto.ts
│   │   └── decision-feedback.dto.ts
│   ├── types/
│   │   └── either.ts
│   └── errors/
│       └── application.error.ts
│
├── infrastructure/              # Layer 2: Infrastructure
│   ├── database/
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   ├── repositories/       # Implementações concretas das ports
│   │   │   ├── prisma-tenant.repository.ts
│   │   │   ├── prisma-client.repository.ts
│   │   │   ├── prisma-invoice.repository.ts
│   │   │   ├── prisma-payment.repository.ts
│   │   │   ├── prisma-message.repository.ts
│   │   │   ├── prisma-decision-log.repository.ts
│   │   │   ├── prisma-subscription.repository.ts
│   │   │   └── prisma-payment-provider-config.repository.ts
│   │   ├── transaction-context.ts  # AsyncLocalStorage
│   │   └── unit-of-work.ts         # DrizzleUnitOfWork
│   ├── payment/                 # Payment Provider Implementations
│   │   ├── asaas/
│   │   │   └── asaas-payment.gateway.ts
│   │   ├── mercadopago/
│   │   │   └── mercadopago-payment.gateway.ts
│   │   ├── pagbank/
│   │   │   └── pagbank-payment.gateway.ts
│   │   └── polar/
│   │       └── polar-payment.gateway.ts
│   ├── messaging/               # Message Provider Implementations
│   │   ├── evolution/
│   │   │   ├── evolution-message.provider.ts
│   │   │   ├── evolution-webhook.handler.ts
│   │   │   └── evolution-client.ts       # HTTP client
│   │   └── templates/
│   │       └── message-template.renderer.ts
│   ├── cache/
│   │   └── redis-cache.adapter.ts
│   ├── queue/
│   │   ├── bullmq/
│   │   │   ├── queues.ts         # Queue definitions
│   │   │   ├── workers/
│   │   │   │   ├── send-message.worker.ts
│   │   │   │   ├── process-payment.worker.ts
│   │   │   │   └── reconcile-payment.worker.ts
│   │   │   └── connection.ts
│   ├── crypto/
│   │   ├── bcrypt-hash.provider.ts
│   │   └── aes-crypto.provider.ts
│   └── event-bus/
│       ├── in-memory-event-bus.ts
│       └── redis-event-bus.ts
│
├── presentation/               # Layer 3: Interface Adapters
│   ├── routes/                  # Fastify routes grouped by context
│   │   ├── client.routes.ts
│   │   ├── invoice.routes.ts
│   │   ├── payment.routes.ts
│   │   ├── reminder.routes.ts
│   │   ├── decision.routes.ts
│   │   ├── tenant.routes.ts
│   │   ├── webhook.routes.ts
│   │   ├── report.routes.ts
│   │   ├── message.routes.ts
│   │   └── health.routes.ts
│   ├── factories/               # Dependency injection (singletons)
│   │   ├── create-client.factory.ts
│   │   ├── process-payment.factory.ts
│   │   ├── send-reminder.factory.ts
│   │   └── ...  (um factory por use case)
│   ├── schemas/                 # Zod schemas (validação de input)
│   │   └── ...
│   ├── handler.ts               # Error handler genérico
│   └── index.ts                 # Build do server Fastify
│
├── config/
│   ├── env.ts                   # Zod-validated env vars
│   └── logger.ts
│
└── server.ts                    # Entry point
```

### 3.2 Dependency Rule

```
domain/  ←  application/  ←  infrastructure/  ←  presentation/
   │                              │                      │
   └── Zero deps externos         └── Implementa ports    └── Monta tudo
                                  └── Depende de domain/     (composition root)
                                  └── Depende de app ports
```

**Regra de Ferro**: Nada em `domain/` importa algo de `application/`, `infrastructure/`, ou `presentation/`. Nada em `application/` importa algo de `infrastructure/` ou `presentation/`. A `presentation/` é a única camada que conhece todo mundo (composition root).

### 3.3 Domain Layer Detail

#### 3.3.1 Value Objects

```typescript
// domain/value-objects/phone.vo.ts
// Invariante: 10-11 dígitos, apenas números
class Phone {
  private constructor(private value: string) { /* valida */ }
  static create(phone: string): Phone
  value(): string               // raw: 5511999998888
  formatted(): string           // display: (11) 99999-8888
}
```

```typescript
// domain/value-objects/money.vo.ts
// Invariante: amount > 0, precisão de 2 casas decimais
class Money {
  private constructor(private amount: number, private currency: string) { /* valida */ }
  static create(amount: number, currency?: string): Money
  value(): number
  add(other: Money): Money
  subtract(other: Money): Money
  percentage(pct: number): Money
}
```

```typescript
// domain/value-objects/risk-score.vo.ts
class RiskScore {
  static readonly GREEN = 'green'   // Paga em dia > 90%
  static readonly YELLOW = 'yellow' // Risco 30-60%
  static readonly RED = 'red'       // Risco > 70% de atraso > 30d
  private constructor(private value: 'green' | 'yellow' | 'red') {}
  static fromScore(probability: number): RiskScore  // probabilistic mapping
  value(): 'green' | 'yellow' | 'red'
}
```

```typescript
// domain/value-objects/invoice-status.vo.ts
// State machine: pending → paid | overdue | cancelled → refunded
class InvoiceStatus {
  private constructor(private value: InvoiceStatusValue) {}
  static PENDING(): InvoiceStatus
  static PAID(): InvoiceStatus
  static OVERDUE(): InvoiceStatus
  static CANCELLED(): InvoiceStatus
  static REFUNDED(): InvoiceStatus
  canTransitionTo(next: InvoiceStatus): boolean
  value(): InvoiceStatusValue
}
```

```typescript
// domain/value-objects/tax-id.vo.ts
class TaxId {
  private constructor(private value: string) { /* valida CPF/CNPJ */ }
  static create(taxId: string): TaxId
  value(): string
  formatted(): string
  isCPF(): boolean
  isCNPJ(): boolean
}
```

#### 3.3.2 Domain Events

```typescript
// domain/events/payment-confirmed.event.ts
class PaymentConfirmedEvent {
  constructor(
    readonly paymentId: string,
    readonly invoiceId: string,
    readonly clientId: string,
    readonly tenantId: string,
    readonly amount: number,
    readonly paymentMethod: string,
    readonly occurredAt: Date
  ) {}
}

// domain/events/invoice-overdue.event.ts
class InvoiceOverdueEvent {
  constructor(
    readonly invoiceId: string,
    readonly clientId: string,
    readonly tenantId: string,
    readonly amount: number,
    readonly dueDate: Date,
    readonly daysOverdue: number,
    readonly occurredAt: Date
  ) {}
}

// domain/events/message-read.event.ts
class MessageReadEvent {
  constructor(
    readonly messageId: string,
    readonly clientId: string,
    readonly tenantId: string,
    readonly invoiceId: string | null,
    readonly channel: string,
    readonly occurredAt: Date
  ) {}
}

// domain/events/client-risk-updated.event.ts
class ClientRiskUpdatedEvent {
  constructor(
    readonly clientId: string,
    readonly tenantId: string,
    readonly previousRisk: string,
    readonly newRisk: string,
    readonly reason: string,
    readonly occurredAt: Date
  ) {}
}
```

### 3.4 Application Layer Detail

#### 3.4.1 Ports (Interfaces)

```typescript
// application/ports/gateways/payment-gateway.port.ts
// Strategy Pattern: múltiplas implementações (Asaas, MercadoPago, PagBank, Polar)
interface PaymentGatewayPort {
  createPixCharge(input: CreatePixChargeInput): Promise<Either<PaymentError, PixChargeResult>>
  createBoletoCharge(input: CreateBoletoChargeInput): Promise<Either<PaymentError, BoletoChargeResult>>
  createCreditCardCharge(input: CreateCreditCardChargeInput): Promise<Either<PaymentError, CardChargeResult>>
  createSubscription(input: CreateSubscriptionInput): Promise<Either<PaymentError, SubscriptionResult>>
  cancelSubscription(id: string): Promise<Either<PaymentError, void>>
  getPayment(id: string): Promise<Either<PaymentError, PaymentDetails>>
  handleWebhook(payload: unknown, headers: Record<string, string>): Promise<Either<PaymentError, NormalizedWebhookEvent>>
}

interface CreatePixChargeInput {
  amount: number
  description: string
  externalReference: string  // invoiceId
  customer: { name: string; taxId: string; email?: string; phone?: string }
  expiresInMinutes?: number  // default 3600 (60 min)
}

interface PixChargeResult {
  id: string
  status: string
  pixQrCode: string         // base64 image
  pixCopiaECola: string     // pix copy-paste key
  expiresAt: Date
  linkUrl?: string           // payment link
}
```

```typescript
// application/ports/gateways/message-provider.port.ts
// Strategy Pattern: WhatsApp (Evolution), E-mail (SMTP), SMS (Twilio)
interface MessageProviderPort {
  sendText(input: SendTextInput): Promise<Either<MessageError, SendResult>>
  sendTemplate(input: SendTemplateInput): Promise<Either<MessageError, SendResult>>
  sendMedia(input: SendMediaInput): Promise<Either<MessageError, SendResult>>
}

interface SendTemplateInput {
  to: string                    // phone number
  templateName: string          // Meta-approved template name
  parameters: Record<string, string>  // {{name}}, {{value}}, etc.
  tenantId: string
}

interface SendResult {
  providerMessageId: string
  status: 'queued' | 'sent' | 'failed'
}
```

```typescript
// application/ports/adapters/event-bus.port.ts
// Observer Pattern: Domain Events → Handlers
interface EventBusPort {
  publish<T extends DomainEvent>(event: T): Promise<void>
  subscribe<T extends DomainEvent>(eventType: string, handler: EventHandler<T>): void
}

interface EventHandler<T extends DomainEvent> {
  handle(event: T): Promise<void>
}
```

```typescript
// application/ports/unit-of-work.port.ts
interface UnitOfWork {
  run<T>(fn: () => Promise<T>): Promise<T>
}
```

#### 3.4.2 Use Cases

```typescript
// application/usecases/billing/create-invoice.usecase.ts
interface CreateInvoiceInput {
  clientId: string
  tenantId: string
  amount: number
  dueDate: Date
  paymentMethod?: PaymentMethod
  description?: string
  subscriptionId?: string
}

interface CreateInvoiceOutput {
  invoice: Invoice
  paymentInfo: {
    pixQrCode?: string
    pixCopiaECola?: string
    boletoUrl?: string
    boletoBarcode?: string
    linkUrl?: string
  }
}

class CreateInvoiceUseCase implements Usecase<CreateInvoiceInput, CreateInvoiceOutput> {
  constructor(
    private uow: UnitOfWork,
    private invoiceRepo: InvoiceRepository,
    private clientRepo: ClientRepository,
    private tenantRepo: TenantRepository,
    private paymentProviderConfigRepo: PaymentProviderConfigRepository,
    private paymentGatewayFactory: PaymentGatewayFactory,
    private eventBus: EventBusPort
  ) {}

  async execute(input: CreateInvoiceInput): Promise<Either<DomainError | ApplicationError, CreateInvoiceOutput>>
}
```

```typescript
// application/usecases/billing/process-payment.usecase.ts
interface ProcessPaymentInput {
  invoiceId: string
  tenantId: string
  paymentMethod: PaymentMethod
  pixCopiaECola?: string    // pre-filled PIX
  creditCardToken?: string  // tokenized card
}

interface ProcessPaymentOutput {
  payment: Payment
  invoice: Invoice
  receiptUrl?: string
}

class ProcessPaymentUseCase implements Usecase<ProcessPaymentInput, ProcessPaymentOutput> {
  constructor(
    private uow: UnitOfWork,
    private invoiceRepo: InvoiceRepository,
    private paymentRepo: PaymentRepository,
    private paymentGatewayFactory: PaymentGatewayFactory,
    private eventBus: EventBusPort
  ) {}
}
```

```typescript
// application/usecases/billing/reconcile-payment.usecase.ts
// Chamado pelo webhook handler do gateway de pagamento
interface ReconcilePaymentInput {
  providerPaymentId: string
  provider: PaymentProvider
  status: 'confirmed' | 'failed' | 'refunded'
  amount: number
  fee?: number
  paidAt?: Date
  rawPayload: Record<string, unknown>
}

class ReconcilePaymentUseCase implements Usecase<ReconcilePaymentInput, void> {
  constructor(
    private uow: UnitOfWork,
    private paymentRepo: PaymentRepository,
    private invoiceRepo: InvoiceRepository,
    private clientRepo: ClientRepository,
    private eventBus: EventBusPort
  ) {}
}
```

```typescript
// application/usecases/decision/decide-next-action.usecase.ts
interface DecideNextActionInput {
  clientId: string
  tenantId: string
  invoiceId?: string
}

interface DecideNextActionOutput {
  action: 'send_message' | 'wait' | 'alert_human' | 'offer_parcel' | 'change_due_date'
  channel: MessageChannel | null
  templateName: string | null
  sendAt: Date | null
  reason: string
  confidence: number
}

class DecideNextActionUseCase implements Usecase<DecideNextActionInput, DecideNextActionOutput> {
  constructor(
    private clientRepo: ClientRepository,
    private invoiceRepo: InvoiceRepository,
    private decisionLogRepo: DecisionLogRepository,
    private messageRepo: MessageRepository,
    private riskCalculator: RiskCalculatorService,
    private benchmarkService: BenchmarkService
  ) {}
}
```

```typescript
// application/usecases/decision/calculate-risk-score.usecase.ts
interface CalculateRiskScoreInput {
  clientId: string
  tenantId: string
}

interface CalculateRiskScoreOutput {
  clientId: string
  riskScore: RiskScore
  probability: number      // 0-1
  topFeatures: Array<{ name: string; value: number; impact: number }>  // explainability
  reason: string
}

class CalculateRiskScoreUseCase implements Usecase<CalculateRiskScoreInput, CalculateRiskScoreOutput> {
  constructor(
    private clientRepo: ClientRepository,
    private invoiceRepo: InvoiceRepository,
    private paymentRepo: PaymentRepository,
    private messageRepo: MessageRepository,
    private decisionLogRepo: DecisionLogRepository,
    private riskCalculator: RiskCalculatorService
  ) {}
}
```

```typescript
// application/usecases/messaging/send-reminder.usecase.ts
interface SendReminderInput {
  clientId: string
  tenantId: string
  invoiceId: string
  templateName: string
  channel: MessageChannel
}

interface SendReminderOutput {
  messageId: string
  providerMessageId: string
  status: 'queued' | 'sent'
}

class SendReminderUseCase implements Usecase<SendReminderInput, SendReminderOutput> {
  constructor(
    private uow: UnitOfWork,
    private messageRepo: MessageRepository,
    private invoiceRepo: InvoiceRepository,
    private clientRepo: ClientRepository,
    private messageProvider: MessageProviderPort,
    private eventBus: EventBusPort
  ) {}
}
```

### 3.5 Decision Engine Architecture (AI/Heuristic)

#### 3.5.1 Cold Start Heuristic (MVP — Mês 1)

```
┌──────────────────────────────────────────────────────────────────┐
│                    Decision Engine Pipeline                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  INPUT: clientId, tenantId, invoiceId (opcional)                  │
│                                                                   │
│  1. LOAD FEATURES                                                  │
│     ├── Client profile (onboarding prefs, risk score)             │
│     ├── Invoice data (amount, dueDate, status)                    │
│     ├── Recent messages (last 7 days engagement)                  │
│     ├── Payment history (avg delay, payment method)               │
│     └── Tenant benchmark (niche-based defaults)                   │
│                                                                   │
│  2. DECIDE NEXT ACTION                                             │
│     ├── Rule 1: Is this FIRST invoice?                             │
│     │   └── YES: Use onboarding preferences (cold start)          │
│     ├── Rule 2: Has client engaged recently? (< 7d)               │
│     │   └── NO:  Use benchmark defaults for niche                 │
│     ├── Rule 3: Bandit recommends channel/time?                   │
│     │   └── YES: Use bandit recommendation (exploit)              │
│     ├── Rule 4: Should explore (random < epsilon)?                │
│     │   └── YES: Try alternative channel/time (explore)           │
│     └── Default: Fallback to tenant's BillingSchedule rules       │
│                                                                   │
│  3. LOG DECISION                                                  │
│     └── DecisionLog: action, reason, features, confidence         │
│                                                                   │
│  4. ENQUEUE MESSAGE (if action = send_message)                    │
│     └── BullMQ queue: {clientId, channel, template, sendAt}      │
│                                                                   │
│  OUTPUT: {action, channel, template, sendAt, reason}              │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

#### 3.5.2 Bandit Algorithm (MVP — Mês 1)

```typescript
// application/services/next-action-decider.service.ts
// Thompson Sampling para otimização de horário + canal
interface BanditArm {
  channel: MessageChannel
  timeBucket: string  // "morning" | "afternoon" | "evening" | "night"
  templateName: string
}

interface BanditState {
  arm: BanditArm
  alpha: number  // successes (payment within 24h of message)
  beta: number   // failures (no payment within 24h)
}

class ThompsonSamplingBandit {
  // Para cada cliente, mantém distribuição Beta(alpha, beta) por arm
  // Na decisão: sample de cada arm, escolhe a maior amostra
  // No feedback: atualiza alpha/beta do arm escolhido
  selectArm(states: BanditState[]): { arm: BanditArm; confidence: number }
  updateFeedback(state: BanditState, success: boolean): BanditState
}
```

#### 3.5.3 Risk Scoring Heuristic (MVP)

```typescript
// application/services/risk-calculator.service.ts
class RiskCalculatorService {
  // Heurística baseada em regras + features comportamentais
  calculate(client: Client, paymentHistory: Payment[], messages: Message[]): {
    score: RiskScore
    probability: number
    features: Feature[]
    reason: string
  }
  // Features usadas:
  // 1. payment_delay_avg: atraso médio em dias
  // 2. payment_delay_max: maior atraso
  // 3. payment_delay_trend: tendência (piorando/melhorando)
  // 4. msg_open_rate_7d: taxa de abertura nos últimos 7 dias
  // 5. msg_click_rate_7d: taxa de clique nos últimos 7 dias
  // 6. days_since_last_payment: dias desde último pagamento
  // 7. invoice_amount_vs_avg: valor da fatura vs média do cliente
  // 8. onboarding_completed: onboarding feito?
  // 9. preferred_channel_used: canal preferido sendo usado?
  // 10. tenure_days: tempo de relacionamento
}
```

### 3.6 Queue Architecture (BullMQ)

| Queue | Consumers | Description | Retry Policy | Priority |
|---|---|---|---|---|
| `send-message` | 1 worker (3 concurrency) | Envia mensagens via Evolution API | 3 retries, exponential backoff 30s-5min | High |
| `process-payment` | 1 worker (2 concurrency) | Processa pagamento via gateway | 3 retries, 10s-60s | High |
| `reconcile-payment` | 1 worker (5 concurrency) | Reconcilia pagamento via webhook | 5 retries, 10s-2min | High |
| `update-risk-score` | 1 worker (1 concurrency) | Recalcula risk score após evento | 2 retries, 30s | Low |
| `generate-report` | 1 worker (1 concurrency) | Gera relatórios (under 5min) | 2 retries, 1min | Low |
| `event-collector` | 1 worker (10 concurrency) | Persiste eventos no PostgreSQL | 3 retries, 5s | Medium |

### 3.7 Cache Strategy (Redis)

| Key Pattern | TTL | Purpose |
|---|---|---|
| `decision:{clientId}:{invoiceId}` | 5 min | Decision cache (recalcular se enventos novos) |
| `risk:{clientId}` | 1 hour | Risk score cache |
| `benchmark:{niche}` | 24 hours | Niche benchmark (calculado via query agregada) |
| `session:{evolutionInstance}` | 1 hour | Evolution API session cache |
| `rate-limit:{tenantId}:{endpoint}` | 1 min | Rate limiting counters |
| `pix-qrcode:{invoiceId}` | Until expiry | PIX QRCode cache (evita regenerar) |

---

## 4. API Contracts (Fastify Routes)

### 4.1 Standard Response Format

```json
// Success
{
  "data": { ... },
  "meta": {
    "page": 1,
    "perPage": 20,
    "total": 150
  }
}

// Error
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Campo 'amount' deve ser maior que zero",
    "details": [ ... ]
  }
}
```

### 4.2 Client Management

#### `POST /api/clients` — Create Client

**Authentication**: Required (Tenant API Key)
**Rate Limit**: 100/min per tenant

**Request Body**:
```typescript
const createClientSchema = z.object({
  name: z.string().min(2).max(200),
  phone: z.string().regex(/^\d{10,11}$/),
  email: z.string().email().optional(),
  preferredChannel: z.enum(['whatsapp', 'email', 'sms']).default('whatsapp'),
  preferredTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  preferredLeadDays: z.number().int().min(1).max(15).default(5),
  metadata: z.record(z.unknown()).optional(),
});
```

**Responses**:
- `201 Created`: `{ data: Client }`
- `400 Bad Request`: `{ error: { code: "VALIDATION_ERROR", message: "..." } }`
- `409 Conflict`: `{ error: { code: "CONFLICT", message: "Cliente com este telefone já cadastrado" } }`

---

#### `GET /api/clients` — List Clients

**Query Parameters**:
```typescript
const listClientsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),            // name or phone search
  riskScore: z.enum(['green','yellow','red']).optional(),
  channel: z.enum(['whatsapp','email','sms']).optional(),
  onboardingCompleted: z.coerce.boolean().optional(),
  sortBy: z.enum(['name','createdAt','riskScore']).default('createdAt'),
  sortOrder: z.enum(['asc','desc']).default('desc'),
});
```

**Responses**:
- `200 OK`: `{ data: Client[], meta: { page, perPage, total } }`

---

#### `GET /api/clients/:id` — Get Client

**Responses**:
- `200 OK`: `{ data: Client }`
- `404 Not Found`: `{ error: { code: "NOT_FOUND", message: "Cliente não encontrado" } }`

---

#### `PATCH /api/clients/:id` — Update Client

**Request Body** (all optional):
```typescript
const updateClientSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  phone: z.string().regex(/^\d{10,11}$/).optional(),
  email: z.string().email().optional(),
  preferredChannel: z.enum(['whatsapp', 'email', 'sms']).optional(),
  preferredTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  preferredLeadDays: z.number().int().min(1).max(15).optional(),
  metadata: z.record(z.unknown()).optional(),
});
```

**Responses**:
- `200 OK`: `{ data: Client }`
- `409 Conflict`: `{ error: { code: "CONFLICT", message: "Telefone já cadastrado para outro cliente" } }`

---

#### `GET /api/clients/:id/risk-score` — Get Risk Score

**Responses**:
- `200 OK`:
```json
{
  "data": {
    "clientId": "uuid",
    "riskScore": "yellow",
    "probability": 0.45,
    "topFeatures": [
      { "name": "payment_delay_avg", "value": 7, "impact": 0.32 },
      { "name": "msg_open_rate_7d", "value": 0.15, "impact": 0.28 },
      { "name": "onboarding_completed", "value": 1, "impact": -0.15 }
    ],
    "reason": "Atraso médio de 7 dias + baixa abertura de mensagens",
    "calculatedAt": "2026-07-25T10:00:00Z"
  }
}
```

**Nota**: Este endpoint aciona o `CalculateRiskScoreUseCase` se o cache estiver expirado.

---

### 4.3 Invoices & Billing

#### `POST /api/invoices` — Create Invoice

**Request Body**:
```typescript
const createInvoiceSchema = z.object({
  clientId: z.string().uuid(),
  amount: z.number().positive().multipleOf(0.01),
  dueDate: z.string().datetime(),          // ISO 8601
  paymentMethod: z.enum(['pix', 'boleto', 'credit_card']).default('pix'),
  description: z.string().max(500).optional(),
  subscriptionId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});
```

**Responses**:
- `201 Created`: `{ data: { invoice: Invoice, paymentInfo: { pixQrCode?, pixCopiaECola?, ... } } }`
- `422 Unprocessable Entity`: `{ error: { code: "DOMAIN_ERROR", message: "..." } }`

---

#### `GET /api/invoices` — List Invoices

**Query Parameters**:
```typescript
const listInvoicesQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['pending','paid','overdue','cancelled','refunded']).optional(),
  clientId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  paymentMethod: z.enum(['pix','boleto','credit_card']).optional(),
  sortBy: z.enum(['dueDate','createdAt','amount','status']).default('dueDate'),
  sortOrder: z.enum(['asc','desc']).default('desc'),
});
```

---

#### `GET /api/invoices/:id` — Get Invoice Details

Includes: Invoice data, Payment info (if exists), Client summary, Message history for this invoice.

---

#### `POST /api/invoices/:id/pay` — Process Payment

**Request Body**:
```typescript
const processPaymentSchema = z.object({
  paymentMethod: z.enum(['pix', 'boleto', 'credit_card']),
  pixCopiaECola: z.string().optional(),      // pre-filled PIX for 1-click
  creditCardToken: z.string().optional(),     // tokenized card
});
```

**Responses**:
- `200 OK`: `{ data: { payment, invoice, receiptUrl? } }`
- `400 Bad Request`: Se invoice já está paga
- `402 Payment Required`: Se pagamento falhou
- `422`: Se dados de pagamento inválidos

---

#### `GET /api/invoices/:id/pix-qrcode` — Get PIX QRCode

**Response**:
- `200 OK`: `{ data: { pixQrCode (base64), pixCopiaECola, expiresAt } }`
- `404`: Invoice não encontrada ou método não é PIX

---

### 4.4 Reminders & Communication

#### `POST /api/reminders/schedule` — Schedule a Reminder

**Request Body**:
```typescript
const scheduleReminderSchema = z.object({
  clientId: z.string().uuid(),
  invoiceId: z.string().uuid(),
  templateName: z.string().optional(),  // se omitido, Decision Engine escolhe
  sendAt: z.string().datetime().optional(), // se omitido, Decision Engine escolhe
  channel: z.enum(['whatsapp','email','sms']).optional(), // se omitido, Decision Engine escolhe
});
```

**Nota**: Se `templateName`, `sendAt` e `channel` forem omitidos, o Decision Engine escolhe tudo automaticamente via `DecideNextActionUseCase`.

**Responses**:
- `201 Created`: `{ data: { messageId, providerMessageId, status, scheduledFor } }`

---

#### `GET /api/messages` — List Message Delivery Status

**Query Parameters**:
```typescript
const listMessagesQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  clientId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),
  status: z.enum(['queued','sent','delivered','read','clicked','failed']).optional(),
  channel: z.enum(['whatsapp','email','sms']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});
```

---

#### `GET /api/messages/:id/tracking` — Get Message Tracking

**Response**:
```json
{
  "data": {
    "id": "uuid",
    "clientId": "uuid",
    "channel": "whatsapp",
    "templateName": "friendly_reminder_d3",
    "timeline": [
      { "event": "queued", "timestamp": "..." },
      { "event": "sent", "timestamp": "..." },
      { "event": "delivered", "timestamp": "..." },
      { "event": "read", "timestamp": "..." },
      { "event": "clicked", "timestamp": "..." }
    ]
  }
}
```

---

### 4.5 Decision Engine

#### `GET /api/decisions/next-action?clientId=X&invoiceId=Y` — Get Next Best Action

**Query Parameters**:
```typescript
const nextActionQuery = z.object({
  clientId: z.string().uuid(),
  invoiceId: z.string().uuid().optional(),
});
```

**Response**:
- `200 OK`:
```json
{
  "data": {
    "clientId": "uuid",
    "action": "send_message",
    "channel": "whatsapp",
    "templateName": "friendly_reminder_d3",
    "sendAt": "2026-07-25T19:00:00Z",
    "reason": "Cliente prefere noturno (onboarding). D-3 padrão para segmento verde.",
    "confidence": 0.85,
    "explored": false
  }
}
```

**Performance SLA**: < 50ms p95 (cache hit) / < 200ms p95 (cache miss)

---

#### `POST /api/decisions/feedback` — Record Action Outcome

**Request Body**:
```typescript
const decisionFeedbackSchema = z.object({
  decisionLogId: z.string().uuid(),
  outcome: z.enum(['success', 'failure', 'pending']),
  metadata: z.record(z.unknown()).optional(),
});
```

**Nota**: Este endpoint alimenta o Bandit (atualiza alpha/beta do arm usado). Chamado por webhooks internos quando um evento de pagamento ou leitura é recebido.

---

### 4.6 Tenant Configuration

#### `GET /api/tenants/:id/config` — Get Tenant Configuration

**Response**:
```json
{
  "data": {
    "id": "uuid",
    "name": "Academia Fit",
    "taxId": "12.345.678/0001-90",
    "niche": "gym",
    "plan": "pro",
    "active": true,
    "createdAt": "..."
  }
}
```

---

#### `PATCH /api/tenants/:id/config` — Update Tenant Configuration

**Request Body**:
```typescript
const updateTenantSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});
```

---

#### `GET /api/tenants/:id/payment-provider` — Get Payment Provider Config

**Response**:
```json
{
  "data": {
    "provider": "asaas",
    "environment": "sandbox",
    "active": true,
    "config": {
      "pixEnabled": true,
      "boletoEnabled": true,
      "creditCardEnabled": false
    }
  }
}
```

**Nota**: API key nunca é retornada na resposta (sempre mascarada).

---

#### `PUT /api/tenants/:id/payment-provider` — Set Payment Provider

**Request Body**:
```typescript
const setPaymentProviderSchema = z.object({
  provider: z.enum(['asaas', 'mercadopago', 'pagbank', 'polar']),
  apiKey: z.string().min(1),
  environment: z.enum(['sandbox', 'production']).default('sandbox'),
  config: z.object({
    pixEnabled: z.boolean().default(true),
    boletoEnabled: z.boolean().default(false),
    creditCardEnabled: z.boolean().default(false),
  }).default({}),
});
```

**Responses**:
- `200 OK`: `{ data: { provider, environment, active } }`
- `400`: `{ error: { code: "VALIDATION_ERROR", message: "Chave de API inválida" } }`
- `422`: `{ error: { code: "DOMAIN_ERROR", message: "Falha ao testar conexão com provedor" } }`

---

### 4.7 Webhooks (External)

#### `POST /api/webhooks/payment/:provider` — Payment Gateway Webhooks

**Providers**: `asaas`, `mercadopago`, `pagbank`, `polar`

**Autenticação**: Validação HMAC de assinatura (cada provider tem seu método)

**Fluxo**:
1. Fastify recebe payload raw + headers
2. Roteia para o provider handler correto
3. Provider valida assinatura HMAC
4. Normaliza evento para formato interno (`PaymentConfirmed | PaymentFailed`)
5. Enfileira job `reconcile-payment` no BullMQ
6. Retorna `200 OK` imediatamente (< 100ms)

**Response**: `200 OK: { received: true }`

**Nota**: Nunca exponha lógica de negócio aqui — apenas validação + enfileiramento.

---

#### `POST /api/webhooks/evolution` — Evolution API Webhooks

**Eventos Esperados**:
| Event Type | Ação |
|---|---|
| `messages.upsert` | Mensagem recebida (resposta do cliente) |
| `messages.update` | Status update (delivered, read, etc.) |
| `send.message` | Mensagem enviada com sucesso |
| `connection.update` | Conexão WhatsApp (connected/disconnected/qrcode) |

**Fluxo**:
1. Fastify recebe payload
2. Valida com Zod schema
3. Se `messages.update` com status de entrega/leitura → Atualiza Message status + emite domain event
4. Se `connection.update` com QR Code → Notifica tenant via websocket ou polling
5. Retorna `200 OK` imediatamente

---

#### `GET /api/webhooks/evolution/register` — Register Webhook URL

**Query Parameters**:
```typescript
const registerWebhookSchema = z.object({
  url: z.string().url().default('https://api.agiliza.com/webhooks/evolution'),
  events: z.array(z.string()).default(['messages.upsert', 'messages.update', 'send.message', 'connection.update']),
});
```

**Response**: `200 OK: { registered: true, webhookId: "..." }`

---

### 4.8 Dashboard / Reports

#### `GET /api/reports/cash-flow` — Cash Flow Forecast

**Query Parameters**:
```typescript
const cashFlowQuery = z.object({
  months: z.coerce.number().int().min(1).max(12).default(3),
  tenantId: z.string().uuid(),
});
```

**Response**:
```json
{
  "data": {
    "forecast": [
      {
        "month": "2026-08",
        "expectedRevenue": 85000.00,
        "expectedDefaults": 5100.00,
        "recoveryEstimate": 2550.00,
        "netForecast": 82450.00,
        "confidence": 0.85
      }
    ],
    "totalExpected": 255000.00,
    "totalAtRisk": 15300.00,
    "generatedAt": "2026-07-25T10:00:00Z"
  }
}
```

---

#### `GET /api/reports/risk-distribution` — Risk Distribution

**Response**:
```json
{
  "data": {
    "green": { "count": 150, "totalValue": 75000.00 },
    "yellow": { "count": 75, "totalValue": 37500.00 },
    "red": { "count": 25, "totalValue": 12500.00 },
    "total": { "count": 250, "totalValue": 125000.00 },
    "generatedAt": "2026-07-25T10:00:00Z"
  }
}
```

---

#### `GET /api/reports/recovery-rate` — Recovery Rate by Template/Segment

**Query Parameters**:
```typescript
const recoveryRateQuery = z.object({
  dateFrom: z.string().datetime(),
  dateTo: z.string().datetime(),
  segmentBy: z.enum(['template', 'riskScore', 'channel', 'niche']).default('template'),
});
```

**Response**:
```json
{
  "data": [
    {
      "segment": "friendly_reminder_d3",
      "sent": 500,
      "delivered": 480,
      "read": 350,
      "clicked": 200,
      "paid": 150,
      "recoveryRate": 0.30
    }
  ]
}
```

---

#### `GET /api/reports/collection-efficiency` — Collection Efficiency Metrics

**Response**:
```json
{
  "data": {
    "overdueRate": 0.12,
    "recoveryRate30d": 0.65,
    "recoveryRate60d": 0.80,
    "averagePaymentDelay": 4.5,
    "pixConversionRate": 0.78,
    "messageOpenRate": 0.72,
    "messageClickRate": 0.45,
    "averageTimeToPayment": "2.3 hours",
    "totalInvoiced": 125000.00,
    "totalCollected": 110000.00,
    "totalOutstanding": 15000.00,
    "generatedAt": "2026-07-25T10:00:00Z"
  }
}
```

---

### 4.9 Error Codes Summary

| HTTP Code | Error Code | Description | When |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | Input validation failed | Zod schema violation |
| 401 | `UNAUTHORIZED` | Missing/invalid API key | No auth header |
| 403 | `FORBIDDEN` | No permission for resource | Cross-tenant access |
| 404 | `NOT_FOUND` | Resource not found | Invalid ID |
| 409 | `CONFLICT` | Resource conflict | Duplicate phone/email |
| 422 | `DOMAIN_ERROR` | Business rule violation | Invalid state transition |
| 429 | `RATE_LIMITED` | Too many requests | Rate limit exceeded |
| 500 | `INTERNAL_ERROR` | Unexpected error | Bug or infra failure |
| 502 | `PROVIDER_ERROR` | External provider failed | Payment gateway down |

---

## 5. Event Schema (Data Contracts)

### 5.1 Standard Event Envelope

```typescript
// Todo evento do sistema segue este formato
interface DomainEvent {
  eventId: string              // UUID v7
  eventType: EventType
  clientId: string
  tenantId: string
  timestamp: string           // ISO 8601
  metadata: Record<string, unknown>
  correlationId?: string      // Para tracing de fluxos completos
  causationId?: string        // ID do evento que causou este
}
```

### 5.2 Event Types

```typescript
type EventType =
  // Messaging Events
  | 'message.sent'
  | 'message.delivered'
  | 'message.read'
  | 'message.clicked'
  | 'message.failed'
  | 'message.received'         // Cliente respondeu

  // Payment Events
  | 'payment.created'
  | 'payment.pending'
  | 'payment.confirmed'
  | 'payment.failed'
  | 'payment.refunded'

  // Invoice Events
  | 'invoice.created'
  | 'invoice.overdue'
  | 'invoice.paid'
  | 'invoice.cancelled'

  // Client Events
  | 'client.created'
  | 'client.updated'
  | 'client.onboarding.completed'
  | 'client.risk.updated'

  // Decision Events
  | 'decision.made'
  | 'decision.feedback.recorded'

  // Tenant Events
  | 'tenant.created'
  | 'tenant.provider.changed'
  | 'tenant.schedule.updated'

  // System Events
  | 'system.error'
  | 'system.warning'
```

### 5.3 Event Payload Schemas

```typescript
// message.sent
interface MessageSentEvent extends DomainEvent {
  eventType: 'message.sent'
  metadata: {
    messageId: string
    channel: 'whatsapp' | 'email' | 'sms'
    templateName: string
    invoiceId?: string
    providerMessageId: string
  }
}

// message.read
interface MessageReadEvent extends DomainEvent {
  eventType: 'message.read'
  metadata: {
    messageId: string
    channel: 'whatsapp'
    invoiceId?: string
    readDelay: number  // segundos entre sent e read
  }
}

// message.clicked
interface MessageClickedEvent extends DomainEvent {
  eventType: 'message.clicked'
  metadata: {
    messageId: string
    channel: 'whatsapp'
    invoiceId?: string
    clickType: 'pix_link' | 'boleto_link' | 'card_link'
    clickDelay: number  // segundos entre sent e click
  }
}

// payment.confirmed
interface PaymentConfirmedEvent extends DomainEvent {
  eventType: 'payment.confirmed'
  metadata: {
    invoiceId: string
    paymentId: string
    amount: number
    paymentMethod: 'pix' | 'boleto' | 'credit_card'
    provider: PaymentProvider
    providerPaymentId: string
    fee: number
    netAmount: number
    paidAt: string
  }
}

// payment.failed
interface PaymentFailedEvent extends DomainEvent {
  eventType: 'payment.failed'
  metadata: {
    invoiceId: string
    paymentId: string
    amount: number
    paymentMethod: 'pix' | 'boleto' | 'credit_card'
    provider: PaymentProvider
    failureReason: string
    failureCode?: string
  }
}

// invoice.overdue
interface InvoiceOverdueEvent extends DomainEvent {
  eventType: 'invoice.overdue'
  metadata: {
    invoiceId: string
    amount: number
    dueDate: string
    daysOverdue: number
    totalAttemptedPayments: number
    lastAction?: string
  }
}

// decision.made
interface DecisionMadeEvent extends DomainEvent {
  eventType: 'decision.made'
  metadata: {
    decisionLogId: string
    action: string
    channel?: string
    templateName?: string
    reason: string
    confidence: number
    modelVersion: string
    features: Record<string, number>
    invoiceId?: string
  }
}

// client.risk.updated
interface ClientRiskUpdatedEvent extends DomainEvent {
  eventType: 'client.risk.updated'
  metadata: {
    previousRiskScore: string
    newRiskScore: string
    probability: number
    reason: string
    topFeatures: Array<{ name: string; value: number; impact: number }>
  }
}
```

### 5.4 Event Storage

- **Storage Engine**: PostgreSQL (tabela `events` com índice em `(tenantId, eventType, timestamp)`)
- **Modelo**: Append-only (sem updates ou deletes)
- **Retenção**: 90 dias para dados brutos, resumos agregados mantidos permanentemente
- **Tamanho Estimado**: ~500 bytes/evento. 10k invoices/mês × 10 eventos/invoice = 100k eventos/mês = ~50MB/mês

```prisma
model Event {
  id            String   @id @default(uuid()) @db.Uuid
  eventId       String   @unique @db.Uuid
  eventType     String   @db.VarChar(50)
  clientId      String   @db.Uuid
  tenantId      String   @db.Uuid
  timestamp     DateTime @db.Timestamptz()
  metadata      Json
  correlationId String?  @db.Uuid
  causationId   String?  @db.Uuid
  createdAt     DateTime @default(now())

  @@index([tenantId, eventType, timestamp])
  @@index([clientId, timestamp])
  @@index([eventType, timestamp])
}
```

---

## 6. Acceptance Criteria (Measurable)

### 6.1 Epic 1: Client Onboarding & Configuration

#### AC1: B2B user registers tenant and configures payment provider
```gherkin
Given a B2B user with valid registration data (name, email, CNPJ, phone, niche)
When they submit POST /api/tenants/:id/payment-provider with:
  | provider | asaas |
  | apiKey   | valid_sandbox_key |
  | environment | sandbox |
Then the system returns 200 OK
And the payment provider is stored encrypted
And a connection test is performed against Asaas sandbox
And the tenant is marked as active
```

#### AC2: B2B user imports/creates clients with basic profile
```gherkin
Given an active tenant with valid payment provider
When they submit POST /api/clients with:
  | name  | João Silva       |
  | phone | 5511999998888    |
Then the system returns 201 Created
And the client is stored with riskScore = "green" (cold start default)
And an onboarding WhatsApp message is queued with 3 preference questions
```

#### AC3: System captures client communication preferences via WhatsApp
```gherkin
Given a client created without onboarding preferences
When the system sends the onboarding message with 3 questions
And the client responds to all 3 questions within 24h
Then the client's preferredChannel, preferredTime, and preferredLeadDays are updated
And onboardingCompleted is set to true
And the Decision Engine starts using personalized preferences
```

### 6.2 Epic 2: Smart Billing & Reminders

#### AC4: System generates invoice on due date
```gherkin
Given a subscription with billingDay = 15 and amount = R$ 150,00
When the cron job runs on day 15 at 00:00 UTC-3
Then an invoice is created with status = "pending" and dueDate = current date + 30 days
And a PIX charge is created via the configured payment provider
And the invoice stores the PIX QRCode and Copia e Cola
And a DomainEvent "invoice.created" is emitted
```

#### AC5: System sends WhatsApp reminder at optimal time
```gherkin
Given a pending invoice due in 3 days
And the client has preferredTime = "19:00" and preferredLeadDays = 3
When the Decision Engine decides next action
Then the system queues a WhatsApp message with template "friendly_reminder_d3"
And the message is scheduled for 19:00 on D-3
And a DecisionLog is created with the decision reason
```

#### AC6: Client clicks PIX link and completes payment in < 5 seconds
```gherkin
Given a client receives a WhatsApp reminder with a PIX link (copia e cola)
When the client clicks the link
And the banking app opens with the PIX pre-filled
And the client authenticates via biometrics and confirms
Then the payment is processed by the provider
And the webhook confirms within 30 seconds
```

#### AC7: System confirms payment and sends receipt automatically
```gherkin
Given a webhook notification of payment.confirmed for invoice X
When the ReconcilePaymentUseCase processes the webhook
Then the invoice status changes to "paid"
And a receipt message is sent via WhatsApp with invoice details
And a DomainEvent "payment.confirmed" is emitted
And the client's risk score is recalculated (likely improving)
```

### 6.3 Epic 3: Risk Scoring (MVP Heuristic)

#### AC8: System classifies each client as Green/Yellow/Red
```gherkin
Given a client with:
  | paymentHistory | 5 payments, avg delay = 2 days, max delay = 5 days |
  | messages       | 80% open rate, 60% click rate |
  | onboarding     | completed |
When the CalculateRiskScoreUseCase executes
Then the risk score is "green"
And the probability is >= 0.90
And the top features include positive indicators

Given a client with:
  | paymentHistory | 3 payments, 1 overdue, avg delay = 15 days |
  | messages       | 20% open rate, 5% click rate |
When the CalculateRiskScoreUseCase executes
Then the risk score is "red"
And the probability is >= 0.70
```

#### AC9: Dashboard shows risk distribution with drill-down
```gherkin
Given the system has 200 clients classified as green, 75 as yellow, 25 as red
When the B2B user accesses GET /api/reports/risk-distribution
Then the response shows:
  | green  | count: 200 | totalValue: R$ 100.000 |
  | yellow | count: 75  | totalValue: R$ 37.500  |
  | red    | count: 25  | totalValue: R$ 12.500  |
When the user drills into "red" segment
Then they see the list of 25 clients with top risk factors for each
```

### 6.4 Epic 4: Payment Reconciliation

#### AC10: System auto-reconciles payments via webhook within 30 seconds
```gherkin
Given a pending invoice with externalPaymentId = "pay_123"
When the Asaas webhook sends payment.confirmed for externalPaymentId "pay_123"
Then within 30 seconds the invoice status changes to "paid"
And a payment record is created with status "confirmed"
And the client's risk score is updated
```

#### AC11: Failed webhooks are retried up to 3 times with exponential backoff
```gherkin
Given the payment gateway sends a webhook
And the infrastructure returns an error (e.g., database timeout)
Then the webhook processing is retried
With backoff: 10s, 30s, 90s
If all 3 retries fail, the webhook payload is saved to a dead-letter queue
And a "Exceptions" panel entry is created for manual reconciliation
```

#### AC12: Unreconciled payments are flagged in "Exceptions" panel
```gherkin
Given a payment was confirmed by the provider but reconciliation failed
And the dead-letter queue has the event
When a daily cron job runs at 03:00
Then it attempts to reconcile via API query
If reconciliation still fails, the invoice is flagged with status = "pending_reconciliation"
And the "Exceptions" panel on the dashboard shows 1 pending item
```

### 6.5 Epic 5: Dashboard & Reports

#### AC13: Dashboard shows real-time collection metrics
```gherkin
Given the tenant has invoices across all statuses
When the B2B user accesses GET /api/reports/collection-efficiency
Then the response includes within 500ms:
  | overdueRate | recoveryRate30d | pixConversionRate | messageOpenRate |
And the totalInvoiced matches the sum of all invoices
And the totalCollected matches the sum of all paid invoices
```

#### AC14: System generates cash flow forecast
```gherkin
Given the tenant has 250 active clients with subscriptions
And the risk distribution is (green=150, yellow=75, red=25)
When the user requests GET /api/reports/cash-flow?months=3
Then the response includes a month-by-month forecast
And the netForecast = expectedRevenue - expectedDefaults + recoveryEstimate
And the confidence is higher for month 1 (> 0.90) than month 3 (< 0.80)
```

---

## 7. Non-Functional Requirements

### 7.1 Performance

| Metric | Target | Measurement | Notes |
|---|---|---|---|
| API Response (p95) | < 200ms | All authenticated endpoints | Exclui webhooks |
| Decision API (p95) | < 50ms | Cache hit; < 200ms cache miss | GET /next-action |
| Webhook Processing | < 100ms | Ack to provider | Só validação + enfileiramento |
| Report Generation | < 5s | 95th percentile | Para até 50k clients |
| Invoice Generation | < 2s | Per invoice batch | Batch de até 100 invoices |
| P95 Latency | < 500ms | Entre webhook e confirmação | Inclui BullMQ processing |
| Concurrent Users | 100 | Simultâneos no dashboard | B2B users |
| Event Ingestion | 1000/s | Pico de eventos | Webhooks + tracking |

### 7.2 Availability

| Metric | Target | Measurement Period |
|---|---|---|
| Uptime (business hours) | 99.5% | 08:00-20:00, seg-sex |
| Uptime (full week) | 99.0% | 7 dias |
| Planned Downtime | < 4h/mês | Comunicado com 48h de antecedência |
| Recovery Time (RTO) | < 1h | Para falha catastrófica |
| Recovery Point (RPO) | < 5min | Perda máxima de dados |

### 7.3 Scalability

- **Horizontal Scaling**: Backend Fastify é stateless, escala horizontalmente via load balancer
- **Database Connections**: Pool de conexões PostgreSQL (max 20 por instância)
- **Queue Processing**: Workers BullMQ escalam com redis cluster
- **Frontend CDN**: Next.js SSR com CDN caching para assets estáticos

### 7.4 Data

- **Event Data**: Append-only, imutável (nunca deletar/update events)
- **Multi-tenancy**: Isolamento completo via `tenantId` em todas as queries
- **Logs**: Structured JSON logs, shipped to stdout (Docker)
- **Backups**: PostgreSQL WAL contínuo + snapshots diários
- **Retention**: Events brutos 90 dias; agregados permanentemente

### 7.5 Cold Start Requirements

- Decision Engine funciona com ZERO dados históricos
- Heurística usa: onboarding prefs (3 perguntas) + benchmark de nicho
- Benchmark de nicho pré-carregado via `config/niche-benchmarks.json`
- Bandit começa com prior uniforme (Beta(1,1)) para cada arm
- Todos os endpoints retornam dados mesmo sem histórico (com `confidence` menor)

---

## 8. Security & Compliance Requirements

### 8.1 Data Protection

| Requirement | Implementation |
|---|---|
| PII Encryption at Rest | AES-256-GCM para campos sensíveis (phone, email, taxId, addresses) |
| API Key Encryption | AES-256-GCM para payment provider keys |
| Password Hashing | bcrypt (cost 10+) para senhas de B2B users |
| HTTPS | TLS 1.3 obrigatório em produção |
| Secrets Management | Todos os secrets via environment variables, nunca hardcoded |

### 8.2 Authentication & Authorization

| Mechanism | Details |
|---|---|
| B2B API Authentication | JWT (access + refresh tokens) ou API Key (header `X-API-Key`) |
| B2C Authentication | Link mágico via WhatsApp (token JWT de uso único) |
| Internal Auth | Serviços internos comunicam via mTLS ou network isolada |
| Webhook Verification | HMAC validation para cada gateway de pagamento |
| Rate Limiting | 100 req/min por tenant (endpoints públicos), 20 req/min (auth) |

### 8.3 Audit & Compliance

| Requirement | Implementation |
|---|---|
| Decision Audit | Todo decision.made tem DecisionLog imutável |
| Payment Audit | Raw webhook payload preservado no Payment.metadata |
| Data Deletion | Cascade delete por tenant (LGPD right to erasure) |
| Access Logs | Structured logs de todas as requisições autenticadas |
| LGPD Compliance | Consentimento explícito no onboarding; opt-out granular |

### 8.4 Security Checklist

- [ ] Todas as senhas hasheadas com bcrypt (cost >= 10)
- [ ] Todas as chaves de API criptografadas em repouso (AES-256-GCM)
- [ ] Webhook signatures validadas (HMAC-SHA256)
- [ ] Rate limiting ativo em todos os endpoints públicos
- [ ] CORS configurado apenas para origens conhecidas
- [ ] HTTP Security Headers (HSTS, CSP, X-Frame-Options)
- [ ] Prisma guarda contra SQL injection (parametrização nativa)
- [ ] Zod validação contra injection e payload malicioso
- [ ] Docker containers rodam como non-root
- [ ] Secrets injetados via env, não em arquivos de configuração

---

## 9. Out of Scope (MVP)

### 9.1 Features Excluídas do MVP (30 dias)

- **Federated Learning / Cross-tenant Model Sharing**: Modelos são por tenant no MVP
- **Python ML Microservice**: Decisão fica em TypeScript (heuristic + simple bandit)
- **Generative AI for Copywriting**: Templates escritos manualmente, pré-aprovados
- **Open Finance Integration**: Sem dados bancários externos no MVP
- **PWA Offline Mode**: Apenas online-first; PWA básico para instalação
- **Multi-language / Internationalization**: Português-BR apenas
- **Boleto Registration/Return**: Apenas PIX no MVP (boleto opcional pós-MVP)
- **Credit Card Tokenization**: Apenas PIX no MVP (cartão opcional pós-MVP)
- **Advanced Reports**: Apenas os 4 relatórios base (cash flow, risk, recovery, efficiency)
- **WebSocket / Real-time Dashboard Updates**: Atualização via pooling a cada 30s
- **SMS / Email Channels**: WhatsApp-only no MVP (canais adicionais pós-MVP)
- **Custom Domain / White-label**: Todos os tenants usam o mesmo domínio agiliza.com
- **Role-based Access Control (RBAC)**: Apenas owner/user no MVP

### 9.2 Justificativa

| Decisão | Motivação |
|---|---|
| PIX-only no MVP | 78% dos SMBs brasileiros preferem PIX; menos complexidade de integração |
| TypeScript-only | Evita split de stack (Node + Python) no MVP; bandit simples em TS resolve |
| WhatsApp-only | Evolution API resolve o delivery; email/SMS adicionam complexidade marginal |
| Heuristic + Bandit | ML supervisionado precisa de ~3 ciclos de dados para ser útil; heuristic funciona dia 1 |
| Sem RBAC | 1 humano + agentes = sem conflito de permissão no time pequeno |
| Relatórios simples | Dashboard de 4 cards + 3 gráficos cobre 80% das necessidades |

---

## 10. Design Patterns & Architecture Decisions

### 10.1 Strategy Pattern — Provedores Intercambiáveis

**Aplicado em**: Payment Provider, Message Provider

Sempre que houver mais de uma implementação para a mesma responsabilidade, definimos uma única interface na `application/ports` e cada provedor é uma implementação concreta na `infrastructure/`. Nunca usar `if/else` ou `switch` por provedor dentro do Use Case.

```typescript
// application/ports/gateways/payment-gateway.port.ts
// Várias implementações: AsaasPaymentGateway, MercadoPagoPaymentGateway, etc.
interface PaymentGatewayPort {
  createPixCharge(input: CreatePixChargeInput): Promise<Either<PaymentError, PixChargeResult>>
  // ...
}

// infrastructure/payment/asaas/asaas-payment.gateway.ts
class AsaasPaymentGateway implements PaymentGatewayPort { /* Asaas API calls */ }

// infrastructure/payment/polar/polar-payment.gateway.ts
class PolarPaymentGateway implements PaymentGatewayPort { /* Polar API calls */ }
```

O Use Case nunca sabe qual provider está sendo usado — depende apenas da interface `PaymentGatewayPort`.

### 10.2 Observer Pattern — Domain Events

**Aplicado em**: Event Bus, Webhook Processing, Messaging Effects

Quando uma ação de domínio precisa disparar efeitos colaterais desacoplados (enviar e-mail, atualizar risk score, notificar webhooks), emite-se um Domain Event via `EventBusPort`. O Use Case não sabe quantos handlers existem nem o que eles fazem.

```typescript
// Exemplo: PaymentConfirmedEvent tem 3 handlers
// 1. SendReceiptHandler → enfileira WhatsApp de recibo
// 2. UpdateRiskScoreHandler → recalcula risk score do cliente
// 3. NotifyOutboundWebhookHandler → notifica sistema externo se configurado
```

### 10.3 Factory Pattern — Composition Root

**Aplicado em**: `presentation/factories/`

Cada use case tem uma factory que monta todas as dependências. As instâncias são singletons criadas uma vez na inicialização do servidor.

### 10.4 Unit of Work — Transações Consistentes

**Aplicado em**: Todos os use cases que persistem dados

Usando `AsyncLocalStorage`, a transação é iniciada pelo UoW e propagada automaticamente para todos os repositórios dentro do mesmo `await` chain. Rollback automático em caso de erro.

### 10.5 Architectural Decision Records

#### ADR-001: TypeScript Heuristic over Python ML for MVP

- **Contexto**: MVP precisa de Decision Engine desde o dia 1
- **Decisão**: Implementar em TypeScript dentro do mesmo processo Fastify
- **Alternativas**: FastAPI + Python scikit-learn (rejeitado por complexidade de deploy)
- **Consequências**: Menos performance para modelos complexos, mas zero latência de rede e deploy simplificado
- **Evolução**: Extrair para microsserviço Python no Mês 3+ se dados validarem necessidade

#### ADR-002: PostgreSQL over Dedicated Event Store for MVP

- **Contexto**: Precisa armazenar eventos para auditoria e IA
- **Decisão**: Tabela `events` no PostgreSQL (append-only)
- **Alternativas**: Kafka (over-engineering para MVP), ClickHouse (mais um serviço para gerenciar)
- **Consequências**: PostgreSQL aguenta ~100k eventos/mês facilmente. Migrar para event store dedicado se escala exigir

#### ADR-003: UUID v7 over Serial/Autoincrement IDs

- **Contexto**: IDs precisam ser ordenáveis por tempo e seguros
- **Decisão**: UUID v7 (time-ordered UUID) para todas as entidades
- **Alternativas**: UUID v4 (não ordenável, ruim para índices), SERIAL (seqüencial, expõe volume de dados)
- **Consequências**: 128 bits vs 32 bits, mas índices performam bem com v7

---

## 11. Glossary (Ubiquitous Language)

| Termo | Definição |
|---|---|
| **Tenant** | Estabelecimento B2B que usa a plataforma para gerenciar cobranças |
| **Client** | Cliente final do Tenant (pessoa física que paga) |
| **Invoice** | Fatura gerada para um Client |
| **Payment** | Transação de pagamento associada a uma Invoice |
| **Subscription** | Plano/assinatura que gera Invoices automaticamente |
| **Message** | Mensagem enviada via WhatsApp (ou futuro canal) |
| **Decision Log** | Registro de auditoria de cada decisão do motor de IA/Heurística |
| **Risk Score** | Classificação do cliente (Green/Yellow/Red) baseada em probabilidade de inadimplência |
| **Bandit** | Algoritmo de aprendizado online (Thompson Sampling) que otimiza escolha de horário/canal |
| **Cold Start** | Capacidade de funcionar sem dados históricos (via onboarding + benchmark) |
| **Niche Benchmark** | Parâmetros de comportamento de pagamento agregados por segmento (ex: academia, escola) |
| **Billing Schedule** | Régua de cobrança configurada pelo Tenant (regras de quando/como cobrar) |
| **Webhook** | Callback HTTP recebido de provedores externos (pagamento, WhatsApp) |
| **Reconciliation** | Processo de conciliação entre pagamento recebido e invoice |
| **Evolution API** | Provedor de API WhatsApp utilizado no MVP |
| **Payment Provider** | Gateway de pagamento (Asaas, Mercado Pago, PagBank, Polar) |
| **Onboarding** | Coleta de 3 preferências do cliente via WhatsApp (horário, canal, antecedência) |
| **PIX Copia e Cola** | Chave PIX texto que permite pagamento com 1 clique (copy-paste no banco) |
| **HMAC** | Assinatura criptográfica para validar webhooks |

---

## Appendix A: Prisma Schema (MVP)

```prisma
// apps/backend/src/infrastructure/database/prisma/schema.prisma

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pgvector, pgcron]
}

// ─── Tenants (B2B Clients) ───────────────────────────────
model Tenant {
  id        String   @id @default(uuid()) @db.Uuid
  name      String   @db.VarChar(200)
  taxId     String   @unique @db.VarChar(20)
  email     String?  @db.VarChar(255)
  phone     String?  @db.VarChar(20)
  niche     String   @db.VarChar(50)   // school|gym|condo|pharmacy|bakery|supermarket|event
  plan      String   @default("starter") @db.VarChar(20)
  active    Boolean  @default(true)
  metadata  Json?
  createdAt DateTime @default(now()) @db.Timestamptz()
  updatedAt DateTime @updatedAt @db.Timestamptz()

  clients              Client[]
  invoices             Invoice[]
  payments             Payment[]
  subscriptions        Subscription[]
  messages             Message[]
  decisionLogs         DecisionLog[]
  events               Event[]
  paymentProviderConfigs PaymentProviderConfig[]
  messageTemplates     MessageTemplate[]
  billingSchedules     BillingSchedule[]
}

// ─── Clients (End Customers) ──────────────────────────────
model Client {
  id                 String   @id @default(uuid()) @db.Uuid
  tenantId           String   @db.Uuid
  name               String   @db.VarChar(200)
  phone              String   @db.VarChar(20)
  email              String?  @db.VarChar(255)
  preferredChannel   String   @default("whatsapp") @db.VarChar(20)
  preferredTime      String?  @db.VarChar(5)    // HH:mm
  preferredLeadDays  Int      @default(5)
  riskScore          String   @default("green") @db.VarChar(10)
  onboardingCompleted Boolean @default(false)
  metadata           Json?
  createdAt          DateTime @default(now()) @db.Timestamptz()
  updatedAt          DateTime @updatedAt @db.Timestamptz()

  tenant         Tenant        @relation(fields: [tenantId], references: [id])
  invoices       Invoice[]
  payments       Payment[]
  subscriptions  Subscription[]
  messages       Message[]
  decisionLogs   DecisionLog[]
  events         Event[]

  @@unique([tenantId, phone])
  @@index([tenantId, riskScore])
  @@index([tenantId, createdAt])
}

// ─── Invoices ────────────────────────────────────────────
model Invoice {
  id               String   @id @default(uuid()) @db.Uuid
  clientId         String   @db.Uuid
  tenantId         String   @db.Uuid
  amount           Decimal  @db.Decimal(10, 2)
  dueDate          DateTime @db.Date
  status           String   @default("pending") @db.VarChar(20)
  paymentMethod    String?  @db.VarChar(20)
  paidAt           DateTime? @db.Timestamptz()
  externalPaymentId String? @db.VarChar(255)
  paymentProvider  String?  @db.VarChar(50)
  pixQrCode        String?  @db.Text
  pixCopiaECola    String?  @db.Text
  boletoUrl        String?  @db.Text
  boletoBarcode    String?  @db.VarChar(255)
  linkUrl          String?  @db.Text
  subscriptionId   String?  @db.Uuid
  description      String?  @db.VarChar(500)
  metadata         Json?
  createdAt        DateTime @default(now()) @db.Timestamptz()
  updatedAt        DateTime @updatedAt @db.Timestamptz()

  client       Client       @relation(fields: [clientId], references: [id])
  tenant       Tenant       @relation(fields: [tenantId], references: [id])
  subscription Subscription? @relation(fields: [subscriptionId], references: [id])
  payments     Payment[]
  messages     Message[]
  decisionLogs DecisionLog[]
  events       Event[]

  @@index([tenantId, status])
  @@index([clientId, status])
  @@index([tenantId, dueDate])
  @@index([externalPaymentId])
}

// ─── Payments ────────────────────────────────────────────
model Payment {
  id               String   @id @default(uuid()) @db.Uuid
  invoiceId        String   @db.Uuid
  clientId         String   @db.Uuid
  tenantId         String   @db.Uuid
  amount           Decimal  @db.Decimal(10, 2)
  method           String   @db.VarChar(20)
  provider         String   @db.VarChar(50)
  providerPaymentId String  @db.VarChar(255)
  status           String   @default("pending") @db.VarChar(20)
  fee              Decimal? @db.Decimal(10, 2)
  netAmount        Decimal? @db.Decimal(10, 2)
  paidAt           DateTime? @db.Timestamptz()
  webhookReceivedAt DateTime? @db.Timestamptz()
  failureReason    String?  @db.Text
  failureCode      String?  @db.VarChar(50)
  metadata         Json?
  createdAt        DateTime @default(now()) @db.Timestamptz()

  invoice Invoice @relation(fields: [invoiceId], references: [id])
  client  Client  @relation(fields: [clientId], references: [id])
  tenant  Tenant  @relation(fields: [tenantId], references: [id])

  @@unique([provider, providerPaymentId])
  @@index([invoiceId, status])
  @@index([tenantId, createdAt])
}

// ─── Subscriptions ───────────────────────────────────────
model Subscription {
  id                String   @id @default(uuid()) @db.Uuid
  clientId          String   @db.Uuid
  tenantId          String   @db.Uuid
  planName          String   @db.VarChar(200)
  amount            Decimal  @db.Decimal(10, 2)
  frequency         String   @db.VarChar(20)    // monthly|weekly|yearly|custom
  billingDay        Int
  status            String   @default("active") @db.VarChar(20)
  currentPeriodStart DateTime? @db.Timestamptz()
  currentPeriodEnd  DateTime? @db.Timestamptz()
  cancelledAt       DateTime? @db.Timestamptz()
  metadata          Json?
  createdAt         DateTime @default(now()) @db.Timestamptz()
  updatedAt         DateTime @updatedAt @db.Timestamptz()

  client   Client    @relation(fields: [clientId], references: [id])
  tenant   Tenant    @relation(fields: [tenantId], references: [id])
  invoices Invoice[]

  @@index([tenantId, status])
  @@index([clientId, status])
}

// ─── Messages ────────────────────────────────────────────
model Message {
  id                String   @id @default(uuid()) @db.Uuid
  clientId          String   @db.Uuid
  tenantId          String   @db.Uuid
  invoiceId         String?  @db.Uuid
  channel           String   @db.VarChar(20)
  templateName      String?  @db.VarChar(100)
  providerMessageId String?  @db.VarChar(255)
  status            String   @default("queued") @db.VarChar(20)
  content           String?  @db.Text
  sentAt            DateTime? @db.Timestamptz()
  deliveredAt       DateTime? @db.Timestamptz()
  readAt            DateTime? @db.Timestamptz()
  clickedAt         DateTime? @db.Timestamptz()
  failedAt          DateTime? @db.Timestamptz()
  errorMessage      String?  @db.Text
  metadata          Json?
  createdAt         DateTime @default(now()) @db.Timestamptz()

  client  Client  @relation(fields: [clientId], references: [id])
  tenant  Tenant  @relation(fields: [tenantId], references: [id])
  invoice Invoice? @relation(fields: [invoiceId], references: [id])

  @@index([tenantId, status])
  @@index([clientId, createdAt])
  @@index([invoiceId])
}

// ─── Decision Logs ───────────────────────────────────────
model DecisionLog {
  id           String   @id @default(uuid()) @db.Uuid
  clientId     String   @db.Uuid
  tenantId     String   @db.Uuid
  invoiceId    String?  @db.Uuid
  action       String   @db.VarChar(50)
  channel      String?  @db.VarChar(20)
  templateName String?  @db.VarChar(100)
  reason       String   @db.Text
  confidence   Float?
  modelVersion String   @default("heuristic-v1") @db.VarChar(50)
  features     Json?
  outcome      String?  @db.VarChar(20)      // success|failure|pending
  createdAt    DateTime @default(now()) @db.Timestamptz()

  client  Client  @relation(fields: [clientId], references: [id])
  tenant  Tenant  @relation(fields: [tenantId], references: [id])
  invoice Invoice? @relation(fields: [invoiceId], references: [id])

  @@index([tenantId, createdAt])
  @@index([clientId, createdAt])
  @@index([action, outcome])
}

// ─── Events (Immutable Append-Only Log) ─────────────────
model Event {
  id            String   @id @default(uuid()) @db.Uuid
  eventId       String   @unique @db.Uuid
  eventType     String   @db.VarChar(50)
  clientId      String   @db.Uuid
  tenantId      String   @db.Uuid
  timestamp     DateTime @db.Timestamptz()
  metadata      Json
  correlationId String?  @db.Uuid
  causationId   String?  @db.Uuid
  createdAt     DateTime @default(now())

  client Client @relation(fields: [clientId], references: [id])
  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@index([tenantId, eventType, timestamp])
  @@index([clientId, timestamp])
  @@index([eventType, timestamp])
}

// ─── Payment Provider Configs ───────────────────────────
model PaymentProviderConfig {
  id              String   @id @default(uuid()) @db.Uuid
  tenantId        String   @db.Uuid
  provider        String   @db.VarChar(50)
  apiKeyEncrypted String   @db.Text          // AES-256-GCM encrypted
  environment     String   @default("sandbox") @db.VarChar(20)
  webhookSecretEncrypted String? @db.Text   // AES-256-GCM encrypted
  config          Json?                      // provider-specific options
  active          Boolean  @default(true)
  createdAt       DateTime @default(now()) @db.Timestamptz()
  updatedAt       DateTime @updatedAt @db.Timestamptz()

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, provider])
}

// ─── Message Templates ──────────────────────────────────
model MessageTemplate {
  id             String   @id @default(uuid()) @db.Uuid
  tenantId       String   @db.Uuid
  name           String   @db.VarChar(100)
  category       String   @db.VarChar(50)
  language       String   @default("pt_BR") @db.VarChar(10)
  body           String   @db.Text
  status         String   @default("pending") @db.VarChar(20)
  metaTemplateId String?  @db.VarChar(255)
  createdAt      DateTime @default(now()) @db.Timestamptz()
  updatedAt      DateTime @updatedAt @db.Timestamptz()

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, name])
}

// ─── Billing Schedules ──────────────────────────────────
model BillingSchedule {
  id        String   @id @default(uuid()) @db.Uuid
  tenantId  String   @db.Uuid
  name      String   @db.VarChar(200)
  rules     Json                              // array de regras
  active    Boolean  @default(true)
  isDefault Boolean  @default(false)
  createdAt DateTime @default(now()) @db.Timestamptz()
  updatedAt DateTime @updatedAt @db.Timestamptz()

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@index([tenantId, active])
}
```

## Appendix B: Frontend Page Structure (MVP)

```
apps/frontend/src/app/
├── layout.tsx                    // RootLayout (Inter font, metadata, manifest)
├── page.tsx                      // Redirect → /dashboard
├── globals.css                   // Tailwind + Shadcn/ui globals
│
├── (auth)/                       // Auth group
│   ├── login/
│   │   └── page.tsx
│   └── register/
│       └── page.tsx
│
├── dashboard/                    // Main dashboard
│   ├── page.tsx                  // Overview: collection metrics, risk pie, cash flow sparkline
│   ├── loading.tsx
│   └── error.tsx
│
├── clients/                      // Client management
│   ├── page.tsx                  // List + search + filters
│   ├── [id]/
│   │   └── page.tsx              // Client detail + risk score + payment history
│   └── new/
│       └── page.tsx              // Create client form
│
├── invoices/                     // Invoices
│   ├── page.tsx                  // List + filters (status, date, client)
│   ├── [id]/
│   │   └── page.tsx              // Invoice detail + payment info + timeline
│   └── new/
│       └── page.tsx              // Create invoice form (manual)
│
├── reminders/                    // Reminder management
│   ├── page.tsx                  // Schedule view + upcoming
│   └── [id]/
│       └── page.tsx              // Message tracking timeline
│
├── reports/                      // Reports
│   ├── cash-flow/
│   │   └── page.tsx
│   ├── risk-distribution/
│   │   └── page.tsx
│   ├── recovery-rate/
│   │   └── page.tsx
│   └── collection-efficiency/
│       └── page.tsx
│
├── settings/                     // Tenant configuration
│   ├── page.tsx                  // General settings
│   ├── payment/
│   │   └── page.tsx              // Payment provider config
│   ├── schedule/
│   │   └── page.tsx              // Billing schedule rules
│   └── templates/
│       └── page.tsx              // Message templates
│
├── clients/[id]/onboarding/
│   └── page.tsx                  // Onboarding status + manual trigger
│
└── api/                          // API routes (Next.js API proxy, if needed)
    └── ...proxy
```

## Appendix C: Environment Variables (Full Reference)

```env
# ─── App ─────────────────────────────────────────────
NODE_ENV=development                      # development | production | test
HOST=0.0.0.0
PORT=3333
FRONTEND_URL=http://localhost:3000
LOG_LEVEL=debug                           # debug | info | warn | error

# ─── Database ────────────────────────────────────────
DATABASE_URL=postgresql://dev:dev@localhost:5432/agiliza

# ─── Redis ───────────────────────────────────────────
REDIS_URL=redis://localhost:6379

# ─── JWT / Auth ──────────────────────────────────────
JWT_SECRET=your-jwt-secret-change-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ─── Evolution API (WhatsApp) ────────────────────────
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=your-evolution-api-key
EVOLUTION_WEBHOOK_URL=http://localhost:3333/api/webhooks/evolution

# ─── Payment Provider (default: Asaas) ───────────────
# Provider selecionado via banco (PaymentProviderConfig)
# Mas pode-se definir default no env:
# PAYMENT_PROVIDER=asaas

# ─── Encryption ──────────────────────────────────────
ENCRYPTION_KEY=32-bytes-hex-key-for-aes-256-gcm

# ─── Rate Limiting ───────────────────────────────────
RATE_LIMIT_MAX=100                        # requests per minute per tenant
RATE_LIMIT_DURATION=60000                 # window in ms
```

---

> **Document Version**: 1.0.0
> **Last Updated**: 2026-07-25
> **Author**: Architect Agent
> **Review Status**: Pending — awaiting CTO review and approval
> **Related Specs**: `specs/*.spec.md` (to be generated from this SDD via `to-tickets`)
