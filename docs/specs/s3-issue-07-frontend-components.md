# Spec: Issue #27 — Frontend Component Completion (11 Components)

**Component:** Frontend (apps/frontend)  
**Spec Author:** Product Designer Agent  
**Date:** 2026-07-29  
**Status:** Draft  
**Related:** Sprint 3 Plan, SDD Section 4 (API Contracts), `apps/frontend/src/components/`

---

## 1. Overview

Sprint 2 delivered 8 of 19 domain components. This spec covers the remaining **11 components** needed for the Agiliza v0.3.0 frontend. All components are **pure presentational** — data fetching is the parent page's responsibility via `@tanstack/react-query` or direct `api.get()` calls.

### Design Foundation

All components build on existing design tokens from `tailwind.config.ts`:

| Token | Usage | Example Value |
|-------|-------|--------------|
| `primary-{50-900}` | Primary actions, highlights | `bg-primary-500`, `text-primary-700` |
| `success-{50-900}` | Positive states, paid | `bg-success-100`, `text-success-800` |
| `warning-{50-900}` | Medium risk, pending | `bg-warning-100`, `text-warning-800` |
| `danger-{50-900}` | High risk, overdue, errors | `bg-danger-100`, `text-danger-800` |
| `info-{50-900}` | Informational, neutral status | `bg-info-100`, `text-info-800` |
| `gray-{50-900}` | Text, borders, backgrounds | `text-gray-900`, `border-gray-100` |
| `font-sans` | Inter var | Typography scale from tailwind config |
| `rounded-xl` | Card/border radius (12px) | Default card container |
| `shadow-sm` | Card shadow | `shadow-sm` on Card components |

### Existing Component Dependencies

Components below may import and wrap:

| Symbol | Source | Purpose |
|--------|--------|---------|
| `Card`, `CardHeader`, `CardTitle`, `CardContent`, `CardFooter` | `@/components/ui/card` | Container layout |
| `Badge` | `@/components/ui/badge` | Status labels |
| `Button` | `@/components/ui/button` | Actions |
| `Skeleton` | `@/components/ui/skeleton` | Loading skeletons |
| `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell` | `@/components/ui/table` | Data tables |
| `RiskBadge` | `@/components/risk-badge` | Risk level display |
| `ClientCard` | `@/components/client-card` | Client summary |
| `PaymentStatus` | `@/components/payment-status` | Payment state display |
| `StatusBadge` | `@/components/status-badge` | Status indicators |
| `KpiCard` | `@/components/kpi-card` | Metric display |
| `StatCard` | `@/components/stat-card` | Data stat display |
| `InvoiceTable` | `@/components/invoice-table` | Invoice list table |
| `EmptyState` | `@/components/empty-state` | Empty state fallback |
| `ErrorState` | `@/components/error-state` | Error state fallback |
| `LoadingSkeleton` | `@/components/loading-skeleton` | Loading state skeleton |
| `cn` | `@/lib/utils` | Classname merge utility |
| `lucide-react` | dependency | Icons (already present) |

### New UI Dependencies to Install

Per Sprint 3 Plan, install:
```bash
npm install --save @radix-ui/react-progress @radix-ui/react-scroll-area
```

These will be used for `onboarding-wizard` (Progress) and `kanban-board` / `message-tracking` (ScrollArea).

---

## 2. Component Specifications

---

### 2.1 `onboarding-wizard.tsx`

**File:** `apps/frontend/src/components/onboarding-wizard.tsx`

**Description:** 3-step wizard for client onboarding. Steps: (1) Select preferred channel, (2) Select preferred time, (3) Set lead days before due date. After step 3, calls `onComplete` with the collected preferences.

#### Props Interface

```typescript
'use client';

interface OnboardingWizardProps {
  clientId: string;
  initialData?: {
    preferredChannel?: 'whatsapp' | 'email' | 'sms';
    preferredTime?: string;       // HH:mm format
    preferredLeadDays?: number;   // 1-15
  };
  onComplete: (data: {
    clientId: string;
    preferredChannel: 'whatsapp' | 'email' | 'sms';
    preferredTime: string;
    preferredLeadDays: number;
  }) => void;
  onClose?: () => void;
}
```

#### States

| State | Implementation |
|-------|---------------|
| **Loading** | `LoadingSkeleton variant="card"` shown initially if `initialData` is being fetched by parent |
| **Empty** | Not applicable (wizard always has content) |
| **Error** | `ErrorState` with message "Não foi possível carregar dados do cliente" + retry calls `onClose` |
| **Success** | Wizard steps rendered with current step highlighted |
| **Edge: Step transition** | Button "Avançar" disabled for 300ms after click to prevent double-submit |
| **Edge: Last step submit** | Button "Concluir" shows `Loader2` spinner icon while processing |

#### Visual Layout (Mobile-first)

```
┌──────────────────────────────────┐
│ [Progress: ● ● ○]  Etapa 1 de 3 │
│                                  │
│  Qual o canal preferido?          │
│                                  │
│  ○ WhatsApp    [icon: MessageCircle]│
│  ○ Email       [icon: Mail]      │
│  ○ SMS         [icon: MessageSquare]│
│                                  │
│         [Voltar]  [Avançar →]    │
└──────────────────────────────────┘
```

**Breakpoints:**
- **Mobile (< 640px):** Full-width, no sidebar, stacked radio cards
- **Tablet (640-1024px):** Centered max-w-lg, compact radio list
- **Desktop (> 1024px):** Modal overlay with backdrop (if triggered from card), or inline section

**Steps detail:**
1. **Step 1 (Channel):** 3 radio cards with icon, label, description. Pre-select from `initialData.preferredChannel` or default "whatsapp".
2. **Step 2 (Time):** Time picker input (`input type="time"` in Brazilian locale HH:mm). Show current preference or default "18:00". Include helper text: "Horário que o cliente prefere receber mensagens."
3. **Step 3 (Lead Days):** Number input with +/- buttons, range 1-15. Show current preference or default 5. Helper text: "Quantos dias antes do vencimento iniciar a cobrança?"

#### Accessibility

- Each step is a `<fieldset>` with `<legend>` for the step question
- Radio buttons use `aria-describedby` for helper descriptions
- Progress indicator uses `aria-label="Passo X de Y"` and `role="progressbar"`
- Focus is moved to step heading on transition (`tabindex="-1"` on step title)
- Keyboard: Enter/Space to select option, Ctrl+Enter to advance
- WCAG 2.1 AA: All interactive elements meet 3:1 contrast ratio

#### Dependencies

- `@/components/ui/button` (Button)
- `@/components/ui/card` (Card, CardContent)
- `@/components/loading-skeleton` (LoadingSkeleton)
- `@/components/error-state` (ErrorState)
- `@radix-ui/react-progress` (Progress bar indicator)
- `lucide-react` (MessageCircle, Mail, MessageSquare, Check, ChevronRight, ChevronLeft, Loader2)

---

### 2.2 `collection-timeline.tsx`

**File:** `apps/frontend/src/components/collection-timeline.tsx`

