import { MessageProviderPort, SendMessageParams, MessageStatusResponse } from '../../../application/ports/message-provider.port';
import { EvolutionApiClient } from './evolution-client';

export class EvolutionMessageProvider implements MessageProviderPort {
  private client: EvolutionApiClient;
  private instanceName: string;

  constructor(config: { baseUrl: string; apiKey: string; instanceName: string }) {
    this.client = new EvolutionApiClient({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
    });
    this.instanceName = config.instanceName;
  }

  async sendText(params: SendMessageParams): Promise<MessageStatusResponse> {
    const formattedNumber = params.to.startsWith('55') ? params.to : `55${params.to}`;
    
    const result = await this.client.sendText(
      this.instanceName,
      `${formattedNumber}@s.whatsapp.net`,
      params.text
    );

    return {
      externalId: result.key?.id || result.id || crypto.randomUUID(),
      status: 'queued',
      timestamp: new Date().toISOString(),
    };
  }

  async sendTemplate(params: SendMessageParams & { templateName: string; variables: Record<string, string> }): Promise<MessageStatusResponse> {
    const formattedNumber = params.to.startsWith('55') ? params.to : `55${params.to}`;
    
    const result = await this.client.sendTemplate(
      this.instanceName,
      `${formattedNumber}@s.whatsapp.net`,
      {
        name: params.templateName,
        variables: params.variables,
      }
    );

    return {
      externalId: result.key?.id || result.id || crypto.randomUUID(),
      status: 'queued',
      timestamp: new Date().toISOString(),
    };
  }

  async getStatus(externalMessageId: string): Promise<MessageStatusResponse> {
    return {
      externalId: externalMessageId,
      status: 'sent',
      timestamp: new Date().toISOString(),
    };
  }
}
