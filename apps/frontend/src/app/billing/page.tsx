'use client';

import { useState } from 'react';
import { CreditCard, Copy, Check } from 'lucide-react';

export default function BillingPage() {
  const [step, setStep] = useState<'view' | 'processing' | 'success'>('view');
  const [copied, setCopied] = useState(false);

  const mockPixCode = '00020126580014BR.GOV.BCB.PIX0136abc123...';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(mockPixCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handlePay = () => {
    setStep('processing');
    setTimeout(() => setStep('success'), 2000);
  };

  if (step === 'success') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-green-50">
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Pagamento Confirmado!</h1>
          <p className="mt-2 text-gray-600">Sua fatura foi paga com sucesso.</p>
          <div className="mt-6 bg-gray-50 rounded-lg p-4 text-left">
            <p className="text-sm text-gray-500">Valor pago</p>
            <p className="text-xl font-bold text-green-700">R$ 99,90</p>
            <p className="mt-2 text-sm text-gray-500">Data</p>
            <p className="font-medium">{new Date().toLocaleDateString('pt-BR')}</p>
          </div>
          <button className="mt-6 w-full bg-gray-900 text-white py-3 px-6 rounded-lg font-medium hover:bg-gray-800">
            Baixar Recibo
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">
        {step === 'processing' ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-gray-900">Processando pagamento...</h2>
            <p className="text-sm text-gray-500 mt-2">Aguardando confirmação do PIX</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-green-600" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Fatura Agiliza</h1>
                <p className="text-sm text-gray-500">Premium Mensal</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Vencimento</span>
                <span className="font-medium">15/08/2026</span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-gray-600">Valor</span>
                <span className="text-2xl font-bold text-gray-900">R$ 99,90</span>
              </div>
            </div>

            <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 mb-6 text-center">
              <div className="w-48 h-48 bg-gray-100 mx-auto mb-3 flex items-center justify-center">
                <span className="text-xs text-gray-400">[QR Code PIX]</span>
              </div>
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-2 text-sm text-green-600 font-medium hover:text-green-700"
              >
                {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                {copied ? 'Código copiado!' : 'Copiar código PIX'}
              </button>
            </div>

            <button
              onClick={handlePay}
              className="w-full bg-green-600 text-white py-3 px-6 rounded-lg font-semibold text-lg hover:bg-green-700 transition-colors"
            >
              Pagar com PIX
            </button>
            <p className="mt-3 text-xs text-center text-gray-400">
              Pagamento 100% seguro via PIX - Aprovação instantânea
            </p>
          </>
        )}
      </div>
    </main>
  );
}