**Description:** Visual vertical timeline showing the history of reminder messages sent to a client for a specific invoice. Each event is a timeline node with icon, status, timestamp, and message preview.

#### Props Interface

```typescript
'use client';

interface TimelineEvent {
  id: string;
  event: 'queued' | 'sent' | 'delivered' | 'read' | 'clicked' | 'failed';
  channel: 'whatsapp' | 'email' | 'sms';
  timestamp: string;       // ISO 8601
  templateName?: string;
  content?: string;        // message preview
  errorMessage?: string;   // present only if event === 'failed'
}

interface CollectionTimelineProps {
  clientId: string;
  invoiceId: string;
  events: TimelineEvent[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}
```

#### States

| State | Implementation |
|-------|---------------|
| **Loading** | 4 skeleton timeline nodes (gray circles + shimmer lines) |
| **Empty** | `EmptyState` with icon `MessageSquare` and title "Nenhum lembrete enviado" + description "Ainda não foram enviados lembretes para esta fatura." |
| **Error** | `ErrorState` with message from `error` prop + retry calls `onRetry` |
| **Success** | Vertical timeline with all events rendered in chronological order |
| **Edge: Pending delivery** | Last node shows pulsing dot with label "Aguardando entrega..." |

#### Visual Layout (Mobile-first)

```
┌──────────────────────────────────────┐
│  Histórico de Cobrança               │
│                                      │
│  ● ─── 25 Jul, 19:00                 │
│  │  Enviado · WhatsApp               │
│  │  Template: friendly_reminder_d3   │
│  │  "Olá {{name}}, sua fatura..."    │
│  │                                   │
│  ├ ─── 25 Jul, 19:01                 │
│  │  Entregue · WhatsApp              │
│  │                                   │
│  ├ ─── 25 Jul, 19:30                 │
│  │  Lida · WhatsApp                  │
│  │                                   │
│  ○ ─── Aguardando clique...          │
│     [pending - pulsing dot]          │
│                                      │
│  Se houver falha:                    │
│  ✕ ─── 25 Jul, 19:00                 │
│     Falha · WhatsApp                 │
│     Erro: Número inválido            │
└──────────────────────────────────────┘
```

**Breakpoints:**
- **Mobile (< 640px):** Compact timeline with smaller dots, reduced font sizes, single column
- **Tablet/Desktop (> 640px):** Full detail with icon badges, 2-line event descriptions

**Timeline node visual states:**

| Event | Dot | Label | Background |
|-------|-----|-------|------------|
| `queued` | Gray circle `bg-gray-400` | "Na fila" | `bg-gray-50` |
| `sent` | Blue circle `bg-info-500` | "Enviado" | `bg-info-50` |
| `delivered` | Green circle `bg-success-500` | "Entregue" | `bg-success-50` |
| `read` | Green circle with check `bg-success-500` | "Lida" | `bg-success-50` |
| `clicked` | Primary circle `bg-primary-500` | "Clicou" | `bg-primary-50` |
| `failed` | Red circle with X `bg-danger-500` | "Falhou" | `bg-danger-50` |

#### Accessibility

- Timeline is an `<ol>` with `role="list"` and `aria-label="Linha do tempo de cobrança"`
- Each node is an `<li>` with `role="listitem"`
- Color is never the sole indicator of status — each dot has an adjacent text label
- Failed nodes include `role="alert"` with the error message in `aria-label`
- Timeline connector lines are decorative `aria-hidden="true"`

#### Dependencies

- `@/components/ui/card` (Card, CardHeader, CardTitle, CardContent)
- `@/components/empty-state` (EmptyState)
- `@/components/error-state` (ErrorState)
- `@/components/loading-skeleton` (LoadingSkeleton — custom timeline skeleton pattern, not existing variant)
- `lucide-react` (Check, X, Clock, MessageSquare, Phone, Mail, AlertCircle)

---

### 2.3 `kanban-board.tsx`

**File:** `apps/frontend/src/components/kanban-board.tsx`

**Description:** Kanban board with 3 columns: Pending, Overdue, Paid. Drag-and-drop (or click-to-move) for changing invoice status. Mobile: collapses to an accordion or stacked list.

#### Props Interface

```typescript
'use client';

interface KanbanInvoice {
  id: string;
  clientName: string;
  amount: number;
  dueDate: string;          // ISO 8601
  status: 'pending' | 'paid' | 'overdue';
  riskScore?: 'green' | 'yellow' | 'red';
  paymentMethod?: 'pix' | 'boleto' | 'credit_card';
}

interface KanbanBoardProps {
  invoices: KanbanInvoice[];
  columns?: {
    pending: string;    // column label, default "Pendentes"
    overdue: string;    // column label, default "Vencidas"
    paid: string;       // column label, default "Pagas"
  };
  onStatusChange: (invoiceId: string, newStatus: 'pending' | 'paid' | 'overdue') => void;
  onInvoiceClick?: (invoiceId: string) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}
```

#### States

| State | Implementation |
|-------|---------------|
| **Loading** | 3 column skeletons with card skeleton placeholders (4 per column) |
| **Empty** | Each column individually shows "Nenhuma fatura" if its array is empty, using compact inline empty state |
| **Error** | `ErrorState` with message from `error` prop + retry calls `onRetry` |
| **Success** | 3-column kanban with draggable cards in each column |
| **Edge: All empty** | `EmptyState` with title "Nenhuma fatura encontrada" across all columns |
| **Edge: Drag feedback** | Card opacity 0.5 while dragging, column highlight on drag over |

#### Visual Layout (Mobile-first)

**Desktop (> 1024px):**
```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Pendentes   │ │  Vencidas    │ │  Pagas       │
│  (3)         │ │  (2)         │ │  (5)         │
├──────────────┤ ├──────────────┤ ├──────────────┤
│ ┌──────────┐ │ │ ┌──────────┐ │ │ ┌──────────┐ │
│ │Ana Souza │ │ │ │Carlos   │ │ │ │Pedro    │ │
│ │R$ 150,00 │ │ │ │R$ 89,90 │ │ │ │R$ 200   │ │
│ │Vence:    │ │ │ │Vence:   │ │ │ │Pago:    │ │
│ │02/08     │ │ │ │15/07    │ │ │ │25/07    │ │
│ │[Baixo ▲] │ │ │ │[Alto ▼] │ │ │ │         │ │
│ └──────────┘ │ │ └──────────┘ │ │ └──────────┘ │
│ ┌──────────┐ │ │ ┌──────────┐ │ │ ┌──────────┐ │
│ │ ...      │ │ │ │ ...      │ │ │ │ ...      │ │
│ └──────────┘ │ │ └──────────┘ │ │ └──────────┘ │
└──────────────┘ └──────────────┘ └──────────────┘
```

**Mobile (< 640px):**
- Single column, toggleable sections via `details/summary` or Accordion
- Each section labeled "Pendentes (3)", "Vencidas (2)", "Pagas (5)"
- Cards stacked vertically with same content

**Card component (inline, not separate file):**
- `bg-white rounded-lg border border-gray-100 p-3 shadow-sm`
- Client name (bold), amount (tabular-nums), due date
- RiskBadge inline if riskScore provided
- Click handler via `onInvoiceClick`
- Drag handle (6 dots icon) on top-left

