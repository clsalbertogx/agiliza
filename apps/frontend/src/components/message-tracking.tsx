// Available for wire-up — not yet connected to a page.
// Exported from the barrel; natural home: message delivery/detail view.
'use client';

import { AlertCircle, Check, ChevronRight, Clock, Download, Eye, MousePointerClick, Send, X } from 'lucide-react';
import { ErrorState } from '@/components/error-state';
import { LoadingSkeleton } from '@/components/loading-skeleton';
import { StatusBadge } from '@/components/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface MessageTrackingEvent {
  event: 'queued' | 'sent' | 'delivered' | 'read' | 'clicked' | 'failed';
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface MessageDetails {
  id: string;
  clientId: string;
  clientName: string;
  channel: 'whatsapp' | 'email' | 'sms';
  templateName: string;
  content?: string;
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'clicked' | 'failed';
  events: MessageTrackingEvent[];
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  clickedAt?: string;
  failedAt?: string;
  errorMessage?: string;
}

export interface MessageTrackingProps {
  messageId: string;
  data: MessageDetails;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const eventConfig: Record<string, { icon: React.ReactNode; label: string; color: string; bgColor: string }> = {
  queued: {
    icon: <Clock className="w-5 h-5" aria-hidden="true" />,
    label: 'Na fila para envio',
    color: 'text-gray-400',
    bgColor: 'bg-gray-50',
  },
  sent: {
    icon: <Send className="w-5 h-5" aria-hidden="true" />,
    label: 'Enviada',
    color: 'text-info-500',
    bgColor: 'bg-info-50',
  },
  delivered: {
    icon: <Download className="w-5 h-5" aria-hidden="true" />,
    label: 'Entregue',
    color: 'text-success-500',
    bgColor: 'bg-success-50',
  },
  read: {
    icon: <Eye className="w-5 h-5" aria-hidden="true" />,
    label: 'Lida',
    color: 'text-success-600',
    bgColor: 'bg-success-50',
  },
  clicked: {
    icon: <MousePointerClick className="w-5 h-5" aria-hidden="true" />,
    label: 'Clicou no link',
    color: 'text-primary-500',
    bgColor: 'bg-primary-50',
  },
  failed: {
    icon: <AlertCircle className="w-5 h-5" aria-hidden="true" />,
    label: 'Falha no envio',
    color: 'text-danger-500',
    bgColor: 'bg-danger-50',
  },
};

const channelLabel: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  sms: 'SMS',
};

const statusBadgeMap: Record<string, 'green' | 'yellow' | 'red' | 'paid' | 'pending' | 'overdue'> = {
  queued: 'pending',
  sent: 'pending',
  delivered: 'paid',
  read: 'paid',
  clicked: 'paid',
  failed: 'red',
};

function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function MessageTrackingSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4" role="status" aria-label="Carregando...">
      <div className="h-5 w-48 bg-gray-200 rounded animate-pulse" aria-hidden="true" />
      <div className="space-y-2">
        <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" aria-hidden="true" />
        <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" aria-hidden="true" />
        <div className="h-4 w-40 bg-gray-200 rounded animate-pulse" aria-hidden="true" />
      </div>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-full bg-gray-200 animate-pulse" aria-hidden="true" />
          <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" aria-hidden="true" />
        </div>
      ))}
    </div>
  );
}

function TimelineNode({
  event,
  timestamp,
  isLast,
  isPending,
}: {
  event: MessageTrackingEvent;
  timestamp: string;
  isLast: boolean;
  isPending: boolean;
}) {
  const config = eventConfig[event.event];
  if (!config) return null;

  // Pending node (future event)
  if (isPending) {
    return (
      <li className="flex items-start gap-3" role="listitem">
        <div className="flex flex-col items-center">
          <div className="w-5 h-5 rounded-full bg-gray-200 animate-pulse" aria-hidden="true" />
          {!isLast && <div className="w-0.5 flex-1 bg-gray-200 mt-1" aria-hidden="true" />}
        </div>
        <div className="pb-6">
          <p className="text-sm text-gray-400 italic">Aguardando evento...</p>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-start gap-3" role="listitem">
      <div className="flex flex-col items-center">
        <div className={`w-5 h-5 rounded-full flex items-center justify-center ${config.bgColor}`}>
          <div className={config.color}>{config.icon}</div>
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-gray-200 mt-1" aria-hidden="true" />}
      </div>
      <div className={`pb-6`} {...(event.event === 'failed' ? { role: 'alert' as const } : {})}>
        <p className={`text-sm font-medium ${config.color}`}>{config.label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(timestamp)}</p>
        {event.event === 'failed' && event.metadata?.error != null && (
          <p className="text-xs text-danger-500 mt-1">Erro: {String(event.metadata.error)}</p>
        )}
      </div>
    </li>
  );
}

export function MessageTracking({ messageId, data, isLoading = false, error = null, onRetry }: MessageTrackingProps) {
  if (isLoading) return <MessageTrackingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;

  // Determine which events are the "future" / pending ones
  const eventIndex = ['queued', 'sent', 'delivered', 'read', 'clicked'];
  const lastEventIdx = eventIndex.indexOf(data.status);
  const futureEvents = eventIndex.slice(lastEventIdx + 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rastreamento de Mensagem</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Header info */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-6 p-4 bg-gray-50 rounded-xl">
          <div>
            <p className="text-xs text-gray-400">Para</p>
            <p className="text-sm font-medium text-gray-900">{data.clientName}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Canal</p>
            <p className="text-sm font-medium text-gray-900">{channelLabel[data.channel]}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Template</p>
            <p className="text-sm font-medium text-gray-900">{data.templateName}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Status</p>
            <StatusBadge status={statusBadgeMap[data.status] ?? 'pending'} label={eventConfig[data.status]?.label} />
          </div>
        </div>

        {/* Timeline */}
        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Linha do Tempo</h4>
        <ol role="list" aria-label="Linha do tempo da mensagem" className="space-y-0">
          {data.events.map((event, idx) => (
            <TimelineNode
              key={`${event.event}-${event.timestamp}`}
              event={event}
              timestamp={event.timestamp}
              isLast={idx === data.events.length - 1 && futureEvents.length === 0}
              isPending={false}
            />
          ))}

          {/* Future / pending events */}
          {futureEvents.map((event) => (
            <li key={event} className="flex items-start gap-3" role="listitem">
              <div className="flex flex-col items-center">
                <div className="w-5 h-5 rounded-full bg-gray-200 animate-pulse" aria-hidden="true" />
                {event !== futureEvents[futureEvents.length - 1] && (
                  <div className="w-0.5 flex-1 bg-gray-200 mt-1" aria-hidden="true" />
                )}
              </div>
              <div className="pb-6">
                <p className="text-sm text-gray-400 italic">Em andamento...</p>
                <p className="text-xs text-gray-300 mt-0.5">{eventConfig[event]?.label ?? event}</p>
              </div>
            </li>
          ))}
        </ol>

        {/* Failed message error */}
        {data.status === 'failed' && data.errorMessage && (
          <div
            className="mt-4 p-4 bg-danger-50 border border-danger-200 rounded-xl text-sm text-danger-800"
            role="alert"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-danger-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-semibold">Erro no envio</p>
                <p className="mt-1">{data.errorMessage}</p>
              </div>
            </div>
          </div>
        )}

        {/* Message preview */}
        {data.content && (
          <div className="mt-6">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Conteúdo da Mensagem</h4>
            <blockquote className="p-4 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-700 whitespace-pre-wrap">
              {data.content}
            </blockquote>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
