import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Agiliza - Cobrança Inteligente',
  description: 'Gestão de assinaturas e cobrança recorrente com lembretes inteligentes via WhatsApp',
  manifest: '/manifest.json',
  icons: { icon: '/favicon.ico', shortcut: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
