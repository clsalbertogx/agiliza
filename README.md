# Agiliza — Gestão de Assinaturas e Cobrança Recorrente com IA Preditiva

> **Status**: MVP (v0.9.0 — Sprint 9: Multi-Provider + Advanced Subscription)

---

## Sobre o Projeto

Agiliza é uma plataforma B2B SaaS para gestão de cobrança recorrente com inteligência artificial preditiva.
Empresas (academias, escolas, condomínios) cadastram clientes, criam assinaturas com cobrança recorrente,
enviam lembretes via WhatsApp, processam pagamentos através de múltiplos provedores e recebem scoring
de risco preditivo com recomendações de próxima ação.

**Problema resolvido**: Pequenas e médias empresas brasileiras perdem de 15% a 30% do faturamento
recorrente por inadimplência e processos manuais de cobrança. Agiliza automatiza todo o ciclo:
geração de faturas → tentativa de cobrança → lembretes inteligentes → re-tentativas com backoff →
encaminhamento para ação humana nos casos críticos.

### Público-alvo

- Academias (gestão de mensalidades)
- Escolas (mensalidades e anuidades)
- Condomínios (taxas condominiais)
- PMEs com modelos de assinatura

---

## 🏛️ Arquitetura

```
Monorepo (npm workspaces — Turborepo)
├── apps/
│   ├── backend/     — Fastify + Prisma + PostgreSQL + Redis + BullMQ
│   └── frontend/    — Next.js 14 + Tailwind CSS + shadcn/ui
└── packages/
    └── shared/      — Tipos compartilhados (contrato API público)
```