#### Accessibility

- Columns use `role="region"` with `aria-label="{Column Name} - {Count} faturas"`
- Cards use `role="button"` with `tabindex="0"` and keyboard activation
- Drag-and-drop is not the only interaction mode: click-to-select then choose target column via dropdown also supported
- Focus indicator on drag handles (3:1 contrast ring)
- Live region (`aria-live="polite"`) announces "Fatura movida para {column}" on status change
- WCAG 2.1 AA: All status colors have text labels alongside

#### Dependencies

- `@/components/ui/card` (Card, CardContent)
- `@/components/risk-badge` (RiskBadge)
- `@/components/empty-state` (EmptyState)
- `@/components/error-state` (ErrorState)
- `@/components/loading-skeleton` (LoadingSkeleton — custom kanban skeleton needed)
- `@/components/ui/badge` (Badge for column counts)
- `@radix-ui/react-scroll-area` (horizontal scroll on desktop if columns overflow)
- `lucide-react` (GripVertical, ChevronDown, ChevronRight, ArrowRight)

**Note:** For MVP, skip HTML5 drag-and-drop API complexity. Use click-to-select → dropdown for target column. Drag-and-drop can be added post-MVP with `@dnd-kit/core`.

---

### 2.4 `report-chart.tsx`

**File:** `apps/frontend/src/components/report-chart.tsx`

**Description:** Reusable chart wrapper that renders bar, line, or pie charts using a lightweight SVG-based approach (no heavy charting library). Includes date range filter controls and responsive sizing.

#### Props Interface

```typescript
'use client';

type ChartType = 'bar' | 'line' | 'pie';

interface ChartSeries {
  name: string;
  data: number[];
  color?: string;              // tailwind color class, defaults to primary-500
}

interface ChartDataPoint {
  label: string;               // x-axis label or slice label
  value: number;
  color?: string;
}

interface ReportChartProps {
  type: ChartType;
  title: string;
  data: ChartDataPoint[];
  series?: ChartSeries[];      // for multi-series bar/line
  dateRange?: {
    start: string;             // ISO 8601
    end: string;               // ISO 8601
  };
  onDateRangeChange?: (range: { start: string; end: string }) => void;
  height?: number;             // px, default 300
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyMessage?: string;       // default "Nenhum dado disponível para o período"
}
```

#### States

| State | Implementation |
|-------|---------------|
| **Loading** | `LoadingSkeleton variant="card"` with chart-shaped skeleton (bars of varying height) |
| **Empty** | `EmptyState` with icon `BarChart3` and title from `emptyMessage` prop |
| **Error** | `ErrorState` with message from `error` prop + retry calls `onRetry` |
| **Success** | SVG chart rendered inline |
| **Edge: Single data point** | Bar/line shows single bar/dot with label |
| **Edge: Large dataset (>20 points)** | Responsive: x-axis labels rotate 45deg or every-nth label shown |

#### Visual Layout (Mobile-first)

```
┌──────────────────────────────────┐
│  Fluxo de Caixa Previsto         │
│                                  │
│  [07/2026] ──▶ [09/2026]         │  ← date range picker
│                                  │
│  R$ 85k ┤█                        │
│  R$ 80k ┤██                       │
│  R$ 75k ┤███                      │
│  R$ 70k ┤████    ██               │
│  R$ 65k ┤████    ████             │
│  R$ 60k ┤██████  ████   ██        │
│          └───┬────┬────┬────      │
│             Ago  Set  Out         │
│                                  │
│  █ Receita  █ Default  █ Recup.  │  ← legend
└──────────────────────────────────┘
```

**Chart rendering approach (MVP — no external chart library):**
- Custom SVG component using simple `<rect>`, `<path>`, `<circle>`, `<text>` elements
- Bar chart: `<rect>` elements with calculated widths/heights
- Line chart: `<polyline>` or `<path>` with smoothed curves
- Pie chart: `<path>` with arc calculations (simple donut/segment)
- Responsive: uses `viewBox` and `preserveAspectRatio="xMidYMid meet"`
- Tooltip on hover: absolutely positioned div showing exact value

**Date range picker:** Two date inputs (`input type="month"`) for start/end.

#### Accessibility

- SVG has `role="img"` and `aria-label` describing the chart
- Data is also available as a hidden `<table>` with the same data (for screen readers)
- Chart is not the only representation — `aria-hidden="true"` on SVG, table is the accessible source
- Color legend includes text labels (not just colored squares)
- All interactive elements have visible focus indicators
- WCAG 2.1 AA: Minimum 3:1 contrast for chart elements against background

#### Dependencies

- `@/components/ui/card` (Card, CardHeader, CardTitle, CardContent)
- `@/components/empty-state` (EmptyState)
- `@/components/error-state` (ErrorState)
- `@/components/loading-skeleton` (LoadingSkeleton variant="card")
- `@/components/ui/button` (Button for filter apply)
- `lucide-react` (BarChart3, TrendingUp, PieChart, Calendar)

**Note on charting library decision:**  
For MVP, use **custom SVG** to avoid bundle size. If complex charts are needed later, migrate to `recharts` (already compatible with React/Next.js). The interface is designed to be swappable — `api` remains the same, only render implementation changes.

---

### 2.5 `pix-payment-flow.tsx`

**File:** `apps/frontend/src/components/pix-payment-flow.tsx`

**Description:** Full PIX payment flow. Displays QR code (base64 image), copy-and-paste key ("copia e cola"), countdown timer to QR code expiry, and polling status indicator that checks payment confirmation.

#### Props Interface

```typescript
'use client';

interface PixData {
  qrCodeBase64: string;          // base64 PNG image
  copyPasteKey: string;          // "copia e cola" key
  expiresAt: string;             // ISO 8601
  amount: number;
  invoiceId: string;
}

type PaymentPollStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'expired';

interface PixPaymentFlowProps {
  invoiceId: string;
  pixData: PixData;
  pollStatus?: PaymentPollStatus;
  onPaid: () => void;                          // called when poll confirms payment
  onExpired?: () => void;                      // called when QR code expires
  onError?: (error: string) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  error?: string | null;
}
```

#### States

| State | Implementation |
|-------|---------------|
| **Loading** | `LoadingSkeleton variant="card"` with QR-shaped skeleton (256x256 square) |
| **Empty** | Not applicable (pixData is always provided) |
| **Error** | `ErrorState` with message from `error` prop. If `onCancel` provided, show "Voltar" button |
| **Success: Pending** | QR code displayed, copy-paste key, countdown running, status "Aguardando pagamento..." (pulsing) |
| **Success: Processing** | QR code faded (opacity 50%), spinner overlay, status "Processando pagamento..." |
| **Success: Paid** | QR code replaced with green check animation, status "Pagamento confirmado!" with confetti-like check |
| **Edge: Expired** | QR code replaced with "Expirado" overlay button "Gerar novo QR Code" calls `onExpired` |
| **Edge: Copy success** | Button text changes to "Copiado!" for 2 seconds via timer |
| **Edge: Poll timeout** | After N seconds without confirmation, status shows "Aguardando ainda..." with option to check manually |

