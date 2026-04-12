import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeProvider } from '@/context/ThemeContext';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import ConditionalLayout from '@/components/ConditionalLayout';

export const viewport: Viewport = {
  themeColor: '#070B14',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'CFSCoffee | Analytics Dashboard',
  description: 'Enterprise Business Intelligence for CFSCoffee Chains',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'CFS BI',
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <meta name="theme-color" content="#090a0f" />
      </head>
      <body>
        <ThemeProvider>
          <LanguageProvider>
            <ConditionalLayout>
              {children}
            </ConditionalLayout>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
