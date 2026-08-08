import type { MessageProviderPort } from '@/application/ports/gateways/message-provider.port';
import type { ClientRepositoryPort } from '@/application/ports/repositories/client.repository.port';
import type { EventRepositoryPort } from '@/application/ports/repositories/event.repository.port';
import { MessageChannel } from '@/domain/entities/client';
import type { IdGeneratorPort } from '@/domain/ports/id-generator.port';

interface OnboardingState {
  clientId: string;
  tenantId: string;
  currentQuestion: number; // 0 = not started, 1-3 = questions, 4 = completed
  answers: {
    channel?: string;
    time?: string;
    leadDays?: number;
  };
  expiresAt: Date;
}

export class OnboardingService {
  private readonly clientRepo: ClientRepositoryPort;
  private readonly eventRepo: EventRepositoryPort;
  private readonly messageProvider: MessageProviderPort;
  private onboardingStates = new Map<string, OnboardingState>();

  constructor(
    clientRepo: ClientRepositoryPort,
    eventRepo: EventRepositoryPort,
    messageProvider: MessageProviderPort,
    private readonly idGenerator: IdGeneratorPort,
  ) {
    this.clientRepo = clientRepo;
    this.eventRepo = eventRepo;
    this.messageProvider = messageProvider;
  }

  /** Check if a client needs onboarding (no preferred channel AND no preferred time). */
  async needsOnboarding(clientId: string): Promise<boolean> {
    const client = await this.clientRepo.findById(clientId);
    if (!client) return false;
    return !client.preferredChannel && !client.preferredTime;
  }

  async startOnboarding(clientId: string, tenantId: string): Promise<void> {
    const client = await this.clientRepo.findById(clientId);
    if (!client) throw new Error('Client not found');

    // Create onboarding state
    const state: OnboardingState = {
      clientId,
      tenantId,
      currentQuestion: 0,
      answers: {},
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h expiry
    };
    this.onboardingStates.set(clientId, state);

    // Send first question
    await this.sendQuestion(clientId);
  }

  async sendQuestion(clientId: string): Promise<void> {
    const state = this.onboardingStates.get(clientId);
    if (!state) throw new Error('Onboarding session not found');
    if (new Date() > state.expiresAt) {
      this.onboardingStates.delete(clientId);
      throw new Error('Onboarding session expired');
    }

    const client = await this.clientRepo.findById(clientId);
    if (!client) throw new Error('Client not found');

    const questions = [
      `🎯 *Olá ${client.name.split(' ')[0]}!* \n\nVamos configurar suas preferências de cobrança? São só 3 perguntinhas rápidas! 🙌\n\n*Pergunta 1 de 3:*\nQual canal você prefere receber os lembretes de cobrança?\n\n1️⃣ WhatsApp\n2️⃣ E-mail\n3️⃣ SMS\n\nResponda com o número da opção!`,

      `📅 *Pergunta 2 de 3:*\nQual horário você prefere receber os lembretes?\n\n1️⃣ 🌅 Manhã (8h-12h)\n2️⃣ ☀️ Tarde (12h-18h)\n3️⃣ 🌆 Noite (18h-21h)\n\nResponda com o número!`,

      `⏰ *Pergunta 3 de 3 (última!):*\nCom quantos dias de antecedência você quer ser lembrado?\n\n1️⃣ 1 dia\n2️⃣ 3 dias\n3️⃣ 5 dias\n4️⃣ 7 dias\n\nResponda com o número!`,
    ];

    const questionText = questions[state.currentQuestion];
    if (!questionText) return;

    const formattedNumber = client.phone.startsWith('55') ? client.phone : `55${client.phone}`;

    await this.messageProvider.sendText({
      to: formattedNumber,
      text: questionText,
      tenantId: state.tenantId,
      clientId,
    });
  }

