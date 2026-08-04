'use client';

import { Check, ChevronLeft, ChevronRight, Loader2, Mail, MessageCircle, MessageSquare } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { ErrorState } from '@/components/error-state';
import { LoadingSkeleton } from '@/components/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export interface OnboardingWizardData {
  clientId: string;
  preferredChannel: 'whatsapp' | 'email' | 'sms';
  preferredTime: string;
  preferredLeadDays: number;
}

export interface OnboardingWizardProps {
  clientId: string;
  initialData?: {
    preferredChannel?: 'whatsapp' | 'email' | 'sms';
    preferredTime?: string;
    preferredLeadDays?: number;
  };
  onComplete: (data: OnboardingWizardData) => void;
  onClose?: () => void;
  isLoading?: boolean;
  error?: string | null;
}

const channelOptions: {
  value: 'whatsapp' | 'email' | 'sms';
  icon: React.ReactNode;
  label: string;
  description: string;
}[] = [
  {
    value: 'whatsapp',
    icon: <MessageCircle className="w-6 h-6" aria-hidden="true" />,
    label: 'WhatsApp',
    description: 'Mensagens instantâneas com alta taxa de abertura',
  },
  {
    value: 'email',
    icon: <Mail className="w-6 h-6" aria-hidden="true" />,
    label: 'Email',
    description: 'Comunicação formal com registro escrito',
  },
  {
    value: 'sms',
    icon: <MessageSquare className="w-6 h-6" aria-hidden="true" />,
    label: 'SMS',
    description: 'Alternativa para clientes sem WhatsApp',
  },
];

const stepLabels = ['Canal', 'Horário', 'Lead'];

export function OnboardingWizard({
  clientId,
  initialData,
  onComplete,
  onClose,
  isLoading = false,
  error = null,
}: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [channel, setChannel] = useState<'whatsapp' | 'email' | 'sms'>(initialData?.preferredChannel ?? 'whatsapp');
  const [time, setTime] = useState(initialData?.preferredTime ?? '18:00');
  const [leadDays, setLeadDays] = useState(initialData?.preferredLeadDays ?? 5);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const stepTitleRef = useRef<HTMLHeadingElement>(null);

  const handleNext = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    const next = currentStep + 1;
    setCurrentStep(next);
    setTimeout(() => {
      setIsTransitioning(false);
      stepTitleRef.current?.focus();
    }, 300);
  }, [currentStep, isTransitioning]);

  const handleBack = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    const prev = currentStep - 1;
    setCurrentStep(prev);
    setTimeout(() => {
      setIsTransitioning(false);
      stepTitleRef.current?.focus();
    }, 300);
  }, [currentStep, isTransitioning]);

  const handleComplete = useCallback(() => {
    setIsCompleting(true);
    onComplete({
      clientId,
      preferredChannel: channel,
      preferredTime: time,
      preferredLeadDays: leadDays,
    });
  }, [clientId, channel, time, leadDays, onComplete]);

  if (isLoading) {
    return <LoadingSkeleton variant="card" />;
  }

  if (error) {
    return <ErrorState message={error || 'Não foi possível carregar dados do cliente'} onRetry={onClose} />;
  }

  const progressPercent = ((currentStep + 1) / 3) * 100;

  return (
    <Card>
      <CardContent className="p-6">
        {/* Progress indicator */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden"
            role="progressbar"
            aria-label={`Passo ${currentStep + 1} de 3`}
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full bg-primary-500 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-sm text-gray-500 font-medium whitespace-nowrap">Etapa {currentStep + 1} de 3</span>
        </div>

        {/* Step content */}
        <fieldset>
          <legend className="sr-only">{stepLabels[currentStep]}</legend>

          {/* Step 1: Channel */}
          {currentStep === 0 && (
            <div className="space-y-4">
              <h3 ref={stepTitleRef} tabIndex={-1} className="text-lg font-semibold text-gray-900 mb-4 outline-none">
                Qual o canal preferido?
              </h3>
              <div className="space-y-3">
                {channelOptions.map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-colors ${
                      channel === option.value
                        ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="channel"
                      value={option.value}
                      checked={channel === option.value}
                      onChange={(e) => {
                        if (e.target.checked) setChannel(option.value);
                      }}
                      className="sr-only"
                    />
                    <div className={`flex-shrink-0 ${channel === option.value ? 'text-primary-600' : 'text-gray-400'}`}>
                      {option.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{option.label}</p>
                      <p className="text-xs text-gray-500" id={`channel-desc-${option.value}`}>
                        {option.description}
                      </p>
                    </div>
                    {channel === option.value && (
                      <Check className="w-5 h-5 text-primary-600 flex-shrink-0" aria-hidden="true" />
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Time */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h3 ref={stepTitleRef} tabIndex={-1} className="text-lg font-semibold text-gray-900 mb-4 outline-none">
                Qual o melhor horário?
              </h3>
              <p className="text-sm text-gray-500 mb-2">Horário que o cliente prefere receber mensagens.</p>
              <div className="max-w-xs">
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-gray-300 bg-white text-gray-900 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  aria-label="Horário preferido"
                />
              </div>
            </div>
          )}

          {/* Step 3: Lead Days */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <h3 ref={stepTitleRef} tabIndex={-1} className="text-lg font-semibold text-gray-900 mb-4 outline-none">
                Quantos dias antes?
              </h3>
              <p className="text-sm text-gray-500 mb-2">Quantos dias antes do vencimento iniciar a cobrança?</p>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setLeadDays((prev) => Math.max(1, prev - 1))}
                  className="w-12 h-12 rounded-xl border border-gray-300 bg-white text-gray-700 text-lg font-bold hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
                  aria-label="Diminuir dias"
                >
                  -
                </button>
                <span
                  className="w-20 text-center text-2xl font-bold text-gray-900 tabular-nums"
                  aria-live="polite"
                  aria-label={`${leadDays} dias antes do vencimento`}
                >
                  {leadDays}
                </span>
                <button
                  type="button"
                  onClick={() => setLeadDays((prev) => Math.min(15, prev + 1))}
                  className="w-12 h-12 rounded-xl border border-gray-300 bg-white text-gray-700 text-lg font-bold hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
                  aria-label="Aumentar dias"
                >
                  +
                </button>
                <span className="text-sm text-gray-500">dias</span>
              </div>
              <p className="text-xs text-gray-400">Mínimo: 1 dia | Máximo: 15 dias</p>
            </div>
          )}
        </fieldset>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between mt-8 pt-4 border-t border-gray-100">
          <div>
            {currentStep > 0 ? (
              <Button variant="outline" onClick={handleBack} disabled={isTransitioning}>
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                Voltar
              </Button>
            ) : (
              onClose && (
                <Button variant="ghost" onClick={onClose}>
                  Cancelar
                </Button>
              )
            )}
          </div>

          <div>
            {currentStep < 2 ? (
              <Button variant="primary" onClick={handleNext} disabled={isTransitioning}>
                Avançar
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </Button>
            ) : (
              <Button variant="primary" onClick={handleComplete} disabled={isCompleting}>
                {isCompleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Check className="w-4 h-4" aria-hidden="true" />
                )}
                Concluir
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
