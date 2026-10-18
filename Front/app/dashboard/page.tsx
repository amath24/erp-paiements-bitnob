"use client";

import React from "react";
import Link from "next/link";
import { Plus, ArrowRight, Wallet } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/ui/StatCard";
import { CryptoIcon } from "@/components/ui/CryptoIcon";
import { ChartCard } from "@/components/ui/ChartCard";
import { QuickStatsCard } from "@/components/dashboard/QuickStatsCard";
import { TransactionTable } from "@/components/ui/TransactionTable";
import {
  MOCK_BALANCES,
  MOCK_TRANSACTIONS,
  MOCK_USER,
} from "@/lib/mock-data";
import { ToastProvider } from "@/components/ui/Toast";

export default function DashboardPage() {
  return (
    <ToastProvider>
      <AppLayout>
        <div className="space-y-6">
          {/* Header Row: Greeting & Action */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                Bonjour, {MOCK_USER.name.split(" ")[0]}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Voici un aperçu de vos activités aujourd&apos;hui.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/factures"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#F5C200] hover:bg-[#E5B500] text-[#0f172a] font-bold text-sm shadow-md shadow-[#F5C200]/25 transition-all duration-150 transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Créer une facture</span>
              </Link>
            </div>
          </div>

          {/* Balances Row: 4 Cards - Uni-couleur & Compact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Card 1: Solde total */}
            <StatCard
              title="Solde total"
              value={`$${MOCK_BALANCES.totalUSD.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}`}
              variant="white"
              allowMask
              icon={
                <div className="w-6 h-6 rounded-full bg-[#FFF9E6] text-[#E5B500] flex items-center justify-center shrink-0 border border-[#F5C200]/30 shadow-xs">
                  <Wallet className="w-3.5 h-3.5" />
                </div>
              }
              badge={{
                text: `+${MOCK_BALANCES.monthlyGrowthPct}% ce mois`,
                trend: "up",
              }}
            />

            {/* Card 2: Bitcoin */}
            <StatCard
              title="Bitcoin"
              value={`${MOCK_BALANCES.crypto.BTC.amount} BTC`}
              subValue={`≈ $${MOCK_BALANCES.crypto.BTC.usdValue.toFixed(2)}`}
              variant="white"
              icon={<CryptoIcon symbol="BTC" size="sm" />}
            />

            {/* Card 3: USDT */}
            <StatCard
              title="USDT"
              value={`${MOCK_BALANCES.crypto.USDT.amount.toFixed(2)} USDT`}
              subValue={`≈ $${MOCK_BALANCES.crypto.USDT.usdValue.toFixed(2)}`}
              variant="white"
              icon={<CryptoIcon symbol="USDT" size="sm" />}
            />

            {/* Card 4: USDC */}
            <StatCard
              title="USDC"
              value={`${MOCK_BALANCES.crypto.USDC.amount.toFixed(2)} USDC`}
              subValue={`≈ $${MOCK_BALANCES.crypto.USDC.usdValue.toFixed(2)}`}
              variant="white"
              icon={<CryptoIcon symbol="USDC" size="sm" />}
            />
          </div>

          {/* Middle Row: Chart & Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ChartCard />
            </div>
            <div className="lg:col-span-1">
              <QuickStatsCard />
            </div>
          </div>

          {/* Bottom Row: Transactions récentes */}
          <div className="bg-white rounded-2xl border border-[#EAECEF] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Transactions récentes
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Historique de vos derniers règlements reçus et transferts
                </p>
              </div>

              <Link
                href="/paiements"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-700 hover:text-black group"
              >
                <span>Voir tout</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            <TransactionTable transactions={MOCK_TRANSACTIONS} limit={4} />
          </div>
        </div>
      </AppLayout>
    </ToastProvider>
  );
}
