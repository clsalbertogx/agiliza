# Spec: Correção de Consistência da UI (Frontend)

## Contexto de Negócio

O audit Headed Playwright cobrindo as 10 rotas do frontend revelou que a navegação do dashboard
anuncia 8 itens no sidebar, porém 4 rotas não existem (`clients`, `invoices`, `reminders`, `templates`),
duas páginas existentes (`risk`, `reports`) chamam a API com `tenantId=demo` + `ApiKey dev-key` em vez
do tenant autenticado + JWT, e a página de risco chama um endpoint inexistente (`/api/clients/risk`).
O footer exibe versão incorreta (`v0.1.0`).

O efeito: ao logar com um tenant real, metade da navegação cai em 404 e as páginas de Risco e
Relatórios produzem 500/400 por propagação errada de tenant — a UI é incoerente com o backend.

Esta spec é exclusivamente de **correção** de contrato e experiência da UI. Sem mudanças de regra
de negócio no backend.

## Escopo

- **Incluído:**
  - Vida de 3 telas novas funcionais (`Clientes`, `Faturas`, `Lembretes`) ligadas às APIs existentes.
  - Remoção do item de navegação `Mensagens` (`/dashboard/templates`) do sidebar (sem API de templates).
  - Correção de auth/tenant nas páginas `risk` e `reports` (drenar todo `tenantId=demo` + `ApiKey`).
  - Correção do endpoint da página de risco (`/api/reports/risk-distribution`).
  - Correção da versão no footer (`v0.12.0`).
  - Extração do helper `getTenantId()` para um módulo compartilhado.
  - Atualização do teste existente do sidebar para refletir versão e conjunto de rotas corretos.
- **Fora de escopo:** criar qualquer endpoint novo no backend; criar CRUD de templates de mensagem;
  alterar contratos dos use cases/serviços do backend; mudanças de regra de negócio.

## Decisões de Design (documentadas)

1. **`/dashboard/clients` (Clientes): CRIAR** — `GET /api/clients` existe e retorna 200. Página
   funcional que lista clientes reais do tenant autenticado. **Por quê:** dado real disponível e
   componente `ClientCard` já pronto; a rota está anunciada e deve resolver.
2. **`/dashboard/invoices` (Faturas): CRIAR** — `GET /api/invoices` e `GET /api/invoices/stats`
   existem e retornam 200. Página funcional com estatísticas + listagem + criação.
3. **`/dashboard/reminders` (Lembretes): CRIAR** — `GET /api/messages` existe e retorna 200
   (`data` hoje é `[]`, mas o contrato é válido). Página funcional com `EmptyState` quando vazio.
4. **`/dashboard/templates` (Mensagens): REMOVER do sidebar** — não existe endpoint de templates
   (`MessageTemplate` é modelo Prisma sem repository/route). Construir a rota criaria uma feature
   morta. Alternativa de reaproveitar a rota para listar mensagens foi descartada: duplicaria a
   página Lembretes, criando dois itens de navegação enganosos para o mesmo dado. **Decisão:** remover.
   O sidebar passa de 8 para **7** itens.

## Critérios de Aceitação (ACs)

- [x] **AC1 — Rotas resolvem:** navegando a cada rota listada abaixo logado com tenant real, o browser
      retorna **200** e renderiza o título esperado (sem página 404):
      `/dashboard`, `/dashboard/clients`, `/dashboard/invoices`, `/dashboard/reminders`,
      `/dashboard/risk`, `/dashboard/reports`, `/dashboard/settings`.
- [x] **AC2 — Zero chamada >= 400 autenticada:** logado com tenant real, **nenhuma** requisição das
      páginas acima dispara status `>= 400`. Em particular as chamadas passam a ser:
      `GET /api/clients`, `GET /api/invoices`, `GET /api/invoices/stats`,
      `GET /api/reports/risk-distribution`, `GET /api/reports/cash-flow`, `GET /api/messages` — todos com
      tenant real + `Authorization: Bearer <jwt>`. Deixa de existir qualquer `tenantId=demo`,
      `ApiKey dev-key` ou `GET /api/clients/risk` no frontend.
- [x] **AC3 — Risco:** a página `/dashboard/risk` renderiza (a) 3 cards de faixa de risco com **contagem
      real** e percentual vindos de `GET /api/reports/risk-distribution` e (b) `ClientCard`s **reais**
      por cliente vindos de `GET /api/clients`. Cards fictícios de demonstração só aparecem como
      fallback quando ambas as chamadas falham (mesmo comportamento defensivo atual).
- [x] **AC4 — Footer:** o sidebar exibe `Agiliza v0.12.0`.
- [x] **AC5 — Sidebar coerente:** o sidebar lista exatamente os 7 itens que resolvem
      (`Dashboard`, `Clientes`, `Faturas`, `Lembretes`, `Risco`, `Relatórios`, `Configurações`) e
      **não** lista `Mensagens`.
- [x] **AC6 — Sem erros de console:** nenhum `console.error`/exception não tratada navegando pelas
      rotas em estado normal (dado vazio e dado populado).