  async processAnswer(clientId: string, answer: string): Promise<{ completed: boolean; message: string }> {
    const state = this.onboardingStates.get(clientId);
    if (!state) {
      return { completed: false, message: 'Sessão de onboarding não encontrada. Inicie novamente.' };
    }
    if (new Date() > state.expiresAt) {
      this.onboardingStates.delete(clientId);
      return { completed: false, message: 'Sessão expirada. Inicie novamente.' };
    }

    const questionIndex = state.currentQuestion;

    switch (questionIndex) {
      case 0: {
        // Channel preference
        const channelMap: Record<string, MessageChannel> = {
          '1': MessageChannel.WHATSAPP,
          '2': MessageChannel.EMAIL,
          '3': MessageChannel.SMS,
          whatsapp: MessageChannel.WHATSAPP,
          email: MessageChannel.EMAIL,
          sms: MessageChannel.SMS,
        };
        const channel = channelMap[answer.toLowerCase()];
        if (!channel) {
          await this.sendQuestion(clientId); // Re-ask
          return { completed: false, message: 'Opção inválida. Responda 1, 2 ou 3.' };
        }
        state.answers.channel = channel;
        break;
      }

      case 1: {
        // Time preference
        const timeMap: Record<string, string> = {
          '1': '09:00',
          '2': '15:00',
          '3': '19:00',
          manhã: '09:00',
          tarde: '15:00',
          noite: '19:00',
        };
        const time = timeMap[answer.toLowerCase()];
        if (!time) {
          await this.sendQuestion(clientId);
          return { completed: false, message: 'Opção inválida. Responda 1, 2 ou 3.' };
        }
        state.answers.time = time;
        break;
      }

      case 2: {
        // Lead days preference
        const daysMap: Record<string, number> = {
          '1': 1,
          '2': 3,
          '3': 5,
          '4': 7,
        };
        const days = daysMap[answer];
        if (!days) {
          await this.sendQuestion(clientId);
          return { completed: false, message: 'Opção inválida. Responda 1, 2, 3 ou 4.' };
        }
        state.answers.leadDays = days;
        break;
      }

      default:
        return { completed: false, message: 'Onboarding já foi concluído.' };
    }

    state.currentQuestion++;

    if (state.currentQuestion >= 3) {
      // Onboarding complete! Save preferences
      await this.completeOnboarding(clientId, state);
      this.onboardingStates.delete(clientId);
      return { completed: true, message: this.getThankYouMessage() };
    }

    // Send next question
    await this.sendQuestion(clientId);
    return { completed: false, message: `Pergunta ${state.currentQuestion + 1} enviada!` };
  }

  private async completeOnboarding(clientId: string, state: OnboardingState): Promise<void> {
    const client = await this.clientRepo.findById(clientId);
    if (!client) throw new Error('Client not found');

    await this.clientRepo.update({
      ...client,
      preferredChannel: state.answers.channel as MessageChannel,
      preferredTime: state.answers.time,
      preferredLeadDays: state.answers.leadDays ?? client.preferredLeadDays,
    });

    await this.eventRepo.save({
      eventId: this.idGenerator.generate(),
      eventType: 'client.risk.updated',
      clientId,
      tenantId: state.tenantId,
      timestamp: new Date().toISOString(),
      metadata: {
        type: 'onboarding_completed',
        preferences: state.answers,
        completedAt: new Date().toISOString(),
      },
    });
  }

  private getThankYouMessage(): string {
    return `✨ *Tudo pronto!* Suas preferências foram salvas.\n\nAgora vamos cuidar dos seus lembretes de pagamento do jeito que você prefere! 😊`;
  }

  async getOnboardingStatus(clientId: string): Promise<{ active: boolean; currentQuestion?: number }> {
    const state = this.onboardingStates.get(clientId);
    if (!state || new Date() > state.expiresAt) {
      return { active: false };
    }
    return { active: true, currentQuestion: state.currentQuestion };
  }
}
