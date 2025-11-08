import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI Product Launch Kit',
  description: 'One-click product launch optimization for Shopify',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

