import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Project Thoth',
  description: 'SME Knowledge Capture & Routing Intelligence System',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
