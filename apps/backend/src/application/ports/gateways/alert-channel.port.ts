export interface AlertMessage {
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  metadata?: Record<string, unknown>;
}

export interface AlertChannelPort {
  sendAlert(alert: AlertMessage): Promise<void>;
}
