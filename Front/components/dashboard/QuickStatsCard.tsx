import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { MOCK_STATS } from "@/lib/mock-data";

export function QuickStatsCard() {
  return (
    <div className="bg-white p-6 rounded-2xl border border-[#EAECEF] shadow-sm flex flex-col justify-between">
      <div>
        <h3 className="text-base font-bold text-gray-900 mb-4">Statistiques</h3>

        <div className="space-y-5">
          {/* Factures créées */}
          <div className="pb-3.5 border-b border-gray-100">
            <div className="text-2xl font-extrabold text-gray-900 font-sans">
              {MOCK_STATS.invoicesCreated}
            </div>
            <div className="text-xs font-medium text-gray-500 mt-0.5">
              Factures créées
            </div>
          </div>

          {/* Paiements reçus */}
          <div className="pb-3.5 border-b border-gray-100 flex items-end justify-between">
            <div>
              <div className="text-2xl font-extrabold text-gray-900 font-sans">
                {MOCK_STATS.paymentsReceived}
              </div>
              <div className="text-xs font-medium text-gray-500 mt-0.5">
                Paiements reçus
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 mb-0.5">
              <TrendingUp className="w-3 h-3" />
              <span>+{MOCK_STATS.paymentsGrowthPct}%</span>
            </span>
          </div>

          {/* Paiements en attente */}
          <div className="flex items-end justify-between">
            <div>
              <div className="text-2xl font-extrabold text-gray-900 font-sans">
                {MOCK_STATS.pendingPayments}
              </div>
              <div className="text-xs font-medium text-gray-500 mt-0.5">
                Paiements en attente
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200/60 mb-0.5">
              <TrendingDown className="w-3 h-3" />
              <span>{MOCK_STATS.pendingGrowthPct}%</span>
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100 text-[11px] text-gray-400 text-center">
        Mise à jour en temps réel
      </div>
    </div>
  );
}