**Clean Architecture** com strict Dependency Rule — o fluxo de dependência é unidirecional:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Presentation                                │
│              (Fastify Routes, Factories, Error Handler)             │
├─────────────────────────────────────────────────────────────────────┤
│                        Application                                 │
│         (Use Cases, Ports, Event Handlers, Services)                │
├─────────────────────────────────────────────────────────────────────┤
│                          Domain                                     │
│      (Entities, Value Objects, Domain Events, Domain Services)      │
├─────────────────────────────────────────────────────────────────────┤
│                      Infrastructure                                 │
│   (Prisma, BullMQ, Redis, Payment Providers, JWT, Encryption...)    │
└─────────────────────────────────────────────────────────────────────┘
```

| Camada | Responsabilidade |
|--------|-----------------|
| **Domain** | Entidades, Value Objects, Eventos de Domínio, Serviços de Domínio (regras de negócio puras — zero dependências externas) |
| **Application** | Use Cases, Handlers de Eventos, Portas (interfaces de repositórios e adaptadores) |
| **Infrastructure** | Prisma, BullMQ, Redis, Provedores de Pagamento, JWT, Criptografia, Serviços de Mensageria (adaptadores concretos) |
| **Presentation** | Rotas Fastify, Factories (DI Wiring), Error Handler Global (4-tier) |

### Decisões Arquiteturais (ADRs)

1. **Clean Architecture com Dependency Rule** — Domain nunca importa Infrastructure; Application depende apenas de Portas (interfaces)
2. **Either monad** para tratamento de erros em Use Cases (`success` / `failure` — sem exceções para fluxos esperados)
3. **Unit of Work** (AsyncLocalStorage) para transações atômicas entre múltiplos repositórios
4. **Port/Adapter pattern** — Todo serviço externo (banco, fila, gateway de pagamento, criptografia) atrás de uma interface
5. **UUID v7** (time-ordered) para todas as entidades — índices eficientes e ordenação temporal implícita
6. **Event Bus in-process** — Eventos de domínio fire-and-forget (sem broker externo para eventos internos)
7. **Factory pattern para DI** — Sem container de injeção de dependência; fábricas explícitas por Use Case
8. **Strategy Pattern para múltiplos provedores de pagamento** (Sprint 9) — `PaymentGatewayPort` única; Asaas, Mercado Pago e Stripe são estratégias concretas selecionadas por tenant
9. **Exponential Backoff + Dead Letter Queue para webhooks** (Sprint 9) — 5 retries com backoff exponencial (2s base), falha permanente vai para DLQ `failed-webhooks` para inspeção manual

---

## ✨ Funcionalidades

### 💳 Multi-Provider Payments
- **Asaas**, **Mercado Pago** e **Stripe** como gateways de pagamento
- Configuração por tenant (sandbox/production) com chaves criptografadas em repouso (AES-256-GCM)
- Fallback automático para variáveis de ambiente quando não há config por tenant
- Cobrança via PIX (Asaas, Mercado Pago) e Payment Intents (Stripe em cents)
- Webhook verification por provider (HMAC, Stripe-Signature, MP-Signature)

### 📋 Subscriptions
- Criação, cancelamento, pausa, retomada, expiração e renovação automática
- **Upgrade** e **Downgrade** (Sprint 9) com cálculo de prorrogação proporcional
- ProrationService: cálculo de crédito/débito baseado em dias restantes do ciclo vigente
- Ciclo de faturamento configurável (mensal, trimestral, semestral, anual)
- Invoice de ajuste gerada automaticamente no upgrade/downgrade

### 🔄 Recurring Billing
- Geração automática de faturas via BullMQ (job diário às 03:00)
- `CreateInvoiceForSubscriptionUseCase` — verifica `nextBilling <= today` e gera fatura com idempotência
- `AutoPayHandler` — processa pagamento automaticamente ao evento `subscription.invoice.created`
- Worker de cobrança recorrente com verificação de duplicidade por subscription + mês de referência

### 🤖 Smart Reminders (WhatsApp)
- Lembretes automáticos via Evolution API (BullMQ worker dedicado)
- Template-based messaging com agendamento inteligente
- Rastreamento de entrega e leitura (status tracking)

### 🌐 Webhook Processing
- Confirmação de pagamento via webhook dos provedores
- Retry com **exponential backoff** (5 tentativas, 2s base)
- **Dead Letter Queue** (`failed-webhooks`) para falhas permanentes
- Verificação HMAC por tenant (cada tenant tem sua chave de webhook)
- Worker dedicado para inspeção manual de DLQ

### 🧠 Decision Engine (IA Preditiva)
- Scoring de risco preditivo por cliente
- Recomendação de próxima ação: `send_reminder`, `call_client`, `escalate`, `none`
- Canais de ação: `whatsapp`, `email`, `phone_call`
- Template de mensagem e agendamento sugerido

### 🔒 Security
- JWT com HMAC-SHA256 + `timingSafeEqual` contra timing attacks
- Helmet: CSP, HSTS preload, X-Frame-Options DENY, X-Content-Type-Options nosniff
- Rate Limiting: 100 req/min global, 60/min auth, 10/s webhook
- **Criptografia AES-256-GCM** (32-byte key, IV 16-byte aleatório, auth tag) para credenciais de pagamento em repouso
- Error Handler 4-tier: Zod (400) → AppError (custom) → Fastify (status code) → Unknown (500)
- Webhook HMAC verification com chave por tenant
- Segurança em CI: `npm audit`, Trivy (container), CodeQL, Gitleaks (secrets scanning)

### 📊 Dashboard & API Documentation
- Dashboard com métricas de faturamento e KPIs em tempo real
- **Swagger UI** em `/docs` — 45 endpoints documentados com OpenAPI 3.0
- Schema de requisição/resposta por Zod integrado ao Fastify
- UI protegida/desabilitada em produção

---

## 📊 Test Stats

| Suite | Testes | Como executar |
|-------|--------|--------------|
| Backend (unit/integration) | **872** | `npm run -w apps/backend test` ou `cd apps/backend && npx vitest run` |
| Frontend (componentes) | **399** | `npm run -w apps/frontend test` |
| E2E (Playwright) | 5 specs | `bash scripts/e2e-setup.sh` (requer servidor rodando) |
| TypeScript (`tsc --noEmit`) | **0 errors** em todos os packages | `npm run -w apps/backend typecheck && npm run -w apps/frontend typecheck` |

### Qualidade
- **Cobertura**: ≥80% line coverage para novos Use Cases e serviços
- **Lint**: ESLint + Prettier
- **Dependency Rule**: Verificação automática via `dependency-cruiser` no CI
- **Complexidade ciclomática**: Monitorada por função (sem `switch`/`if` excessivos em Use Cases)

---

## 🚀 Começando

### Pré-requisitos

- **Node.js** >= 20.0.0
- **Docker** + Docker Compose
- **PostgreSQL** 16
- **Redis** 7

### Setup

```bash
# Clone
git clone <repo-url>
cd agiliza

# Instalar dependências (npm workspaces)
npm install

# Iniciar infraestrutura (PostgreSQL + Redis)
docker compose -f docker/docker-compose.dev.yml up -d

# Rodar migrations do Prisma
npm run -w apps/backend db:migrate

# Iniciar backend (terminal 1)
cd apps/backend && npx tsx watch src/index.ts

# Iniciar workers BullMQ (terminal 2 — opcional, necessário para jobs async)
cd apps/backend && npx tsx watch src/infrastructure/queue/worker.ts

