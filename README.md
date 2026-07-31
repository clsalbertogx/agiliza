# Agiliza — Gestão de Assinaturas e Cobrança Recorrente com IA Preditiva

> **Status**: MVP (v0.7.0 — Sprint 7: Recurring Billing)

Agiliza é uma plataforma B2B SaaS para gestão de cobrança recorrente com inteligência artificial. 
Empresas (academias, escolas, condomínios) cadastram clientes, criam assinaturas com cobrança recorrente,
enviam lembretes via WhatsApp, processam pagamentos e recebem scoring de risco preditivo com
recomendações de próxima ação.

## 🏛️ Arquitetura

```
Monorepo (npm workspaces)
├── apps/
│   ├── backend/     — Fastify + Prisma + PostgreSQL + Redis + BullMQ
│   └── frontend/    — Next.js 14 + Tailwind CSS + shadcn/ui
└── packages/
    └── shared/      — Tipos compartilhados (contrato API público)
```

**Clean Architecture**: Domain → Application (Ports) → Infrastructure (Adapters) → Presentation

| Camada | Responsabilidade |
|--------|-----------------|
| **Domain** | Entidades, Value Objects, Eventos de Domínio, Portas (interfaces) |
| **Application** | Use Cases, Handlers de Eventos, Portas (repositórios, gateways) |
| **Infrastructure** | Prisma, BullMQ, Redis, Provedores de Pagamento, JWT |
| **Presentation** | Rotas Fastify, Factories (DI Wiring), Error Handler Global |

## ✨ Funcionalidades

- **Assinaturas**: Criação, cancelamento, pausa, renovação, expiração automática
- **Cobrança Recorrente**: Geração automática de faturas via BullMQ (job diário)
- **Auto-Pagamento**: Processamento automático de pagamento na geração da fatura
- **Webhook**: Confirmação de pagamento via Asaas com atualização de status
- **Lembretes WhatsApp**: Envio automático via Evolution API (BullMQ worker)
- **Motor de Decisão**: Scoring de risco preditivo com recomendação de ação
- **Segurança**: JWT HMAC-SHA256, Helmet CSP/HSTS, Rate Limiting, Error Handler 4-tier
- **Dashboard**: Métricas de faturamento com KPIs em tempo real

## 📊 Testes

| Suite | Testes | Como executar |
|-------|--------|--------------|
| Backend (unit/integration) | 826+ | `cd apps/backend && npx vitest run` |
| Frontend (componentes) | 282 | `npm run -w apps/frontend test` |
| E2E (Playwright) | 5 specs | `bash scripts/e2e-setup.sh` |

## 🚀 Começando

### Pré-requisitos
- Node.js >= 20
- Docker + Docker Compose
- PostgreSQL 16
- Redis 7

### Desenvolvimento

```bash
# Clone
git clone <repo-url>
cd agiliza

# Instalar dependências
npm install

# Iniciar infraestrutura
docker compose -f docker/docker-compose.dev.yml up -d

# Migrations
npm run -w apps/backend db:migrate

# Iniciar backend (terminal 1)
cd apps/backend && npx tsx watch src/index.ts

# Iniciar frontend (terminal 2)
npm run -w apps/frontend dev
```

### Variáveis de Ambiente
Copie `.env.example` para `.env` e configure:
```bash
cp .env.example apps/backend/.env
# Edite apps/backend/.env com suas credenciais
```

## 🧪 Testes

```bash
# Backend
cd apps/backend && npx vitest run

# Frontend
npm run -w apps/frontend test

# E2E (requer servidor rodando)
bash scripts/e2e-setup.sh
```

## 📦 Release History

| Tag | Sprint | Tema |
|-----|--------|------|
| v0.7.0 | 7 | Recurring Billing — Geração recorrente de faturas, ciclo de vida de assinaturas |
| v0.6.1 | 6.1 | Consistency Fix — 15 inconsistências corrigidas |
| v0.6.0 | 6 | Subscription Module — Assinaturas, PaymentRepository, Dashboard |
| v0.5.0 | 5 | Payment Pipeline — ProcessPayment, Webhook, Decision Engine |
| v0.4.0 | 4 | Architecture II — Read Use Cases, Unit of Work, E2E CI |
| v0.3.0 | 3 | Security — JWT, Helmet, Rate Limit, Error Handler |
| v0.2.0 | 2 | Architecture — Clean Architecture, Ports, Factories |
| v0.1.0 | 1 | Foundation — Entidades, Rotas, Prisma |

## 🏛️ Decisões Arquiteturais (ADRs)

1. **Clean Architecture com Dependency Rule** — Domain não importa Infrastructure
2. **Either monad** para tratamento de erros em Use Cases
3. **Unit of Work** (AsyncLocalStorage) para transações atômicas
4. **Port/Adapter pattern** — Todo serviço externo atrás de uma interface
5. **UUID v7** (time-ordered) para todas as entidades
6. **Event Bus in-process** — Eventos de domínio síncronos (fire-and-forget)
7. **Factory pattern** para DI — sem container de injeção de dependência

## 🔒 Segurança

- JWT com HMAC-SHA256 + timingSafeEqual
- Helmet: CSP, HSTS preload, X-Frame-Options DENY
- Rate Limiting: 100 req/min global, 20/min auth, 10/s webhook
- Error Handler 4-tier: Zod → 400, AppError → custom, Fastify → status, Unknown → 500
- Webhook HMAC verification com chave por tenant
- npm audit, Trivy, CodeQL, Gitleaks (CI semanal)

## 🛠️ Stack

| Categoria | Tecnologia |
|-----------|-----------|
| **Runtime** | Node.js 20+ com tsx |
| **Backend** | Fastify + Prisma + PostgreSQL + Redis + BullMQ |
| **Frontend** | Next.js 14 + Tailwind CSS + shadcn/ui |
| **Testes** | Vitest + @testing-library/react + Playwright |
| **Pagamento** | Asaas (gateway padrão) |
| **Mensageria** | Evolution API (WhatsApp) |
| **CI/CD** | GitHub Actions + Turborepo |

## 📝 Licença

MIT
