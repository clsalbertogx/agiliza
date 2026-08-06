'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';

// Mirrors the API regex (createTenantSchema): lowercase alphanumeric + hyphens.
const SLUG_REGEX = /^[a-z0-9-]+$/;

interface SignupResponse {
  data: { tenant: { id: string } };
  token: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [email, setEmail] = useState('');
  const [slugError, setSlugError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setApiError(null);

    if (!SLUG_REGEX.test(slug)) {
      setSlugError('Slug deve conter apenas letras minúsculas, números e hífens.');
      return;
    }
    setSlugError(null);
    setSubmitting(true);

    try {
      const res = await api.post<SignupResponse>('/api/tenants', { name, slug, email });
      localStorage.setItem('auth_token', res.token);
      localStorage.setItem('tenant_id', res.data.tenant.id);
      router.push('/dashboard');
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Erro ao criar conta. Tente novamente.');
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="text-lg font-semibold leading-none tracking-tight text-gray-900">Criar conta</h1>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Sua empresa"
                autoComplete="organization"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="sua-empresa"
                autoComplete="off"
                aria-invalid={slugError ? true : undefined}
                required
              />
              {slugError && (
                <p role="alert" className="text-sm text-red-600">
                  {slugError}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@empresa.com"
                autoComplete="email"
                required
              />
            </div>
            {apiError && (
              <p role="alert" className="text-sm text-red-600">
                {apiError}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Criando conta...' : 'Criar conta'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
