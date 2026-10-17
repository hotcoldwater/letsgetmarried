import '../fonts.css';
import '../app.css';
import './live.css';
export const metadata = { title: '성현과 지윤의 결혼 준비', description: '두 사람이 함께 준비하는 2027년 9월 25일', manifest: '/manifest.webmanifest', icons: { apple: '/icon-180.png', icon: '/icon-192.png' }, robots: { index: false, follow: false }, appleWebApp: { capable: true, title: '우리의 결혼 준비', statusBarStyle: 'default' } };
export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#fcf7f7' };
export default function RootLayout({ children }) { return <html lang="ko"><body>{children}</body></html>; }