# Iniciar frontend (terminal 3)
npm run -w apps/frontend dev
```

O backend estará disponível em `http://localhost:3333` e o frontend em `http://localhost:3000`.
Documentação Swagger da API em `http://localhost:3333/docs`.

### Variáveis de Ambiente

Copie `.env.example` para `.env` e configure:

```bash
cp .env.example apps/backend/.env
cp .env.e2e.example e2e/.env.e2e   # (opcional) para testes E2E
```

#### Lista completa de variáveis

| Variável | Descrição | Obrigatório | Padrão |
|----------|-----------|-------------|--------|
| **Database** | | | |
| `DATABASE_URL` | URL de conexão PostgreSQL | Sim | `postgresql://dev:dev@localhost:5432/agiliza` |
| **Redis** | | | |
| `REDIS_URL` | URL de conexão Redis | Sim | `redis://localhost:6379` |
| `REDIS_PASSWORD` | Senha do Redis | Não | `changeme` |
| **App** | | | |
| `NODE_ENV` | Ambiente (`development` / `production` / `test`) | Sim | `development` |
| `HOST` | Host do servidor Fastify | Não | `0.0.0.0` |
| `PORT` | Porta do servidor Fastify | Não | `3333` |
| `FRONTEND_URL` | URL do frontend (para CORS) | Sim | `http://localhost:3000` |
| **Next.js** | | | |
| `NEXT_PUBLIC_API_URL` | URL da API para o frontend | Sim | `http://localhost:3333` |
| `NEXT_PUBLIC_DEMO_MODE` | Modo demo (desativa autenticação real) | Não | `false` |
| **JWT** | | | |
| `JWT_SECRET` | Chave secreta para assinatura JWT (HMAC-SHA256) | Sim | `agiliza-dev-secret-change-in-production` |
| **Encryption** | | | |
| `ENCRYPTION_KEY` | Chave AES-256-GCM (mín. 32 caracteres) para criptografar credenciais de pagamento em repouso | Sim | `agiliza-encryption-key-change-in-production` |
| **API Keys** | | | |
| `MASTER_API_KEY` | Chave mestre para endpoints administrativos | Não | `agiliza-dev-api-key-change-in-production` |
| **Payment Provider (default: Asaas)** | | | |
| `PAYMENT_PROVIDER` | Provedor de pagamento padrão (`asaas` / `mercadopago` / `stripe`) | Sim | `asaas` |
| `ASAAS_API_KEY` | API Key do Asaas | Conforme config | — |
| `ASAAS_ENVIRONMENT` | Ambiente Asaas (`sandbox` / `production`) | Conforme config | `sandbox` |
| **Rate Limiting** | | | |
| `RATE_LIMIT_MAX` | Máximo de requisições por minuto | Não | `100` |
| **Webhook Secrets** | | | |
| `ASAAS_WEBHOOK_SECRET` | Webhook secret para verificação de payloads do Asaas | Conforme config | `asaas-webhook-secret-change-in-production` |
| `MERCADOPAGO_WEBHOOK_SECRET` | Webhook secret para verificação de payloads do Mercado Pago | Conforme config | `mercadopago-webhook-secret-change-in-production` |
| **Outbound Webhook (opcional)** | | | |
| `OUTBOUND_WEBHOOK_URL` | URL para onde eventos internos são encaminhados | Não | — |
| `OUTBOUND_WEBHOOK_API_KEY` | API Key para autenticação no outbound webhook | Não | — |
| **Evolution API (WhatsApp)** | | | |
| `EVOLUTION_API_URL` | URL da instância Evolution API | Conforme config | `http://localhost:8080` |
| `EVOLUTION_API_KEY` | API Key da Evolution API | Conforme config | `your-evolution-api-key` |

### Testes

```bash
# Backend (872 testes — unitários + integração)
npm run -w apps/backend test

# Frontend (399 testes — componentes)
npm run -w apps/frontend test

# E2E (requer servidor rodando + migrations aplicadas)
bash scripts/e2e-setup.sh

# Cobertura
npm run -w apps/backend test -- --coverage
npm run -w apps/frontend test -- --coverage

# Type checking
npm run -w apps/backend typecheck
npm run -w apps/frontend typecheck
```

---

## 📦 Release History

