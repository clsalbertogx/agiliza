'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';

type Environment = 'sandbox' | 'production';

type ProviderField = string;

interface ProviderDefinition {
  value: string;
  label: string;
  fields: ProviderField[];
}

const PROVIDERS: ProviderDefinition[] = [
  { value: 'asaas', label: 'Asaas', fields: ['apiKey', 'environment'] },
  { value: 'mercadopago', label: 'Mercado Pago', fields: ['accessToken', 'environment'] },
  { value: 'stripe', label: 'Stripe', fields: ['secretKey', 'publishableKey', 'webhookSecret', 'environment'] },
  { value: 'pagbank', label: 'PagBank', fields: ['accessToken', 'environment'] },
  { value: 'polar', label: 'Polar', fields: ['accessToken', 'environment'] },
];

const SECRET_FIELDS = new Set(['apiKey', 'accessToken', 'secretKey', 'webhookSecret']);

const FIELD_LABELS: Record<string, string> = {
  apiKey: 'API Key',
  accessToken: 'Access Token',
  secretKey: 'Secret Key',
  publishableKey: 'Publishable Key',
  webhookSecret: 'Webhook Secret',
  environment: 'Ambiente',
};

const REQUIRED_FIELDS_BY_PROVIDER: Record<string, string[]> = {
  asaas: ['apiKey'],
  mercadopago: ['accessToken'],
  stripe: ['secretKey', 'publishableKey'],
  pagbank: ['accessToken'],
  polar: ['accessToken'],
};

type FieldValueMap = Record<string, string>;

interface PaymentConfigResponse {
  provider: string;
  environment: string;
  [key: string]: unknown;
}

export default function SettingsPage() {
  const [provider, setProvider] = useState<string>('asaas');
  const [config, setConfig] = useState<FieldValueMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const currentProvider = useMemo<ProviderDefinition>(
    () => PROVIDERS.find((p) => p.value === provider) ?? PROVIDERS[0]!,
    [provider],
  );

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: PaymentConfigResponse }>('/api/tenants/demo/payment-config');
      if (res.data) {
        setProvider(res.data.provider);
        const loaded: FieldValueMap = {};
        for (const [key, value] of Object.entries(res.data)) {
          if (key === 'provider') continue;
          if (typeof value === 'string') {
            loaded[key] = value;
          }
        }
        setConfig(loaded);
      }
    } catch {
      // No config yet — that's ok
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  function handleProviderChange(newProvider: string) {
    setProvider(newProvider);
    setConfig({ environment: 'sandbox' });
    setValidationErrors([]);
    setSaved(false);
    setError(null);
  }

  function handleFieldChange(field: string, value: string) {
    setConfig((prev) => ({ ...prev, [field]: value }));
    setValidationErrors([]);
  }

  function validate(): string[] {
    const required = REQUIRED_FIELDS_BY_PROVIDER[provider] ?? [];
    const missing: string[] = [];
    for (const field of required) {
      if (!config[field] || config[field]!.trim().length === 0) {
        missing.push(FIELD_LABELS[field] ?? field);
      }
    }
    return missing;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const missing = validate();
    if (missing.length > 0) {
      setValidationErrors(missing);
      return;
    }
    setValidationErrors([]);

    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await api.put('/api/tenants/demo/payment-config', {
        provider,
        ...config,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar configuração');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Configurações</h1>
        <Card>
          <CardHeader>
            <CardTitle>Gateway de Pagamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-24" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Configurações</h1>

      <Card>
        <CardHeader>
          <CardTitle>Gateway de Pagamento</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="provider">Provedor</Label>
              <select
                id="provider"
                value={provider}
                onChange={(e) => handleProviderChange(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {currentProvider.fields.map((field) => {
              if (field === 'environment') {
                return (
                  <div key={field} className="space-y-2">
                    <Label htmlFor={field}>{FIELD_LABELS[field] ?? field}</Label>
                    <select
                      id={field}
                      value={config[field] ?? 'sandbox'}
                      onChange={(e) => handleFieldChange(field, e.target.value)}
                      className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="sandbox">Sandbox</option>
                      <option value="production">Produção</option>
                    </select>
                  </div>
                );
              }

              const isSecret = SECRET_FIELDS.has(field);
              return (
                <div key={field} className="space-y-2">
                  <Label htmlFor={field}>{FIELD_LABELS[field] ?? field}</Label>
                  <Input
                    id={field}
                    type={isSecret ? 'password' : 'text'}
                    value={config[field] ?? ''}
                    onChange={(e) => handleFieldChange(field, e.target.value)}
                    placeholder={isSecret ? '••••••••' : ''}
                  />
                </div>
              );
            })}

            {validationErrors.length > 0 && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md" role="alert">
                <p className="font-medium">Campos obrigatórios:</p>
                <ul className="list-disc list-inside">
                  {validationErrors.map((field) => (
                    <li key={field}>{field}</li>
                  ))}
                </ul>
              </div>
            )}

            {error && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md" role="alert">
                {error}
              </div>
            )}

            {saved && (
              <div className="text-green-600 text-sm bg-green-50 p-3 rounded-md" role="status">
                Configuração salva com sucesso!
              </div>
            )}

            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
