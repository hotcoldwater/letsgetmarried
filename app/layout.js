import '../fonts.css';
import '../app.css';
import './live.css';
import './brand.css';
import './simple.css';
import './inline.css';
export const metadata = {
  title: 'letsgetmarried · 성현과 지윤의 결혼 준비',
  applicationName: 'letsgetmarried',
  description: '성현과 지윤, 두 사람이 함께 준비하는 2027년 9월 25일',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48', type: 'image/x-icon' },
      { url: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
    apple: { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
  },
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: 'letsgetmarried', statusBarStyle: 'default' },
};
export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#fcf7f7' };
export default function RootLayout({ children }) { return <html lang="ko"><body>{children}</body></html>; }
