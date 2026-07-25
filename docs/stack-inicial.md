# Agiliza: Stack Inicial

Com base na proposta estratégica do **Agiliza** e na pesquisa técnica detalhada da documentação da **Evolution API**, defini a stack inicial ideal. O foco absoluto é: **velocidade de execução no MVP (30 dias), paridade total entre ambiente Local e VPS, e evitar over-engineering**, mantendo a porta aberta para a camada de IA preditiva.

---

### 🔍 1. Insights Críticos da Pesquisa (Evolution API)
A análise da documentação oficial [[1]] e guias de implementação [[2]] revelou pontos que impactam diretamente sua arquitetura:
* **Stack Nativa:** Node.js 20+, TypeScript, Express, Prisma ORM, PostgreSQL e Redis [[1]]. Isso garante compatibilidade nativa e baixa latência com seu backend Fastify.
* **Consumo de Recursos:** A Evolution API consome cerca de **300-500 MB de RAM por instância ativa** do WhatsApp [[2]]. Isso é crucial para o dimensionamento da VPS.
* **Eventos e Webhooks:** Suporta Webhooks HTTP, WebSocket, RabbitMQ e Redis Pub/Sub [[1]]. Para o MVP, **Webhooks HTTP diretos para o Fastify** com fallback de retry é a abordagem mais simples e robusta.
* **Deploy:** Possui configuração Docker pronta para produção [[1]], o que valida a estratégia de "escrever uma vez, rodar local e na VPS" via Docker Compose.

---

### 🛠️ 2. Stack Tecnológica Recomendada (MVP: Local → VPS)

A stack foi desenhada para ser **unificada em contêineres**, eliminando o "funciona na minha máquina" e facilitando a migração para a VPS.

#### **A. Frontend (B2C PWA + Dashboard B2B)**
* **Framework:** Next.js 14+ (App Router) com TypeScript.
* **Estilização:** Tailwind CSS + Shadcn/ui (para componentes de dashboard rápidos e acessíveis).
* **PWA:** `next-pwa` ou `@ducanh2912/next-pwa` para cache offline e instalação na tela inicial do cliente B2C.
* **Estado e Data Fetching:** Zustand (estado global leve) + TanStack Query (cache e sincronização de dados do backend).

#### **B. Backend Core (Motor de Regras, API e Webhooks)**
* **Runtime:** Node.js 20+ (LTS).
* **Framework:** **Fastify** (escolha perfeita: mais rápido que Express, schema-based validation nativa com JSON Schema, ideal para alta concorrência de webhooks).
* **ORM:** Prisma ORM (mesmo da Evolution API, facilitando manutenção e conhecimento da equipe).
* **Validação:** Zod (integrado ao Fastify via `@fastify/type-provider-zod`).

#### **C. Camada de Dados e Eventos (O "Combustível da IA")**
* **Banco de Dados Principal:** **PostgreSQL 16+**.
  * *Extensão `pgvector`:* Já preparada para armazenar embeddings de mensagens ou perfis de cliente no futuro (Fase 2).
  * *Extensão `pg_cron`:* Para agendar jobs leves de verificação de status de pagamento sem precisar de um worker externo complexo no MVP.
* **Cache e Filas Leves:** **Redis**.
  * Usado pela Evolution API para cache de sessão.
  * Usado pelo Fastify com **BullMQ** para gerenciar a fila de disparos de mensagens e retries de webhooks falhos.
* **Feature Store (MVP):** O próprio PostgreSQL. Conforme sua premissa, "SQL é seu Feature Store". Views materializadas ou queries otimizadas calcularão `days_since_last_payment`, `msg_open_rate_7d`, etc.

#### **D. Motor de IA e Decisão (Estratégia Híbrida para MVP)**
* **Recomendação para Mês 1:** Manter a lógica de decisão **dentro do próprio Fastify (TypeScript)**.
  * *Por que?* A regra de "Cold Start" é, por definição, uma heurística `if/else` bem informada + Bandits simples. Introduzir um microsserviço Python (FastAPI) no dia 1 adiciona complexidade de deploy, monitoramento e comunicação (gRPC/REST) desnecessária para validar o valor.
  * *Bibliotecas:* `mathjs` ou implementações simples de Thompson Sampling em TS.
