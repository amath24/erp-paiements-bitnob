"use client";

import React from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/ui/StatCard";
import { ChartCard } from "@/components/ui/ChartCard";
import { ToastProvider } from "@/components/ui/Toast";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { TrendingUp, Globe2, Wallet, ArrowUpRight } from "lucide-react";

const CRYPTO_DISTRIBUTION = [
  { name: "USDT", value: 65, color: "#26A17B", amount: "$1,868.90" },
  { name: "Bitcoin (BTC)", value: 20, color: "#F7931A", amount: "$575.05" },
  { name: "USDC", value: 15, color: "#2775CA", amount: "$431.29" },
];

const DAILY_VOLUME = [
  { day: "10 Oct", volume: 420 },
  { day: "11 Oct", volume: 680 },
  { day: "12 Oct", volume: 510 },
  { day: "13 Oct", volume: 920 },
  { day: "14 Oct", volume: 750 },
  { day: "15 Oct", volume: 1150 },
  { day: "16 Oct", volume: 1420 },
];

function AnalyticsContent() {
  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
          Analytics & Performance
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Analysez vos volumes d&apos;encaissement, devises préférées et répartition géographique.
        </p>
      </div>

      {/* Top 3 Metric Cards - Uni-couleur & Compact */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <StatCard
          title="Volume global traité"
          value="$14,520.00"
          subValue="Sur les 6 derniers mois"
          variant="white"
          icon={
            <div className="w-6 h-6 rounded-full bg-[#FFF9E6] text-[#E5B500] flex items-center justify-center shrink-0 border border-[#F5C200]/30 shadow-xs">
              <Wallet className="w-3.5 h-3.5" />
            </div>
          }
          badge={{ text: "+32.4% de croissance", trend: "up" }}
        />
        <StatCard
          title="Délai moyen de règlement"
          value="4.2 heures"
          subValue="Après envoi du lien"
          variant="white"
          icon={
            <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-200/60 shadow-xs">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          }
        />
        <StatCard
          title="Taux d'encaissement"
          value="88.5%"
          subValue="Factures réglées à échéance"
          variant="white"
          icon={
            <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200/60 shadow-xs">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          }
        />
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Daily Volume Area Chart */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-[#EAECEF] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900">
                Volume quotidien d&apos;encaissement
              </h3>
              <p className="text-xs text-gray-500">
                Progression des règlements sur les 7 derniers jours
              </p>
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              +14.2% ce jour
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={DAILY_VOLUME}>
                <defs>
                  <linearGradient id="colorVol" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F5C200" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#F5C200" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F3F7" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "#9CA3AF", fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: "#9CA3AF", fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-[#0f172a] border border-[#1e293b] text-white p-2.5 rounded-xl text-xs shadow-lg">
                          <p className="text-gray-400">{payload[0].payload.day}</p>
                          <p className="font-bold text-[#F5C200] mt-0.5">
                            Volume : ${payload[0].value}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="volume"
                  stroke="#F5C200"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorVol)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Crypto Distribution Donut Chart */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-[#EAECEF] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-bold text-gray-900">
              Répartition par crypto
            </h3>
            <span className="text-xs text-gray-400">Total solde</span>
          </div>

          <div className="relative w-44 h-44 mx-auto my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={CRYPTO_DISTRIBUTION}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={4}
                  stroke="none"
                >
                  {CRYPTO_DISTRIBUTION.map((entry, index) => (
                    <Cell key={`c-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
              <span className="text-sm font-extrabold text-gray-900 font-sans">
                $2,875.24
              </span>
              <span className="text-[10px] text-gray-400">Actifs totaux</span>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-gray-100 text-xs">
            {CRYPTO_DISTRIBUTION.map((c) => (
              <div key={c.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="text-gray-700 font-medium">{c.name}</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-gray-900">{c.value}%</span>
                  <span className="text-gray-400 text-[11px] ml-1.5">({c.amount})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <ToastProvider>
      <AppLayout>
        <AnalyticsContent />
      </AppLayout>
    </ToastProvider>
  );
}
