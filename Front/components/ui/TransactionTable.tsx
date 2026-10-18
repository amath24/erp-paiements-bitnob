"use client";

import React from "react";
import { Transaction } from "@/types";
import { StatusBadge } from "./StatusBadge";
import { ArrowDownLeft, ArrowUpRight, ExternalLink, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface TransactionTableProps {
  transactions: Transaction[];
  limit?: number;
  showPagination?: boolean;
  onSelectTransaction?: (tx: Transaction) => void;
  className?: string;
}

export function TransactionTable({
  transactions,
  limit,
  showPagination = false,
  onSelectTransaction,
  className,
}: TransactionTableProps) {
  const displayed = limit ? transactions.slice(0, limit) : transactions;

  if (displayed.length === 0) {
    return (
      <div className="py-12 text-center bg-white rounded-2xl border border-gray-100">
        <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm font-medium text-gray-700">Aucune transaction trouvée</p>
        <p className="text-xs text-gray-400 mt-0.5">
          Vos transactions récentes apparaîtront ici dès leur création.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            <th className="pb-3 px-4 font-medium">Client</th>
            <th className="pb-3 px-4 font-medium">Type</th>
            <th className="pb-3 px-4 font-medium">Montant</th>
            <th className="pb-3 px-4 font-medium">Statut</th>
            <th className="pb-3 px-4 font-medium text-right">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 text-sm">
          {displayed.map((tx) => {
            const isReceived =
              tx.rawType === "payment_received" || tx.type.toLowerCase().includes("reçu");

            return (
              <tr
                key={tx.id}
                onClick={() => onSelectTransaction?.(tx)}
                className="hover:bg-gray-50/80 transition-colors group cursor-pointer"
              >
                {/* Client Name with Icon */}
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold",
                        isReceived
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-amber-50 text-amber-700"
                      )}
                    >
                      {isReceived ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 group-hover:text-black">
                        {tx.client}
                      </div>
                      {tx.network && (
                        <div className="text-[11px] text-gray-400">{tx.network}</div>
                      )}
                    </div>
                  </div>
                </td>

                {/* Type */}
                <td className="py-3.5 px-4 text-gray-500 text-xs font-medium">
                  {tx.type}
                </td>

                {/* Montant */}
                <td className="py-3.5 px-4 font-semibold text-gray-900">
                  <span
                    className={
                      isReceived ? "text-gray-900" : "text-gray-700"
                    }
                  >
                    {isReceived ? "+" : "-"}
                    {tx.amount.toLocaleString("fr-FR", {
                      minimumFractionDigits: tx.currency === "BTC" ? 4 : 2,
                      maximumFractionDigits: tx.currency === "BTC" ? 4 : 2,
                    })}{" "}
                    {tx.currency}
                  </span>
                </td>

                {/* Statut */}
                <td className="py-3.5 px-4">
                  <StatusBadge status={tx.status} />
                </td>

                {/* Date */}
                <td className="py-3.5 px-4 text-right text-xs text-gray-500 whitespace-nowrap">
                  {tx.date}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
