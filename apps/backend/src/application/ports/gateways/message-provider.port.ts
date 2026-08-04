export interface SendMessageParams {
  to: string;
  text: string;
  tenantId: string;
  clientId: string;
  invoiceId?: string;
}

export interface MessageStatusResponse {
  externalId: string;
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
}

export interface MessageProviderPort {
  sendText(params: SendMessageParams): Promise<MessageStatusResponse>;
  sendTemplate(
    params: SendMessageParams & { templateName: string; variables: Record<string, string> },
  ): Promise<MessageStatusResponse>;
  getStatus(externalMessageId: string): Promise<MessageStatusResponse>;
}
