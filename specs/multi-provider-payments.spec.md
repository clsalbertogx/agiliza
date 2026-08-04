# Spec: Multi-Provider Payments — 5 Gateways, Config Per-Tenant, Webhooks

> Status: **Implementado (Sprint 8–10)** — spec backfill. Contratos extraídos do código atual.
> Fonte: `apps/backend/src/{application/ports/gateways, infrastructure/payment, infrastructure/encryption, application/usecases/process-payment*, upsert/get-payment-provider-config}`.

## Contexto de Negócio

Cada tenant escolhe seu **provedor de pagamento** (Asaas, Mercado Pago, Stripe, PagBank ou Polar). O sistema precisa: (1) criar cobranças PIX/cartão/boleto no provedor ativo do tenant, (2) processar webhooks com verificação HMAC per-tenant, e (3) armazenar credenciais criptografadas (AES-256-GCM) por tenant. A seleção de provedor é **Strategy Pattern** via `PaymentProviderFactory` — nunca `if/else` por provedor dentro do Use Case.

> **Escolha de gateway (regra do time):** esta spec cobre os 5 provedores como *strategies intercambiáveis* sob a mesma `PaymentGatewayPort`. Uma feature de pagamento específica deve referenciar **um único** provedor (ver guias `payments-asaas|mercadopago|stripe|pagbank|polar`).

---

## Escopo

### Incluído
- `PaymentGatewayPort` (PIX, cartão de crédito, boleto, getCharge, cancelCharge, verifyWebhook, handleWebhook)
- 5 estratégias: `AsaasPaymentProvider`, `MercadoPagoGateway`, `StripeGateway`, `PagBankGateway`, `PolarGateway`
- `PaymentProviderFactory` — `create` (direto), `createForTenant` (per-tenant com fallback env), `createForTenantAndProvider` (onboarding)
- `EncryptionPort` + `AesEncryptionService` (AES-256-GCM) para credenciais em repouso
- `PaymentProviderConfigRepositoryPort` + entidade `PaymentProviderConfig` + use cases `UpsertPaymentProviderConfig` / `GetPaymentProviderConfig`
- `ProcessPaymentUseCase` (criar PIX), `ProcessPaymentWebhookUseCase` + `AsaasWebhookParser`, `PerTenantHmacVerifier`
- Endpoint `POST /api/webhooks/payment/:provider` com rate limit burst e headers de assinatura por provedor

### Fora de Escopo
- Ciclo de vida de assinaturas / geração recorrente — ver specs `subscription-lifecycle` e `recurring-billing`
- Pagamentos via `BillingSchedule` (modelo Prisma sem use case)
- Conciliação financeira automatizada / recebimento de `PaymentEvent` (feed de atividades) — fora do backfill
- Testes E2E de conexão real com provedores (as gateways usam SDKs reais com factory injetável para teste)

---

## Critérios de Aceitação (ACs)

