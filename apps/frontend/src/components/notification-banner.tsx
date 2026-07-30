'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, AlertTriangle, Info, X, Loader2 } from 'lucide-react';

export type BannerType = 'success' | 'error' | 'warning' | 'info';

export interface NotificationBannerProps {
  type: BannerType;
  title: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  onDismiss?: () => void;
  autoDismiss?: number;
  isLoading?: boolean;
  className?: string;
}

const bannerConfig: Record<
  BannerType,
  { icon: React.ReactNode; bg: string; border: string; iconColor: string; textColor: string }
> = {
  success: {
    icon: <CheckCircle className="w-5 h-5" aria-hidden="true" />,
    bg: 'bg-success-50',
    border: 'border-success-200',
    iconColor: 'text-success-500',
    textColor: 'text-success-800',
  },
  error: {
    icon: <XCircle className="w-5 h-5" aria-hidden="true" />,
    bg: 'bg-danger-50',
    border: 'border-danger-200',
    iconColor: 'text-danger-500',
    textColor: 'text-danger-800',
  },
  warning: {
    icon: <AlertTriangle className="w-5 h-5" aria-hidden="true" />,
    bg: 'bg-warning-50',
    border: 'border-warning-200',
    iconColor: 'text-warning-500',
    textColor: 'text-warning-800',
  },
  info: {
    icon: <Info className="w-5 h-5" aria-hidden="true" />,
    bg: 'bg-info-50',
    border: 'border-info-200',
    iconColor: 'text-info-500',
    textColor: 'text-info-800',
  },
};

export function NotificationBanner({
  type,
  title,
  message,
  action,
  onDismiss,
  autoDismiss = 0,
  isLoading = false,
  className,
}: NotificationBannerProps) {
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(100);
  const config = bannerConfig[type];
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    setTimeout(() => onDismiss?.(), 300);
  }, [onDismiss]);

  useEffect(() => {
    if (autoDismiss <= 0) return;

    const interval = 50;
    const step = (interval / autoDismiss) * 100;
    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        const next = prev - step;
        if (next <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleDismiss();
          return 0;
        }
        return next;
      });
    }, interval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoDismiss, handleDismiss]);

  if (!visible) return null;

  const isAlert = type === 'error' || type === 'warning';
  const role = isAlert ? 'alert' : 'status';
  const liveRegion = isAlert ? 'assertive' : 'polite';

  return (
    <div
      className={`relative rounded-xl border ${config.bg} ${config.border} overflow-hidden transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      } ${className ?? ''}`}
      role={role}
      aria-live={liveRegion}
    >
      <div className="flex items-start gap-3 p-4">
        <div className={`flex-shrink-0 mt-0.5 ${config.iconColor}`}>
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
          ) : (
            config.icon
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${config.textColor}`}>
            {isLoading ? 'Processando...' : title}
          </p>
          {message && (
            <p className={`text-sm mt-1 ${config.textColor} opacity-90`}>
              {message}
            </p>
          )}
          {action && !isLoading && (
            <Button
              variant="outline"
              size="sm"
              onClick={action.onClick}
              className="mt-2"
            >
              {action.label}
            </Button>
          )}
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={handleDismiss}
            className={`flex-shrink-0 p-1 rounded-md hover:bg-black/5 transition-colors ${config.textColor}`}
            aria-label="Fechar notificação"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {autoDismiss > 0 && (
        <div
          className="h-1 bg-black/10"
          role="progressbar"
          aria-label="Tempo restante para notificação fechar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-black/20 transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