| Tag | Sprint | Tema |
|-----|--------|------|
| **v0.9.0** | 9 | **Multi-Provider + Advanced Subscription** — Mercado Pago + Stripe gateways (Strategy Pattern), upgrade/downgrade com prorrogação, webhook retry com exponential backoff (5 tentativas + DLQ), frontend multi-provider com campos dinâmicos por provedor |
| **v0.8.0** | 8 | **Production Readiness** — Per-tenant payment config criptografado (AES-256-GCM), Swagger UI (/docs, 45 endpoints), CD pipeline GHCR (tag v*.*.*), CI E2E fix, migration baseline, frontend settings UI, 872+ backend tests |
| **v0.7.0** | 7 | **Recurring Billing** — Geração recorrente de faturas (BullMQ job diário), ciclo de vida de assinaturas (expirar, renovar, pausar, retomar), AutoPayHandler, integration test E2E de cobrança recorrente |
| **v0.6.1** | 6.1 | **Consistency Fix** — 15 inconsistências corrigidas (tipos, nullable, validação, testes) |
| **v0.6.0** | 6 | **Subscription Module** — Assinaturas, PaymentRepository, Dashboard com KPIs |
| **v0.5.0** | 5 | **Payment Pipeline** — ProcessPayment, Webhook, Decision Engine com scoring preditivo |
| **v0.4.0** | 4 | **Architecture II** — Read Use Cases, Unit of Work (AsyncLocalStorage), E2E no CI |
| **v0.3.0** | 3 | **Security** — JWT HMAC-SHA256 + timingSafeEqual, Helmet CSP/HSTS, Rate Limiting, Error Handler 4-tier |
| **v0.2.0** | 2 | **Architecture** — Clean Architecture, Ports/Adapters, Factories, Either monad |
| **v0.1.1** | 1.1 | **Foundation Fix** — Ajustes pós-fundacao |
| **v0.1.0** | 1 | **Foundation** — Entidades, Rotas Fastify, Prisma schema, Docker compose |

---

## 🔒 Segurança

### Mecanismos implementados

- **Autenticação**: JWT com HMAC-SHA256 + `timingSafeEqual` (proteção contra timing attacks)
- **Headers HTTP**: Helmet com CSP restrito, HSTS preload, X-Frame-Options DENY, X-Content-Type-Options nosniff
- **Rate Limiting**: 100 req/min global, 60 req/min endpoints de autenticação, 10 req/s webhooks
- **Criptografia em repouso**: AES-256-GCM (32-byte key, IV 16-byte aleatório, auth tag armazenado) para credenciais de pagamento — chave derivada via SHA-256 se `ENCRYPTION_KEY` não for hex de 64 caracteres
- **Webhooks**: HMAC verification por tenant (cada config de pagamento tem seu próprio webhook secret)
- **Error Handling**: 4-tier — Zod (400 Bad Request) → ApplicationError (status code customizado) → FastifyError (status code interno) → Unknown (500 Internal Server Error)
- **CI/CD Security**: `npm audit` semanal, Trivy (scan de vulnerabilidades em containers), CodeQL (análise estática), Gitleaks (detecção de secrets no código)

### Boas práticas

- Nenhum secret é embarcado nas imagens Docker — todas as chaves são injetadas via variáveis de ambiente em runtime
- API keys nunca retornadas em respostas da API (atributo booleano `hasApiKey` apenas)
- Webhook secrets configuráveis por tenant e por provider
- DLQ (`failed-webhooks`) retém payloads para inspeção sem re-exposição automática
- `npm audit` roda semanalmente no CI; falhas de severidade alta/crítica bloqueiam o build

---

## 🛠️ Tech Stack

| Categoria | Tecnologia |
|-----------|-----------|
| **Runtime** | Node.js 20+ com `tsx` (TypeScript Execution) |
| **Backend** | Fastify + Prisma ORM + PostgreSQL 16 + Redis 7 + BullMQ |
| **Frontend** | Next.js 14 (App Router) + Tailwind CSS + shadcn/ui |
| **Testes** | Vitest + @testing-library/react + Playwright |
| **Pagamento** | Asaas (padrão), Mercado Pago, Stripe — Strategy Pattern |
| **Criptografia** | Node.js `crypto` (AES-256-GCM) |
| **Mensageria** | Evolution API (WhatsApp) |
| **API Docs** | @fastify/swagger + @fastify/swagger-ui (OpenAPI 3.0) |
| **CI/CD** | GitHub Actions + Turborepo + GHCR (Docker images) |
| **Qualidade** | ESLint, Prettier, dependency-cruiser, CodeQL, Trivy, Gitleaks |
| **Package Manager** | npm 10 (workspaces) |
| **Monorepo Tool** | Turborepo |

---

## 📁 Estrutura do Projeto