| ID | Critério | Verificação |
|----|----------|-------------|
| AC1 | `PaymentGatewayPort` define `createPixCharge`, `createCreditCardCharge`, `createBoletoCharge`, `getCharge`, `cancelCharge`, `verifyWebhook`, `handleWebhook` | `application/ports/gateways/payment-gateway.port.ts` |
| AC2 | **5 implementações** da porta existem: `AsaasPaymentProvider`, `MercadoPagoGateway`, `StripeGateway`, `PagBankGateway`, `PolarGateway` | `infrastructure/payment/*.gateway.ts` + `asaas.provider.ts` |
| AC3 | **Strategy Pattern**: `PaymentProviderFactory.create(config)` constrói a gateway certa por `ProviderType`; Use Case nunca faz `switch` por provedor | `infrastructure/payment/payment-provider.factory.ts`, `__tests__/application/ports/gateways-and-adapters.test.ts` |
| AC4 | `createForTenant(tenantId)` percorre `PROVIDER_FALLBACK_ORDER = [asaas, mercadopago, stripe, pagbank, polar]`, usa a primeira config ativa do tenant, e **cai para Asaas com credenciais de env** se nada configurado | `payment-provider.factory.ts` |
| AC5 | `PaymentProviderFactory.create` para provider desconhecido lança `Error` (default case) | `payment-provider.factory.ts` |
| AC6 | **Encryption**: `AesEncryptionService` usa AES-256-GCM (chave hex de 32 bytes / 64 chars, IV 16B, tag 16B); `encrypt` retorna JSON `{ciphertext, iv, tag}`; `decrypt` falha com chave errada | `__tests__/security/encryption.test.ts` |
| AC7 | `UpsertPaymentProviderConfigUseCase` valida `tenantId`/`provider`/`apiKey`, criptografa a API key e faz `upsert` per-tenant; `GetPaymentProviderConfigUseCase` lê a config | `upsert-payment-provider-config.usecase.ts`, `get-payment-provider-config.usecase.ts` |
| AC8 | `PaymentProviderConfig` (domain) tem `apiKeyEncrypted`, `environment`, `webhookSecret`, `isActive`; schema Prisma `payment_provider_configs` com `@@unique([tenantId, provider])` | `domain/entities/payment-provider-config.ts`, `schema.prisma` |
| AC9 | `ProcessPaymentUseCase` resolve gateway per-tenant (repo + encryption + `PaymentGatewayFactory`), cria PIX com `externalReference = invoiceId`, atualiza invoice com PIX data, registra `Payment` PENDING e retorna `{status: 'PENDING', pix}` | `process-payment.usecase.test.ts`, `process-payment-with-repo.test.ts` |
| AC10 | `ProcessPaymentUseCase` retorna `ALREADY_PAID` (400) se invoice já `PAID`, `NOT_FOUND` se invoice não pertence ao tenant, `PAYMENT_PROVIDER_ERROR` (502) se o gateway lança | `process-payment.usecase.test.ts` |
| AC11 | `ProcessPaymentWebhookUseCase` verifica HMAC (`WebhookVerifierPort`), parseia via `PaymentWebhookParserPort`, marca invoice `PAID`, cria payment `CONFIRMED`, publica `payment.confirmed`; assinatura inválida → `UNAUTHORIZED` 401; evento não-parseável → ack 200 | `process-payment-webhook.usecase.test.ts`, `__tests__/security/webhook.test.ts` |
| AC12 | `AsaasWebhookParser` mapeia `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED` → `status:'confirmed'`, `PAYMENT_FAILED` → `failed`, `PAYMENT_REFUNDED` → `refunded`; `invoiceId` vem de `payment.externalReference`; payload não-Asaas retorna `null` | `infrastructure/payment/asaas-webhook-parser.ts` |
| AC13 | `PerTenantHmacVerifier` busca `webhookSecret` por `tenantId+provider` no DB, valida inputs antes da lookup (injection prevention), HMAC-SHA256 com `timingSafeEqual` | `__tests__/security/webhook.test.ts` |
| AC14 | Rota webhook: header de assinatura por provedor (`asaas-signature`, `x-signature`, `x-pagbank-signature`, `webhook-signature`); provedor desconhecido → 400; sem assinatura → 401; sem `tenantId` no payload → 400; rate limit burst 10 req/s por IP | `webhook.routes.ts`, `__tests__/security/rate-limiting.test.ts` |
| AC15 | `PaymentProvider` enum do domínio (`domain/entities/payment.ts`) inclui `ASAAS, MERCADO_PAGO, STRIPE, PAGBANK, POLAR` | `domain/entities/payment.ts` (zod schema idem) |
| AC16 | Retry/DLQ: falha transitória em webhook → `RetryableWebhookHandler.handleWithRetry` (3 tentativas, backoff exp) → DLQ `failed-webhooks` + alerta | `__tests__/events/retryable-webhook-handler.test.ts`, `alert-on-payment-failed.handler.test.ts` |

---

## Contratos entre Camadas