#### Visual Layout (Mobile-first)

```
┌──────────────────────────────────┐
│  Pagamento PIX                   │
│                                  │
│  Valor: R$ 150,00                │
│                                  │
│  ┌──────────────────────┐        │
│  │                      │        │
│  │    [QR Code IMG]     │        │
│  │    (256x256)         │        │
│  │                      │        │
│  └──────────────────────┘        │
│                                  │
│  [Copiar código PIX]   [📋]     │  ← copy button
│                                  │
│  ⏱ Expira em 04:32              │  ← countdown timer
│                                  │
│  Status: ● Aguardando...         │  ← polling status
│                                  │
│  [Cancelar]                      │
└──────────────────────────────────┘
```

**Paid state:**
```
┌──────────────────────────────────┐
│  ✅ Pagamento Confirmado!        │
│                                  │
│  ┌──────────────────────┐        │
│  │     ✅ (large)       │        │
│  │  R$ 150,00           │        │
│  │  Pago em 25/07 às    │        │
│  │  19:32               │        │
│  └──────────────────────┘        │
│                                  │
│  [Voltar para faturas]           │
└──────────────────────────────────┘
```

**Expired state:**
```
┌──────────────────────────────────┐
│  ⚠️ QR Code Expirado             │
│                                  │
│  O código PIX expirou em         │
│  25/07 às 19:35                  │
│                                  │
│  [Gerar novo QR Code]            │
│  [Cancelar pagamento]            │
└──────────────────────────────────┘
```

#### Accessibility

- QR code image has `alt="QR Code para pagamento PIX"`
- Copy button announces "Copiado" via `aria-live="polite"` region
- Countdown timer uses `aria-live="polite"` to announce every 30s ("Faltam 4 minutos")
- Status changes are announced via `role="status"` with `aria-live="polite"`
- Copy-paste key is a `<code>` element with `aria-label="Chave PIX para copiar"`
- Payment confirmed state uses `role="alert"` with `aria-live="assertive"`

#### Dependencies

- `@/components/ui/card` (Card, CardContent)
- `@/components/ui/button` (Button variants: primary, outline, ghost)
- `@/components/loading-skeleton` (LoadingSkeleton variant="card")
- `@/components/error-state` (ErrorState)
- `@/components/payment-status` (PaymentStatus — reuse for status display)
- `lucide-react` (Copy, Check, X, Clock, AlertCircle, Loader2, QrCode)

**Timer implementation note:** Use `useEffect` with `setInterval` (1s tick). Store remaining seconds in state. Format as `MM:SS`. Clean up interval on unmount.

---

### 2.6 `client-detail-card.tsx`

**File:** `apps/frontend/src/components/client-detail-card.tsx`

**Description:** Extended client detail card showing full profile information, risk score breakdown with visual meter, payment statistics, and contact info. Used on client detail page.

#### Props Interface

```typescript
'use client';

interface RiskFeature {
  name: string;
  label: string;           // Portuguese display name
  value: number;
  impact: number;          // -1 to 1, negative = reduces risk
}

interface ClientDetail {
  id: string;
  name: string;
  phone: string;
  email?: string;
  preferredChannel: 'whatsapp' | 'email' | 'sms';
  preferredTime: string;         // HH:mm
  preferredLeadDays: number;
  onboardingCompleted: boolean;
  riskScore: 'green' | 'yellow' | 'red';
  riskProbability?: number;      // 0-1
  riskFeatures?: RiskFeature[];
  paymentStats?: {
    totalInvoices: number;
    paidInvoices: number;
    overdueInvoices: number;
    avgPaymentDelay: number;     // days
    totalPaid: number;
  };
  createdAt: string;             // ISO 8601
}

interface ClientDetailCardProps {
  client: ClientDetail;
  onEdit?: () => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}
```

#### States

| State | Implementation |
|-------|---------------|
| **Loading** | Card skeleton with 6 skeleton lines + circular skeleton for avatar |
| **Empty** | Not applicable (client data always expected) |
| **Error** | `ErrorState` with message from `error` prop + retry calls `onRetry` |
| **Success** | Full detail card with all sections |
| **Edge: Missing email** | Section shows "Não cadastrado" in gray italic |
| **Edge: No risk features** | Risk breakdown shows "Dados insuficientes para análise de risco" |

#### Visual Layout (Mobile-first)

```
┌──────────────────────────────────┐
│  [Edit icon]                     │
│                                  │
│  [Avatar circle]  Maria Silva    │
│  (initials)       since Jul 2026 │
│                                  │
│  ─── Contato ───                  │
│  📞 (11) 99999-8888              │
│  ✉️ maria@email.com              │
│                                  │
│  ─── Preferências ───             │
│  Canal: WhatsApp                 │
│  Horário: 19:00                  │
│  Lead: 5 dias                    │
│  Onboarding: ✅ Completo         │
│                                  │
│  ─── Risco ───                    │
│  [████████░░░░] 45%              │  ← risk meter bar
│  Baixo Risco                     │
│                                  │
│  Fatores:                        │
│  • Atraso médio: 3 dias ▲ +0.32 │
│  • Abertura msgs: 85% ▼ -0.15   │
│  • Pagamentos: 12/15 ✅ -0.10   │
│                                  │
│  ─── Pagamentos ───               │
│  Total: R$ 4.500,00              │
│  Pagas: 12 | Vencidas: 3        │
│  Atraso médio: 3 dias           │
└──────────────────────────────────┘
```

**Breakpoints:**
- **Mobile (< 640px):** Single column, sections stacked vertically
- **Desktop (> 1024px):** 2-column grid: left column (profile + contact + preferences), right column (risk breakdown + payment stats)

#### Accessibility

- Sections use `<section>` with `aria-labelledby` referencing section headings
- Risk meter uses `role="meter"` with `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="1"`
- Risk features list uses `role="list"` with positive/negative impact clearly labeled
- Contact info uses `<a href="tel:...">` for phone, `<a href="mailto:...">` for email
- Edit button has `aria-label="Editar cliente"`

#### Dependencies

- `@/components/ui/card` (Card, CardHeader, CardTitle, CardContent)
- `@/components/risk-badge` (RiskBadge for risk label)
- `@/components/status-badge` (StatusBadge for onboarding status)
- `@/components/loading-skeleton` (LoadingSkeleton — custom detail skeleton)
- `@/components/error-state` (ErrorState)
- `@/components/ui/badge` (Badge for tags)
- `lucide-react` (User, Phone, Mail, MessageCircle, Clock, Calendar, TrendingUp, TrendingDown, AlertTriangle, Edit3)

---

### 2.7 `invoice-form.tsx`

**File:** `apps/frontend/src/components/invoice-form.tsx`

**Description:** Create/edit invoice form with client search/select, amount input, due date picker, payment method selector, and description field. Supports both create and edit modes.

#### Props Interface

