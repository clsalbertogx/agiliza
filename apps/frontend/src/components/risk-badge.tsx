'use client';

import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';

interface RiskBadgeProps {
  level: 'green' | 'yellow' | 'red';
  probability?: number;
  reason?: string;
}

export const levelToVariant: Record<string, 'success' | 'warning' | 'danger'> = {
  green: 'success',
  yellow: 'warning',
  red: 'danger',
};

export const levelLabel: Record<string, string> = {
  green: 'Baixo Risco',
  yellow: 'Médio Risco',
  red: 'Alto Risco',
};

export function RiskBadge({ level, probability, reason }: RiskBadgeProps) {
  const variant = levelToVariant[level];
  const label = levelLabel[level];
  const tooltipParts: string[] = [];
  if (probability !== undefined) {
    tooltipParts.push(`Probabilidade: ${(probability * 100).toFixed(0)}%`);
  }
  if (reason) {
    tooltipParts.push(`Motivo: ${reason}`);
  }
  const tooltipText = tooltipParts.join(' | ');

  const [isVisible, setIsVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsVisible(false);
        buttonRef.current?.focus();
      }
    };

    if (isVisible) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible]);

  const showTooltip = () => {
    if (tooltipText) setIsVisible(true);
  };

  const hideTooltip = () => setIsVisible(false);

  const handleFocus = () => {
    setIsFocused(true);
    if (tooltipText) setIsVisible(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    setTimeout(() => setIsVisible(false), 100);
  };

  return (
    <span className="inline-flex relative">
      <button
        ref={buttonRef}
        type="button"
        tabIndex={0}
        aria-describedby={tooltipText ? 'risk-badge-tooltip' : undefined}
        aria-label={`${label}${probability !== undefined ? `, probabilidade ${(probability * 100).toFixed(0)}%` : ''}${reason ? `, motivo: ${reason}` : ''}`}
        className="inline-flex group focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded"
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={handleFocus}
        onBlur={handleBlur}
      >
        <Badge variant={variant}>{label}</Badge>
      </button>
      {tooltipText && (
        <div
          id="risk-badge-tooltip"
          ref={tooltipRef}
          role="tooltip"
          className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 text-xs text-white bg-gray-900 rounded-lg shadow-sm transition-opacity pointer-events-none whitespace-nowrap z-10 ${
            isVisible || isFocused ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {tooltipText}
          <span
            className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"
            aria-hidden="true"
          />
        </div>
      )}
    </span>
  );
}