### Application

```typescript
// application/ports/gateways/payment-gateway.port.ts
export interface PaymentGatewayPort {
  createPixCharge(params: { amount: number; description: string; customerId?: string; externalReference?: string; }): Promise<Either<ApplicationError, PixChargeResponse>>;
  createCreditCardCharge(input: CreditCardChargeInput): Promise<Either<ApplicationError, CreditCardChargeResponse>>;
  createBoletoCharge(input: BoletoChargeInput): Promise<Either<ApplicationError, BoletoChargeResponse>>;
  getCharge(providerPaymentId: string): Promise<Either<ApplicationError, PixChargeResponse>>;
  cancelCharge(providerPaymentId: string): Promise<Either<ApplicationError, void>>;
  verifyWebhook(provider: string, payload: string, signature: string): Promise<boolean>;
  handleWebhook(payload: unknown): Either<ApplicationError, { event: string; paymentId: string; status: string; metadata: Record<string, unknown> }>;
}
// PixChargeResponse { id, qrCode, copyPaste, expiresAt, status }
// CreditCardChargeInput/Response, BoletoChargeInput/Response (barcode, boletoUrl, dueDate)
```

```typescript
// application/ports/gateways/payment-webhook-parser.port.ts
export interface PaymentWebhookParserPort {
  parse(provider: string, payload: Record<string, unknown>): PaymentWebhookData | null;
}
export interface PaymentWebhookData {
  providerPaymentId: string;
  status: 'confirmed' | 'failed' | 'refunded';
  invoiceId?: string; amount?: number; paidAt?: Date; rawPayload: Record<string, unknown>;
}

// application/ports/gateways/webhook-verifier.port.ts
export interface WebhookVerifierPort {
  verify(provider: string, rawBody: string, signature: string, tenantId: string): Promise<Either<ApplicationError, boolean>>;
}

// application/ports/gateways/encryption.port.ts
export interface EncryptionPort {
  encrypt(plaintext: string): string;
  decrypt(ciphertext: string): string;
}

// application/ports/repositories/payment-provider-config.repository.port.ts
export interface PaymentProviderConfigRepositoryPort {
  upsert(tenantId: string, provider: string, config: { apiKey: string; environment: string }): Promise<void>;
  findByTenantAndProvider(tenantId: string, provider: string): Promise<{ apiKey: string; environment: string } | null>;
}
```

```typescript
// application/usecases/process-payment.usecase.ts
export interface ProcessPaymentInput { invoiceId: string; tenantId: string; }
export interface ProcessPaymentOutput { status: string; pix: { qrCode: string; copyPaste: string; expiresAt: Date }; }
export type PaymentGatewayFactory = (config: { apiKey: string; environment: string }) => PaymentGatewayPort;

export class ProcessPaymentUseCase {
  constructor(
    invoiceRepo: InvoiceRepositoryPort,
    clientRepo: ClientRepositoryPort,
    paymentRepo: PaymentRepositoryPort,
    paymentGateway: PaymentGatewayPort,            // gateway injetado (fallback)
    eventBus: EventBusPort,
    paymentProviderConfigRepo?: PaymentProviderConfigRepositoryPort,  // opcional → resolve per-tenant
    encryption?: EncryptionPort,
    gatewayFactory?: PaymentGatewayFactory,
  ) {}
  async execute(input: ProcessPaymentInput): Promise<Either<ApplicationError, ProcessPaymentOutput>>;
}
```

```typescript
// application/usecases/process-payment-webhook.usecase.ts
export interface ProcessPaymentWebhookInput { provider: string; rawBody: string; signature: string; tenantId: string; }
export interface ProcessPaymentWebhookOutput { received: boolean; provider: string; }
export class ProcessPaymentWebhookUseCase {
  constructor(verifier: WebhookVerifierPort, parser: PaymentWebhookParserPort,
    invoiceRepo: InvoiceRepositoryPort, paymentRepo: PaymentRepositoryPort, eventBus: EventBusPort) {}
  async execute(input: ProcessPaymentWebhookInput): Promise<Either<ApplicationError, ProcessPaymentWebhookOutput>>;
}
```