```typescript
'use client';

interface InvoiceFormClient {
  id: string;
  name: string;
  phone: string;
  riskScore: 'green' | 'yellow' | 'red';
}

interface InvoiceFormData {
  clientId: string;
  amount: number;
  dueDate: string;            // ISO 8601 date string or YYYY-MM-DD
  paymentMethod: 'pix' | 'boleto' | 'credit_card';
  description?: string;
}

interface InvoiceFormProps {
  clients: InvoiceFormClient[];
  initialData?: Partial<InvoiceFormData>;  // for edit mode
  onSubmit: (data: InvoiceFormData) => Promise<void> | void;
  onCancel?: () => void;
  isLoading?: boolean;
  error?: string | null;
  fieldErrors?: Partial<Record<keyof InvoiceFormData, string>>;
  submitLabel?: string;                     // default "Criar Fatura"
  isSubmitting?: boolean;
}
```

#### States

| State | Implementation |
|-------|---------------|
| **Loading** | `LoadingSkeleton variant="card"` with 5 form field skeletons |
| **Error** | `ErrorState` if `error` is set + form is not shown |
| **Field Errors** | Each field with error shows `danger-500` border + error message below in `text-danger-600 text-xs` |
| **Success** | Form rendered with all fields, submit button enabled |
| **Edge: Submitting** | Submit button shows `Loader2` spinner + `disabled`, all inputs disabled |
| **Edge: Client search** | Typeahead search with filtered dropdown, minimum 2 chars to search |
| **Edge: Amount format** | Input accepts only digits + comma, formats as BRL on blur (R$ 1.500,00) |
| **Edge: Due date min** | Date picker minimum = today (cannot create invoice in the past) |

#### Visual Layout (Mobile-first)

```
┌──────────────────────────────────┐
│  Nova Fatura                     │
│                                  │
│  Cliente *                       │
│  ┌──────────────────────────┐   │
│  │ 🔍 Buscar cliente...     │   │  ← search/select
│  └──────────────────────────┘   │
│  [Maria Silva] [Ana Souza]      │   ← selected chips
│                                  │
│  Valor *                        │
│  ┌──────────────────────────┐   │
│  │ R$ 1.500,00              │   │
│  └──────────────────────────┘   │
│                                  │
│  Data de Vencimento *            │
│  ┌──────────────────────────┐   │
│  │ 15/08/2026          📅   │   │
│  └──────────────────────────┘   │
│                                  │
│  Método de Pagamento *           │
│  ○ PIX    ○ Boleto  ○ Cartão   │  ← radio group
│                                  │
│  Descrição (opcional)            │
│  ┌──────────────────────────┐   │
│  │ Mensalidade Agosto/2026  │   │
│  └──────────────────────────┘   │
│                                  │
│  [Voltar]          [Criar Fatura]│
└──────────────────────────────────┘
```

**Client selector behavior:**
1. Text input with a dropdown of matching clients (filtered by name or phone)
2. Selected client shown as a chip/tag above the input (with remove button)
3. RiskBadge shown next to each client name in the dropdown
4. Accessible: `role="combobox"` with `aria-expanded`, `aria-activedescendant`

#### Accessibility

- All inputs have associated `<label>` elements (not placeholders as labels)
- Required fields marked with `aria-required="true"` and visual asterisk
- Error messages use `aria-describedby` on the input pointing to the error span with `role="alert"`
- Client combobox follows ARIA Combobox pattern
- Form has `novalidate` to prevent browser validation UI, all validation is custom
- Submit announcement: screen reader notified via `aria-live="polite"` on status change
- WCAG 2.1 AA: Error messages are not just color-dependent — include icon + text

#### Dependencies

- `@/components/ui/card` (Card, CardHeader, CardTitle, CardContent)
- `@/components/ui/button` (Button variants: primary, outline)
- `@/components/risk-badge` (RiskBadge on client select)
- `@/components/loading-skeleton` (LoadingSkeleton variant="card")
- `@/components/error-state` (ErrorState)
- `lucide-react` (Search, X, Loader2, Calendar, DollarSign, CreditCard, FileText)

**Note:** `@/components/ui/input` and `@/components/ui/label` don't exist yet — they are simple wrappers needed. Create inline or extend the `ui/` library with:

```typescript
// src/components/ui/input.tsx — basic input with cn() styling
// src/components/ui/label.tsx — basic label with cn() styling
// src/components/ui/textarea.tsx — basic textarea with cn() styling
```

These are thin wrappers following the same pattern as `button.tsx` and `badge.tsx`.

---

### 2.8 `payment-history.tsx`

**File:** `apps/frontend/src/components/payment-history.tsx`

**Description:** Paginated payment history table with status badges, formatted amounts, and payment method icons. Supports filtering by status and date range.

#### Props Interface

```typescript
'use client';

interface PaymentRecord {
  id: string;
  invoiceId: string;
  clientName: string;
  amount: number;
  method: 'pix' | 'boleto' | 'credit_card';
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  paidAt?: string;            // ISO 8601
  dueDate: string;            // ISO 8601
  provider: string;
}

interface PaymentHistoryProps {
  payments: PaymentRecord[];
  total: number;               // total count for pagination
  page: number;
  perPage: number;
  onPageChange: (page: number) => void;
  onPaymentClick?: (paymentId: string) => void;
  filterStatus?: string;       // current status filter
  onFilterChange?: (status: string | null) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}
```

#### States

| State | Implementation |
|-------|---------------|
| **Loading** | `LoadingSkeleton variant="table"` with 8 rows |
| **Empty** | `EmptyState` with icon `Receipt` and title "Nenhum pagamento encontrado" + action button "Criar nova fatura" if filter not applied |
| **Empty (filtered)** | `EmptyState` with title "Nenhum resultado para este filtro" + "Limpar filtros" action |
| **Error** | `ErrorState` with message from `error` prop + retry calls `onRetry` |
| **Success** | Table with data + pagination controls |
| **Edge: 1 page only** | Pagination hidden |
| **Edge: Status filter active** | Filter badge shown next to filter label with "Limpar" button |

#### Visual Layout (Mobile-first)

**Desktop (> 768px):**
```
┌──────────────────────────────────────────────────────────┐
│  Histórico de Pagamentos    [Filtro: ▼] [Período: ▼]    │
├──────────────────────────────────────────────────────────┤
│ Cliente    │ Valor   │ Método │ Status    │ Data Pag.   │
├────────────┼─────────┼────────┼───────────┼─────────────┤
│ Ana Souza  │R$150,00│  PIX   │ ✅ Pago   │ 25/07/2026  │
│ Carlos M.  │R$89,90 │  Boleto│ 📄 Pend.  │ -           │
│ Pedro A.   │R$200,00│  Cartão│ ❌ Falhou │ -           │
│ ...        │ ...    │  ...   │ ...       │ ...         │
├────────────┴─────────┴────────┴───────────┴─────────────┤
│                                                 1 2 3 … ▶│
└──────────────────────────────────────────────────────────┘
```

**Mobile (< 640px):**
- Card-based layout instead of table
- Each payment is a compact card (similar to `ClientCard` pattern)
- Horizontal scroll on table is undesirable on mobile — use cards

