'use client';

import { Calendar, Clock, Edit3, Mail, MessageCircle, Phone, TrendingDown, TrendingUp } from 'lucide-react';
import { ErrorState } from '@/components/error-state';
import { RiskBadge } from '@/components/risk-badge';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

export interface RiskFeature {
  name: string;
  label: string;
  value: number;
  impact: number;
}

export interface ClientDetail {
  id: string;
  name: string;
  phone: string;
  email?: string;
  preferredChannel: 'whatsapp' | 'email' | 'sms';
  preferredTime: string;
  preferredLeadDays: number;
  onboardingCompleted: boolean;
  riskScore: 'green' | 'yellow' | 'red';
  riskProbability?: number;
  riskFeatures?: RiskFeature[];
  paymentStats?: {
    totalInvoices: number;
    paidInvoices: number;
    overdueInvoices: number;
    avgPaymentDelay: number;
    totalPaid: number;
  };
  createdAt: string;
}

export interface ClientDetailCardProps {
  client: ClientDetail;
  onEdit?: () => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const channelLabel: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  sms: 'SMS',
};

const channelIcon: Record<string, React.ReactNode> = {
  whatsapp: <MessageCircle className="w-4 h-4" aria-hidden="true" />,
  email: <Mail className="w-4 h-4" aria-hidden="true" />,
  sms: <MessageCircle className="w-4 h-4" aria-hidden="true" />,
};

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('pt-BR', {
    month: 'short',
    year: 'numeric',
  });
}

function DetailSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4" role="status" aria-label="Carregando...">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-gray-200 animate-pulse" aria-hidden="true" />
        <div className="space-y-2">
          <div className="h-5 w-36 bg-gray-200 rounded animate-pulse" aria-hidden="true" />
          <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" aria-hidden="true" />
        </div>
      </div>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-4 w-full bg-gray-200 rounded animate-pulse" aria-hidden="true" />
      ))}
    </div>
  );
}

export function ClientDetailCard({ client, onEdit, isLoading = false, error = null, onRetry }: ClientDetailCardProps) {
  if (isLoading) return <DetailSkeleton />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;

  const riskPercent = client.riskProbability !== undefined ? Math.round(client.riskProbability * 100) : null;

  return (
    <Card>
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-lg"
              aria-hidden="true"
            >
              {getInitials(client.name)}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{client.name}</h2>
              <p className="text-sm text-gray-400">Cliente desde {formatDate(client.createdAt)}</p>
            </div>
          </div>
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Editar cliente"
            >
              <Edit3 className="w-5 h-5 text-gray-500" />
            </button>
          )}
        </div>

        {/* Content grid: 1 col on mobile, 2 cols on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column: Contact + Preferences */}
          <div className="space-y-6">
            {/* Contact */}
            <section aria-labelledby="contact-heading">
              <h3 id="contact-heading" className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                Contato
              </h3>
              <div className="space-y-2">
                <a
                  href={`tel:${client.phone}`}
                  className="flex items-center gap-2 text-sm text-gray-700 hover:text-primary-600 transition-colors"
                >
                  <Phone className="w-4 h-4 text-gray-400" aria-hidden="true" />
                  {client.phone}
                </a>
                {client.email ? (
                  <a
                    href={`mailto:${client.email}`}
                    className="flex items-center gap-2 text-sm text-gray-700 hover:text-primary-600 transition-colors"
                  >
                    <Mail className="w-4 h-4 text-gray-400" aria-hidden="true" />
                    {client.email}
                  </a>
                ) : (
                  <p className="flex items-center gap-2 text-sm text-gray-400 italic">
                    <Mail className="w-4 h-4" aria-hidden="true" />
                    Não cadastrado
                  </p>
                )}
              </div>
            </section>

            {/* Preferences */}
            <section aria-labelledby="prefs-heading">
              <h3 id="prefs-heading" className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                Preferências
              </h3>
              <div className="space-y-2">
                <p className="flex items-center gap-2 text-sm text-gray-700">
                  {channelIcon[client.preferredChannel]}
                  Canal: {channelLabel[client.preferredChannel]}
                </p>
                <p className="flex items-center gap-2 text-sm text-gray-700">
                  <Clock className="w-4 h-4 text-gray-400" aria-hidden="true" />
                  Horário: {client.preferredTime}
                </p>
                <p className="flex items-center gap-2 text-sm text-gray-700">
                  <Calendar className="w-4 h-4 text-gray-400" aria-hidden="true" />
                  Lead: {client.preferredLeadDays} dias
                </p>
                <p className="flex items-center gap-2 text-sm text-gray-700">
                  <Badge variant={client.onboardingCompleted ? 'success' : 'warning'}>
                    {client.onboardingCompleted ? 'Onboarding Completo' : 'Onboarding Pendente'}
                  </Badge>
                </p>
              </div>
            </section>
          </div>

          {/* Right column: Risk + Payment Stats */}
          <div className="space-y-6">
            {/* Risk */}
            <section aria-labelledby="risk-heading">
              <h3 id="risk-heading" className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                Risco
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <RiskBadge level={client.riskScore} probability={client.riskProbability} />
                </div>

                {/* Risk meter */}
                {riskPercent !== null && (
                  <div className="space-y-1">
                    {/* biome-ignore lint/a11y/useSemanticElements: custom-styled meter (Tailwind fill bar); native <meter> would change visual design */}
                    <div
                      className="h-2 bg-gray-200 rounded-full overflow-hidden"
                      role="meter"
                      aria-valuenow={riskPercent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Risco: ${riskPercent}%`}
                    >
                      <div
                        className={`h-full rounded-full transition-all ${
                          riskPercent < 33 ? 'bg-success-500' : riskPercent < 66 ? 'bg-warning-500' : 'bg-danger-500'
                        }`}
                        style={{ width: `${riskPercent}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500">{riskPercent}% de probabilidade</p>
                  </div>
                )}

                {/* Risk features */}
                {client.riskFeatures && client.riskFeatures.length > 0 ? (
                  <ul className="space-y-1.5">
                    {client.riskFeatures.map((feature) => (
                      <li key={feature.name} className="flex items-center gap-2 text-sm text-gray-600">
                        {feature.impact > 0 ? (
                          <TrendingUp className="w-3.5 h-3.5 text-danger-500 flex-shrink-0" aria-hidden="true" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5 text-success-500 flex-shrink-0" aria-hidden="true" />
                        )}
                        <span>
                          {feature.label}: {feature.value}
                        </span>
                        <span
                          className={`text-xs font-medium ${feature.impact > 0 ? 'text-danger-500' : 'text-success-500'}`}
                        >
                          {feature.impact > 0 ? '+' : ''}
                          {feature.impact.toFixed(2)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-400 italic">Dados insuficientes para análise de risco</p>
                )}
              </div>
            </section>

            {/* Payment stats */}
            {client.paymentStats && (
              <section aria-labelledby="payment-heading">
                <h3 id="payment-heading" className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                  Pagamentos
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Total</p>
                    <p className="text-sm font-bold text-gray-900">{formatBRL(client.paymentStats.totalPaid)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Pagas</p>
                    <p className="text-sm font-bold text-success-600">{client.paymentStats.paidInvoices}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Vencidas</p>
                    <p className="text-sm font-bold text-danger-600">{client.paymentStats.overdueInvoices}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Atraso médio</p>
                    <p className="text-sm font-bold text-gray-900">{client.paymentStats.avgPaymentDelay} dias</p>
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