- [x] **AC7 — Testes:** suíte de testes do frontend passa na íntegra; o teste do sidebar é atualizado
      para `Agiliza v0.12.0` e para o conjunto de 7 rotas.
- [x] **AC8 — Dado vazio:** `Clientes`, `Faturas` e `Lembretes` exibem `EmptyState` coerente quando o
      respectivo `data` retorna `[]` (sem quebrar/erro de runtime).

## Contratos entre Camadas

> Frontend Next.js (`apps/frontend`). Nenhum contrato de backend muda — apenas o frontend passa a
> consumir os endpoints existentes corretamente.

### Fonte de verdade — módulo compartilhado (NOVO)

`apps/frontend/src/lib/tenant.ts` — extrair `getTenantId()` do `dashboard/page.tsx`:

```ts
export function getTenantId(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('tenant_id') || 'demo';
  }
  return 'demo';
}
```

O helper de API já autentica por JWT (ler `auth_token`). **Não** alterar `api.ts`; apenas **consumir**.

`apps/frontend/src/lib/api.ts` (superfície existente — referência de contrato):

```ts
api.get<T>(endpoint, params?: Record<string,string>): Promise<T>
api.post<T>(endpoint, body?): Promise<T>
api.put<T>(endpoint, body?): Promise<T>
api.patch<T>(endpoint, body?): Promise<T>
```

- Lê `localStorage.getItem('auth_token')` e envia `Authorization: Bearer <token>`.
- Envia `Content-Type: application/json`.
- **Lança `Error`** em `!response.ok` com a mensagem `error` do corpo.
- Params virando query string automática.

### Página: Clientes — CRIAR

Arquivo: `apps/frontend/src/app/dashboard/clients/page.tsx` (novo)

- Chamada: `api.get<{ data: Client[]; meta: Meta }>('/api/clients', { tenantId, perPage: '100' })`
- Shape do contrato (de `client.routes.ts`):
  ```ts
  interface Client {
    id: string; name: string; phone: string;
    email: string | null;
    riskScore: 'green' | 'yellow' | 'red' /* nível: list mapeia para o valor */;
    totalInvoices?: number; paidInvoices?: number; avgPaymentDelay?: number | null;
  }
  interface Meta { total: number; page: number; perPage: number; totalPages: number }
  ```
- Componentes reutilizados: `ClientCard` (item), `EmptyState` (lista vazia), `LoadingSkeleton`
  (carregando), `ErrorState` (erro com retry). Título `clientes`.
- Fiação: mapear `Client` → `ClientCardClient { name, phone, email, riskScore }` (usar `email || ''`).

### Página: Faturas — CRIAR

Arquivo: `apps/frontend/src/app/dashboard/invoices/page.tsx`

- Chamadas:
  - `api.get<{ data: InvoiceStats }>('/api/invoices/stats', { tenantId })`
  - `api.get<{ data: Invoice[]; meta: Meta }>('/api/invoices', { tenantId, perPage: '50' })`
- Shapes (`invoice.routes.ts`):
  ```ts
  interface InvoiceStats {
    total: number; paid: number; pending: number; overdue: number;
    totalAmount: number; paidAmount: number; pendingAmount: number; overdueAmount: number;
  }
  interface Invoice {
    id: string; clientId: string; amount: number; dueDate: string | null;
    status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'REFUNDED';
  }
  ```
- Componentes reutilizados: `StatCard` ×4 (faturamento `/stats`), `InvoiceTable` (listagem),
  `EmptyState`, `LoadingSkeleton`, `ErrorState`. O `InvoiceTable` espera
  `{ id, clientName, amount, dueDate, status: 'PENDING'|'PAID'|'OVERDUE' }`; fiar exibindo
  `clientId` como nome de exibição (consistente com `dashboard/page.tsx`) e **filtrando** status
  fora dos 3 core (`CANCELLED`/`REFUNDED` mantidos só como contagem no `stats`).
- Bônus em escopo: formulário de criação via `InvoiceForm` chamando `api.post('/api/invoices', body)`
  com `{ clientId, amount, dueDate }` (contrato `createInvoiceSchema`). Opcional e isolado — se
  incrementar risco, pode ficar para ticket próprio; os ACs **não** dependem dele.

### Página: Lembretes — CRIAR

Arquivo: `apps/frontend/src/app/dashboard/reminders/page.tsx`

- Chamada: `api.get<{ data: MessageEvent[]; meta: Meta }>('/api/messages', { tenantId, perPage: '50' })`
- Shape do contrato (evento `MESSAGE_SENT`, linha crua do `Event`, via `/api/messages`):
  ```ts
  interface MessageEvent {
    id: string; tenantId: string; clientId: string | null;
    eventType: 'MESSAGE_SENT';
    payload: Record<string, unknown>; // canal, templateName, destinatário, etc.
    source?: string | null;
    createdAt: string;
  }
  ```
