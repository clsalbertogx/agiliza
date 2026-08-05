'use client';

import { Bell, CalendarDays } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { LoadingSkeleton } from '@/components/loading-skeleton';
import { api } from '@/lib/api';
import { getTenantId } from '@/lib/tenant';

interface MessageEvent {
  id: string;
  tenantId: string;
  clientId: string | null;
  eventType: string;
  payload: Record<string, unknown>;
  source?: string | null;
  createdAt: string;
}

interface Meta {
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

function summarizePayload(payload: Record<string, unknown>): {
  channel?: string;
  template?: string;
  recipient?: string;
} {
  const channel = typeof payload.channel === 'string' ? payload.channel : undefined;
  const template = typeof payload.templateName === 'string' ? payload.templateName : undefined;
  const recipient = typeof payload.recipient === 'string' ? payload.recipient : undefined;
  return { channel, template, recipient };
}

function formatDate(raw: string): string {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString('pt-BR');
}

export default function RemindersPage() {
  const [messages, setMessages] = useState<MessageEvent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tenantId = getTenantId();
      const payload = await api.get<{ data: MessageEvent[]; meta: Meta }>('/api/messages', {
        tenantId,
        perPage: '50',
      });
      setMessages(payload.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar lembretes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Lembretes</h1>
        <LoadingSkeleton variant="page" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Lembretes</h1>
        </div>
        <ErrorState message={error} details="Verifique sua conexão e tente novamente." onRetry={load} />
      </div>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Lembretes</h1>
        <EmptyState
          icon={<Bell className="w-16 h-16" />}
          title="Nenhum lembrete enviado ainda"
          description="Programe lembretes de cobrança para manter seus clientes em dia, e eles aparecerão aqui."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Lembretes</h1>
        <span className="text-sm text-gray-400">{messages.length} envio(s)</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-sm text-gray-500 border-b border-gray-100">
              <th scope="col" className="p-4">
                Cliente
              </th>
              <th scope="col" className="p-4">
                Evento
              </th>
              <th scope="col" className="p-4">
                Resumo
              </th>
              <th scope="col" className="p-4">
                Data
              </th>
            </tr>
          </thead>
          <tbody>
            {messages.map((message) => {
              const summary = summarizePayload(message.payload);
              return (
                <tr key={message.id} className="border-b border-gray-50">
                  <td className="p-4 font-medium text-gray-900">{message.clientId ?? '-'}</td>
                  <td className="p-4 text-sm text-gray-600">{message.eventType}</td>
                  <td className="p-4">
                    <div className="flex flex-col gap-0.5 text-sm text-gray-600">
                      {summary.channel && <span>{summary.channel}</span>}
                      {summary.template && <span>{summary.template}</span>}
                      {summary.recipient && <span className="text-xs text-gray-400">{summary.recipient}</span>}
                      {!summary.channel && !summary.template && <span>-</span>}
                    </div>
                  </td>
                  <td className="p-4 text-sm text-gray-500 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="w-4 h-4" aria-hidden="true" />
                      {formatDate(message.createdAt)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
