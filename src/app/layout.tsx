import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { Toaster } from "sonner"

export const metadata: Metadata = {
  title: "UI Annotator",
  description: "Screenshot annotation tool",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
        {/* Global toast portal */}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
