'use client';

import { Check, Clock, Copy, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorState } from '@/components/error-state';
import { PaymentStatus } from '@/components/payment-status';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export interface PixData {
  qrCodeBase64: string;
  copyPasteKey: string;
  expiresAt: string;
  amount: number;
  invoiceId: string;
}

export type PaymentPollStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'expired';

export interface PixPaymentFlowProps {
  invoiceId: string;
  pixData: PixData;
  pollStatus?: PaymentPollStatus;
  onPaid: () => void;
  onExpired?: () => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  error?: string | null;
}

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDateTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function useCountdown(expiresAt: string): { remaining: number; formatted: string; isExpired: boolean } {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      setRemaining(Math.max(0, Math.floor(diff / 1000)));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return { remaining, formatted, isExpired: remaining <= 0 };
}

export function PixPaymentFlow({
  invoiceId,
  pixData,
  pollStatus = 'pending',
  onPaid,
  onExpired,
  onError,
  onCancel,
  isLoading = false,
  error = null,
}: PixPaymentFlowProps) {
  const [copied, setCopied] = useState(false);
  const [_fadingOut, setFadingOut] = useState(false);
  const [pollTimer, setPollTimer] = useState(0);
  const statusRef = useRef<HTMLDivElement>(null);

  const { remaining, formatted, isExpired } = useCountdown(pixData.expiresAt);
  const showExpired = isExpired || pollStatus === 'expired';

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(pixData.copyPasteKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onError?.('Não foi possível copiar o código PIX');
    }
  }, [pixData.copyPasteKey, onError]);

  // Poll timer tracking
  useEffect(() => {
    if (pollStatus === 'pending') {
      const interval = setInterval(() => {
        setPollTimer((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [pollStatus]);

  // Announce status every 30s
  useEffect(() => {
    if (pollStatus !== 'pending' || remaining <= 0) return;
    if (remaining > 0 && remaining % 30 === 0) {
      const node = statusRef.current;
      if (node) {
        node.textContent = `Aguardando pagamento. Faltam ${formatted} para o QR Code expirar.`;
      }
    }
  }, [remaining, pollStatus, formatted]);

  useEffect(() => {
    if (pollStatus === 'paid') {
      setFadingOut(true);
    }
  }, [pollStatus]);

  if (isLoading) {
    return (
      <div role="status" aria-label="Carregando PIX">
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex flex-col items-center gap-4">
            <div className="w-64 h-64 bg-gray-200 rounded-xl animate-pulse" aria-hidden="true" />
            <div className="h-10 w-48 bg-gray-200 rounded-lg animate-pulse" aria-hidden="true" />
            <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" aria-hidden="true" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} {...(onCancel ? { onRetry: undefined } : {})} />;
  }

  // Paid state
  if (pollStatus === 'paid') {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="flex flex-col items-center gap-4" role="alert" aria-live="assertive">
            <div className="w-20 h-20 rounded-full bg-success-100 flex items-center justify-center">
              <Check className="w-10 h-10 text-success-600" aria-hidden="true" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Pagamento Confirmado!</h3>
            <div className="bg-success-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-success-700">{formatBRL(pixData.amount)}</p>
              <p className="text-sm text-success-600 mt-1">Pago em {formatDateTime(new Date().toISOString())}</p>
            </div>
            <Button variant="primary" onClick={onPaid}>
              Voltar para faturas
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Expired state
  if (showExpired) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-warning-100 flex items-center justify-center">
              <Clock className="w-8 h-8 text-warning-600" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">QR Code Expirado</h3>
            <p className="text-sm text-gray-500">O código PIX expirou em {formatDateTime(pixData.expiresAt)}</p>
            <div className="flex gap-3 mt-2">
              <Button variant="primary" onClick={() => onExpired?.()}>
                Gerar novo QR Code
              </Button>
              {onCancel && (
                <Button variant="outline" onClick={onCancel}>
                  Cancelar pagamento
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Default: Pending / Processing state
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col items-center gap-5">
          {/* Amount */}
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-1">Valor</p>
            <p className="text-2xl font-bold text-gray-900">{formatBRL(pixData.amount)}</p>
          </div>

          {/* QR Code */}
          <div className={`relative ${pollStatus === 'processing' ? 'opacity-50' : ''}`}>
            {/* biome-ignore lint/performance/noImgElement: dynamically-generated base64 PNG QR code; next/image cannot optimize data URIs */}
            <img
              src={`data:image/png;base64,${pixData.qrCodeBase64}`}
              alt="QR Code para pagamento PIX"
              className="w-64 h-64 rounded-xl border border-gray-200"
            />
            {pollStatus === 'processing' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-primary-500 animate-spin" aria-hidden="true" />
              </div>
            )}
          </div>

          {/* Copy button */}
          <div className="w-full max-w-sm">
            <div className="flex gap-2">
              <code aria-label="Chave PIX para copiar" className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700 truncate">
                {pixData.copyPasteKey}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                aria-label={copied ? 'Copiado' : 'Copiar código PIX'}
              >
                {copied ? (
                  <Check className="w-4 h-4 text-success-500" aria-hidden="true" />
                ) : (
                  <Copy className="w-4 h-4" aria-hidden="true" />
                )}
                <span className="sr-only">{copied ? 'Copiado' : 'Copiar'}</span>
              </Button>
            </div>
            <p className="text-xs text-gray-400 mt-1 text-center">
              {copied ? (
                <span className="text-success-600 font-medium" aria-live="polite">
                  Copiado!
                </span>
              ) : (
                'Clique no botão para copiar o código'
              )}
            </p>
          </div>

          {/* Countdown */}
          <div className="flex items-center gap-2 text-sm" aria-live="polite">
            <Clock className="w-4 h-4 text-gray-400" aria-hidden="true" />
            <span className={remaining <= 60 ? 'text-danger-600 font-semibold' : 'text-gray-600'}>
              Expira em {formatted}
            </span>
          </div>

          {/* Polling status */}
          <div ref={statusRef} role="status" aria-live="polite">
            <PaymentStatus status={pollStatus === 'processing' ? 'processing' : 'pending'} />
          </div>

          {/* Manual check / Cancel */}
          <div className="flex gap-3">
            {pollStatus === 'pending' && pollTimer > 30 && (
              <Button variant="outline" size="sm" onClick={() => setPollTimer(0)}>
                Verificar manualmente
              </Button>
            )}
            {onCancel && (
              <Button variant="ghost" size="sm" onClick={onCancel}>
                Cancelar
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
