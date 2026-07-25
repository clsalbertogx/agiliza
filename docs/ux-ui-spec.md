# UX/UI Design Specification — Agiliza Platform

> **Product Design Specification Document**
> Versão: 1.0.0 | Status: Draft | Autor: Product Designer Agent
> Última atualização: 2026-07-25

---

## Índice

1. [Design System Foundation](#1-design-system-foundation)
2. [Component Library](#2-component-library)
3. [Page Specifications](#3-page-specifications)
4. [User Flow Diagrams](#4-user-flow-diagrams)
5. [Accessibility Requirements](#5-accessibility-requirements)
6. [Mobile Responsiveness](#6-mobile-responsiveness)

---

## 1. Design System Foundation

### 1.1 Design Principles

A identidade visual da Agiliza é construída sobre três pilares:

1. **Confiável (Trustworthy)** — Cores verdes transmitem segurança, crescimento e saúde financeira. Tipografia limpa e espaçamento generoso comunicam organização e profissionalismo.
2. **Humano (Human-centered)** — O sistema cobra sem constranger. A interface reflete isso: tons amenos, cantos arredondados, micro-animações suaves, linguagem empática.
3. **Inteligente (AI-augmented)** — Decisões de IA são apresentadas com **explicabilidade visual**: scores de confiança, badges de risco, razões legíveis. O usuário nunca é surpreendido por uma "caixa preta".

### 1.2 Brand Colors

A paleta é centrada no verde primário `#22c55e` (já definido no `tailwind.config.ts`), expandida para suportar todos os contextos do produto.

| Token | Hex | Usage | WCAG AA Contrast |
|---|---|---|---|
| `primary-50` | `#f0fdf4` | Background de cards, seções destacadas | — |
| `primary-100` | `#dcfce7` | Hover de linhas de tabela, alertas suaves | — |
| `primary-200` | `#bbf7d0` | Badge verde claro, indicadores positivos | — |
| `primary-300` | `#86efac` | Gráfico verde, progresso | — |
| `primary-400` | `#4ade80` | Hover de botão primário | — |
| **`primary-500`** | **`#22c55e`** | **Botões primários, links, destaque principal** | 3.2:1 (large text on white) |
| `primary-600` | `#16a34a` | **Hover state de botões** | 4.5:1 (normal text on white) |
| `primary-700` | `#15803d` | Texto ativo, bordas foco | 5.5:1 |
| `primary-800` | `#166534` | Cabeçalhos escuros | 7.2:1 |
| `primary-900` | `#14532d` | Footer, backgrounds escuros | 12.5:1 |

**Cores Semânticas (Risk & Status):**

| Token | Hex | Usage | risco |
|---|---|---|---|
| `success` | `#22c55e` | Pagamento confirmado, badge verde | — |
| `warning` | `#eab308` | Risco amarelo, atenção, pending | 3.8:1 on white |
| `danger` | `#ef4444` | Risco vermelho, overdue, erro crítico | 4.5:1 on white |
| `info` | `#3b82f6` | Informacional, onboarding, links | — |
| `muted` | `#6b7280` | Texto secundário, labels | 4.5:1 on white |
| `muted-foreground` | `#9ca3af` | Placeholder, desabilitado | — |

**Neutros (Base — Zinc, já definido no components.json):**

| Token | Hex | Usage |
|---|---|---|
| `background` | `#ffffff` | Fundo principal |
| `foreground` | `#09090b` | Texto principal |
| `card` | `#ffffff` | Fundo de cards |
| `card-foreground` | `#09090b` | Texto em cards |
| `popover` | `#ffffff` | Dropdowns, tooltips |
| `popover-foreground` | `#09090b` | Texto em popovers |
| `muted` | `#f4f4f5` | Fundo secundário |
| `muted-foreground` | `#71717a` | Texto secundário |
| `border` | `#e4e4e7` | Bordas de componentes |
| `input` | `#e4e4e7` | Borda de inputs |
| `ring` | `#22c55e` | Anel de foco (focus ring) — usar primary-500 |

### 1.3 Typography

**Família principal:** Inter (já incluída no layout do Next.js)

**Type Scale:**

| Elemento | Tamanho | Line-height | Weight | Tracking |
|---|---|---|---|---|
| `h1` | 2rem (32px) | 2.5rem (40px) | 700 (bold) | -0.02em |
| `h2` | 1.5rem (24px) | 2rem (32px) | 600 (semibold) | -0.01em |
| `h3` | 1.25rem (20px) | 1.75rem (28px) | 600 (semibold) | 0 |
| `h4` | 1.125rem (18px) | 1.5rem (24px) | 600 (semibold) | 0 |
| `body` | 0.875rem (14px) | 1.5rem (24px) | 400 (regular) | 0 |
| `body-sm` | 0.8125rem (13px) | 1.25rem (20px) | 400 (regular) | 0 |
| `small` | 0.75rem (12px) | 1rem (16px) | 400 (regular) | 0 |
| `caption` | 0.6875rem (11px) | 1rem (16px) | 500 (medium) | 0.04em |
| `mono` | 0.875rem (14px) | 1.5rem (24px) | 400 (regular) | 0 |

**Mapping Tailwind (utility classes):**

```typescript
// tailwind.config.ts — extend theme
fontSize: {
  'h1': ['2rem', { lineHeight: '2.5rem', fontWeight: '700', letterSpacing: '-0.02em' }],
  'h2': ['1.5rem', { lineHeight: '2rem', fontWeight: '600', letterSpacing: '-0.01em' }],
  'h3': ['1.25rem', { lineHeight: '1.75rem', fontWeight: '600' }],
  'h4': ['1.125rem', { lineHeight: '1.5rem', fontWeight: '600' }],
  'body': ['0.875rem', { lineHeight: '1.5rem' }],
  'body-sm': ['0.8125rem', { lineHeight: '1.25rem' }],
  'small': ['0.75rem', { lineHeight: '1rem' }],
  'caption': ['0.6875rem', { lineHeight: '1rem', fontWeight: '500', letterSpacing: '0.04em' }],
  'mono': ['0.875rem', { lineHeight: '1.5rem' }],
},
fontFamily: {
  sans: ['Inter', 'system-ui', 'sans-serif'],
  mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
},
```

### 1.4 Spacing (4px Grid System)

| Token | Pixels | Tailwind | Usage |
|---|---|---|---|
| `space-0` | 0px | `0` | — |
| `space-1` | 4px | `1` | Micro espaçamentos, ícones pequenos |
| `space-2` | 8px | `2` | Padding interno de badges, chips |
| `space-3` | 12px | `3` | Gap entre label e input |
| `space-4` | 16px | `4` | Padding horizontal de cards, botões |
| `space-5` | 20px | `5` | Gap entre seções de formulário |
| `space-6` | 24px | `6` | Padding de cards, gap entre grupos |
| `space-8` | 32px | `8` | Margem entre seções da página |
| `space-10` | 40px | `10` | Padding do container principal |
| `space-12` | 48px | `12` | Gap vertical entre seções grandes |
| `space-16` | 64px | `16` | Margem de página hero/splash |

**Regra:** Preferir múltiplos de 4px para consistência vertical e horizontal.

### 1.5 Border Radius Tokens

| Token | Pixels | Tailwind | Usage |
|---|---|---|---|
| `radius-none` | 0px | `rounded-none` | Tabelas, inputs inline |
| `radius-sm` | 4px | `rounded-sm` | Badges, pequenos indicadores |
| `radius-md` | 6px | `rounded-md` | Inputs, botões, cards compactos |
| `radius-lg` | 8px | `rounded-lg` | Cards, modais, dropdowns |
| `radius-xl` | 12px | `rounded-xl` | Sidebar, containers grandes |
| `radius-2xl` | 16px | `rounded-2xl` | Dialog, sheet |
| `radius-full` | 9999px | `rounded-full` | Avatars, pills, indicadores |

### 1.6 Shadow Elevation Tokens

| Token | Tailwind | Usage |
|---|---|---|
| `shadow-sm` | `shadow-sm` (`0 1px 2px 0 rgb(0 0 0 / 0.05)`) | Cards em estado normal |
| `shadow-md` | `shadow-md` (`0 4px 6px -1px rgb(0 0 0 / 0.1)`) | Dropdowns, popovers, hover de cards |
| `shadow-lg` | `shadow-lg` (`0 10px 15px -3px rgb(0 0 0 / 0.1)`) | Modais, dialogs, sidebar |
| `shadow-xl` | `shadow-xl` (`0 20px 25px -5px rgb(0 0 0 / 0.1)`) | Sheets, elementos flutuantes full-screen |

**Sombra customizada para toast/notificação:**

```css
--shadow-toast: 0 8px 32px rgba(0, 0, 0, 0.12);
```

### 1.7 Icons

**Biblioteca:** Lucide React (já em `dependencies` no `package.json`)

**Convenções de naming em componentes:**

```typescript
// Sempre importar como componente, nunca como string
import { Bell, DollarSign, TrendingUp, Users, AlertTriangle, CheckCircle } from 'lucide-react'
```

**Tamanhos de ícone por contexto:**

| Contexto | Tamanho |
|---|---|
| Navigation (sidebar) | 20px (`size={5}`) |
| Button small (icon-only) | 16px (`size={4}`) |
| Button default (with text) | 16px (`size={4}`) |
| StatCard icon | 24px (`size={6}`) |
| Empty state illustration | 48px (`size={12}`) |
| Toast icon | 20px (`size={5}`) |

**Ícones mapeados por domínio:**

| Domínio | Ícone Primário | Ícone Secundário |
|---|---|---|
| Clientes | `Users` | `UserPlus`, `UserCheck` |
| Faturas | `FileText` | `Receipt`, `DollarSign` |
| Pagamentos | `CreditCard` | `Banknote`, `CheckCircle` |
| Mensagens | `MessageSquare` | `Send`, `Bell` |
| Risco | `ShieldAlert` | `TrendingUp`, `AlertTriangle` |
| Dashboard | `LayoutDashboard` | `BarChart3`, `PieChart` |
| Configurações | `Settings` | `Sliders`, `Shield` |
| Onboarding | `Wand2` | `Sparkles`, `Rocket` |

---

## 2. Component Library

### 2.1 Component Tree — Architecture Overview

```
App
├── Layout
│   ├── Sidebar (collapsible, bottom nav on mobile)
│   ├── Header (breadcrumbs + user menu + search)
│   └── PageContainer (responsive padding)
│
├── Shared / Primitive (shadcn/ui base)
│   ├── Button, Badge, Card, Input, Select, Switch
│   ├── Dialog, Sheet, Popover, Tooltip
│   ├── Tabs, Table, Pagination, Skeleton
│   ├── Form, Label, Textarea, Checkbox, RadioGroup
│   └── Sonner (toast), Command (autocomplete)
│
├── Domain Components (Agiliza-specific)
│   ├── DataDisplay/
│   │   ├── DataTable        (paginated, sortable, filterable)
│   │   ├── StatCard         (metric + label + trend)
│   │   ├── StatusBadge      (green/yellow/red + variants)
│   │   ├── RiskScoreIndicator (radial progress + color)
│   │   └── MetricTrend      (arrow up/down + delta %)
│   │
│   ├── Forms/
│   │   ├── ClientForm       (create/edit client)
│   │   ├── InvoiceForm      (create invoice)
│   │   ├── ConfigForm       (tenant payment provider)
│   │   └── SearchInput      (debounced search)
│   │
│   ├── Communication/
│   │   ├── MessagePreview   (WhatsApp bubble simulation)
│   │   └── TemplateSelector (template picker + variables)
│   │
│   ├── Navigation/
│   │   ├── TabNavigation    (segment tabs)
│   │   └── Breadcrumbs      (auto-generated from path)
│   │
│   ├── Feedback/
│   │   ├── Toast            (sonner-based, action + dismiss)
│   │   ├── LoadingSkeleton  (per-component skeletons)
│   │   ├── EmptyState       (icon + title + description + CTA)
│   │   └── ErrorState       (error message + retry)
│   │
│   └── B2C Billing/
│       ├── PaymentCard      (PIX QRCode + Copy&Paste)
│       ├── InvoiceSummary   (compact invoice display)
│       └── PaymentHistory   (scrollable list + status)
```

### 2.2 Shared / Primitive Components (shadcn/ui)

A base do design system utiliza componentes **shadcn/ui** instalados via CLI. A lista abaixo define quais componentes devem ser instalados e quais customizações são necessárias.

| Componente | Status | Customização |
|---|---|---|
| `button` | Instalar | Adicionar variante `success`, `warning`, `danger` que seguem as cores semânticas |
| `badge` | Instalar | Adicionar variantes `green`, `yellow`, `red` para StatusBadge |
| `card` | Instalar | Usar como base para StatCard e PaymentCard |
| `input` | Instalar | Sem customização |
| `select` | Instalar | Sem customização |
| `switch` | Instalar | Cor primária (green) no active track |
| `label` | Instalar | Sem customização |
| `textarea` | Instalar | Sem customização |
| `checkbox` | Instalar | Cor primária |
| `radio-group` | Instalar | Cor primária |
| `tabs` | Instalar | Usar como TabNavigation base |
| `table` | Instalar | Usar como DataTable base |
| `pagination` | Instalar | Usar na DataTable |
| `dialog` | Instalar | Sem customização |
| `sheet` | Instalar | Para sidebar mobile |
| `popover` | Instalar | Para filtros, date picker |
| `tooltip` | Instalar | Delay de 500ms para mostrar |
| `skeleton` | Instalar | Cor neutra com animação pulse |
| `sonner` | Instalar | Posição bottom-right, rich colors |
| `command` | Instalar | Para paleta de atalhos (futuro) |
| `separator` | Instalar | Sem customização |
| `dropdown-menu` | Instalar | Para user menu e actions |
| `breadcrumb` | Instalar | Sem customização |
| `spinner` | Instalar | Usar em loading states de botões |
| `calendar` | Instalar | Para date range picker |
| `form` | Instalar | Para formulários com validação |

### 2.3 Domain Components — Specifications

#### 2.3.1 DataTable

**Base:** shadcn `Table` + `Pagination`

**Props:**
```typescript
interface DataTableProps<T> {
  data: T[]
  columns: ColumnDef<T>[]
  pagination: {
    page: number
    perPage: number
    total: number
    onPageChange: (page: number) => void
    onPerPageChange: (perPage: number) => void
  }
  sorting?: {
    sortBy: string
    sortOrder: 'asc' | 'desc'
    onSort: (field: string, order: 'asc' | 'desc') => void
  }
  filters?: React.ReactNode  // filter bar slot
  search?: {
    value: string
    onChange: (value: string) => void
    placeholder?: string
  }
  selection?: {
    selectedIds: string[]
    onSelectionChange: (ids: string[]) => void
  }
  loading?: boolean
  emptyState?: {
    icon?: React.ReactNode
    title: string
    description: string
    action?: { label: string; onClick: () => void }
  }
  onRowClick?: (row: T) => void
}
```

**Estados:**

| State | Visual |
|---|---|
| **Loading** | 5x linhas de Skeleton com altura de 52px cada |
| **Empty** | EmptyState centralizado com título + descrição + CTA "Criar primeiro cliente" |
| **Error** | ErrorState com mensagem + botão "Tentar novamente" |
| **Filtered Empty** | EmptyState com "Nenhum resultado encontrado" + botão "Limpar filtros" |

**Comportamento:**
- Ordenação: clicar no header alterna asc/desc/off. Indicador visual com ícone `ArrowUpDown`.
- Seleção: checkbox na primeira coluna. Header checkbox seleciona/deseleciona todos na página.
- Paginação: 20 items por página default. Opções: 10, 20, 50, 100.
- Largura mínima da tabela: 640px. Scroll horizontal em telas menores.
- Row hover: background `muted` (`#f4f4f5`).

#### 2.3.2 StatCard

**Props:**
```typescript
interface StatCardProps {
  title: string
  value: string | number
  description?: string
  icon?: React.ReactNode
  trend?: {
    direction: 'up' | 'down' | 'neutral'
    value: string        // ex: "+12.5%", "-3.2%"
    label?: string       // ex: "vs. mês anterior"
  }
  variant?: 'default' | 'success' | 'warning' | 'danger'
  loading?: boolean
  onClick?: () => void
}
```

**Layout:**
```
┌──────────────────────────────────┐
│ [icon]  title                    │
│                                  │
│         R$ 45.230,00             │  ← value (text-h2)
│                                  │
│          description             │  ← text-small text-muted-foreground
│                                  │
│   ↑ +12.5%   vs. mês anterior   │  ← trend (color conforme direction)
└──────────────────────────────────┘
```

**Estados:**

| State | Visual |
|---|---|
| **Loading** | Skeleton retangular com dimensões do card (altura ~120px) |
| **Hover** | Sutil elevação (`shadow-md`), cursor pointer se `onClick` definido |
| **Trend up** | Texto verde + `TrendingUp` icon |
| **Trend down** | Texto vermelho + `TrendingDown` icon |
| **Trend neutral** | Texto muted + `Minus` icon |

#### 2.3.3 StatusBadge

**Base:** shadcn `Badge` com variantes customizadas

```typescript
type StatusBadgeVariant = 'green' | 'yellow' | 'red' | 'gray' | 'blue'

interface StatusBadgeProps {
  variant: StatusBadgeVariant
  label: string
  dot?: boolean
  pulse?: boolean   // animated dot para "processing"
  size?: 'sm' | 'md'
}
```

**Variantes:**

| Variant | Background | Text | Border | Dot |
|---|---|---|---|---|
| `green` | `primary-100` | `primary-700` | `primary-200` | `#22c55e` |
| `yellow` | `#fef9c3` | `#a16207` | `#fde047` | `#eab308` |
| `red` | `#fee2e2` | `#b91c1c` | `#fecaca` | `#ef4444` |
| `gray` | `#f4f4f5` | `#52525b` | `#e4e4e7` | `#a1a1aa` |
| `blue` | `#dbeafe` | `#1d4ed8` | `#bfdbfe` | `#3b82f6` |

**Mapeamento de domínio:**

| Contexto | Status | Variant |
|---|---|---|
| Invoice | `paid` | green |
| Invoice | `pending` | yellow |
| Invoice | `overdue` | red |
| Invoice | `cancelled` | gray |
| Invoice | `refunded` | blue |
| Risk Score | `green` | green |
| Risk Score | `yellow` | yellow |
| Risk Score | `red` | red |
| Message | `sent` / `delivered` | blue |
| Message | `read` / `clicked` | green |
| Message | `failed` | red |
| Payment | `confirmed` | green |
| Payment | `processing` | yellow (com pulse) |
| Payment | `failed` | red |
| Template | `approved` | green |
| Template | `pending` | yellow |
| Template | `rejected` | red |

#### 2.3.4 RiskScoreIndicator

**Props:**
```typescript
interface RiskScoreIndicatorProps {
  score: 'green' | 'yellow' | 'red'
  probability?: number   // 0-1
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}
```

**Visual:**
- Círculo radial (SVG `circle` com `stroke-dasharray`) na cor do score
- Probabilidade exibida como porcentagem no centro (ex: "92%")
- Tamanhos: sm (32px), md (48px), lg (64px)

#### 2.3.5 ClientForm

**Base:** shadcn `Form`

**Props:**
```typescript
interface ClientFormProps {
  mode: 'create' | 'edit'
  initialData?: Partial<CreateClientInput>
  onSubmit: (data: CreateClientInput) => Promise<void>
  onCancel?: () => void
  loading?: boolean
}
```

**Fields:**

| Field | Type | Required | Validations |
|---|---|---|---|
| `name` | Input | Sim | min 2, max 200 chars |
| `phone` | Input (masked) | Sim | 10-11 dígitos, máscara `(99) 99999-9999` |
| `email` | Input | Não | Email válido |
| `preferredChannel` | RadioGroup | Sim | whatsapp / email / sms |
| `preferredTime` | Select (HH:mm) | Não | Intervalos: manhã/tarde/noite |
| `preferredLeadDays` | Select (1-15) | Sim | Valor default: 5 |

**Phone Input:** Usar biblioteca `react-phone-number-input` ou input customizado com máscara.

**Estados:**

| State | Visual |
|---|---|
| **Loading (edit)** | Skeleton em cada field + botão desabilitado |
| **Validation error** | Campo específico com borda vermelha + mensagem abaixo |
| **Submit loading** | Botão com Spinner + "Salvando..." |
| **Submit success** | Toast + redirecionamento |
| **Submit error** | Toast de erro + formulário permanece preenchido |

#### 2.3.6 InvoiceForm

**Props:**
```typescript
interface InvoiceFormProps {
  mode: 'create' | 'edit'
  initialData?: Partial<CreateInvoiceInput>
  clients: { id: string; name: string; phone: string }[]  // autocomplete source
  onSubmit: (data: CreateInvoiceInput) => Promise<void>
  onCancel?: () => void
  loading?: boolean
}
```

**Fields:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `clientId` | Combobox (autocomplete) | Sim | Buscar clientes por nome/phone |
| `amount` | Input (currency) | Sim | Máscara R$ 0,00 |
| `dueDate` | DatePicker | Sim | Data futura |
| `paymentMethod` | Select | Sim | PIX (default) / Boleto / Cartão |
| `description` | Textarea | Não | Max 500 chars |

#### 2.3.7 ConfigForm (Payment Provider)

**Props:**
```typescript
interface ConfigFormProps {
  tenantId: string
  initialConfig?: PaymentProviderConfig
  onSubmit: (data: SetPaymentProviderInput) => Promise<void>
  onTestConnection?: () => Promise<boolean>
  loading?: boolean
}
```

**Fields:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `provider` | Select | Sim | Asaas / MercadoPago / PagBank / Polar |
| `apiKey` | Password Input | Sim | Mascarado, toggle visibility |
| `environment` | Switch (sandbox/production) | Sim | Visual toggle com labels |
| `pixEnabled` | Switch | Sim | Default true |
| `boletoEnabled` | Switch | Não | Default false |
| `creditCardEnabled` | Switch | Não | Default false |

**Fluxo especial:** Após preencher a API key, exibir botão "Testar Conexão" que valida a chave antes de salvar. Retorno visual: `CheckCircle` verde se OK, `XCircle` vermelho se falha.

#### 2.3.8 SearchInput

**Base:** shadcn `Input` com ícone `Search` à esquerda

**Props:**
```typescript
interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  debounceMs?: number   // default 300
  onClear?: () => void
  disabled?: boolean
}
```

**Comportamento:**
- Input com ícone `Search` (lucide-react) à esquerda
- Botão `X` à direita quando há texto (para limpar)
- Debounce de 300ms antes de chamar `onChange`
- Loading spinner no lugar do ícone search enquanto debounce aguarda (opcional)

#### 2.3.9 MessagePreview (WhatsApp Bubble)

**Props:**
```typescript
interface MessagePreviewProps {
  template: {
    body: string
    variables: Record<string, string>
  }
  status?: 'sent' | 'delivered' | 'read' | 'failed'
  timestamp?: Date
  direction?: 'outgoing' | 'incoming'
}
```

**Visual:**
```
┌──────────────────────────────────┐
│                                  │
│  ┌──────────────────────────┐    │
│  │ Olá, João!               │    │  ← Bubble verde (#dcfce7 bg)
│  │                           │    │
│  │ Sua mensalidade de R$    │    │
│  │ 150,00 vence em 3 dias.  │    │
│  │                           │    │
│  │ 👆 Pague com 1 clique:    │    │
│  │ [  Link Mágico PIX  ]    │    │  ← Link button estilizado
│  │                           │    │
│  │ 19:00  ✓✓                │    │  ← Timestamp + check duplo
│  └──────────────────────────┘    │
│                                  │
└──────────────────────────────────┘
```

**Especificação do Bubble:**
- Background: `primary-100` (#dcfce7) para outgoing
- Background: branco com borda `border` para incoming
- Border radius: `radius-xl` (12px)
- Shadow: `shadow-sm`
- Max width: 320px (mobile), 400px (desktop)
- Timestamp: `text-caption` alinhado à direita
- Double check (✓✓): cinza quando enviado, azul quando lido

**Variáveis com destaque visual:**
Placeholders `{{name}}`, `{{value}}` devem ser renderizados com highlight (bold + primary-600) quando preenchidos.

#### 2.3.10 TemplateSelector

**Props:**
```typescript
interface TemplateSelectorProps {
  templates: MessageTemplate[]
  selectedId?: string
  onSelect: (template: MessageTemplate) => void
  previewVariables?: Record<string, string>  // valores de exemplo para preview
}
```

**Layout:**
- Grid de cards com o nome do template, categoria, status aprovação e preview.
- Ao selecionar um template, o MessagePreview é atualizado ao lado (layout split).
- Filtros por categoria (reminder, receipt, retention, offer, onboarding).

#### 2.3.11 TabNavigation

**Base:** shadcn `Tabs`

**Props:**
```typescript
interface TabNavigationProps {
  tabs: { id: string; label: string; icon?: React.ReactNode; badge?: string | number }[]
  activeTab: string
  onTabChange: (tabId: string) => void
  variant?: 'underline' | 'pills' | 'segmented'
}
```

**Variants:**
- `underline`: Padrão shadcn, linha inferior animada
- `pills`: Badges arredondados (usar em filtros de risk score)
- `segmented`: Grupo de botões conectados (usar em ConfigForm environment)

**Estados:**
- Active: cor primária + underline/pill ativo
- Hover: muted background
- Disabled: opacity-50, cursor not-allowed
- Com badge: bolinha com número (ex: "Clientes (45)")

#### 2.3.12 Breadcrumbs

**Base:** shadcn `Breadcrumb`

**Props:**
```typescript
interface BreadcrumbsProps {
  segments: { label: string; href?: string }[]
  className?: string
}
```

**Comportamento:**
- Auto-gerado a partir da rota atual no Next.js
- Último segmento sem link (página atual)
- Separador: `/` ou `>` conforme preferência
- Mobile: mostrar apenas último segmento + "..." se necessário

#### 2.3.13 Toast (Notifications)

**Base:** `sonner` (shadcn instala sonner como provider de toast)

**Props:**
```typescript
// Usar API do sonner:
// toast.success('Cliente criado com sucesso')
// toast.error('Erro ao salvar. Tente novamente.')
// toast.warning('A chave de API expirará em 7 dias')
// toast.info('Processando pagamento...')
```

**Tipos:**
| Type | Icon | Cor | Duração | Ação |
|---|---|---|---|---|
| Success | `CheckCircle` | green | 4s | OK / Desfazer |
| Error | `XCircle` | red | 6s | Tentar novamente |
| Warning | `AlertTriangle` | yellow | 5s | Ver detalhes |
| Info | `Info` | blue | 4s | — |
| Loading | `Spinner` | gray | Até conclusão | — |

**Posição:** `bottom-right` (default do sonner)

#### 2.3.14 LoadingSkeleton

**Base:** shadcn `Skeleton`

**Props:**
```typescript
interface LoadingSkeletonProps {
  variant: 'card' | 'table-row' | 'stat-card' | 'chart' | 'form' | 'detail'
  count?: number   // repeat count for lists
}
```

**Variantes predefinidas:**

| Variant | Estrutura |
|---|---|
| `card` | Retângulo 300x200px com cantos arredondados |
| `table-row` | 5x linhas de 52px com colunas variando largura |
| `stat-card` | 4 cards lado a lado, cada 180x120px |
| `chart` | Retângulo 100% x 300px |
| `form` | 4x grupos label + input (200px), 2x lado a lado |
| `detail` | Avatar 64px + 3 linhas de texto de larguras variadas |

#### 2.3.15 EmptyState

**Props:**
```typescript
interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
    variant?: 'default' | 'outline'
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
}
```

**Layout centralizado:**
```
         [icon large 48-64px]
          text-muted-foreground

        Título em semibold h3

    Descrição em body text-muted-foreground
        max-w-md centralizado

      [  Botão de ação primária  ]
        Link de ação secundária
```

#### 2.3.16 ErrorState

**Props:**
```typescript
interface ErrorStateProps {
  error: Error | string
  onRetry?: () => void
  fullPage?: boolean
  variant?: 'inline' | 'full-page'
}
```

**Variant `inline`:** Container compacto com borda vermelha, ícone `AlertTriangle`, mensagem, botão "Tentar novamente".

**Variant `full-page`:** Centralizado na tela com largura max-w-md, ícone maior, mensagem mais descritiva.

**UX Rule:** Nunca expor detalhes técnicos do erro (stack trace, SQL, etc). Usar mensagens amigáveis: "Não foi possível carregar os dados. Tente novamente em alguns instantes."

#### 2.3.17 PaymentCard (PIX)

**Props:**
```typescript
interface PaymentCardProps {
  invoice: {
    id: string
    amount: number
    description?: string
    dueDate: Date
    pixQrCode?: string   // base64
    pixCopiaECola?: string
    linkUrl?: string
  }
  status: 'pending' | 'processing' | 'confirmed' | 'expired'
  onCopyPix?: (code: string) => void
  onOpenBank?: (code: string) => void
}
```

**Layout (B2C PWA):**
```
┌──────────────────────────────────────┐
│                                      │
│  ┌────────────────────────────────┐  │
│  │      [QR Code 200x200]         │  │
│  │      ┌──────────────┐          │  │
│  │      │ ██ █  ██ ██  │          │  │
│  │      │ ██ █  ██ ██  │          │  │
│  │      │ ██ █  ██ ██  │          │  │
│  │      └──────────────┘          │  │
│  └────────────────────────────────┘  │
│                                      │
│      Sua conta: R$ 150,00           │  ← text-h2
│      Vencimento: 15/08/2026         │  ← text-small muted
│                                      │
│  ┌────────────────────────────────┐  │
│  │   Pagar com PIX (Abrir App)    │  │  ← Button primário (full-width)
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │  Copiar código PIX             │  │  ← Button outline (full-width)
│  └────────────────────────────────┘  │
│                                      │
│  ⏱ Expira em 59:32                 │  ← Countdown timer
│                                      │
└──────────────────────────────────────┘
```

**Estados:**

| State | Visual |
|---|---|
| **Pending** | QR Code visível, botões habilitados, timer ativo |
| **Processing** | QR Code com overlay "Processando...", botões desabilitados, spinner |
| **Confirmed** | Check animado verde, confetes (via `react-confetti` ou CSS), botões escondidos |
| **Expired** | QR Code com overlay "Expirado", botão "Gerar novo PIX" |

**Copy & Paste:** Ao clicar em "Copiar código PIX", copiar para clipboard + toast "Código PIX copiado! Cole no seu banco."

**Deep Link:** Ao clicar em "Pagar com PIX", tentar abrir URL de deep link `pix://...` ou copiar + redirecionar para app do banco.

#### 2.3.18 InvoiceSummary

**Props:**
```typescript
interface InvoiceSummaryProps {
  invoice: {
    id: string
    amount: number
    dueDate: Date
    status: InvoiceStatus
    description?: string
    paymentMethod?: string
    clientName?: string   // B2B context
  }
  variant?: 'compact' | 'detailed'
}
```

**Variant `compact`:** Usado em listas (DataTable row). Uma linha com: ícone, valor, vencimento, status badge.

**Variant `detailed`:** Card expandido com: descrição, método, timeline de status, botões de ação.

#### 2.3.19 PaymentHistory

**Props:**
```typescript
interface PaymentHistoryProps {
  payments: {
    id: string
    amount: number
    status: 'pending' | 'confirmed' | 'failed' | 'refunded'
    method: string
    paidAt?: Date
    createdAt: Date
  }[]
  loading?: boolean
}
```

**Layout:** Lista vertical com grupos por mês/ano. Cada item mostra: data, valor, método, status badge. Scroll infinito com paginação.

### 2.4 Component States — Complete Matrix

Todo componente deve implementar os estados abaixo conforme aplicável:

| Estado | Obrigatório? | Critério de Aceitação |
|---|---|---|
| **default/ideal** | Sim | Renderiza com dados completos |
| **loading** | Sim | Feedback visual em < 200ms. Skeleton ou spinner |
| **empty** | Sim (data-dependent) | Mensagem descritiva + CTA |
| **error** | Sim (data-dependent) | Mensagem amigável + botão retry. Sem expor detalhes técnicos |
| **hover** | Sim | Interação visual suave (bg change, elevation) |
| **focus** | Sim | Focus ring visível (outline ou shadow) usando cor `ring` |
| **active/pressed** | Sim | Escala 95% ou darken |
| **disabled** | Sim | Opacity 50%, cursor not-allowed |
| **selected** | Sim (selectable) | Border highlight, checkmark |
| **validation error** | Sim (forms) | Campo específico + mensagem de erro |

---

## 3. Page Specifications

### 3.1 Page Structure — Shared Layout

Cada página do dashboard B2B segue a mesma estrutura:

```
┌─────────────────────────────────────────────────────────────┐
│  ┌──────────┐  ┌────────────────────────────────────────┐  │
│  │          │  │  Header                                │  │
│  │          │  │  ┌──────────────────────────────────┐  │  │
│  │  Sidebar │  │  │ Breadcrumbs > Current Page       │  │  │
│  │          │  │  └──────────────────────────────────┘  │  │
│  │  240px   │  │  [Search]   [Notifications]   [User]  │  │
│  │          │  ├────────────────────────────────────────┤  │
│  │          │  │                                        │  │
│  │          │  │  Page Content (responsive padding)     │  │
│  │          │  │                                        │  │
│  │          │  │             ...                        │  │
│  │          │  │                                        │  │
│  └──────────┘  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Sidebar Navigation:**

| Item | Icon | Path | Badge |
|---|---|---|---|
| Dashboard | `LayoutDashboard` | `/dashboard` | — |
| Clientes | `Users` | `/clients` | Contagem |
| Faturas | `FileText` | `/invoices` | Overdue count |
| Mensagens | `MessageSquare` | `/messages` | — |
| Risco | `ShieldAlert` | `/risk` | — |
| Relatórios | `BarChart3` | `/reports` | — |
| Configurações | `Settings` | `/settings` | — |

**Header:**
- Breadcrumbs automáticos (shadcn `Breadcrumb`)
- SearchInput global (busca clientes, faturas)
- Notification bell (futuro: dropdown de notificações)
- User menu (dropdown: perfil, configurações, logout)

### 3.2 Login / Tenant Onboarding

**Path:** `/auth/login` e `/auth/register`

**Layout:** Centralizado, card único, max-w-md.

**Login:**
- Email + Senha
- Botão "Entrar" (full-width, primary)
- Link "Esqueci a senha"
- Link "Criar conta"

**Register / Onboarding Wizard:**

```
Step 1/3: Cadastro da Empresa
  ┌────────────────────────────────┐
  │                                │
  │  🏢 Dados da Empresa          │
  │                                │
  │  Nome do estabelecimento      │
  │  [__________________________] │
  │                                │
  │  CNPJ                         │
  │  [___.___.___/____-__]        │  ← masked input
  │                                │
  │  Segmento (Niche)             │
  │  [Select: Academia / Escola   │
  │   / Condomínio / Farmácia ...]│
  │                                │
  │  [Continuar →]                │
  └────────────────────────────────┘

Step 2/3: Gateway de Pagamento
  ┌────────────────────────────────┐
  │                                │
  │  💳 Conectar Pagamento        │
  │                                │
  │  Provedor                     │
  │  [Select: Asaas / MercadoPago │
  │   / PagBank / Polar]          │
  │                                │
  │  Chave de API                 │
  │  [●●●●●●●●●●●●●●●] 👁         │  ← toggle visibility
  │                                │
  │  Ambiente                     │
  │  [Sandbox] [Production]       │  ← segmented tabs
  │                                │
  │  [  Testar Conexão  ]         │
  │  ✓ Conexão estabelecida       │  ← feedback visual
  │                                │
  │  [Continuar →]                │
  └────────────────────────────────┘

Step 3/3: Preferências Iniciais
  ┌────────────────────────────────┐
  │                                │
  │  ⚙️ Configuração Inicial      │
  │                                │
  │  Nome da régua de cobrança    │
  │  [Régua Padrão________________]│
  │                                │
  │  Os clientes receberão         │
  │  lembretes:                    │
  │  3 dias antes do vencimento    │
  │  [Sim] [Não]                  │
  │  No dia do vencimento          │
  │  [Sim] [Não]                  │
  │  3 dias após vencimento        │
  │  [Sim] [Não]                  │
  │                                │
  │  [Finalizar Configuração]     │
  └────────────────────────────────┘
```

**UX Rules:**
- Wizard salva progresso no localStorage (não perder dados se fechar a janela)
- Cada step valida antes de avançar
- Step 2: "Testar Conexão" é obrigatório antes de continuar
- Loading state no botão "Continuar" enquanto salva
- Step progress indicator (3 bolinhas no topo)
- Animação de transição suave entre steps (fade + slide)

### 3.3 Dashboard Home

**Path:** `/dashboard`

**Layout:**
```
┌────────────────────────────────────────────────────────────┐
│  Dashboard                                     [Data range]│  ← Header
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐                   │
│  │A Receber│ │% Col.│ │  Em   │ │Tempo  │                   │  ← 4 StatCards
│  │R$45.2K │ │ 88%  │ │Risco  │ │Médio  │                   │
│  │↑ 12%   │ │↓ 2%  │ │R$5.1K │ │2.3h   │                   │
│  └──────┘  └──────┘  └──────┘  └──────┘                   │
│                                                            │
│  ┌─────────────────────────┐  ┌────────────────────────┐  │
│  │                         │  │                        │  │
│  │   Collection Trend      │  │   Risk Distribution    │  │  ← Charts
│  │   (Line Chart)          │  │   (Donut Chart)        │  │
│  │                         │  │                        │  │
│  └─────────────────────────┘  └────────────────────────┘  │
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │
│  │  Recent Payments / Pending Invoices                │   │  ← DataTable
│  │  ┌────┬──────────┬──────┬────────┬──────┬──────┐  │   │
│  │  │Cli.│Valor     │Venc. │Status  │Risco │Ações │  │   │
│  │  ├────┼──────────┼──────┼────────┼──────┼──────┤  │   │
│  │  │... │...       │...   │...     │...   │...   │  │   │
│  │  └────┴──────────┴──────┴────────┴──────┴──────┘  │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**StatCards (4):**
1. **A Receber** — Total de faturas pendentes (R$). Trend vs mês anterior.
2. **% Coletado** — Porcentagem de faturas pagas no período. Warning se < 80%.
3. **Em Risco** — Soma de valores de clientes "red" + "yellow". Vermelho se > 15%.
4. **Tempo Médio de Recuperação** — Média de horas entre vencimento e pagamento. Green se < 24h.

**Charts (usar shadcn `chart` blocks):**
- **Collection Trend:** Line chart, pontos por dia/semana, duas séries: "Previsto" (tracejado) e "Realizado".
- **Risk Distribution:** Donut chart, 3 cores (green/yellow/red), labels com % e valor em R$.

**DataTable:** Últimos 10 pagamentos recebidos + próximos vencimentos. Colunas: Cliente, Valor, Vencimento, Status badge, Risk badge, Ações (ver fatura).

**Empty State (primeiro acesso):** "Bem-vindo à Agiliza! Comece importando seus clientes." + CTA "Importar Clientes".

### 3.4 Client Management

**Path:** `/clients`

**Layout:**
```
┌────────────────────────────────────────────────────────────┐
│  Clientes                          [+ Novo Cliente]        │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  [Buscar nome ou telefone...]  [Filtrar ▼] [Risco ▼]      │  ← Search + Filters
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ □ │ Nome   │ Telefone   │ Plano   │ Risco │ Venc.   │  │
│  │ □ │ João   │ (11) 9... │ Premium │ 🟢    │ 15/08   │  │
│  │ □ │ Maria  │ (21) 9... │ Básico  │ 🟡    │ 10/08   │  │
│  │ └─────────────────────────────────────────────────────┘  │
│  │                                        [1-20 de 145]    │  ← Pagination
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Filters:**
- Risk Score: pills (Todos / Verde / Amarelo / Vermelho)
- Channel: select dropdown
- Onboarding: switch (Completou / Não completou)
- Date range: calendar popover

**Bulk Actions (quando 1+ selecionados):**
- "Gerar Faturas" → modal confirm + create invoices
- "Enviar Lembrete" → modal selecionar template
- "Exportar CSV"

**Client Detail Page (`/clients/[id]`):**

```
┌────────────────────────────────────────────────────────────┐
│  Clientes > João Silva                                      │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌────────────────────┐  ┌──────────────────────────────┐  │
│  │ Profile Card       │  │ Risk Timeline                │  │
│  │ [Avatar]           │  │ ┌──────────────────────────┐  │  │
│  │ João Silva         │  │ │ Risk: 🟢 (92%)           │  │  │
│  │ (11) 99999-8888    │  │ │ "Paga em dia > 90%"      │  │  │
│  │ Premium - R$150/m  │  │ │ Features:                │  │  │
│  │ 🟢 Risco Baixo     │  │ │ • Atraso médio: 2d ✓     │  │  │
│  │                    │  │ │ • Abertura msg: 85% ✓    │  │  │
│  │ [Editar] [Enviar]  │  │ └──────────────────────────┘  │  │
│  └────────────────────┘  └──────────────────────────────┘  │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Faturas │ Mensagens │ Decisões                     │   │  ← Tabs
│  ├─────────────────────────────────────────────────────┤   │
│  │  DataTable de faturas do cliente                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Client Form (Create/Edit):** Modal ou página dedicada com os campos especificados na seção 2.3.5.

### 3.5 Invoices & Billing

**Path:** `/invoices`

**Layout:**
```
┌────────────────────────────────────────────────────────────┐
│  Faturas                             [+ Nova Fatura]       │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Filters: [Status ▼] [Cliente ▼] [Data ▼] [Método ▼]      │
│  [Buscar...]                                                │
│                                                            │
│  Bulk: [Gerar em Lote]  [Enviar Lembretes]  [Exportar]    │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ □ │#   │ Cliente   │ Valor   │ Venc. │ Status  │ Aç  │  │
│  │ □ │001 │ João      │ R$150   │ 15/08 │ 🟡 Pend.│ 👁  │  │
│  │ □ │002 │ Maria     │ R$200   │ 10/08 │ 🟢 Pago │ 👁  │  │
│  │ □ │003 │ Pedro     │ R$120   │ 05/08 │ 🔴 Venc.│ 👁  │  │
│  │ └────────────────────────────────────────────────────── │
│  │ [1-20 de 89]                                            │
│  └────────────────────────────────────────────────────────┘
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Invoice Detail (`/invoices/[id]`):**
- Header: valor grande + status badge
- Timeline visual: Created → Payment → Confirmed (ou Overdue)
- Client info card
- Payment info (PIX QRCode se aplicável, link)
- Message history for this invoice
- Ações: Cancelar, Reembolsar, Reenviar

**Create Invoice (`/invoices/new`):** Modal ou página com InvoiceForm.

**Empty State:** "Nenhuma fatura encontrada. Crie a primeira fatura ou importe clientes para gerar automaticamente."

### 3.6 Message Templates

**Path:** `/settings/templates`

**Layout:**
```
┌────────────────────────────────────────────────────────────┐
│  Templates de Mensagem              [+ Novo Template]       │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  [Todas] [Lembrete] [Recibo] [Retenção] [Oferta]          │  ← Category tabs
│                                                            │
│  ┌──────────────────────┐  ┌────────────────────────────┐  │
│  │ Template List        │  │ Preview Panel              │  │
│  │                      │  │                            │  │
│  │ ├ friendly_reminder  │  │  ┌──────────────────────┐  │  │
│  │ │ ✅ Aprovado        │  │  │ Olá, {{name}}!       │  │  │
│  │ ├ friendly_reminder  │  │  │ Sua conta de R$      │  │  │
│  │ │ ⏳ Pendente        │  │  │ {{value}} vence em   │  │  │
│  │ ├ urgent_reminder    │  │  │ {{due_date}}.         │  │  │
│  │ │ ✅ Aprovado        │  │  │                      │  │  │
│  │ ├ payment_receipt    │  │  │ 👆 Pague aqui:       │  │  │
│  │ │ ✅ Aprovado        │  │  │ [{{pix_link}}]       │  │  │
│  │ └──                 ┘  │  │                      │  │  │
│  │                        │  │  19:00  ✓✓           │  │  │
│  │                        │  │  └──────────────────────┘  │  │
│  │                        │  │                            │  │
│  │                        │  │  Variáveis:                │  │
│  │                        │  │  [name:  ██████████]       │  │
│  │                        │  │  [value: ██████████]       │  │  ← Variable editor
│  │                        │  │  [due_date: █████]         │  │
│  │                        │  │  [pix_link: ██████████]    │  │
│  │                        │  └────────────────────────────┘  │
│  └──────────────────────┘                                    │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**A/B Test Variants:**
- Cada template pode ter múltiplas variantes (A, B, C...)
- O Decision Engine seleciona qual variante usar baseado no perfil do cliente
- Dashboard mostra performance comparativa (open rate, click rate, conversion)

**Template Editor:**
- Nome do template (slug)
- Categoria (select)
- Body do template com highlight de variáveis
- Preview ao vivo no painel direito
- Botão "Salvar" + "Enviar para aprovação Meta"

### 3.7 Risk Dashboard

**Path:** `/risk`

**Layout:**
```
┌────────────────────────────────────────────────────────────┐
│  Risk Dashboard                                            │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │ 🟢 Baixo  │  │ 🟡 Médio │  │ 🔴 Alto  │                 │  ← Risk cards
│  │ 150 client│  │ 75 client│  │ 25 client│                 │
│  │ R$ 75.000 │  │ R$37.500 │  │ R$12.500 │                 │
│  │ 90% conf. │  │ 65% conf.│  │ 72% conf.│                 │
│  └──────────┘  └──────────┘  └──────────┘                  │
│                                                            │
│  ┌────────────────────────────────────────────────────┐    │
│  │  📊 Risk Distribution by Segment                  │    │  ← Bar chart
│  │  [Academia] [Escola] [Condomínio] [Farmácia]      │    │  ← Niche tabs
│  └────────────────────────────────────────────────────┘    │
│                                                            │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Clientes em Risco Alto                           │    │  ← DataTable filtrada
│  │  ┌────┬──────┬──────┬──────────┬────────────────┐  │    │
│  │  │N.  │Valor │Dias  │Motivos   │Ação Sugerida   │  │    │
│  │  ├────┼──────┼──────┼──────────┼────────────────┤  │    │
│  │  │João│R$150 │12d   │Atraso    │📞 Ligar para   │  │    │
│  │  │    │      │      │médio +   │   cliente      │  │    │
│  │  │    │      │      │baixa     │                │  │    │
│  │  │    │      │      │abertura  │                │  │    │
│  │  └────┴──────┴──────┴──────────┴────────────────┘  │    │
│  └────────────────────────────────────────────────────┘    │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Risk Detail Modal (ao clicar em cliente):**
- Top features explicativas (SHAP-like)
- Timeline de risco (histórico de mudanças)
- Ações sugeridas com botão "Executar"

### 3.8 Settings

**Path:** `/settings`

**Layout com tabs:**
```
┌────────────────────────────────────────────────────────────┐
│  Configurações                                             │
├────────────────────────────────────────────────────────────┤
│  [Geral] [Pagamento] [Régua] [Templates] [Equipe]         │  ← Tabs
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Tab Content (conforme abaixo)                             │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Geral:**
- Nome do estabelecimento, email, telefone
- Niche (read-only após criação)
- Plano atual + link para upgrade

**Pagamento (ConfigForm):**
- Provider selector
- API key (mascarada, toggle visibility)
- Test connection button
- Environment toggle (sandbox/production)
- Enabled methods (PIX, Boleto, Cartão)

**Régua (Billing Schedule):**
```
  ┌────────────────────────────────────────────────────────┐
  │  Nome: [Régua Padrão _____________________________]    │
  │                                                        │
  │  Regras:                                               │
  │  ┌────────────────────────────────────────────────┐    │
  │  │ Trigger   │ Dias │ Canal    │ Template    │  🗑│    │
  │  │ Antes venc│ 3    │ WhatsApp │ friendly... │    │    │
  │  │ No venc.  │ 0    │ WhatsApp │ on_due      │    │    │
  │  │ Após venc │ 3    │ WhatsApp │ urgent...   │    │    │
  │  └────────────────────────────────────────────────┘    │
  │  [+ Adicionar Regra]                                   │
  │                                                        │
  │  [Salvar Régua]                                        │
  └────────────────────────────────────────────────────────┘
```

**Equipe (Team Management — pós-MVP):**
- Lista de usuários com email + role
- Convite via email

### 3.9 Payment Page (B2C PWA)

**Path:** `/billing/[invoiceId]`

**Layout (Mobile-first):**
```
┌──────────────────────────────────┐
│  💳 Pagamento                    │  ← Header com logo
│                                  │
│  ┌────────────────────────────┐  │
│  │  Sua conta                 │  │
│  │                            │  │
│  │  R$ 150,00                 │  │  ← InvoiceSummary
│  │  Academia Fit              │  │
│  │  Vencimento: 15/08/2026   │  │
│  └────────────────────────────┘  │
│                                  │
│  ┌────────────────────────────┐  │
│  │                            │  │
│  │     [QR Code PIX]         │  │
│  │                            │  │
│  │  [  Pagar com PIX 🏦  ]   │  │  ← CTA primário full-width
│  │                            │  │
│  │  [Copiar código PIX]      │  │  ← CTA secundário
│  │                            │  │
│  │  ⏱ Expira em 59:59        │  │  ← Timer regressivo
│  └────────────────────────────┘  │
│                                  │
│  Precisa de ajuda?               │  ← Link sutil
│  Fale conosco via WhatsApp       │
│                                  │
└──────────────────────────────────┘
```

**Comportamento:**
- Página 100% responsiva, single-column
- Ao clicar "Pagar com PIX":
  1. Tentar deep link `pix://` (abre app do banco)
  2. Fallback: copiar código PIX + abrir modal "Cole no seu banco"
  3. Mostrar toast "Redirecionando para seu banco..."
- Timer regressivo: quando expira, desabilitar botões e mostrar "PIX Expirado. [Gerar novo]"
- Polling a cada 5s para verificar status do pagamento

**Status:**
- `pending`: Tela completa com QR Code e botões
- `processing`: Botões desabilitados, spinner no QR Code
- `confirmed`: Transição animada para tela de confirmação

### 3.10 Payment Confirmation (B2C)

**Path:** `/billing/[invoiceId]/success`

```
┌──────────────────────────────────┐
│                                  │
│      ✅                          │  ← Check animado (verde)
│                                  │
│  Pagamento Confirmado!           │  ← h2
│                                  │
│  R$ 150,00                       │  ← h1
│  Academia Fit                    │
│  Pago em 15/08/2026 às 19:32    │  ← body small
│                                  │
│  ┌────────────────────────────┐  │
│  │ [Baixar Recibo (PDF)]     │  │  ← Button outline
│  └────────────────────────────┘  │
│                                  │
│  Próxima fatura:                 │
│  15/09/2026                      │
│                                  │
│  [  Voltar ao Início  ]         │  ← Link suave
│                                  │
└──────────────────────────────────┘
```

**Efeitos:**
- Confete via CSS/animations (não requer lib extra)
- Check mark animado (scale in + rotate)
- Transição suave via fade do estado de loading

### 3.11 Payment History (B2C)

**Path:** `/billing/history`

```
┌──────────────────────────────────┐
│  Histórico de Pagamentos         │
├──────────────────────────────────┤
│                                  │
│  Agosto 2026                     │  ← Month separator
│  ┌────────────────────────────┐  │
│  │ 15/08  Academia Fit  R$150 │  │  ← Payment row
│  │        PIX  ✅ Pago        │  │
│  ├────────────────────────────┤  │
│  │ 10/08  Farmácia    R$ 89  │  │
│  │        Cartão ✅ Pago     │  │
│  └────────────────────────────┘  │
│                                  │
│  Julho 2026                      │
│  ┌────────────────────────────┐  │
│  │ 15/07  Academia Fit  R$150 │  │
│  │        PIX  ✅ Pago        │  │
│  └────────────────────────────┘  │
│                                  │
│  [Carregar mais...]              │  ← Paginated
│                                  │
└──────────────────────────────────┘
```

---

## 4. User Flow Diagrams

### 4.1 B2B Onboarding Flow

```
Novo Usuário (B2B)
│
├── 1. Acessa agiliza.com/login
│     │
│     ├── Já tem conta? → Login (email + senha)
│     │
│     └── Não tem conta? → "Criar Conta"
│           │
│           ├── Step 1: Informações da Empresa
│           │   ├── Nome, CNPJ, Email, Telefone
│           │   ├── Niche (Academia, Escola, etc.)
│           │   ├── Senha + Confirmar Senha
│           │   └── [Continuar]
│           │
│           ├── Step 2: Conectar Gateway de Pagamento
│           │   ├── Selecionar provedor (Asaas/MP/PagBank/Polar)
│           │   ├── Inserir API Key (mascarada)
│           │   ├── Selecionar ambiente (Sandbox/Production)
│           │   ├── [Testar Conexão]
│           │   │   ├── ✓ Sucesso → continuar
│           │   │   └── ✗ Falha → mostrar erro, permitir corrigir
│           │   └── [Continuar]
│           │
│           ├── Step 3: Configurar Régua Inicial
│           │   ├── Nome da régua
│           │   ├── Ativar/desativar triggers padrão
│           │   └── [Finalizar]
│           │
│           └── ✅ Onboarding Completo
│                 │
│                 ├── Toast: "Bem-vindo à Agiliza!"
│                 ├── Redirecionar para /dashboard
│                 ├── Mostrar EmptyState do Dashboard
│                 │   └── "Comece importando seus clientes"
│                 └── Suggestions:
│                     ├── "Importar CSV" → modal upload
│                     └── "Criar manualmente" → client form
│
└── (Pós-onboarding) Flow contínuo:
    ├── Importar/Criar clientes
    ├── Gerar primeiras faturas
    ├── Sistema dispara lembretes automáticos
    └── Dashboard começa a mostrar métricas
```

### 4.2 B2C Payment Flow

```
Cliente Final (B2C) — "João Silva"
│
├── 1. Recebe WhatsApp da Agiliza
│     ┌──────────────────────────────────────┐
│     │ Olá, João! Sua mensalidade de        │
│     │ R$ 150,00 da Academia Fit vence      │
│     │ em 3 dias (15/08).                   │
│     │                                      │
│     │ 👆 Clique aqui para pagar com PIX:   │
│     │ [  Link Mágico PIX  ]               │
│     │                                      │
│     │ Ou copie o código:                   │
│     │ 00020126360014BR.GOV.BCB.PIX...      │
│     └──────────────────────────────────────┘
│
├── 2. Clica no link (ou copia código)
│     │
│     ├── Deep link PIX:
│     │   ├── Abre app do banco automaticamente
│     │   ├── PIX já preenchido com valor e chave
│     │   └── Cliente confirma com biometria
│     │
│     └── Fallback (se deep link não funcionar):
│         ├── Abre página PWA /billing/[invoiceId]
│         ├── Mostra QR Code PIX + Copia e Cola
│         ├── [Copiar Código PIX] → Clipboard + Toast
│         └── [Abrir App do Banco] → Deep link manual
│
├── 3. Banco processa pagamento
│     │
│     ├── Pagamento confirmado (instantâneo)
│     │   ├── Webhook chega no backend (< 30s)
│     │   ├── Invoice status → "paid"
│     │   ├── Risk score é atualizado
│     │   └── Mensagem de recibo é enviada
│     │
│     └── Pagamento falha
│         ├── Saldo insuficiente → Mostra "PIX não aprovado"
│         ├── QR Code expirado → "Gerar novo código"
│         └── Fallback para boleto/cartão (futuro)
│
├── 4. Página PWA mostra confirmação
│     │
│     ├── ✅ Animação de check + confete
│     ├── Resumo: "R$ 150,00 pagos em 15/08"
│     ├── Botão: [Baixar Recibo PDF]
│     ├── "Próxima fatura: 15/09/2026"
│     │
│     └── Cliente pode:
│         ├── Fechar página (recibo chega via WhatsApp)
│         └── Ver /billing/history
│
└── 5. WhatsApp de confirmação (automático)
      ┌──────────────────────────────────────┐
      │ ✅ Pagamento Confirmado!            │
      │                                      │
      │ Academia Fit                         │
      │ R$ 150,00 — Pago em 15/08 às 19:32  │
      │                                      │
      │ 📄 [Baixar Recibo]                  │
      │                                      │
      │ Próxima fatura: 15/09/2026          │
      └──────────────────────────────────────┘
```

### 4.3 Collection Flow (System Orchestration)

```
Sistema Agiliza — Ciclo de Cobrança (Cron Diário)
│
├── 00:00 — Cron job "Generate Invoices" roda
│     │
│     ├── Busca subscriptions com billingDay = hoje
│     │   └── Para cada subscription ativa:
│     │       ├── Cria Invoice (status: pending)
│     │       ├── Cria PIX charge no Payment Provider
│     │       ├── Salva pixQrCode + pixCopiaECola na Invoice
│     │       └── Emite DomainEvent "invoice.created"
│     │
│     └── Busca invoices vencendo hoje (dueDate = now)
│         └── Para cada invoice pending:
│             ├── Atualiza status → "overdue" (se aplicável)
│             └── Emite DomainEvent "invoice.overdue"
│
├── 08:00 — Decision Engine avalia ações do dia
│     │
│     ├── Para cada invoice pending/overdue com ação pendente:
│     │   └── Chama DecideNextActionUseCase(clientId, invoiceId)
│     │       ├── Carrega features do cliente
│     │       ├── Aplica heurística + bandit
│     │       ├── Decide: {action, channel, template, sendAt}
│     │       ├── Cria DecisionLog
│     │       └── Se action = "send_message":
│     │           └── Enfileira job no BullMQ ("send-message")
│     │
│     └── Decision Engine recomenda horários otimizados
│         └── Canais e templates são escolhidos por cliente
│
├── 19:00 — Peak hour de disparo de mensagens
│     │
│     └── Worker "send-message" processa fila:
│         ├── Renderiza template com variáveis do cliente
│         ├── Envia via Evolution API (WhatsApp)
│         ├── Salva Message (status: queued → sent)
│         └── Emite DomainEvent "message.sent"
│
├── (Assíncrono) — Cliente interage com a mensagem
│     │
│     ├── Webhook "messages.update" → delivered
│     │   └── Atualiza Message.status → "delivered"
│     │
│     ├── Webhook "messages.update" → read
│     │   ├── Atualiza Message.status → "read"
│     │   └── Emite DomainEvent "message.read"
│     │
│     └── Webhook "messages.update" → clicked
│         ├── Atualiza Message.status → "clicked"
│         └── Emite DomainEvent "message.clicked"
│
├── (Assíncrono) — Pagamento via PIX
│     │
│     ├── Webhook payment-gateway → payment.confirmed
│     │   └── Chama ReconcilePaymentUseCase:
│     │       ├── Cria Payment (status: confirmed)
│     │       ├── Atualiza Invoice (status: paid, paidAt)
│     │       ├── Emite DomainEvent "payment.confirmed"
│     │       ├── Dispara SendReceiptHandler
│     │       └── Dispara UpdateRiskScoreHandler
│     │
│     └── Webhook payment-gateway → payment.failed
│         └── Chama ReconcilePaymentUseCase (failure path):
│             ├── Cria Payment (status: failed)
│             ├── Registra failureReason + failureCode
│             └── Emite DomainEvent "payment.failed"
│
├── (Assíncrono) — Loop de Feedback do Bandit
│     │
│     └── Após "payment.confirmed" ou após 24h sem ação:
│         ├── FeedbackUseCase atualiza BanditState
│         │   ├── Sucesso (pagou ≤ 24h): alpha++
│         │   └── Falha (não pagou em 24h): beta++
│         └── Thompson Sampling recalbra prior por arm
│
└── 03:00 — Jobs de reconciliação e manutenção
      │
      ├── Varredura de payments órfãos (dead-letter queue)
      ├── Re-tenta reconciliação de invoices inconsistentes
      ├── Gera agregados de relatórios (cache para dashboard)
      └── Limpa cache expirado (Redis TTL)
```

---

## 5. Accessibility Requirements

### 5.1 WCAG 2.1 AA Compliance Checklist

A plataforma deve atender ao nível AA da WCAG 2.1 como padrão mínimo.

| Critério | Descrição | Implementação |
|---|---|---|
| **1.1.1** Non-text Content | Todo conteúdo não-textual tem alternativa textual | Ícones decorativos com `aria-hidden="true"`; ícones informativos com `aria-label` |
| **1.4.1** Use of Color | Cor não é o único meio de transmitir informação | StatusBadge tem texto + ícone + cor; gráficos usam patterns + labels |
| **1.4.3** Contrast (Minimum) | Texto normal ≥ 4.5:1, texto grande ≥ 3:1 | Todas as cores definidas na seção 1.2 atendem ao contraste mínimo |
| **1.4.4** Resize Text | Texto pode ser redimensionado até 200% sem perda | Unidades relativas (rem/em) em toda a interface, sem `text-size-adjust: none` |
| **1.4.10** Reflow | Conteúdo sem scroll horizontal em 320px | Layout responsivo, sidebar vira bottom nav |
| **1.4.11** Non-text Contrast | Componentes UI têm contraste ≥ 3:1 | Botões, inputs, cards têm bordas e backgrounds contrastantes |
| **1.4.12** Text Spacing | Sem perda de conteúdo ao aumentar espaçamento | Layout usa gap/flex, não posicionamento absoluto |
| **2.1.1** Keyboard | Todas as funcionalidades via teclado | Tabs, dropdowns, modais, formulários — navegação por Tab/Enter/Escape |
| **2.4.3** Focus Order | Ordem de foco lógica e significativa | Tab order segue layout visual (sidebar → header → content) |
| **2.4.7** Focus Visible | Indicador de foco visível em todos os elementos | Focus ring `ring-primary` com `outline-offset-2` |
| **2.5.3** Label in Name | Nome acessível inclui texto visível | Botões de ícone usam `aria-label="..."` |
| **3.2.1** On Focus | Foco não causa mudança de contexto | Nenhum auto-redirect ao focus |
| **3.3.1** Error Identification | Erro de input é identificado e descrito | Validação inline com campo específico destacado |
| **3.3.2** Labels or Instructions | Labels ou instruções presentes em todos os inputs | shadcn Form + Label com `htmlFor` |
| **4.1.2** Name, Role, Value | Todos os elementos UI têm nome, role, valor acessíveis | ARIA attributes conforme necessidade |

### 5.2 Color Contrast Compliance

| Combo | Foreground | Background | Ratio | Passa? |
|---|---|---|---|---|
| Primary text on white | `primary-500` (#22c55e) | #ffffff | 3.2:1 | ✅ Large text only |
| Primary text on white | `primary-600` (#16a34a) | #ffffff | 4.5:1 | ✅ Normal text |
| Primary text on white | `primary-700` (#15803d) | #ffffff | 5.5:1 | ✅ Normal text |
| Muted text on white | `#6b7280` | #ffffff | 4.5:1 | ✅ Normal text |
| Muted foreground | `#9ca3af` | #ffffff | 3.1:1 | ⚠️ Apenas em placeholders / disabled |
| Warning text on white | `#eab308` | #ffffff | 1.4:1 | ❌ Não usar texto amarelo em branco. Usar `#a16207` para texto. |
| Danger text on white | `#ef4444` | #ffffff | 4.5:1 | ✅ Normal text |
| Button primary text | #ffffff | `primary-500` | 3.2:1 | ✅ Large text (button) |
| Button primary hover | #ffffff | `primary-600` | 4.5:1 | ✅ Normal text |

### 5.3 Focus Indicators

```css
/* Estilo de focus global — usar no globals.css */
*:focus-visible {
  outline: 2px solid hsl(var(--ring));   /* #22c55e / primary-500 */
  outline-offset: 2px;
  border-radius: 4px;   /* pegar do token radius-sm */
}

/* Button focus (já incluso no shadcn) */
/* Input focus (já incluso no shadcn) */

/* Skip to content link (acessibilidade de teclado) */
.skip-to-content {
  position: absolute;
  left: -9999px;
  top: 0;
  z-index: 9999;
}
.skip-to-content:focus {
  left: 16px;
  top: 16px;
  padding: 8px 16px;
  background: white;
  border: 2px solid #22c55e;
}
```

### 5.4 Screen Reader (ARIA) Guidelines

| Elemento | ARIA Attribute | Valor |
|---|---|---|
| Sidebar navigation | `role="navigation"` | — |
| Sidebar toggle button | `aria-expanded` | `true` / `false` |
| Sidebar toggle button | `aria-controls` | `#sidebar-menu` |
| DataTable | `role="table"` | — |
| DataTable sortable header | `aria-sort` | `ascending` / `descending` / `none` |
| Tabs | `role="tablist"` + `role="tab"` + `aria-selected` | — |
| Modal/Dialog | `role="dialog"` + `aria-modal="true"` | — |
| Loading skeleton | `aria-hidden="true"` | — |
| Toast notification | `role="status"` + `aria-live="polite"` | — |
| Error message | `role="alert"` | — |
| Progress indicator | `role="progressbar"` + `aria-valuenow` | — |
| Button with only icon | `aria-label` | Descrição da ação |
| Form field error | `aria-invalid="true"` + `aria-describedby` | ID do elemento de erro |

### 5.5 Keyboard Navigation

| Tecla | Ação | Contexto |
|---|---|---|
| `Tab` | Navegar entre elementos focáveis | Global |
| `Shift+Tab` | Navegar para trás | Global |
| `Enter` / `Space` | Ativar elemento | Botões, links, checkboxes |
| `Escape` | Fechar modal/dropdown/popover | Modais, selects, tooltips |
| `ArrowDown` | Abrir dropdown / próximo item | Select, autocomplete, menu |
| `ArrowUp` | Item anterior | Select, autocomplete, menu |
| `ArrowLeft/Right` | Navegar entre tabs | TabNavigation |
| `Home` / `End` | Primeiro/último item | Listas, tabelas |
| `Ctrl+K` | Abrir paleta de comandos | Global (futuro) |

---

## 6. Mobile Responsiveness

### 6.1 Breakpoints (Tailwind Default)

| Breakpoint | Min Width | Target |
|---|---|---|
| `sm` | 640px | Large phones landscape |
| `md` | 768px | Tablets |
| `lg` | 1024px | Desktop small |
| `xl` | 1280px | Desktop wide |
| `2xl` | 1536px | Large screens |

### 6.2 B2B Dashboard — Responsive Behavior

| Elemento | Desktop (≥1024px) | Tablet (768-1023px) | Mobile (<768px) |
|---|---|---|---|
| **Sidebar** | 240px, fixed | Collapsible (hamburger) | Bottom navigation bar |
| **Header** | Full width + breadcrumbs | Full width + hamburger | Hidden breadcrumbs |
| **StatCards (4)** | 4 columns | 2x2 grid | 1 column, stacked |
| **Charts (2)** | Side-by-side (1fr 1fr) | Stacked vertically | Stacked, full-width |
| **DataTable** | Full width | Scroll horizontal | Card list (cards, no table) |
| **Page Padding** | `px-8` | `px-6` | `px-4` |
| **Content Max Width** | 1440px | 100% | 100% |

**Sidebar → Bottom Navigation (mobile):**
```
┌──────────────────────────────────┐
│                                  │
│        Page Content              │
│                                  │
│                                  │
│                                  │
│                                  │
├──────────────────────────────────┤
│  🏠  👥  📄  ✉️  ⚙️            │  ← Bottom Nav (5 icons)
│  Dashboard  Cli  Fat  Msg  Conf  │
└──────────────────────────────────┘
```

### 6.3 B2C Billing — Mobile-first

O B2C é projetado primariamente para mobile (WhatsApp → link → PWA).

| Elemento | Mobile (<768px) | Tablet+ (≥768px) |
|---|---|---|
| **Layout** | Single column, full-width | Centralizado, max-w-md |
| **Header** | Logo + "Pagamento" | Logo + breadcrumbs |
| **QR Code** | 200x200 centered | 240x240 centered |
| **CTA Buttons** | Full-width, stacked | max-w-sm centered |
| **InvoiceSummary** | Compact card | Detailed card |
| **Payment History** | Lista simples | Lista com mais colunas |

**Touch Targets (Mobile):**

| Elemento | Tamanho Mínimo | Espaçamento |
|---|---|---|
| Botões CTA | 48px height | 16px margin |
| Links | 44x44px touch area | 8px gap |
| Form inputs | 44px height | 12px gap |
| Bottom nav items | 56x48px | — |
| Checkboxes | 44x44px touch area | — |

### 6.4 Responsive Component Variants

| Component | Desktop | Mobile |
|---|---|---|
| **DataTable** | Tabela com colunas | Card list: cada linha vira um card |
| **MessagePreview** | 400px max-width | Full-width |
| **StatCard** | Compact, horizontal | Full-width, vertical |
| **SearchInput** | 320px width | Full-width |
| **Filters bar** | Inline, horizontal | Accordion/drawer "Filtros" |
| **Modal** | Centered, max-w-lg | Bottom sheet (drawer) |
| **Tooltip** | Hover | Tap to show |

---

## Appendix A: File Structure — Frontend Components

```
apps/frontend/src/
├── components/
│   ├── ui/                            # shadcn/ui primitives
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── badge.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── table.tsx
│   │   ├── tabs.tsx
│   │   ├── skeleton.tsx
│   │   ├── dialog.tsx
│   │   ├── sheet.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── breadcrumb.tsx
│   │   ├── form.tsx
│   │   ├── sonner.tsx
│   │   ├── pagination.tsx
│   │   ├── popover.tsx
│   │   ├── tooltip.tsx
│   │   ├── separator.tsx
│   │   ├── label.tsx
│   │   ├── textarea.tsx
│   │   ├── checkbox.tsx
│   │   ├── radio-group.tsx
│   │   ├── switch.tsx
│   │   ├── calendar.tsx
│   │   ├── command.tsx
│   │   ├── spinner.tsx
│   │   ├── chart.tsx
│   │   └── sidebar.tsx                # shadcn sidebar (instalar via CLI)
│   │
│   ├── layout/
│   │   ├── sidebar.tsx                # App sidebar wrapper (collapsible)
│   │   ├── header.tsx                 # Breadcrumbs + search + user menu
│   │   ├── page-container.tsx         # Responsive padding + max-width
│   │   ├── mobile-bottom-nav.tsx      # Bottom navigation (mobile only)
│   │   └── app-layout.tsx             # Combina Sidebar + Header + Content
│   │
│   ├── data-display/
│   │   ├── data-table.tsx             # Generic paginated/sortable table
│   │   ├── data-table-column-header.tsx
│   │   ├── data-table-pagination.tsx
│   │   ├── data-table-toolbar.tsx
│   │   ├── stat-card.tsx
│   │   ├── status-badge.tsx
│   │   ├── risk-score-indicator.tsx
│   │   └── metric-trend.tsx
│   │
│   ├── forms/
│   │   ├── client-form.tsx
│   │   ├── invoice-form.tsx
│   │   ├── config-form.tsx            # Payment provider config
│   │   ├── search-input.tsx
│   │   ├── phone-input.tsx            # Masked phone input
│   │   └── currency-input.tsx         # R$ masked input
│   │
│   ├── communication/
│   │   ├── message-preview.tsx        # WhatsApp bubble
│   │   ├── template-selector.tsx
│   │   └── message-timeline.tsx       # Timeline de eventos de mensagem
│   │
│   ├── navigation/
│   │   ├── tab-navigation.tsx
│   │   └── breadcrumbs.tsx
│   │
│   ├── feedback/
│   │   ├── loading-skeleton.tsx
│   │   ├── empty-state.tsx
│   │   ├── error-state.tsx
│   │   └── toast.tsx                  # Sonner wrapper/configuration
│   │
│   └── billing/                       # B2C components
│       ├── payment-card.tsx
│       ├── invoice-summary.tsx
│       ├── payment-history.tsx
│       ├── payment-confirmation.tsx
│       ├── payment-timer.tsx          # Countdown timer
│       └── pix-qrcode.tsx             # QRCode renderer
│
├── hooks/
│   ├── use-debounce.ts
│   ├── use-media-query.ts
│   ├── use-pagination.ts
│   └── use-polling.ts
│
├── lib/
│   ├── utils.ts                       # cn() helper
│   ├── formatters.ts                  # currency, date, phone formatters
│   └── constants.ts                   # risk colors, status maps, etc.
│
└── app/
    ├── layout.tsx                     # Root layout (Inter font, metadata)
    ├── globals.css                    # Tailwind + custom tokens
    │
    ├── (auth)/
    │   ├── login/page.tsx
    │   └── register/page.tsx          # Onboarding wizard
    │
    ├── dashboard/page.tsx             # Home dashboard
    │
    ├── clients/
    │   ├── page.tsx                   # Client list
    │   ├── [id]/page.tsx              # Client detail
    │   └── new/page.tsx               # Create client
    │
    ├── invoices/
    │   ├── page.tsx                   # Invoice list
    │   ├── [id]/page.tsx              # Invoice detail
    │   └── new/page.tsx               # Create invoice
    │
    ├── risk/page.tsx                  # Risk dashboard
    │
    ├── messages/
    │   └── page.tsx                   # Message log / tracking
    │
    ├── settings/
    │   ├── page.tsx                   # General settings
    │   ├── payment/page.tsx           # Payment provider config
    │   ├── schedule/page.tsx          # Billing schedule
    │   └── templates/page.tsx         # Message templates
    │
    └── billing/                       # B2C routes (PWA)
        ├── [invoiceId]/page.tsx       # Payment page
        ├── [invoiceId]/success/page.tsx  # Payment confirmation
        └── history/page.tsx           # Payment history
```

---

## Appendix B: Tailwind Config — Extended Theme

```typescript
// tailwind.config.ts — Extensões para o design system
import type { Config } from "tailwindcss";

const config: Config = {
  // ... existing config
  theme: {
    extend: {
      colors: {
        // Already defined: primary (50-900)

        // Semantic colors
        success: {
          DEFAULT: "#22c55e",
          light: "#dcfce7",
          dark: "#15803d",
        },
        warning: {
          DEFAULT: "#eab308",
          light: "#fef9c3",
          dark: "#a16207",
        },
        danger: {
          DEFAULT: "#ef4444",
          light: "#fee2e2",
          dark: "#b91c1c",
        },
        info: {
          DEFAULT: "#3b82f6",
          light: "#dbeafe",
          dark: "#1d4ed8",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        "h1": ["2rem", { lineHeight: "2.5rem", fontWeight: "700", letterSpacing: "-0.02em" }],
        "h2": ["1.5rem", { lineHeight: "2rem", fontWeight: "600", letterSpacing: "-0.01em" }],
        "h3": ["1.25rem", { lineHeight: "1.75rem", fontWeight: "600" }],
        "h4": ["1.125rem", { lineHeight: "1.5rem", fontWeight: "600" }],
        "body": ["0.875rem", { lineHeight: "1.5rem" }],
        "body-sm": ["0.8125rem", { lineHeight: "1.25rem" }],
        "small": ["0.75rem", { lineHeight: "1rem" }],
        "caption": ["0.6875rem", { lineHeight: "1rem", fontWeight: "500", letterSpacing: "0.04em" }],
        "mono": ["0.875rem", { lineHeight: "1.5rem" }],
      },
      borderRadius: {
        sm: "4px",
        md: "6px",
        lg: "8px",
        xl: "12px",
        "2xl": "16px",
      },
      boxShadow: {
        toast: "0 8px 32px rgba(0, 0, 0, 0.12)",
      },
    },
  },
};
```

---

## Appendix C: Design Review Checklist

Antes de considerar um componente "pronto", verificar:

- [ ] **Todos os estados implementados?** (default, loading, empty, error, hover, focus, disabled)
- [ ] **Feedback visual em < 200ms?** (loading skeleton ou spinner imediatamente)
- [ ] **Contraste de cores atende WCAG AA?** (texto normal ≥ 4.5:1)
- [ ] **Navegação por teclado funcional?** (Tab, Enter, Escape, Arrow keys)
- [ ] **Focus ring visível?** (outline 2px primary, offset 2px)
- [ ] **ARIA attributes corretos?** (roles, labels, live regions)
- [ ] **Responsivo nos breakpoints?** (sm, md, lg, xl)
- [ ] **Touch targets ≥ 44px (mobile)?**
- [ ] **Ícones com `aria-hidden` ou `aria-label`?**
- [ ] **Formulários com label + error state?** (aria-invalid, aria-describedby)
- [ ] **Empty state com CTA claro?** (nunca tela em branco)
- [ ] **Error state sem expor detalhes técnicos?** (mensagem amigável + retry)
- [ ] **Consistência com Design System?** (cores, tipografia, spacing, radius)
- [ ] **Animações respeitam `prefers-reduced-motion`?** (transition: none se reduzido)

---

> **Document Version**: 1.0.0
> **Last Updated**: 2026-07-25
> **Author**: Product Designer Agent
> **Review Status**: Draft — pending CTO and full-stack engineer review
> **Related Specs**: `docs/sdd.md`, `docs/project.md`, `apps/frontend/tailwind.config.ts`