**Method icons:**
| Method | Icon | Label |
|--------|------|-------|
| `pix` | `QrCode` | PIX |
| `boleto` | `FileText` | Boleto |
| `credit_card` | `CreditCard` | Cartão |

#### Accessibility

- Table has `role="table"` (inherited), `aria-label="Histórico de pagamentos"`
- Sortable headers use `role="columnheader"` with `aria-sort` when active
- Pagination uses `<nav>` with `aria-label="Paginação"`
- Page buttons have `aria-label="Página X"`
- Status badges include text labels (not just icons)
- Payment method is communicated via icon + text label together

#### Dependencies

- `@/components/ui/table` (Table, TableHeader, TableBody, TableRow, TableCell)
- `@/components/ui/badge` (Badge)
- `@/components/ui/button` (Button for pagination)
- `@/components/status-badge` (StatusBadge)
- `@/components/empty-state` (EmptyState)
- `@/components/error-state` (ErrorState)
- `@/components/loading-skeleton` (LoadingSkeleton variant="table")
- `lucide-react` (ChevronLeft, ChevronRight, QrCode, FileText, CreditCard, Receipt, Filter, X)

---

### 2.9 `message-tracking.tsx`

**File:** `apps/frontend/src/components/message-tracking.tsx`

**Description:** Detailed message delivery tracking timeline for a single message. Shows the full lifecycle: queued → sent → delivered → read → clicked (where applicable). Each event shows timestamp and channel metadata.

#### Props Interface

```typescript
'use client';

interface MessageTrackingEvent {
  event: 'queued' | 'sent' | 'delivered' | 'read' | 'clicked' | 'failed';
  timestamp: string;           // ISO 8601
  metadata?: Record<string, unknown>;
}

interface MessageDetails {
  id: string;
  clientId: string;
  clientName: string;
  channel: 'whatsapp' | 'email' | 'sms';
  templateName: string;
  content?: string;            // message preview
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'clicked' | 'failed';
  events: MessageTrackingEvent[];
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  clickedAt?: string;
  failedAt?: string;
  errorMessage?: string;
}

interface MessageTrackingProps {
  messageId: string;
  data: MessageDetails;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}
```

#### States

| State | Implementation |
|-------|---------------|
| **Loading** | Skeleton with header + 5 timeline node placeholders |
| **Empty** | Not applicable (data always expected for a message) |
| **Error** | `ErrorState` with message from `error` prop + retry calls `onRetry` |
| **Success** | Header with message summary + vertical timeline of all events |
| **Edge: Failed message** | Timeline stops at "failed" node, error message shown in red alert box |
| **Edge: In-flight message** | Last node is pulsing "Em andamento..." |

#### Visual Layout (Mobile-first)

```
┌──────────────────────────────────┐
│  Rastreamento de Mensagem        │
│                                  │
│  Para: Maria Silva               │
│  Canal: WhatsApp                 │
│  Template: friendly_reminder_d3  │
│  Status: ● Entregue              │
│                                  │
│  ─── Linha do Tempo ───          │
│                                  │
│  📋 25 Jul, 18:59                │
│     Na fila para envio           │
│                                  │
│  📤 25 Jul, 19:00                │
│     Enviada                      │
│     ID: prov_abc123              │
│                                  │
│  📥 25 Jul, 19:01                │
│     Entregue                     │
│                                  │
│  👁 25 Jul, 19:30                │
│     Lida                         │
│                                  │
│  👆 [Aguardando clique...]       │
│     (pulsing)                    │
│                                  │
│  Conteúdo da Mensagem:           │
│  ┌──────────────────────┐       │
│  │ Olá Maria, sua fatura │       │
│  │ de R$ 150,00 vence em │       │
│  │ 3 dias...             │       │
│  └──────────────────────┘       │
└──────────────────────────────────┘
```

**Timeline node events:**
| Event | Icon | Color | Description |
|-------|------|-------|-------------|
| `queued` | `Clock` | `text-gray-400` | "Na fila para envio" |
| `sent` | `Send` | `text-info-500` | "Enviada" |
| `delivered` | `Download` | `text-success-500` | "Entregue" |
| `read` | `Eye` | `text-success-600` | "Lida" |
| `clicked` | `MousePointerClick` | `text-primary-500` | "Clicou no link" |
| `failed` | `AlertCircle` | `text-danger-500` | "Falha no envio" |

#### Accessibility

- Timeline is `<ol>` with `role="list"` and `aria-label="Linha do tempo da mensagem"`
- Each event is an `<li>` with `role="listitem"`
- Icons have `aria-hidden="true"` — adjacent text provides meaning
- Status is communicated via `role="status"` at the top of the component
- Message preview is in a `<blockquote>` or `<pre>` with appropriate styling

#### Dependencies

- `@/components/ui/card` (Card, CardHeader, CardTitle, CardContent)
- `@/components/status-badge` (StatusBadge)
- `@/components/loading-skeleton` (LoadingSkeleton variant="card" + custom timeline nodes)
- `@/components/error-state` (ErrorState)
- `lucide-react` (Clock, Send, Download, Eye, MousePointerClick, AlertCircle, Check, X, ChevronRight)

---

### 2.10 `exception-panel.tsx`

**File:** `apps/frontend/src/components/exception-panel.tsx`

**Description:** Panel showing reconciliation exceptions and flagged items. Each exception shows the issue type, affected invoice/client, error details, and a manual retry action.

#### Props Interface

```typescript
'use client';

type ExceptionSeverity = 'critical' | 'high' | 'medium' | 'low';
type ExceptionStatus = 'open' | 'in_progress' | 'resolved' | 'ignored';

interface ExceptionItem {
  id: string;
  type: 'payment_mismatch' | 'webhook_failed' | 'message_failed' | 'duplicate_invoice' | 'provider_error' | 'reconciliation_gap';
  severity: ExceptionSeverity;
  status: ExceptionStatus;
  title: string;                  // human-readable summary
  description: string;            // detailed description
  invoiceId?: string;
  clientName?: string;
  amount?: number;
  errorMessage?: string;
  occurredAt: string;             // ISO 8601
  updatedAt: string;
  retryCount?: number;
  maxRetries?: number;
}

interface ExceptionPanelProps {
  exceptions: ExceptionItem[];
  onRetry: (exceptionId: string) => void;
  onResolve?: (exceptionId: string) => void;
  onIgnore?: (exceptionId: string) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetryFetch?: () => void;
}
```

#### States

| State | Implementation |
|-------|---------------|
| **Loading** | `LoadingSkeleton variant="card"` with 4 stacked exception card skeletons |
| **Empty** | `EmptyState` with icon `CheckCircle` and title "Nenhuma exceção encontrada" + "Todas as reconciliações estão em dia." |
| **Error** | `ErrorState` with message from `error` prop + retry calls `onRetryFetch` |
| **Success** | Stacked exception cards, each collapsible, with action buttons |
| **Edge: Many exceptions (>10)** | ScrollArea wrapper with max-height 600px |
| **Edge: Retryable exception** | "Tentar novamente" button enabled; shows count "Tentativa 2/3" |
| **Edge: Max retries reached** | Button disabled with label "Retries esgotados" |