```
agiliza/
├── apps/
│   ├── backend/
│   │   ├── prisma/                          # Schema + Migrations
│   │   │   └── migrations/                  # Migration baseline (Prisma Migrate)
│   │   ├── src/
│   │   │   ├── __tests__/                   # Testes (unitários, integração, rotas)
│   │   │   ├── application/
│   │   │   │   ├── ports/                   # Interfaces (repositories, gateways, adapters)
│   │   │   │   ├── services/                # Application services (ex: PaymentProviderResolver)
│   │   │   │   ├── usecases/                # Casos de uso (orquestram o domínio)
│   │   │   │   └── events/                  # Event handlers da aplicação
│   │   │   ├── config/                      # Config (env vars, Zod schema)
│   │   │   ├── domain/
│   │   │   │   ├── entities/                # Entidades de negócio (Subscription, Invoice, Client...)
│   │   │   │   ├── value-objects/           # Value Objects
│   │   │   │   ├── services/                # Serviços de domínio (proration, billing-cycle)
│   │   │   │   ├── events/                  # Eventos de domínio
│   │   │   │   └── errors/                  # Domain errors
│   │   │   ├── infrastructure/
│   │   │   │   ├── auth/                    # JWT, HMAC
│   │   │   │   ├── cache/                   # Redis cache
│   │   │   │   ├── database/                # Prisma repositories
│   │   │   │   ├── encryption/              # AES-256-GCM service
│   │   │   │   ├── event-bus/               # In-process event bus
│   │   │   │   ├── messaging/               # Evolution API (WhatsApp)
│   │   │   │   ├── payment/                 # Providers (Asaas, MercadoPago, Stripe) + Factory
│   │   │   │   ├── plugins/                 # Fastify plugins
│   │   │   │   ├── queue/                   # BullMQ (workers, DLQ, queue definitions)
│   │   │   │   ├── uuid/                    # UUID v7 generation
│   │   │   │   └── webhook/                 # Webhook routing
│   │   │   ├── presentation/
│   │   │   │   ├── factories/               # DI factories (wiring Use Cases)
│   │   │   │   └── handler.ts               # Error handler global (4-tier)
│   │   │   ├── routes/                      # Fastify route handlers (11 arquivos)
│   │   │   └── index.ts                     # App bootstrap (buildApp)
│   │   ├── Dockerfile
│   │   └── vitest.config.ts
│   │
│   └── frontend/
│       ├── src/
│       │   ├── __tests__/                   # Testes de componentes
│       │   ├── app/                         # Next.js App Router
│       │   │   ├── billing/                 # Página de faturamento
│       │   │   └── dashboard/
│       │   │       └── settings/            # Configurações (provedor de pagamento)
│       │   └── components/                  # Componentes React (22 componentes)
│       │       └── ui/                      # shadcn/ui primitives
│       ├── components.json                  # shadcn/ui config
│       ├── Dockerfile
│       └── vitest.config.mts
│
├── e2e/                                     # Playwright E2E tests
├── docker/                                  # Docker Compose (dev, prod)
├── docs/                                    # Documentação SDD, Sprint plans, ADRs
├── specs/                                   # Specs formalizadas (SDD)
├── scripts/                                 # Scripts de suporte (e2e-setup, etc.)
├── packages/
│   └── shared/                              # Tipos compartilhados (contrato API)
├── .github/workflows/
│   ├── ci.yml                               # CI: lint, typecheck, testes, E2E
│   ├── cd.yml                               # CD: build + push GHCR (tag v*.*.*)
│   └── security.yml                         # Segurança semanal (npm audit, Trivy, CodeQL)
├── turbo.json                               # Turborepo pipeline config
└── tsconfig.base.json                       # TypeScript base config (strict mode)
```

---

## 🚀 CI/CD Pipeline

### CI (`.github/workflows/ci.yml`)
Trigger: push para `main` ou PR. Executa em paralelo:
- **Lint + TypeCheck**: ESLint + `tsc --noEmit` em todos os workspaces
- **Testes Backend**: Vitest com cobertura (872 testes)
- **Testes Frontend**: Vitest com cobertura (399 testes)
- **Dependency Rule**: `npx depcruise` — verifica violações de Clean Architecture
- **E2E**: Playwright (5 specs) com banco migrado via `prisma migrate deploy`
- **Segurança**: `npm audit` (semanal)

### CD (`.github/workflows/cd.yml`)
Trigger: push de tag `v*.*.*`. Executa:
1. Login no **GitHub Container Registry (GHCR)**
2. Build + push da imagem **backend** (`ghcr.io/<repo>/backend:vX.Y.Z` + `latest`)
3. Build + push da imagem **frontend** (`ghcr.io/<repo>/frontend:vX.Y.Z` + `latest`)
4. Cache layer via GitHub Actions cache (BuildKit cache)

---

## 📝 Licença

MIT