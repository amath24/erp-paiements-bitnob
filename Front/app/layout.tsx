import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PayLink Afrique — Factures & Paiements Crypto pour l'Afrique et le Monde",
  description:
    "Plateforme FinTech de facturation et de paiement hybride Bitcoin, Stablecoins et Mobile Money pour freelances, commerçants et PME en Afrique.",
  keywords: ["PayLink", "PayLink Afrique", "Bitnob", "Bitcoin", "USDT", "USDC", "Factures", "Mobile Money", "Fintech", "Afrique", "Sénégal"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased bg-[#F8F9FB] text-[#101828]">
        {children}
      </body>
    </html>
  );
}
