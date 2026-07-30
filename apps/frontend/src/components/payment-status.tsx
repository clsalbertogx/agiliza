'use client';

import { Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';

type PaymentStatusValue = 'pending' | 'processing' | 'paid' | 'failed';
type PaymentMethod = 'pix' | 'credit_card' | 'boleto';

interface PaymentStatusProps {
  status: PaymentStatusValue;
  method?: PaymentMethod;
}

const statusConfig: Record<
  PaymentStatusValue,
  {
    icon: React.ReactNode;
    label: string;
    containerClass: string;
    iconClass: string;
  }
> = {
  pending: {
    icon: <Clock className="w-5 h-5" aria-hidden="true" />,
    label: 'Aguardando pagamento',
    containerClass: 'bg-warning-50 border-warning-200 text-warning-800',
    iconClass: 'text-warning-500',
  },
  processing: {
    icon: <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />,
    label: 'Processando pagamento',
    containerClass: 'bg-blue-50 border-blue-200 text-blue-800',
    iconClass: 'text-blue-500',
  },
  paid: {
    icon: <CheckCircle className="w-5 h-5" aria-hidden="true" />,
    label: 'Pagamento confirmado',
    containerClass: 'bg-success-50 border-success-200 text-success-800',
    iconClass: 'text-success-500',
  },
  failed: {
    icon: <XCircle className="w-5 h-5" aria-hidden="true" />,
    label: 'Pagamento recusado',
    containerClass: 'bg-danger-50 border-danger-200 text-danger-800',
    iconClass: 'text-danger-500',
  },
};

const methodLabel: Record<PaymentMethod, string> = {
  pix: 'PIX',
  credit_card: 'Cartão de Crédito',
  boleto: 'Boleto',
};

export function PaymentStatus({ status, method }: PaymentStatusProps) {
  const config = statusConfig[status];

  return (
    <div
      className={`inline-flex items-center gap-3 rounded-xl border px-4 py-3 ${config.containerClass}`}
      role="status"
      aria-live="polite"
      aria-label={`Status do pagamento: ${config.label}`}
    >
      <div className={config.iconClass}>{config.icon}</div>
      <div className="flex flex-col">
        <span className="text-sm font-semibold">{config.label}</span>
        {method && (
          <span className="text-xs opacity-75">
            via {methodLabel[method]}
          </span>
        )}
      </div>
      {status === 'processing' && (
        <span className="sr-only">Processando, aguarde...</span>
      )}
    </div>
  );
}
