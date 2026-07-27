interface StatusBadgeProps {
  status: 'green' | 'yellow' | 'red' | 'paid' | 'pending' | 'overdue';
  label?: string;
}

const statusConfig: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  green: { bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500', label: 'Verde' },
  yellow: { bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-500', label: 'Amarelo' },
  red: { bg: 'bg-red-100', text: 'text-red-800', dot: 'bg-red-500', label: 'Vermelho' },
  paid: { bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500', label: 'Pago' },
  pending: { bg: 'bg-blue-100', text: 'text-blue-800', dot: 'bg-blue-500', label: 'Pendente' },
  overdue: { bg: 'bg-red-100', text: 'text-red-800', dot: 'bg-red-500', label: 'Vencido' },
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