```typescript
// application/usecases/upsert-payment-provider-config.usecase.ts
export interface UpsertPaymentProviderConfigInput { tenantId: string; provider: string; apiKey: string; environment: string; }
export class UpsertPaymentProviderConfigUseCase {
  constructor(paymentProviderConfigRepo, encryption: EncryptionPort) {}
  async execute(input): Promise<Either<ApplicationError, void>>; // encrypt(apiKey) → repo.upsert
}
```

### Domain

```typescript
// domain/entities/payment-provider-config.ts
export interface PaymentProviderConfig {
  id: string; tenantId: string; provider: string; apiKeyEncrypted: string | null;
  environment: string; webhookSecret: string | null; isActive: boolean; createdAt: Date; updatedAt: Date;
}
// domain/entities/payment.ts
export enum PaymentProvider { ASAAS = 'ASAAS', MERCADO_PAGO = 'MERCADO_PAGO', STRIPE = 'STRIPE', PAGBANK = 'PAGBANK', POLAR = 'POLAR' }
// domain/entities/invoice.ts — updateInvoice(invoice, { status, paidAt, externalPaymentId, pix* })
```

### Infrastructure

```typescript
// infrastructure/payment/payment-provider.factory.ts
export type ProviderType = 'asaas' | 'mercadopago' | 'stripe' | 'pagbank' | 'polar';
export interface ProviderConfig { type: ProviderType; apiKey: string; environment?: 'sandbox' | 'production'; publicKey?: string; publishableKey?: string; webhookSecret?: string; }
export class PaymentProviderFactory {
  static create(config: ProviderConfig): PaymentGatewayPort;       // switch por type → new *Gateway (Strategy)
  async createForTenant(tenantId: string): Promise<PaymentGatewayPort>;          // fallback: env asaas
  async createForTenantAndProvider(tenantId: string, provider: ProviderType): Promise<PaymentGatewayPort | null>; // onboarding
}
// Order: asaas → mercadopago → stripe → pagbank → polar
```

```typescript
// infrastructure/encryption/aes-encryption.service.ts
export class AesEncryptionService implements EncryptionPort {
  constructor(keyHex: string); // 32-byte hex (64 chars), senão throw
  encrypt(plaintext: string): string;  // JSON {ciphertext, iv, tag}, AES-256-GCM
  decrypt(ciphertext: string): string;
}

// infrastructure/payment/asaas-webhook-parser.ts
export class AsaasWebhookParser implements PaymentWebhookParserPort { parse(provider, payload): PaymentWebhookData | null }

// infrastructure/payment/per-tenant-hmac-verifier.ts
export class PerTenantHmacVerifier implements WebhookVerifierPort {
  verify(provider, rawBody, signature, tenantId): Promise<Either<ApplicationError, boolean>>; // secret do DB, HMAC-SHA256, timingSafeEqual
}

// infrastructure/payment/asaas.provider.ts — AsaasPaymentProvider (env sandbox/prod baseUrl)
// infrastructure/payment/mercadopago.gateway.ts — MercadoPagoGateway (accessToken+publicKey)
// infrastructure/payment/stripe.gateway.ts — StripeGateway (secretKey, apiVersion 2024-06-20, webhooks.constructEvent)
// infrastructure/payment/pagbank.gateway.ts — PagBankGateway (accessToken, client factory injetável)
// infrastructure/payment/polar.gateway.ts — PolarGateway (accessToken, client factory injetável)
```

### Presentation

`routes/webhook.routes.ts` — `POST /api/webhooks/payment/:provider` (público, auth-plugin ignora `/api/webhooks/`):

| Header de assinatura | Provider |
|----------------------|----------|
| `asaas-signature` | asaas |
| `x-signature` | mercadopago |
| `x-pagbank-signature` | pagbank |
| `webhook-signature` | polar |

