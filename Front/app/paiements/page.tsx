"use client";

import React, { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { TransactionTable } from "@/components/ui/TransactionTable";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { MOCK_TRANSACTIONS } from "@/lib/mock-data";
import { Transaction } from "@/types";
import {
  Search,
  Download,
  Filter,
  CheckCircle2,
  Clock,
  ExternalLink,
  X,
  CreditCard,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

function PaiementsContent() {
  const { success } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>(MOCK_TRANSACTIONS);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const filteredTransactions = transactions.filter((tx) => {
    const matchesSearch =
      tx.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tx.txHash && tx.txHash.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType =
      typeFilter === "all" ||
      (typeFilter === "received" && tx.rawType === "payment_received") ||
      (typeFilter === "sent" && tx.rawType === "transfer_sent");

    return matchesSearch && matchesType;
  });

  const handleExportCSV = () => {
    success("Export CSV prêt", "Le relevé de transactions a été téléchargé.");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            Paiements
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Consultez et exportez l&apos;ensemble de vos flux financiers et règlements crypto.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 hover:text-black hover:border-gray-300 text-xs font-bold shadow-sm transition-colors self-start sm:self-auto"
        >
          <Download className="w-4 h-4" />
          <span>Exporter le relevé (CSV)</span>
        </button>
      </div>

      {/* Stats summary - Uni-couleur & Compact */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <StatCard
          title="Total encaissé"
          value="$2,450.00"
          subValue="Sur les 30 derniers jours"
          variant="white"
          icon={
            <div className="w-6 h-6 rounded-full bg-[#FFF9E6] text-[#E5B500] flex items-center justify-center shrink-0 border border-[#F5C200]/30 shadow-xs">
              <Wallet className="w-3.5 h-3.5" />
            </div>
          }
          badge={{ text: "+18% ce mois", trend: "up" }}
        />
        <StatCard
          title="Total transféré"
          value="$225.00"
          subValue="Vers Mobile Money (XOF)"
          variant="white"
          icon={
            <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-200/60 shadow-xs">
              <ArrowDownLeft className="w-3.5 h-3.5" />
            </div>
          }
        />
        <StatCard
          title="Taux de succès"
          value="100%"
          subValue="Aucun rejet de paiement"
          variant="white"
          icon={
            <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200/60 shadow-xs">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          }
          badge={{ text: "Zéro incident", trend: "up" }}
        />
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-[#EAECEF] p-6 shadow-sm space-y-6">
        {/* Filter controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher par client, montant ou hash blockchain..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-[#F5F6F9] border border-transparent focus:border-[#F5C200] rounded-xl text-gray-900 placeholder-gray-400 outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            {[
              { id: "all", label: "Toutes" },
              { id: "received", label: "Paiements reçus" },
              { id: "sent", label: "Transferts sortants" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setTypeFilter(f.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                  typeFilter === f.id
                    ? "bg-[#0f172a] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Transactions Table */}
        <TransactionTable
          transactions={filteredTransactions}
          onSelectTransaction={(tx) => setSelectedTx(tx)}
        />
      </div>

      {/* Transaction Details Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-[#0f172a]/60 backdrop-blur-sm"
            onClick={() => setSelectedTx(null)}
          />

          <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-md w-full p-6 z-10 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">
                Détails de la transaction
              </h3>
              <button
                onClick={() => setSelectedTx(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3.5 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-gray-50">
                <span className="text-gray-500">Référence</span>
                <span className="font-mono font-bold text-gray-900">
                  {selectedTx.id}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-gray-50">
                <span className="text-gray-500">Client / Tiers</span>
                <span className="font-bold text-gray-900">{selectedTx.client}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-gray-50">
                <span className="text-gray-500">Montant net</span>
                <span className="text-base font-black text-gray-900">
                  {selectedTx.amount} {selectedTx.currency}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-gray-50">
                <span className="text-gray-500">Statut</span>
                <StatusBadge status={selectedTx.status} />
              </div>

              {selectedTx.network && (
                <div className="flex items-center justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500">Réseau blockchain</span>
                  <span className="font-medium text-gray-800">
                    {selectedTx.network}
                  </span>
                </div>
              )}

              {selectedTx.txHash && (
                <div className="flex items-center justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500">Hash de transaction</span>
                  <span className="font-mono text-gray-700 bg-gray-100 px-2 py-0.5 rounded text-[11px]">
                    {selectedTx.txHash}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between py-1">
                <span className="text-gray-500">Date et heure</span>
                <span className="text-gray-700">{selectedTx.date}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setSelectedTx(null)}
                className="px-4 py-2 text-xs font-bold bg-gray-900 text-white rounded-xl"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PaiementsPage() {
  return (
    <ToastProvider>
      <AppLayout>
        <PaiementsContent />
      </AppLayout>
    </ToastProvider>
  );
}
