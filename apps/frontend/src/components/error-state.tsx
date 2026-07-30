'use client';

import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  details?: string;
}

export function ErrorState({ message, onRetry, details }: ErrorStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
      role="alert"
      aria-live="assertive"
    >
      <AlertTriangle className="w-16 h-16 text-danger-400 mb-4" aria-hidden="true" />
      <h3 className="text-lg font-semibold text-gray-800 mb-1">
        Não foi possível carregar os dados
      </h3>
      <p className="text-sm text-danger-600 mb-2">{message}</p>
      {details && (
        <p className="text-xs text-gray-400 mb-6 max-w-xs">{details}</p>
      )}
      {!details && <div className="mb-6" />}
      {onRetry && (
        <Button variant="primary" onClick={onRetry}>
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
