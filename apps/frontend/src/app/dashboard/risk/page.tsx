'use client';

import { StatusBadge } from '@/components/status-badge';

const mockClients = [
  { name: 'João Silva', phone: '(85) 99999-0001', riskScore: 'green', invoices: 3, total: 299.70, lastPayment: '10/07/2026' },
  { name: 'Maria Santos', phone: '(85) 99999-0002', riskScore: 'yellow', invoices: 5, total: 499.50, lastPayment: '25/06/2026' },
  { name: 'Carlos Oliveira', phone: '(85) 99999-0003', riskScore: 'red', invoices: 2, total: 199.80, lastPayment: '01/05/2026' },
  { name: 'Ana Costa', phone: '(85) 99999-0004', riskScore: 'green', invoices: 1, total: 99.90, lastPayment: '15/07/2026' },
  { name: 'Pedro Alves', phone: '(85) 99999-0005', riskScore: 'yellow', invoices: 4, total: 399.60, lastPayment: '20/06/2026' },
];

export default function RiskPage() {
  const greenCount = mockClients.filter(c => c.riskScore === 'green').length;
  const yellowCount = mockClients.filter(c => c.riskScore === 'yellow').length;
  const redCount = mockClients.filter(c => c.riskScore === 'red').length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard de Risco</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-green-50 border border-green-200 rounded-xl p-6">
          <p className="text-lg font-bold text-green-800">{greenCount} clientes</p>
          <p className="text-sm text-green-600">Baixo risco - Verde</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <p className="text-lg font-bold text-yellow-800">{yellowCount} clientes</p>
          <p className="text-sm text-yellow-600">Médio risco - Amarelo</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <p className="text-lg font-bold text-red-800">{redCount} clientes</p>
          <p className="text-sm text-red-600">Alto risco - Vermelho</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Clientes por Risco</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full" role="table">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b border-gray-100">
                <th scope="col" className="p-4">Nome</th>
                <th scope="col" className="p-4">Telefone</th>
                <th scope="col" className="p-4">Risco</th>
                <th scope="col" className="p-4">Faturas</th>
                <th scope="col" className="p-4">Total</th>
                <th scope="col" className="p-4">Último Pagamento</th>
              </tr>
            </thead>
            <tbody>
              {mockClients.map((client) => (
                <tr key={client.name} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="p-4 font-medium text-gray-900">{client.name}</td>
                  <td className="p-4 text-gray-600">{client.phone}</td>
                  <td className="p-4"><StatusBadge status={client.riskScore as any} /></td>
                  <td className="p-4 text-gray-600">{client.invoices}</td>
                  <td className="p-4 text-gray-900">R$ {client.total.toFixed(2)}</td>
                  <td className="p-4 text-gray-600">{client.lastPayment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