#### Visual Layout (Mobile-first)

```
┌──────────────────────────────────┐
│  Exceções e Reconciliação   [3]  │
│                                  │
│  ┌──────────────────────────┐   │
│  │ 🔴 Crítico               │   │
│  │ Divergência de Valor     │   │
│  │ Fatura #1234 - Ana Souza │   │
│  │ Esperado: R$ 150,00      │   │
│  │ Recebido: R$ 145,00      │   │
│  │ 25/07/2026 19:32         │   │
│  │                          │   │
│  │ [Detalhes] [Resolver] [Ignorar]│
│  └──────────────────────────┘   │
│                                  │
│  ┌──────────────────────────┐   │
│  │ 🟡 Médio                 │   │
│  │ Webhook não processado   │   │
│  │ Fatura #5678 - Carlos M. │   │
│  │ Provedor: Asaas          │   │
│  │ Tentativa 2/3            │   │
│  │                          │   │
│  │ [Tentar novamente] [Ignorar]  │
│  └──────────────────────────┘   │
│                                  │
│  [Marcar todas como resolvidas] │
└──────────────────────────────────┘
```

**Severity colors:**
| Severity | Dot | Background |
|----------|-----|------------|
| `critical` | `bg-danger-500` | `border-l-4 border-l-danger-500` |
| `high` | `bg-warning-500` | `border-l-4 border-l-warning-500` |
| `medium` | `bg-info-500` | `border-l-4 border-l-info-500` |
| `low` | `bg-gray-400` | `border-l-4 border-l-gray-400` |

**Status badges:**
| Status | Badge Variant | Label |
|--------|--------------|-------|
| `open` | `danger` | "Aberto" |
| `in_progress` | `warning` | "Em andamento" |
| `resolved` | `success` | "Resolvido" |
| `ignored` | `default` | "Ignorado" |

#### Accessibility

- Each exception card is a `<section>` with `aria-labelledby` referencing its title
- Severity is communicated via text + color (not color alone)
- Action buttons have `aria-label` describing the action, e.g., "Tentar novamente exceção #1234"
- "Mark all resolved" button requires confirmation dialog or has `aria-describedby` explaining action
- Collapsible cards use `aria-expanded` on the toggle button
- Exception count in header uses `aria-label="3 exceções pendentes"`

#### Dependencies

- `@/components/ui/card` (Card, CardContent, CardHeader, CardTitle)
- `@/components/ui/badge` (Badge for severity and status)
- `@/components/ui/button` (Button variants: primary, outline, ghost, danger)
- `@/components/empty-state` (EmptyState)
- `@/components/error-state` (ErrorState)
- `@/components/loading-skeleton` (LoadingSkeleton variant="card")
- `@radix-ui/react-scroll-area` (ScrollArea for scrollable list)
- `lucide-react` (AlertTriangle, CheckCircle, XCircle, RefreshCw, ChevronDown, ChevronRight, Filter, Eye, EyeOff)

---

### 2.11 `notification-banner.tsx`

**File:** `apps/frontend/src/components/notification-banner.tsx`

**Description:** Reusable alert/notification banner for success, error, warning, and info messages. Supports dismiss action, auto-dismiss timer, and optional action button.

#### Props Interface

```typescript
'use client';

type BannerType = 'success' | 'error' | 'warning' | 'info';

interface NotificationBannerProps {
  type: BannerType;
  title: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  onDismiss?: () => void;
  autoDismiss?: number;           // milliseconds, default 0 = no auto-dismiss
  isLoading?: boolean;            // for "processing" variant
  className?: string;
}
```

#### States

| State | Implementation |
|-------|---------------|
| **Loading** | Info-styled banner with `Loader2` spinner icon + "Processando..." text |
| **Success** | Green banner with check icon |
| **Error** | Red banner with X icon |
| **Warning** | Yellow/amber banner with alert triangle icon |
| **Info** | Blue banner with info icon |
| **Edge: Auto-dismiss** | `useEffect` with timeout, calls `onDismiss` after `autoDismiss` ms, shows progress bar at top of banner |
| **Edge: With action** | Action button right-aligned in banner |
| **Edge: Long message** | Message text wraps, banner grows vertically |
| **Edge: Dismissing** | Fade-out animation (opacity 1 → 0 over 300ms, then `onDismiss` called) |

#### Visual Layout

```
┌──────────────────────────────────────────────────┐
│ ✅ [icon]  Fatura criada com sucesso!           ✕ │
│           A fatura de R$ 150,00 foi criada        │
│           para Maria Silva.                        │
│                                                   │
│           [Ver fatura]                             │
├──────────────────────────────────────────────────┤
│ ⏳ (progress bar for auto-dismiss)                │
└──────────────────────────────────────────────────┘
```

**Per-type styling:**
| Type | bg | border | icon | icon color | text color |
|------|----|--------|------|------------|------------|
| `success` | `bg-success-50` | `border-success-200` | `CheckCircle` | `text-success-500` | `text-success-800` |
| `error` | `bg-danger-50` | `border-danger-200` | `XCircle` | `text-danger-500` | `text-danger-800` |
| `warning` | `bg-warning-50` | `border-warning-200` | `AlertTriangle` | `text-warning-500` | `text-warning-800` |
| `info` | `bg-info-50` | `border-info-200` | `Info` | `text-info-500` | `text-info-800` |

#### Accessibility

- Banner uses `role="alert"` with `aria-live="assertive"` for error/danger types
- For success/info types: `role="status"` with `aria-live="polite"`
- Dismiss button has `aria-label="Fechar notificação"`
- Action button has its own accessible label
- Auto-dismiss is accompanied by a visible countdown (progress bar) for users who need more time
- Focus is NOT automatically moved to the banner (avoid disrupting current task), but banner is announced by screen reader
- WCAG 2.1 AA: Auto-dismiss gives at least 20 seconds OR includes a pause mechanism

#### Dependencies

- `@/components/ui/button` (Button variant="ghost" for dismiss, variant="outline" for action)
- `lucide-react` (CheckCircle, XCircle, AlertTriangle, Info, X, Loader2)

**Note:** `notification-banner.tsx` should be positioned at the top of its parent container (not fixed/absolute — the parent page controls positioning). For toast-style notifications at app-level, use a future `toast` component.

---

## 3. Export Pattern — Updating `components/index.ts`

After all 11 components are built, update `apps/frontend/src/components/index.ts` with the following exports. Follow the existing pattern:

