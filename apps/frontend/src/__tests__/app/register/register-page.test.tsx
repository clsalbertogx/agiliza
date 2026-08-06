import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPost = vi.hoisted(() => vi.fn());
const mockPush = vi.hoisted(() => vi.fn());
const mockSetItem = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => ({
  api: {
    post: mockPost,
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() }),
}));

import RegisterPage from '@/app/register/page';

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => null),
        setItem: mockSetItem,
      },
      writable: true,
    });
  });

  it('renderiza os campos do formulário e o botão de submit', () => {
    render(<RegisterPage />);

    expect(screen.getByLabelText(/nome/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/slug/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /criar conta/i })).toBeInTheDocument();
  });

  it('envia name, slug e email via api.post ao submeter', async () => {
    mockPost.mockResolvedValue({ data: { tenant: { id: 't1' } }, token: 'jwt-token' });
    const user = userEvent.setup();

    render(<RegisterPage />);

    await user.type(screen.getByLabelText(/nome/i), 'Test Tenant');
    await user.type(screen.getByLabelText(/slug/i), 'test-tenant');
    await user.type(screen.getByLabelText(/email/i), 'tenant@example.com');
    await user.click(screen.getByRole('button', { name: /criar conta/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/api/tenants', {
        name: 'Test Tenant',
        slug: 'test-tenant',
        email: 'tenant@example.com',
      });
    });
  });

  it('armazena o token e o tenant_id retornados e redireciona para /dashboard', async () => {
    mockPost.mockResolvedValue({ data: { tenant: { id: 't1' } }, token: 'jwt-token' });
    const user = userEvent.setup();

    render(<RegisterPage />);

    await user.type(screen.getByLabelText(/nome/i), 'Test Tenant');
    await user.type(screen.getByLabelText(/slug/i), 'test-tenant');
    await user.type(screen.getByLabelText(/email/i), 'tenant@example.com');
    await user.click(screen.getByRole('button', { name: /criar conta/i }));

    await waitFor(() => {
      expect(mockSetItem).toHaveBeenCalledWith('auth_token', 'jwt-token');
      expect(mockSetItem).toHaveBeenCalledWith('tenant_id', 't1');
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('deve renderizar exatamente um h1 "Criar conta"', () => {
    render(<RegisterPage />);

    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent('Criar conta');
  });

  it('mostra erro de validação client-side para slug inválido e não chama a API', async () => {
    const user = userEvent.setup();

    render(<RegisterPage />);

    await user.type(screen.getByLabelText(/nome/i), 'Test Tenant');
    await user.type(screen.getByLabelText(/slug/i), 'Test Slug'); // maiúscula + espaço
    await user.type(screen.getByLabelText(/email/i), 'tenant@example.com');
    await user.click(screen.getByRole('button', { name: /criar conta/i }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('mostra a mensagem de erro da API quando a requisição falha (ex: 409 slug duplicado)', async () => {
    mockPost.mockRejectedValue(new Error('Slug already in use'));
    const user = userEvent.setup();

    render(<RegisterPage />);

    await user.type(screen.getByLabelText(/nome/i), 'Test Tenant');
    await user.type(screen.getByLabelText(/slug/i), 'test-tenant');
    await user.type(screen.getByLabelText(/email/i), 'tenant@example.com');
    await user.click(screen.getByRole('button', { name: /criar conta/i }));

    expect(await screen.findByText(/slug already in use/i)).toBeInTheDocument();
  });
});
