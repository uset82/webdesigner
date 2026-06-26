import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'WebDesigner Next.js Project',
  description: 'Premium layouts generated and validated dynamically by WebDesigner.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="vibe-saas">{children}</body>
    </html>
  );
}
