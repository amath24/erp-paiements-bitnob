import React from "react";
import { Info, Clock, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeeSummaryProps {
  amountSent: number;
  currencySent: string;
  fiatEquivalent?: number;
  fiatCurrency?: string;
  amountReceived: number;
  currencyReceived: string;
  estimatedFee: number;
  feeCurrency?: string;
  exchangeRate: number;
  exchangeRateText?: string;
  estimatedDelivery?: string;
  className?: string;
}

export function FeeSummary({
  amountSent,
  currencySent,
  fiatEquivalent,
  fiatCurrency = "XOF",
  amountReceived,
  currencyReceived,
  estimatedFee,
  feeCurrency,
  exchangeRate,
  exchangeRateText,
  estimatedDelivery = "Quelques minutes",
  className,
}: FeeSummaryProps) {
  const displayFeeCurrency = feeCurrency || currencySent;

  return (
    <div
      className={cn(
        "bg-white p-6 rounded-2xl border border-[#EAECEF] shadow-sm space-y-5",
        className
      )}
    >
      <h3 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3">
        Résumé du transfert
      </h3>

      {/* Main Amounts Comparison */}
      <div className="grid grid-cols-2 gap-4 bg-[#F8F9FA] p-4 rounded-xl border border-gray-100">
        <div>
          <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider block">
            Vous envoyez
          </span>
          <span className="text-lg font-bold text-gray-900 block mt-0.5">
            {amountSent.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}{" "}
            {currencySent}
          </span>
          {fiatEquivalent && (
            <span className="text-xs text-gray-400">
              ≈ {Math.round(fiatEquivalent).toLocaleString("fr-FR")} {fiatCurrency}
            </span>
          )}
        </div>

        <div className="text-right border-l border-gray-200 pl-4">
          <span className="text-[11px] font-medium text-emerald-600 uppercase tracking-wider block">
            Ils reçoivent (estimé)
          </span>
          <span className="text-lg font-bold text-emerald-600 block mt-0.5">
            {Math.round(amountReceived).toLocaleString("fr-FR")}{" "}
            {currencyReceived}
          </span>
          <span className="text-xs text-gray-400">Net garanti</span>
        </div>
      </div>

      {/* Detailed Breakdowns */}
      <div className="space-y-3 text-xs">
        <div className="flex items-center justify-between text-gray-600">
          <span className="flex items-center gap-1.5">
            <span>Frais estimés</span>
            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
              Réseau
            </span>
          </span>
          <span className="font-semibold text-gray-900">
            {estimatedFee} {displayFeeCurrency}
          </span>
        </div>

        <div className="flex items-center justify-between text-gray-600">
          <span>Taux de change</span>
          <span className="font-semibold text-gray-900">
            {exchangeRateText ||
              `1 ${currencySent} = ${exchangeRate.toLocaleString("fr-FR")} ${currencyReceived}`}
          </span>
        </div>

        <div className="flex items-center justify-between text-gray-600">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            <span>Délai estimé</span>
          </span>
          <span className="font-semibold text-emerald-600">
            {estimatedDelivery}
          </span>
        </div>
      </div>

      {/* Warning / Network disclaimer */}
      <div className="flex items-start gap-2 p-3 bg-amber-50/70 border border-amber-200/50 rounded-xl text-[11px] text-amber-800 leading-relaxed">
        <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p>
          Les frais et taux peuvent varier selon le réseau et le pays. Aucun frais
          caché, confirmation avant validation.
        </p>
      </div>
    </div>
  );
}
