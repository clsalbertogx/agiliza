'use client';

import { Card, CardContent } from '@/components/ui/card';

export interface ClientCardClient {
  name: string;
  phone: string;
  email: string;
  riskScore: 'green' | 'yellow' | 'red';
}

interface ClientCardProps {
  client: ClientCardClient;
  onSelect?: () => void;
}

const riskDotColors: Record<string, string> = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
};

const riskLabel: Record<string, string> = {
  green: 'Baixo risco',
  yellow: 'Médio risco',
  red: 'Alto risco',
};

function maskPhone(phone: string): string {
  return phone.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3');
}

export function ClientCard({ client, onSelect }: ClientCardProps) {
  return (
    <Card
      className={onSelect ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}
      onClick={onSelect}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={
        onSelect
          ? (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect();
              }
            }
          : undefined
      }
      aria-label={onSelect ? `Ver detalhes de ${client.name}` : undefined}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-gray-900 truncate">{client.name}</h3>
            <p className="text-sm text-gray-500 mt-1 truncate">{maskPhone(client.phone)}</p>
            <p className="text-sm text-gray-500 truncate">{client.email}</p>
          </div>
          <div className="flex flex-col items-center gap-1 ml-3" aria-label={riskLabel[client.riskScore]}>
            <span className={`w-3 h-3 rounded-full ${riskDotColors[client.riskScore]}`} aria-hidden="true" />
            <span className="text-[10px] uppercase font-medium text-gray-400">{client.riskScore}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
