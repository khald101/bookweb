import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'مكتبتي الإلكترونية الشخصية | نظام متكامل لقراءة وفهرسة وتظليل الكتب',
  description: 'مكتبة كتب إلكترونية شخصية متطورة تدعم صيغ PDF وEPUB وTXT وDOCX مع نظام تظليل بألوان وتصنيفات مخصصة، وبحث شامل داخل الكتب، وحفظ دائم للمواضع والعلامات والملاحظات.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#090d16',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" data-theme="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