- Componentes reutilizados: `EmptyState` (quando `data` é `[]` — estado atual legítimo), `LoadingSkeleton`,
  `ErrorState`. Renderizar lista simples (linha por evento: `createdAt` + resumo do `payload`).
  **Não** usar `MessageTracking` aqui (requer `/api/messages/:id/tracking` e shape `MessageDetails`
  distinto) — manter em ticket futuro de detalhe de mensagem.

### Página: Risco — CORRIGIR

Arquivo: `apps/frontend/src/app/dashboard/risk/page.tsx` (editar)

- **Remover** a chamada `fetch('/api/clients/risk?...')` com `ApiKey dev-key` e `tenantId=demo`.
- Chamadas:
  - `api.get<{ data: RiskDistribution }>('/api/reports/risk-distribution', { tenantId })`
  - `api.get<{ data: Client[]; meta: Meta }>('/api/clients', { tenantId, perPage: '100' })`
- Shape (`CashFlowService.getRiskDistribution`):
  ```ts
  interface RiskDistribution {
    green:  { count: number; percentage: number };
    yellow: { count: number; percentage: number };
    red:    { count: number; percentage: number };
  }
  ```
- **Como renderizar** (a distribuição é **por faixa agregada**, derivada dos status de fatura:
  `PAID→green`, `PENDING→yellow`, `OVERDUE→red` — NÃO é por cliente):
  - 3 `StatCard` (ou cards com `RiskBadge`) alimentados pela **contagem real** de cada faixa,
    com subtítulo `X%`. `RiskBadge` param `level` de cada chave;
  - `ClientCard`s **reais** por cliente a partir de `GET /api/clients` usando `client.riskScore`;
  - Manter os 5 cards fictícios atuais **exclusivamente** como fallback quando as chamadas reais
    falham (mantém a página defensiva, nunca quebra).
- Componentes: `StatCard`, `RiskBadge`, `ClientCard`, `EmptyState`, `LoadingSkeleton`.

### Página: Relatórios — CORRIGIR

Arquivo: `apps/frontend/src/app/dashboard/reports/page.tsx` (editar)

- **Remover** `fetch` com `ApiKey dev-key` + `tenantId=demo`.
- Usar: `api.get<{ data: ReportData }>('/api/reports/cash-flow', { tenantId, months: '6' })`
- Shape (`CashFlowService.generateForecast`) já é idêntico ao `ReportData` local
  (`{ forecast: [...], summary: {...} }`) — apenas trocar o transporte, manter os mapeamentos.
- Componentes: manter os atuais (`KpiCard`, `EmptyState`, `ErrorState`, `LoadingSkeleton`).

### Página: Dashboard — ALINHAR (opcional de baixo risco)

`apps/frontend/src/app/dashboard/page.tsx` — o `getTenantId()` local deve ser movido para
`@/lib/tenant` e o import apontar para o módulo compartilhado (sem mudança de comportamento).

### Sidebar — CORRIGIR

Arquivo: `apps/frontend/src/components/sidebar.tsx`

- Remover o item `{ href: '/dashboard/templates', label: 'Mensagens', icon: MessageSquare }`.
- Remover o import `MessageSquare` (se não usado em outro lugar).
- Linha 59: `Agiliza v0.1.0` → `Agiliza v0.12.0`.

### Testes — ATUALIZAR

Arquivo: `apps/frontend/src/__tests__/components/sidebar.test.tsx`

- `Agiliza v0.1.0` → `Agiliza v0.12.0`.
- Lista de links esperados: remover `'Mensagens'` (fica com 7 labels).
- Adicionar asserção de que `Mensagens` não está no documento, garantindo a remoção.

## Requisitos Não-Funcionais

- **Segurança (a validar com `security-specialist`):** nenhuma credencial hardcoded
  (`ApiKey dev-key`) permanece no frontend; todo tráfego autenticado via `Authorization: Bearer <jwt>`.
  Nenhum endpoint que valide `tenantId` como uuid deve receber `tenantId=demo`.
- **UX (a validar com `product-designer`):** estados de carregamento/erro/vazio consistentes com o
  padrão atual (`LoadingSkeleton`/`ErrorState`/`EmptyState`) em todas as rotas novas.
- **Performance:** listagens paginadas com `perPage` explícito; nenhuma chamada de lista sem limite.

## Design Patterns

- **Strategy Pattern:** não se aplica a esta correção (nenhum provedor externo novo). As páginas
  consomem ports REST já estabelecidos.
- **Observer / Domain Events:** não se aplica; a leitura de histórico usa o endpoint
  `GET /api/messages` (consulta, não efeito colateral).

## Definition of Done

- [x] Todos os ACs (AC1–AC8) cobertos por teste automatizado (unitário Para páginas novas + teste
      do sidebar atualizado + auditoria Playwright repetindo os 10 cenários).
- [x] Zero violação de contrato: nenhuma string `tenantId=demo`, `ApiKey` ou `/api/clients/risk`
      restante em `apps/frontend/src` (verificável por grep).
- [x] `git grep` confirma `Agiliza v0.12.0` no sidebar e ausência de item `Mensagens`.
- [x] Suíte de testes do frontend passando.