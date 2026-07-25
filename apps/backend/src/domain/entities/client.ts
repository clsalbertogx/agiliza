import { z } from 'zod';

export enum RiskScore {
  GREEN = 'GREEN',
  YELLOW = 'YELLOW',
  RED = 'RED',
}

export enum MessageChannel {
  WHATSAPP = 'WHATSAPP',
  EMAIL = 'EMAIL',
  SMS = 'SMS',
}

export const clientSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(255),
  phone: z.string().regex(/^\d{10,15}$/, 'Phone must be 10-15 digits'),
  email: z.string().email().optional(),
  document: z.string().optional(),
  preferredChannel: z.nativeEnum(MessageChannel).default(MessageChannel.WHATSAPP),
  preferredTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM format').optional(),
  preferredLeadDays: z.number().int().min(1).max(14).default(3),
  riskScore: z.nativeEnum(RiskScore).default(RiskScore.GREEN),
  riskScoreReason: z.any().optional(),
  riskScoreUpdatedAt: z.date().optional(),
  totalInvoices: z.number().int().default(0),
  paidInvoices: z.number().int().default(0),
  avgPaymentDelay: z.number().nullable().optional(),
});

export type Client = z.infer<typeof clientSchema>;

export function createClient(data: z.infer<typeof clientSchema>): Client {
  const parsed = clientSchema.parse(data);
  return parsed;
}
