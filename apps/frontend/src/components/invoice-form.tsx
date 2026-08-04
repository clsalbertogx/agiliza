'use client';

import { Calendar, DollarSign, Loader2, Search, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorState } from '@/components/error-state';
import { LoadingSkeleton } from '@/components/loading-skeleton';
import { RiskBadge } from '@/components/risk-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export interface InvoiceFormClient {
  id: string;
  name: string;
  phone: string;
  riskScore: 'green' | 'yellow' | 'red';
}

export interface InvoiceFormData {
  clientId: string;
  amount: number;
  dueDate: string;
  paymentMethod: 'pix' | 'boleto' | 'credit_card';
  description?: string;
}

export interface InvoiceFormProps {
  clients: InvoiceFormClient[];
  initialData?: Partial<InvoiceFormData>;
  onSubmit: (data: InvoiceFormData) => Promise<void> | void;
  onCancel?: () => void;
  isLoading?: boolean;
  error?: string | null;
  fieldErrors?: Partial<Record<keyof InvoiceFormData, string>>;
  submitLabel?: string;
  isSubmitting?: boolean;
}

const paymentMethods: { value: InvoiceFormData['paymentMethod']; label: string }[] = [
  { value: 'pix', label: 'PIX' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'credit_card', label: 'Cartão' },
];

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseBRLtoNumber(input: string): number {
  const cleaned = input.replace(/[^\d,]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

function formatDateInput(dateString: string): string {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return dateString;
  return d.toISOString().split('T')[0];
}

function todayString(): string {
  return new Date().toISOString().split('T')[0];
}

export function InvoiceForm({
  clients,
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
  error = null,
  fieldErrors = {},
  submitLabel = 'Criar Fatura',
  isSubmitting = false,
}: InvoiceFormProps) {
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<InvoiceFormClient | null>(
    initialData?.clientId ? (clients.find((c) => c.id === initialData.clientId) ?? null) : null,
  );
  const [showDropdown, setShowDropdown] = useState(false);
  const [amountText, setAmountText] = useState(initialData?.amount ? formatBRL(initialData.amount) : '');
  const [dueDate, setDueDate] = useState(initialData?.dueDate ? formatDateInput(initialData.dueDate) : '');
  const [paymentMethod, setPaymentMethod] = useState<InvoiceFormData['paymentMethod']>(
    initialData?.paymentMethod ?? 'pix',
  );
  const [description, setDescription] = useState(initialData?.description ?? '');

  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredClients =
    clientSearch.length >= 2
      ? clients.filter(
          (c) => c.name.toLowerCase().includes(clientSearch.toLowerCase()) || c.phone.includes(clientSearch),
        )
      : [];

  const handleSelectClient = useCallback((client: InvoiceFormClient) => {
    setSelectedClient(client);
    setClientSearch('');
    setShowDropdown(false);
  }, []);

  const handleRemoveClient = useCallback(() => {
    setSelectedClient(null);
    setClientSearch('');
  }, []);

  const handleAmountBlur = useCallback(() => {
    const num = parseBRLtoNumber(amountText);
    if (num > 0) {
      setAmountText(formatBRL(num));
    }
  }, [amountText]);

  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (/^[\d,]*$/.test(val.replace('R$ ', '').replace(/\./g, ''))) {
      setAmountText(val);
    }
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const amount = parseBRLtoNumber(amountText);
      if (!selectedClient) return;
      onSubmit({
        clientId: selectedClient.id,
        amount,
        dueDate,
        paymentMethod,
        description: description || undefined,
      });
    },
    [onSubmit, selectedClient, amountText, dueDate, paymentMethod, description],
  );

  if (isLoading) {
    return <LoadingSkeleton variant="card" />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  const isFormValid = selectedClient && parseBRLtoNumber(amountText) > 0 && dueDate;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{initialData ? 'Editar Fatura' : 'Nova Fatura'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          {/* Client selector */}
          <div className="space-y-2">
            <Label htmlFor="client-search">
              Cliente <span className="text-danger-500">*</span>
            </Label>
            <div ref={searchRef} className="relative">
              {selectedClient ? (
                <div className="flex items-center gap-2 p-2 rounded-lg border border-gray-300 bg-gray-50">
                  <span className="flex-1 text-sm text-gray-900">{selectedClient.name}</span>
                  <RiskBadge level={selectedClient.riskScore} />
                  <button
                    type="button"
                    onClick={handleRemoveClient}
                    className="p-1 hover:bg-gray-200 rounded-full transition-colors"
                    aria-label={`Remover ${selectedClient.name}`}
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                    aria-hidden="true"
                  />
                  <Input
                    id="client-search"
                    type="text"
                    placeholder="Buscar cliente..."
                    value={clientSearch}
                    onChange={(e) => {
                      setClientSearch(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    role="combobox"
                    aria-expanded={showDropdown}
                    aria-autocomplete="list"
                    className="pl-9"
                  />
                </div>
              )}

              {showDropdown && filteredClients.length > 0 && (
                <ul role="listbox" className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                  {filteredClients.map((client) => (
                    <li key={client.id}>
                      <button
                        type="button"
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => handleSelectClient(client)}
                        aria-pressed={selectedClient?.id === client.id}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{client.name}</p>
                          <p className="text-xs text-gray-500">{client.phone}</p>
                        </div>
                        <RiskBadge level={client.riskScore} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {showDropdown && clientSearch.length >= 2 && filteredClients.length === 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-center text-sm text-gray-500">
                  Nenhum cliente encontrado
                </div>
              )}
            </div>
            {fieldErrors.clientId && (
              <p className="text-xs text-danger-600 mt-1" role="alert">
                {fieldErrors.clientId}
              </p>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">
              Valor <span className="text-danger-500">*</span>
            </Label>
            <div className="relative">
              <DollarSign
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                aria-hidden="true"
              />
              <Input
                id="amount"
                type="text"
                placeholder="R$ 1.500,00"
                value={amountText}
                onChange={handleAmountChange}
                onBlur={handleAmountBlur}
                aria-required="true"
                className="pl-9"
                inputMode="decimal"
              />
            </div>
            {fieldErrors.amount && (
              <p className="text-xs text-danger-600 mt-1" role="alert">
                {fieldErrors.amount}
              </p>
            )}
          </div>

          {/* Due date */}
          <div className="space-y-2">
            <Label htmlFor="due-date">
              Data de Vencimento <span className="text-danger-500">*</span>
            </Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
              <Input
                id="due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                min={todayString()}
                aria-required="true"
                className="pl-9"
              />
            </div>
            {fieldErrors.dueDate && (
              <p className="text-xs text-danger-600 mt-1" role="alert">
                {fieldErrors.dueDate}
              </p>
            )}
          </div>

          {/* Payment method */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-gray-700">
              Método de Pagamento <span className="text-danger-500">*</span>
            </legend>
            <div className="flex flex-wrap gap-3">
              {paymentMethods.map((method) => (
                <label
                  key={method.value}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                    paymentMethod === method.value
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={method.value}
                    checked={paymentMethod === method.value}
                    onChange={(e) => setPaymentMethod(e.target.value as InvoiceFormData['paymentMethod'])}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium">{method.label}</span>
                </label>
              ))}
            </div>
            {fieldErrors.paymentMethod && (
              <p className="text-xs text-danger-600 mt-1" role="alert">
                {fieldErrors.paymentMethod}
              </p>
            )}
          </fieldset>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Textarea
              id="description"
              placeholder="Mensalidade Agosto/2026"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Voltar
              </Button>
            )}
            <Button type="submit" variant="primary" disabled={!isFormValid || isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  {submitLabel}
                </>
              ) : (
                submitLabel
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
