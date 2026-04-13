import type { Metadata } from 'next';
import './globals.css';
import type { ReactNode } from 'react';

import Providers from '../providers';

export const metadata: Metadata = {
  title: 'AI Agents Platform',
  description: 'Customer onboarding platform with AI-powered WhatsApp agents',
};

export default function FrontendLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
