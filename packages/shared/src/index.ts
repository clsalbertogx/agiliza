// @agiliza/shared — Single source of truth for the Agiliza public API contract.
//
// Types are defined in apps/backend/src/domain/contracts/ — this file re-exports them.
// This eliminates duplication between the frontend API contract and backend domain model.
//
// Wire format convention: lowercase enum values are canonical since A3
// (e.g. PaymentProvider is "asaas"/"mercadopago" — never "ASAAS"). Legacy
// UPPERCASE aliases are normalized at the persistence layer and are not part
// of the API contract.

// ──────────────────────────────────────────────
//  Enums (API Contract)
// ──────────────────────────────────────────────

export type {
  ClientRiskScore,
  InvoiceStatus,
  MessageChannel,
  PaymentMethod,
  PaymentProvider,
} from '../../../apps/backend/src/domain/contracts/enums';

// ──────────────────────────────────────────────
//  API Contract Interfaces (simplified views)
//  These are what the REST API returns. Backend
//  Zod-inferred types may be richer internally.
// ──────────────────────────────────────────────

export type { ClientProfile, Invoice } from '../../../apps/backend/src/domain/contracts/interfaces';

// ──────────────────────────────────────────────
//  Domain Events (for frontend activity feed)
// ──────────────────────────────────────────────

export type { PaymentEvent } from '../../../apps/backend/src/domain/contracts/interfaces';
