import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cura · La tua agenda della salute',
  description: 'Appuntamenti, documenti e promemoria, in un unico posto. Prototipo dimostrativo.',
  appleWebApp: { capable: true, title: 'Cura', statusBarStyle: 'default' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f6f8fa' };
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return <html lang="it"><body>{children}</body></html>;
}
