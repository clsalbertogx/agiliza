'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

type PaymentProvider = 'asaas' | 'mercadopago' | 'pagbank' | 'polar';
type Environment = 'sandbox' | 'production';

interface PaymentProviderConfig {
  provider: PaymentProvider;
  hasApiKey: boolean;
  environment: Environment;
}

export default function SettingsPage() {
  const [provider, setProvider] = useState<PaymentProvider>('asaas');
  const [apiKey, setApiKey] = useState('');
  const [environment, setEnvironment] = useState<Environment>('sandbox');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: PaymentProviderConfig }>('/api/tenants/demo/payment-provider');
      if (res.data) {
        setProvider(res.data.provider);
        setEnvironment(res.data.environment);
      }
    } catch {
      // No config yet — that's ok
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await api.put('/api/tenants/demo/payment-provider', {
        provider,
        apiKey,
        environment,
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
                onChange={(e) => setProvider(e.target.value as PaymentProvider)}
                className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="asaas">Asaas</option>
                <option value="mercadopago">Mercado Pago</option>
                <option value="pagbank">PagBank</option>
                <option value="polar">Polar</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sua_chave_api"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="environment">Ambiente</Label>
              <select
                id="environment"
                value={environment}
                onChange={(e) => setEnvironment(e.target.value as Environment)}
                className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="sandbox">Sandbox</option>
                <option value="production">Produção</option>
              </select>
            </div>

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