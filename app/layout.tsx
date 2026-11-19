import type { Metadata, Viewport } from 'next';
import './globals.css';
import './auth.css';
import './documents.css';
import './report.css';
import './mobile.css';

export const metadata: Metadata = {
  title: 'VisiLab · La tua agenda della salute',
  applicationName: 'VisiLab',
  description: 'Appuntamenti, documenti e promemoria, in un unico posto.',
  icons: {
    icon: [{url:'/brand/visilab.svg',type:'image/svg+xml'}],
    apple: [{url:'/apple-icon.png',sizes:'180x180',type:'image/png'}],
  },
  appleWebApp: { capable: true, title: 'VisiLab', statusBarStyle: 'default' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f6f8fa' };
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return <html lang="it"><body>{children}</body></html>;
}
