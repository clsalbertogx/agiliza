import { AlertService } from '@/application/services/alert.service';
import { SlackAlertChannel } from '@/infrastructure/alerting/slack-alert.channel';

export function createAlertService(): AlertService {
  return new AlertService(new SlackAlertChannel());
}