```typescript
// === Existing exports (keep as-is) ===
export { ClientCard } from './client-card';
export type { ClientCardClient } from './client-card';
export { InvoiceTable } from './invoice-table';
export { PaymentStatus } from './payment-status';
export { RiskBadge } from './risk-badge';
export { KpiCard } from './kpi-card';
export { EmptyState } from './empty-state';
export { ErrorState } from './error-state';
export { LoadingSkeleton } from './loading-skeleton';
export { StatCard } from './stat-card';
export { StatusBadge } from './status-badge';
export { Sidebar } from './sidebar';

// === NEW Issue #27 exports (to be added) ===
export { OnboardingWizard } from './onboarding-wizard';
export type {
  OnboardingWizardProps,
  OnboardingWizardData,
} from './onboarding-wizard';

export { CollectionTimeline } from './collection-timeline';
export type {
  CollectionTimelineProps,
  TimelineEvent,
} from './collection-timeline';

export { KanbanBoard } from './kanban-board';
export type {
  KanbanBoardProps,
  KanbanInvoice,
} from './kanban-board';

export { ReportChart } from './report-chart';
export type {
  ReportChartProps,
  ChartType,
  ChartDataPoint,
  ChartSeries,
} from './report-chart';

export { PixPaymentFlow } from './pix-payment-flow';
export type {
  PixPaymentFlowProps,
  PixData,
  PaymentPollStatus,
} from './pix-payment-flow';

export { ClientDetailCard } from './client-detail-card';
export type {
  ClientDetailCardProps,
  ClientDetail,
  RiskFeature,
} from './client-detail-card';

export { InvoiceForm } from './invoice-form';
export type {
  InvoiceFormProps,
  InvoiceFormData,
  InvoiceFormClient,
} from './invoice-form';

export { PaymentHistory } from './payment-history';
export type {
  PaymentHistoryProps,
  PaymentRecord,
} from './payment-history';

export { MessageTracking } from './message-tracking';
export type {
  MessageTrackingProps,
  MessageDetails,
  MessageTrackingEvent,
} from './message-tracking';

export { ExceptionPanel } from './exception-panel';
export type {
  ExceptionPanelProps,
  ExceptionItem,
  ExceptionSeverity,
  ExceptionStatus,
} from './exception-panel';

export { NotificationBanner } from './notification-banner';
export type {
  NotificationBannerProps,
  BannerType,
} from './notification-banner';
```

### Barrel Export Convention

| Pattern | When to use |
|---------|-------------|
| `export { Component }` | Every component (default named export) |
| `export type { Props }` | Every component's main Props interface that external consumers need |
| `export type { SubType }` | Key data types used in props (e.g., `TimelineEvent`, `KanbanInvoice`) |
| **No default exports** | All components use named exports for consistency |
| **No `React.FC`** | Use plain function components with explicit return types |

---

## 4. Shared A11y & UX Criteria (Apply to All Components)

### 4.1 Measurable UX Constraints

| Criterion | Target | How to verify |
|-----------|--------|---------------|
| **Feedback after action** | ≤ 200ms for local state changes; ≤ 1.5s for async operations with spinner | Performance measurement in tests |
| **Loading skeleton appears** | Immediately (≤ 50ms) when `isLoading=true` | React DevTools component timing |
| **Empty state render** | When data array is empty and not loading | Visual inspection |
| **Error state render** | When `error` prop is non-null and not loading | Visual inspection |
| **Transition animation** | ≤ 300ms for fade/slide transitions | CSS transition timing |
| **Click target size** | Minimum 44×44px for touch targets (mobile) | DevTools layout inspection |
| **Font size minimum** | 14px (text-sm) for body text; no font below 12px | Design token usage audit |

### 4.2 WCAG 2.1 AA Checklist (per component)

- [ ] All non-text content has text alternative (`alt`, `aria-label`, `aria-labelledby`)
- [ ] Color is not the sole means of conveying information
- [ ] All interactive elements are keyboard accessible
- [ ] Visible focus indicator (≥ 2px, 3:1 contrast against adjacent background)
- [ ] Text contrast ≥ 4.5:1 (normal), ≥ 3:1 (large text 18px+)
- [ ] Error messages are descriptive and programmatically associated with inputs
- [ ] Status changes are announced via `aria-live` regions
- [ ] Touch targets ≥ 44×44px on mobile
- [ ] No time-based auto-advance without user control (wizard steps)
- [ ] Reduced motion respected: use `prefers-reduced-motion` for animations

### 4.3 Component Acceptance Template

Each component shall pass this checklist before being marked complete:

```
### [Component Name] Acceptance
- [ ] TypeScript compiles without errors
- [ ] Loading state renders correct skeleton
- [ ] Empty state renders correct message (when applicable)
- [ ] Error state renders error message + retry action
- [ ] Success state renders data correctly
- [ ] All edge cases handled (empty strings, missing fields, extreme values)
- [ ] Responsive at 320px, 768px, 1280px breakpoints
- [ ] Keyboard navigable (Tab, Enter, Space, Escape)
- [ ] Screen reader announces all state changes
- [ ] Exported from `components/index.ts`
```

---

## 5. File Structure Summary

```
apps/frontend/src/components/
├── ui/                          # Existing — shadcn base components
│   ├── badge.tsx
│   ├── button.tsx
│   ├── card.tsx
│   ├── skeleton.tsx
│   └── table.tsx
│
├── client-card.tsx              # Existing
├── empty-state.tsx              # Existing
├── error-state.tsx              # Existing
├── index.ts                     # Updated — barrel export
├── invoice-table.tsx            # Existing
├── kpi-card.tsx                 # Existing
├── loading-skeleton.tsx         # Existing
├── payment-status.tsx           # Existing
├── risk-badge.tsx               # Existing
├── sidebar.tsx                  # Existing
├── stat-card.tsx                # Existing
├── status-badge.tsx             # Existing
│
├── collection-timeline.tsx      # NEW
├── client-detail-card.tsx       # NEW
├── exception-panel.tsx          # NEW
├── invoice-form.tsx             # NEW
├── kanban-board.tsx             # NEW
├── message-tracking.tsx         # NEW
├── notification-banner.tsx      # NEW
├── onboarding-wizard.tsx        # NEW
├── payment-history.tsx          # NEW
├── pix-payment-flow.tsx         # NEW
├── report-chart.tsx             # NEW
```

---

## 6. Implementation Order (Recommended)

Priority based on dependency graph and feature criticality:

| Order | Component | Reason | Estimated effort |
|-------|-----------|--------|-----------------|
| 1 | `notification-banner.tsx` | No dependencies, reused everywhere | 0.5h |
| 2 | `invoice-form.tsx` | Core CRUD, needed for invoice creation flow | 2h |
| 3 | `pix-payment-flow.tsx` | Core payment flow, depends on PaymentStatus | 2h |
| 4 | `client-detail-card.tsx` | Client detail view, depends on RiskBadge, StatusBadge | 1.5h |
| 5 | `onboarding-wizard.tsx` | 3-step wizard with Progress | 2h |
| 6 | `kanban-board.tsx` | Invoice management board | 2h |
| 7 | `payment-history.tsx` | Paginated table, depends on StatusBadge | 1.5h |
| 8 | `message-tracking.tsx` | Timeline component, depends on StatusBadge | 1.5h |
| 9 | `collection-timeline.tsx` | Timeline component, similar to message-tracking | 1.5h |
| 10 | `exception-panel.tsx` | Panel with multiple sub-states | 2h |
| 11 | `report-chart.tsx` | Custom SVG chart, highest complexity | 3h |
| | **Total** | | **~19.5h (3 days)** |

---

*End of Spec — Product Designer Agent*
