interface StatusBadgeProps {
  status: 'green' | 'yellow' | 'red' | 'paid' | 'pending' | 'overdue';
  label?: string;
}

const statusConfig: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  green: { bg: 'bg-success-100', text: 'text-success-800', dot: 'bg-success-500', label: 'Verde' },
  yellow: { bg: 'bg-warning-100', text: 'text-warning-800', dot: 'bg-warning-500', label: 'Amarelo' },
  red: { bg: 'bg-danger-100', text: 'text-danger-800', dot: 'bg-danger-500', label: 'Vermelho' },
  paid: { bg: 'bg-success-100', text: 'text-success-800', dot: 'bg-success-500', label: 'Pago' },
  pending: { bg: 'bg-info-100', text: 'text-info-800', dot: 'bg-info-500', label: 'Pendente' },
  overdue: { bg: 'bg-danger-100', text: 'text-danger-800', dot: 'bg-danger-500', label: 'Vencido' },
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const config = statusConfig[status];
  if (!config) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {label || config.label}
    </span>
  );
}
