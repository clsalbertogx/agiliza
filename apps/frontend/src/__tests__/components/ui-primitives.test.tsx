import { render, screen } from '@testing-library/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

describe('UI primitives', () => {
  describe('Badge', () => {
    it('deve renderizar o conteúdo do badge', () => {
      render(<Badge>Pendente</Badge>);

      expect(screen.getByText('Pendente')).toBeInTheDocument();
    });

    it('deve aplicar classe de variante danger', () => {
      render(<Badge variant="danger">Crítico</Badge>);

      expect(screen.getByText('Crítico')).toHaveClass('bg-danger-100');
    });
  });

  describe('Button', () => {
    it('deve renderizar botão com type padrão', () => {
      render(<Button>Salvar</Button>);

      expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
    });

    it('deve repassar atributos HTML como disabled', () => {
      render(<Button disabled>Salvar</Button>);

      expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
    });

    it('deve renderizar o elemento filho via asChild', () => {
      render(
        <Button asChild>
          <a href="/faturas">Ver faturas</a>
        </Button>,
      );

      expect(screen.getByRole('link', { name: 'Ver faturas' })).toBeInTheDocument();
    });
  });

  describe('Card', () => {
    it('deve renderizar header, título, conteúdo e footer', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Fatura</CardTitle>
          </CardHeader>
          <CardContent>Conteúdo do card</CardContent>
          <CardFooter>Ações do card</CardFooter>
        </Card>,
      );

      expect(screen.getByText('Fatura')).toBeInTheDocument();
      expect(screen.getByText('Conteúdo do card')).toBeInTheDocument();
      expect(screen.getByText('Ações do card')).toBeInTheDocument();
    });
  });

  describe('Input', () => {
    it('deve renderizar input com type e placeholder repassados', () => {
      render(<Input type="email" placeholder="voce@exemplo.com" />);

      const input = screen.getByPlaceholderText('voce@exemplo.com');
      expect(input).toHaveAttribute('type', 'email');
    });
  });

  describe('Label', () => {
    it('deve renderizar label com texto', () => {
      render(<Label htmlFor="nome">Nome do cliente</Label>);

      expect(screen.getByText('Nome do cliente')).toBeInTheDocument();
      expect(screen.getByText('Nome do cliente')).toHaveAttribute('for', 'nome');
    });
  });

  describe('Skeleton', () => {
    it('deve renderizar div com aria-hidden', () => {
      const { container } = render(<Skeleton className="h-4 w-24" />);

      const skeleton = container.querySelector('div');
      expect(skeleton).toHaveAttribute('aria-hidden', 'true');
      expect(skeleton).toHaveClass('animate-pulse');
    });
  });

  describe('Table', () => {
    it('deve renderizar tabela com cabeçalho e células', () => {
      render(
        <Table>
          <TableHeader>
            <TableRow>
              <th>Cliente</th>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>João Silva</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );

      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getByText('Cliente')).toBeInTheDocument();
      expect(screen.getByText('João Silva')).toBeInTheDocument();
    });
  });

  describe('Textarea', () => {
    it('deve renderizar textarea com placeholder', () => {
      render(<Textarea placeholder="Descreva o problema" />);

      expect(screen.getByPlaceholderText('Descreva o problema')).toBeInTheDocument();
    });
  });
});