* **Rota de Evolução (Mês 3+):** Extrair o "Serviço de Decisão" para um microsserviço **Python (FastAPI)** rodando `scikit-learn`/`lightgbm` e `River` (para aprendizado online), comunicando-se com o Fastify via REST interno ou gRPC.

#### **E. Infraestrutura e Deploy**
* **Ambiente Local e VPS:** **Docker + Docker Compose**. É a única forma de garantir que a configuração de rede, variáveis de ambiente e versões de banco sejam idênticas.
* **Reverse Proxy (VPS):** **Traefik** ou **Nginx Proxy Manager**. Gerencia SSL (Let's Encrypt) e roteia `api.agiliza.com` para o Fastify e `evolution.agiliza.com` para a Evolution API.

#### **F. Integrações de Pagamento (Asaas, Mercado Pago, PagBank, Polar)**
Para o MVP, a estratégia é **abstrair os provedores detrás de uma interface única (`PaymentProvider`)** no Fastify, permitindo que o cliente B2B configure seu gateway preferido no dashboard. Isso evita vendor lock-in e simplifica a régua de cobrança.

| Provedor | Tipo | Recursos Chave para MVP | Complexidade de Integração |
| :--- | :--- | :--- | :--- |
| **Asaas** | Gateway Brasileiro | Pix (estático/dinâmico), Boleto, Cartão, Split de pagamentos, Webhooks robustos, API REST bem documentada. | **Baixa** (SDK Node.js oficial, tipagem TypeScript nativa). |
| **Mercado Pago** | Gateway/PSP Brasileiro | Pix, Boleto, Cartão, Wallet (Mercado Pago), Assinaturas, Webhooks (IPN). | **Média** (SDK Node.js oficial, mas tipagem exige `@types` comunitários; fluxo de assinatura mais complexo). |
| **PagBank (PagSeguro)** | Gateway/PSP Brasileiro | Pix, Boleto, Cartão, Recorrência, Webhooks (Notificação de Transação). | **Média** (SDK Node.js disponível; documentação pode ser fragmentada entre versões antigas/novas). |
| **Polar** | MoR (Merchant of Record) Global | **Foco em SaaS/B2B Global**: Checkout hospedado, gestão de impostos globais (VAT/GST/Sales Tax), Assinaturas, Licenças, Webhooks. | **Baixa** (API REST First, SDK Node/TypeScript, *webhooks tipados*; elimina necessidade de entidade legal local no exterior). |

**Arquitetura de Integração Sugerida (Backend):**
1. **Interface `IPaymentProvider`** (TypeScript): `createCharge(params)`, `createSubscription(params)`, `cancelSubscription(id)`, `handleWebhook(payload)`, `getPaymentLink(chargeId)`.
2. **Implementações Concretas:** `AsaasProvider`, `MercadoPagoProvider`, `PagBankProvider`, `PolarProvider`.
3. **Factory/Strategy Pattern:** Seleciona o provider baseado na configuração do `Tenant` (cliente B2B) salva no PostgreSQL.
4. **Webhook Unificado:** Rota única `POST /webhooks/payment/:provider` no Fastify → Valida assinatura (HMAC) → Normaliza payload para evento interno `payment.confirmed` / `payment.failed` → Dispara BullMQ para atualizar `Invoice` e `ClientProfile` (ex: resetar `days_since_last_payment`).
5. **Idempotência:** Garantida no nível do banco (constraint unique em `external_payment_id` + `provider`) antes de processar o job da fila.

---

### ⚙️ 3. Arquitetura de Integração: Fastify + Evolution API

Para garantir a confiabilidade dos dados comportamentais (críticos para a IA), a integração deve seguir este fluxo:

1. **Inicialização:** O Fastify cria a instância na Evolution API via REST (`POST /instance/create`) e define a URL do webhook global ou por instância.
2. **Recebimento de Eventos (Webhook):** A Evolution API envia um POST para `https://api.agiliza.com/webhooks/evolution` com payloads como `message.sent`, `message.read`, `message.received`.
3. **Processamento no Fastify:**
   * Validação do payload com Zod.
   * Gravação imediata na tabela `events` do PostgreSQL (append-only, ideal para time-series).
   * Atualização assíncrona (via BullMQ) do `client_profile` (ex: incrementar `msg_open_rate_7d`).
4. **Resposta Rápida:** O Fastify retorna `HTTP 200 OK` para a Evolution API em < 100ms para evitar que a Evolution API marque o webhook como falho e faça retries desnecessários.

---

### 🚀 4. Estratégia de Deploy: Local → VPS

#### **Fase 1: Desenvolvimento Local (Dias 1-15)**
Um único arquivo `docker-compose.dev.yml` na raiz do projeto:
```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: agiliza
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
    ports: ["5432:5432"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  evolution-api:
    image: atendai/evolution-api:latest
    ports: ["8080:8080"]
    environment:
      - SERVER_URL=http://localhost:8080
      - DATABASE_PROVIDER=postgresql
      - DATABASE_CONNECTION_URI=postgresql://dev:dev@postgres:5432/agiliza
      - CACHE_REDIS_URI=redis://redis:6379
    depends_on: [postgres, redis]

  backend:
    build: ./backend
    ports: ["3333:3333"]
    environment:
      - DATABASE_URL=postgresql://dev:dev@postgres:5432/agiliza
      - REDIS_URL=redis://redis:6379
      - EVOLUTION_API_URL=http://evolution-api:8080
    depends_on: [postgres, redis, evolution-api]

  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    depends_on: [backend]
```
*Vantagem:* O desenvolvedor roda `docker compose up` e tem todo o ecossistema (incluindo o WhatsApp engine) rodando localmente em 2 minutos.

#### **Fase 2: Produção na VPS (Dia 30+)**
* **Requisito Mínimo de Hardware:** VPS com **2 vCPU e 4GB de RAM** (Ubuntu 22.04/24.04).
  * *Justificativa:* O PostgreSQL + Redis + Fastify + Next.js consomem ~1.5GB. A Evolution API consumirá ~500MB por instância ativa [[2]]. Se você tiver 3-4 clientes (instâncias) no MVP, 4GB é o limite seguro para evitar OOM (Out of Memory) kills.
* **Segurança:** Configurar o Traefik para expor apenas as portas 80/443. O banco de dados e o Redis **não** devem ter portas expostas publicamente (`ports` removidos do compose de produção, usando apenas redes internas do Docker).
* **Backups:** Script simples de `pg_dump` agendado via `pg_cron` ou cron do host, salvando em um bucket S3 (ex: AWS S3 ou Cloudflare R2).

---

### ⚠️ 5. Riscos Técnicos e Mitigações na Stack

| Risco na Stack | Mitigação Implementada |
| :--- | :--- |
| **Webhook da Evolution API cai e perde evento de "Lido"** | O Fastify usa BullMQ. Se o DB estiver lento, o job é reprocessado. Além disso, um job diário de "reconciliação" consulta a API da Evolution API (`/message/gets`) para buscar eventos perdidos. |
| **VPS fica sem memória (OOM) devido à Evolution API** | Monitoramento básico com `node_exporter` + Prometheus (ou um serviço simples como Uptime Kuma). Configurar `--memory="1g"` no container da Evolution API no Docker Compose para evitar que ela derrube o PostgreSQL. |
| **Complexidade de manter Node.js + Python no MVP** | Adiado para a Fase 2. O "Cold Start" será resolvido com queries SQL inteligentes e lógica TypeScript no Fastify, cumprindo a premissa de "Zero migração de dados legados" sem over-engineering. |

---

### ✅ 6. Próximos Passos Práticos (Semana 1)

1. **Inicialize o Monorepo:** Crie a estrutura com `turbo` ou `npm workspaces` contendo `/apps/backend` (Fastify), `/apps/frontend` (Next.js) e `/docker/docker-compose.yml`.
2. **Suba a Evolution API Localmente:** Use o Docker Compose acima. Acesse `http://localhost:8080/docs` para testar a criação de uma instância e leitura do QR Code.
3. **Implemente o Listener de Webhook no Fastify:** Crie a rota `POST /webhooks/evolution` que apenas loga o payload no console e salva no PostgreSQL. Envie uma mensagem de teste e veja o evento "message.sent" e "message.read" chegando.
4. **Modele o Banco de Dados (Prisma):** Crie as tabelas `Client`, `Invoice`, `Event` (com colunas: `type`, `timestamp`, `metadata` JSONB) e `DecisionLog` (para auditar por que a IA/heurística tomou uma decisão).

Esta stack garante que você gaste 90% do tempo construindo a **lógica de negócio e a régua de cobrança inteligente**, e apenas 10% brigando com configuração de infraestrutura, permitindo uma transição suave e previsível do laptop para a VPS.
