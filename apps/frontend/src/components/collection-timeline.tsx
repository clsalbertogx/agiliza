'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { LoadingSkeleton } from '@/components/loading-skeleton';
import { Check, X, Clock, MessageSquare, Phone, Mail, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export interface TimelineEvent {
  id: string;
  event: 'queued' | 'sent' | 'delivered' | 'read' | 'clicked' | 'failed';
  channel: 'whatsapp' | 'email' | 'sms';
  timestamp: string;
  templateName?: string;
  content?: string;
  errorMessage?: string;
}

export interface CollectionTimelineProps {
  clientId: string;
  invoiceId: string;
  events: TimelineEvent[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const eventConfig: Record<
  string,
  { dotClass: string; label: string; bgClass: string; icon: React.ReactNode }
> = {
  queued: {
    dotClass: 'bg-gray-400',
    label: 'Na fila',
    bgClass: 'bg-gray-50',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  sent: {
    dotClass: 'bg-info-500',
    label: 'Enviado',
    bgClass: 'bg-info-50',
    icon: <Mail className="w-3.5 h-3.5" />,
  },
  delivered: {
    dotClass: 'bg-success-500',
    label: 'Entregue',
    bgClass: 'bg-success-50',
    icon: <Check className="w-3.5 h-3.5" />,
  },
  read: {
    dotClass: 'bg-success-500',
    label: 'Lida',
    bgClass: 'bg-success-50',
    icon: <Check className="w-3.5 h-3.5" />,
  },
  clicked: {
    dotClass: 'bg-primary-500',
    label: 'Clicou',
    bgClass: 'bg-primary-50',
    icon: <Check className="w-3.5 h-3.5" />,
  },
  failed: {
    dotClass: 'bg-danger-500',
    label: 'Falhou',
    bgClass: 'bg-danger-50',
    icon: <X className="w-3.5 h-3.5" />,
  },
};

const channelLabel: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  sms: 'SMS',
};

function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function TimelineSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-5 w-40 bg-gray-200 rounded animate-pulse" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <div className="space-y-0" role="status" aria-label="Carregando timeline">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-start gap-3 pb-6">
              <div className="flex flex-col items-center">
                <div className="w-4 h-4 rounded-full bg-gray-200 animate-pulse" aria-hidden="true" />
                {i < 4 && <div className="w-0.5 flex-1 bg-gray-100 mt-1" aria-hidden="true" />}
              </div>
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function CollectionTimeline({
  clientId,
  invoiceId,
  events,
  isLoading = false,
  error = null,
  onRetry,
}: CollectionTimelineProps) {
  if (isLoading) return <TimelineSkeleton />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;

  if (events.length === 0) {
    return (
      <EmptyState
        icon={<MessageSquare className="w-16 h-16" />}
        title="Nenhum lembrete enviado"
        description="Ainda não foram enviados lembretes para esta fatura."
      />
    );
  }

  // Check if the last event is pending (queued but no delivery yet)
  const lastEvent = events[events.length - 1];
  const isPending = lastEvent && (lastEvent.event === 'queued' || lastEvent.event === 'sent');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de Cobrança</CardTitle>
      </CardHeader>
      <CardContent>
        <ol role="list" aria-label="Linha do tempo de cobrança" className="space-y-0">
          {events.map((event, idx) => {
            const config = eventConfig[event.event] ?? eventConfig.queued;
            const isLast = idx === events.length - 1;

            return (
              <li
                key={event.id}
                role={event.event === 'failed' ? 'alert' : 'listitem'}
                className="flex items-start gap-3"
                aria-label={
                  event.event === 'failed' && event.errorMessage
                    ? `Falha: ${event.errorMessage}`
                    : undefined
                }
              >
                <div className="flex flex-col items-center">
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center ${config.dotClass} text-white`}
                    aria-hidden="true"
                  >
                    {config.icon}
                  </div>
                  {!isLast && (
                    <div className="w-0.5 flex-1 bg-gray-200 mt-1" aria-hidden="true" />
                  )}
                  {isLast && isPending && (
                    <div className="w-0.5 flex-1 mt-1" aria-hidden="true" />
                  )}
                </div>

                <div className={`pb-6 flex-1 min-w-0 ${config.bgClass} rounded-lg p-3`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-700">
                      {config.label}
                    </span>
                    <span className="text-xs text-gray-400">
                      · {channelLabel[event.channel]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDateTime(event.timestamp)}
                  </p>
                  {event.templateName && (
                    <p className="text-xs text-gray-500 mt-1 font-mono">
                      Template: {event.templateName}
                    </p>
                  )}
                  {event.content && (
                    <p className="text-xs text-gray-600 mt-1 italic truncate">
                      &ldquo;{event.content}&rdquo;
                    </p>
                  )}
                  {event.event === 'failed' && event.errorMessage && (
                    <p className="text-xs text-danger-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" aria-hidden="true" />
                      Erro: {event.errorMessage}
                    </p>
                  )}
                </div>
              </li>
            );
          })}

          {/* Pending dot for last item */}
          {isPending && (
            <li role="listitem" className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className="w-4 h-4 rounded-full bg-gray-300 animate-pulse" aria-hidden="true" />
              </div>
              <div className="pb-0">
                <p className="text-sm text-gray-400 italic">Aguardando entrega...</p>
              </div>
            </li>
          )}
        </ol>
      </CardContent>
    </Card>
  );
}
