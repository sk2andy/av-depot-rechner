import type { Metadata } from "next"
import {
  Atkinson_Hyperlegible,
  JetBrains_Mono,
} from "next/font/google"

import { TooltipProvider } from "@/components/ui/tooltip"

import "./globals.css"

const atkinsonHyperlegible = Atkinson_Hyperlegible({
  variable: "--font-atkinson-hyperlegible",
  weight: ["400", "700"],
  subsets: ["latin"],
})

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "AV-Depot-Rechner",
  description:
    "Vergleicht ETF und neues AV-Depot ab 2027 inklusive Vorabpauschale, Zulagen und Kinderkomponente.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="de">
      <body
        className={`${atkinsonHyperlegible.variable} ${jetBrainsMono.variable} antialiased`}
      >
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  )
}