Status codes: 400 (provider desconhecido / payload inválido / sem tenantId), 401 (sem assinatura / HMAC inválido), 200 `{received: true, provider}`. Rate limit burst: `max: 10, timeWindow: '1 second'`, key por IP.

---

## Requisitos Não-Funcionais

| ID | Requisito | Detalhe |
|----|-----------|---------|
| NFR1 | **Segurança de credenciais** | API keys e webhook secrets criptografados em repouso (AES-256-GCM); nunca em logs (`__tests__/security/audit-logging.test.ts`) |
| NFR2 | **Troca de provedor** | Adicionar provedor = nova classe implementando `PaymentGatewayPort` + entrada no factory + `env.*`; zero mudança em Use Cases |
| NFR3 | **Verificação de webhook** | HMAC-SHA256 com `timingSafeEqual`; secret por tenant no DB (`payment_provider_configs.webhookSecret`) |
| NFR4 | **Anti-abuso** | Rate limit burst 10 req/s por IP nos webhooks; validação de input antes de DB lookup (injection) |
| NFR5 | **Disponibilidade** | Erro de gateway → `PAYMENT_PROVIDER_ERROR` 502 (não quebra o request); webhooks com retry/DLQ |

---

## Design Patterns Declarados Explicitamente

| Padrão | Onde Aplicado | Justificativa |
|--------|---------------|---------------|
| **Strategy** | `PaymentGatewayPort` + `AsaasPaymentProvider`/`MercadoPagoGateway`/`StripeGateway`/`PagBankGateway`/`PolarGateway` | Provedor intercambiável sem `if/else` no Use Case — seleção centralizada na `PaymentProviderFactory` |
| **Factory** | `PaymentProviderFactory` (static + per-tenant) | Resolução do gateway ativo por tenant com fallback env |
| **Adapter / Port** | `EncryptionPort`, `WebhookVerifierPort`, `PaymentWebhookParserPort`, `PaymentGatewayPort` | Infrastructure trocável (SDK real vs stub) |
| **Repository** | `PaymentProviderConfigRepositoryPort` + `PrismaPaymentProviderConfigRepository` | Persistência per-tenant desacoplada |
| **DLQ / Retry** | `RetryableWebhookHandler` + BullMQ `failed-webhooks` | Falhas transitórias não se perdem |

---

## Definition of Done

- [ ] AC1–AC16 cobertos por testes automatizados (ver coluna de verificação)
- [ ] Zero menção a provedor específico no Domain/Application (exceto enum `PaymentProvider` no domínio de pagamento)
- [ ] `__tests__/security/encryption.test.ts` e `__tests__/security/webhook.test.ts` verdes
- [ ] `__tests__/routes/payment.routes.test.ts` e `__tests__/routes/webhook.routes.test.ts` verdes

---

## Rastreabilidade (AC → Testes)

| AC | Teste |
|----|-------|
| AC1 | `__tests__/application/ports/ports.contract.test.ts`, `gateways-and-adapters.test.ts` |
| AC2 | `gateways-and-adapters.test.ts`, `__tests__/application/ports/repositories.test.ts` |
| AC3 | `gateways-and-adapters.test.ts`; impl em `payment-provider.factory.ts` |
| AC6 | `__tests__/security/encryption.test.ts` |
| AC9–AC10 | `process-payment.usecase.test.ts`, `process-payment-with-repo.test.ts` |
| AC11 | `process-payment-webhook.usecase.test.ts`, `__tests__/security/webhook.test.ts` |
| AC13 | `__tests__/security/webhook.test.ts`, `__tests__/application/ports/webhook-verifier.contract.test.ts` |
| AC14 | `__tests__/routes/webhook.routes.test.ts`, `__tests__/security/rate-limiting.test.ts` |
| AC16 | `retryable-webhook-handler.test.ts`, `alert-on-payment-failed.handler.test.ts`, `__tests__/events/event-bus.integration.test.ts` |
