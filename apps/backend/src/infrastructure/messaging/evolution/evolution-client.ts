export interface EvolutionApiConfig {
  baseUrl: string;
  apiKey: string;
  webhookUrl?: string;
}

export class EvolutionApiClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: EvolutionApiConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      apikey: this.apiKey,
    };
  }

  async sendText(instanceName: string, to: string, text: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        number: to,
        text,
        delay: 1200,
      }),
    });

    if (!response.ok) {
      throw new Error(`Evolution API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async sendTemplate(
    instanceName: string,
    to: string,
    template: { name: string; variables: Record<string, string> },
  ): Promise<any> {
    const response = await fetch(`${this.baseUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        number: to,
        text: this.renderTemplate(template.name, template.variables),
        delay: 1200,
      }),
    });

    if (!response.ok) {
      throw new Error(`Evolution API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getInstanceStatus(instanceName: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/instance/connectionState/${instanceName}`, {
      headers: this.getHeaders(),
    });
    return response.json();
  }

  async createInstance(instanceName: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/instance/create`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      }),
    });
    return response.json();
  }

  private renderTemplate(templateName: string, variables: Record<string, string>): string {
    const templates: Record<string, string> = {
      friendly_reminder_d3: `Olá {{name}}! 👋\n\nSua fatura de *{{value}}* vence no dia *{{dueDate}}*.\n\nDeixei o PIX prontinho pra você pagar rapidinho:\n{{pixLink}}\n\nÉ só copiar e pagar no seu banco. 😊`,
      urgent_d0: `⚠️ {{name}, hoje é o dia!\n\nSua fatura de *{{value}}* vence *HOJE*.\n\nPague agora com PIX:\n{{pixLink}}\n\nEvite juros e mantenha seu plano ativo!`,
      overdue_d2: `⏰ {{name}, sua fatura de *{{value}}* está *atrasada*.\n\nNão deixe para depois! Pague agora com PIX:\n{{pixLink}}\n\nSe precisar de ajuda, é só responder essa mensagem.`,
    };

    let template = templates[templateName] || templates['friendly_reminder_d3'];

    Object.entries(variables).forEach(([key, value]) => {
      template = template.replace(`{{${key}}}`, value);
    });

    return template;
  }
}
