// @agiliza/shared — Single source of truth for the Agiliza public API contract.
//
// Types are defined in apps/backend/src/domain/contracts/ — this file re-exports them.
// This eliminates duplication between the frontend API contract and backend domain model.
//
// Wire format convention: UPPERCASE values (e.g. "PENDING", "PIX", "GREEN").
// This matches the backend domain enums, the Prisma persistence layer, and the
// JSON API responses.

// ──────────────────────────────────────────────
//  Enums (API Contract)
// ──────────────────────────────────────────────

export type { PaymentProvider } from '../../backend/src/domain/contracts/enums';
export type { PaymentMethod } from '../../backend/src/domain/contracts/enums';
export type { InvoiceStatus } from '../../backend/src/domain/contracts/enums';
export type { ClientRiskScore } from '../../backend/src/domain/contracts/enums';
export type { MessageChannel } from '../../backend/src/domain/contracts/enums';

// ──────────────────────────────────────────────
//  API Contract Interfaces (simplified views)
//  These are what the REST API returns. Backend
//  Zod-inferred types may be richer internally.
// ──────────────────────────────────────────────

export type { ClientProfile } from '../../backend/src/domain/contracts/interfaces';
export type { Invoice } from '../../backend/src/domain/contracts/interfaces';

// ──────────────────────────────────────────────
//  Domain Events (for frontend activity feed)
// ──────────────────────────────────────────────

export type { PaymentEvent } from '../../backend/src/domain/contracts/interfaces';