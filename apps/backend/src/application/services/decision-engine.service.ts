import { RiskScore, MessageChannel, Client } from '@/domain/entities/client';
import { Invoice } from '@/domain/entities/invoice';

export interface Decision {
  action: 'send_reminder' | 'suggest_call' | 'send_offer' | 'wait';
  channel: MessageChannel;
  templateName: string;
  scheduledAt: Date;
  confidence: number;
  reasoning: string[];
}

interface NicheBenchmark {
  preferredHour: string; // HH:MM
  preferredChannel: MessageChannel;
  leadDays: number;
}

const DEFAULT_BENCHMARKS: Record<string, NicheBenchmark> = {
  default: {
    preferredHour: '09:00',
    preferredChannel: MessageChannel.WHATSAPP,
    leadDays: 3,
  },
};

export class DecisionEngineService {
  private benchmarks: Record<string, NicheBenchmark>;

  constructor(benchmarks?: Record<string, NicheBenchmark>) {
    this.benchmarks = benchmarks ?? DEFAULT_BENCHMARKS;
  }

  decideNextAction(
    client: Client,
    invoice: Invoice,
    niche: string = 'default'
  ): Decision {
    const benchmark = this.benchmarks[niche] ?? this.benchmarks.default;
    const reasoning: string[] = [];

    // Determine timing
    const preferredTime = client.preferredTime ?? benchmark.preferredHour;
    const leadDays = client.preferredLeadDays ?? benchmark.leadDays;
    
    const reminderDate = new Date(invoice.dueDate);
    reminderDate.setDate(reminderDate.getDate() - leadDays);
    const [hours, minutes] = preferredTime.split(':').map(Number);
    reminderDate.setHours(hours, minutes, 0, 0);

    // Determine action based on risk score
    // Note: RiskScore is a class instance, so we must use level comparison, not reference equality
    if (client.riskScore.isHighOrCritical()) {
      reasoning.push('Cliente de alto risco — sugerir contato humano');
      return {
        action: 'suggest_call',
        channel: MessageChannel.WHATSAPP,
        templateName: 'urgent_human_call',
        scheduledAt: new Date(), // ASAP
        confidence: 0.7,
        reasoning: ['Alto risco de inadimplência', ...reasoning],
      };
    }

    if (client.riskScore.isMedium()) {
      reasoning.push(`Cliente de risco médio — enviar lembrete D-${leadDays}`);
      return {
        action: 'send_reminder',
        channel: client.preferredChannel ?? benchmark.preferredChannel,
        templateName: leadDays >= 5 ? 'early_reminder_d5' : 'friendly_reminder_d3',
        scheduledAt: reminderDate,
        confidence: 0.85,
        reasoning: ['Risco médio — lembrete antecipado', ...reasoning],
      };
    }

    // Low risk (GREEN) — default
    reasoning.push(`Cliente de baixo risco — lembrete padrão D-${leadDays}`);
    return {
      action: 'send_reminder',
      channel: client.preferredChannel ?? benchmark.preferredChannel,
      templateName: 'friendly_reminder_d3',
      scheduledAt: reminderDate,
      confidence: 0.95,
      reasoning: ['Baixo risco — lembrete padrão', ...reasoning],
    };
  }
}
