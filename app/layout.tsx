import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'VineGuard — AI сканер винограду',
  description: 'Скануйте листки винограду через камеру та отримуйте професійні рекомендації по догляду',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <body className="min-h-screen">{children}</body>
    </html>
  )
}