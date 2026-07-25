"use client";

import { useState } from "react";

export default function BillingPage() {
  const [loading, setLoading] = useState(false);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-center text-gray-900">
          Fatura
        </h1>
        <div className="mt-6 space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Plano</p>
            <p className="text-lg font-semibold">Premium Mensal</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Vencimento</p>
            <p className="text-lg font-semibold">15/06/2026</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Valor</p>
            <p className="text-3xl font-bold text-primary">R$ 99,90</p>
          </div>
        </div>
        <button
          className="mt-8 w-full bg-primary text-white py-3 px-6 rounded-lg font-semibold text-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            // TODO: Integrate PIX payment
          }}
        >
          {loading ? "Abrindo..." : "Pagar com PIX"}
        </button>
        <p className="mt-4 text-xs text-center text-gray-400">
          Pagamento 100% seguro via PIX
        </p>
      </div>
    </main>
  );
}
