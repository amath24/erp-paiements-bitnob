"use client";

import React, { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { InvoicePreviewCard } from "@/components/invoices/InvoicePreviewCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { MOCK_INVOICES } from "@/lib/mock-data";
import { CryptoAsset, Invoice } from "@/types";
import {
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Calendar,
  DollarSign,
  Copy,
  ExternalLink,
  FileText,
  ListFilter,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

function FacturesContent() {
  const { success, error } = useToast();
  const [activeTab, setActiveTab] = useState<"create" | "list">("create");
  const [invoices, setInvoices] = useState<Invoice[]>(MOCK_INVOICES);

  // Form state
  const [clientName, setClientName] = useState("TechStudio NG");
  const [description, setDescription] = useState("Logo Design");
  const [amount, setAmount] = useState<number>(50);
  const [currency, setCurrency] = useState("USD");
  const [acceptedCryptos, setAcceptedCryptos] = useState<CryptoAsset[]>([
    "BTC",
    "USDT",
    "USDC",
  ]);
  const [dueDate, setDueDate] = useState("2026-10-25");
  const [notes, setNotes] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("SP-1042");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Search and filter for invoices list
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const handleToggleCrypto = (asset: CryptoAsset) => {
    if (acceptedCryptos.includes(asset)) {
      if (acceptedCryptos.length === 1) {
        error("Action impossible", "Vous devez accepter au moins une crypto.");
        return;
      }
      setAcceptedCryptos(acceptedCryptos.filter((c) => c !== asset));
    } else {
      setAcceptedCryptos([...acceptedCryptos, asset]);
    }
  };

  const handleGenerateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !description.trim() || amount <= 0) {
      error("Champs obligatoires", "Veuillez remplir le nom, la description et un montant valide.");
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      const newInvNumber = `SP-${Math.floor(1000 + Math.random() * 9000)}`;
      setInvoiceNumber(newInvNumber);

      const newInvoice: Invoice = {
        id: `inv-${Date.now()}`,
        invoiceNumber: newInvNumber,
        clientName,
        description,
        amount,
        currency: currency as any,
        acceptedCryptos,
        dueDate: dueDate || undefined,
        notes: notes || undefined,
        status: "pending",
        createdAt: new Date().toISOString(),
        shareableUrl: `https://paylink.africa/pay/${newInvNumber}`,
      };

      setInvoices([newInvoice, ...invoices]);
      setIsSubmitting(false);
      success(
        "Facture créée avec succès !",
        `Le lien de paiement pour ${clientName} (${amount} ${currency}) est disponible.`
      );
    }, 600);
  };

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || inv.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const currentShareableUrl = `https://paylink.africa/pay/${invoiceNumber}`;

  return (
    <div className="space-y-6">
      {/* Header and View Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            {activeTab === "create" ? "Créer une facture" : "Gestion des factures"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {activeTab === "create"
              ? "Générez un lien de paiement pour recevoir des paiements en Bitcoin ou stablecoins."
              : "Suivez l'état de règlement de vos factures et encaissements clients."}
          </p>
        </div>

        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setActiveTab("create")}
            className={cn(
              "px-4 py-2 text-xs font-bold rounded-lg transition-all",
              activeTab === "create"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-900"
            )}
          >
            Créer une facture
          </button>
          <button
            onClick={() => setActiveTab("list")}
            className={cn(
              "px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5",
              activeTab === "list"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-900"
            )}
          >
            <span>Toutes les factures</span>
            <span className="text-[10px] bg-gray-200 px-1.5 py-0.2 rounded-full font-semibold">
              {invoices.length}
            </span>
          </button>
        </div>
      </div>

      {activeTab === "create" ? (
        /* Create Invoice View (Mockup Screen 2) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Form */}
          <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-2xl border border-[#EAECEF] shadow-sm">
            <h2 className="text-base font-bold text-gray-900 mb-6">
              Informations de la facture
            </h2>

            <form onSubmit={handleGenerateInvoice} className="space-y-5">
              {/* Nom du client */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Nom du client <span className="text-amber-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Ex: TechStudio NG"
                  className="w-full px-4 py-2.5 text-sm bg-white border border-gray-200 focus:border-[#F5C200] focus:ring-2 focus:ring-[#F5C200]/20 rounded-xl text-gray-900 placeholder-gray-400 outline-none transition-all"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Description <span className="text-amber-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Développement d'un site web"
                  className="w-full px-4 py-2.5 text-sm bg-white border border-gray-200 focus:border-[#F5C200] focus:ring-2 focus:ring-[#F5C200]/20 rounded-xl text-gray-900 placeholder-gray-400 outline-none transition-all"
                />
              </div>

              {/* Montant & Devise */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Montant <span className="text-amber-500">*</span>
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      required
                      min="1"
                      step="any"
                      value={amount || ""}
                      onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                      placeholder="50"
                      className="w-full px-4 py-2.5 text-sm bg-white border border-gray-200 focus:border-[#F5C200] focus:ring-2 focus:ring-[#F5C200]/20 rounded-xl text-gray-900 outline-none transition-all"
                    />
                  </div>
                  <div className="w-28 shrink-0">
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm bg-[#F5F6F9] border border-gray-200 rounded-xl font-medium text-gray-800 outline-none cursor-pointer focus:border-[#F5C200]"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="USDT">USDT</option>
                      <option value="USDC">USDC</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Accepter les paiements en */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Accepter les paiements en
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Bitcoin */}
                  <label
                    onClick={() => handleToggleCrypto("BTC")}
                    className={cn(
                      "flex items-center gap-2.5 p-3 rounded-xl border text-xs font-medium cursor-pointer transition-all",
                      acceptedCryptos.includes("BTC")
                        ? "border-[#F5C200] bg-[#FFFBEB] text-gray-900 shadow-sm"
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={acceptedCryptos.includes("BTC")}
                      onChange={() => {}}
                      className="w-4 h-4 text-[#F5C200] rounded accent-[#F5C200]"
                    />
                    <span>Bitcoin (BTC)</span>
                  </label>

                  {/* USDT */}
                  <label
                    onClick={() => handleToggleCrypto("USDT")}
                    className={cn(
                      "flex items-center gap-2.5 p-3 rounded-xl border text-xs font-medium cursor-pointer transition-all",
                      acceptedCryptos.includes("USDT")
                        ? "border-[#F5C200] bg-[#FFFBEB] text-gray-900 shadow-sm"
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={acceptedCryptos.includes("USDT")}
                      onChange={() => {}}
                      className="w-4 h-4 text-[#F5C200] rounded accent-[#F5C200]"
                    />
                    <span>USDT (TRC20/ERC20)</span>
                  </label>

                  {/* USDC */}
                  <label
                    onClick={() => handleToggleCrypto("USDC")}
                    className={cn(
                      "flex items-center gap-2.5 p-3 rounded-xl border text-xs font-medium cursor-pointer transition-all",
                      acceptedCryptos.includes("USDC")
                        ? "border-[#F5C200] bg-[#FFFBEB] text-gray-900 shadow-sm"
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={acceptedCryptos.includes("USDC")}
                      onChange={() => {}}
                      className="w-4 h-4 text-[#F5C200] rounded accent-[#F5C200]"
                    />
                    <span>USDC (ERC20)</span>
                  </label>
                </div>
              </div>

              {/* Date d'échéance (optionnel) */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Date d&apos;échéance (optionnel)
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-white border border-gray-200 focus:border-[#F5C200] focus:ring-2 focus:ring-[#F5C200]/20 rounded-xl text-gray-900 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Notes (optionnel) */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Notes (optionnel)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ajoutez une note pour votre client..."
                  className="w-full px-4 py-2.5 text-sm bg-white border border-gray-200 focus:border-[#F5C200] focus:ring-2 focus:ring-[#F5C200]/20 rounded-xl text-gray-900 placeholder-gray-400 outline-none transition-all resize-none"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 px-6 rounded-xl bg-[#F5C200] hover:bg-[#E5B500] text-[#0f172a] font-extrabold text-sm shadow-md shadow-[#F5C200]/25 transition-all duration-150 transform active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : null}
                  <span>Générer le lien de paiement</span>
                </button>
              </div>
            </form>
          </div>

          {/* Right: Real-time Live Preview (Mockup Screen 2 Right side) */}
          <div className="lg:col-span-5 sticky top-24">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Aperçu de la facture
              </span>
              <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                Mise à jour en temps réel
              </span>
            </div>

            <InvoicePreviewCard
              invoiceNumber={invoiceNumber}
              clientName={clientName}
              description={description}
              amount={amount}
              currency={currency}
              acceptedCryptos={acceptedCryptos}
              shareableUrl={currentShareableUrl}
            />
          </div>
        </div>
      ) : (
        /* Invoices List View */
        <div className="bg-white rounded-2xl border border-[#EAECEF] p-6 shadow-sm space-y-6">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher par client, référence ou intitulé..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm bg-[#F5F6F9] border border-transparent focus:border-[#F5C200] rounded-xl text-gray-900 placeholder-gray-400 outline-none"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              {["all", "pending", "paid", "expired"].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap capitalize transition-colors",
                    statusFilter === st
                      ? "bg-[#0f172a] text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                >
                  {st === "all"
                    ? "Toutes"
                    : st === "pending"
                    ? "En attente"
                    : st === "paid"
                    ? "Payée"
                    : "Expirée"}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  <th className="pb-3 px-4 font-medium">Référence</th>
                  <th className="pb-3 px-4 font-medium">Client & Description</th>
                  <th className="pb-3 px-4 font-medium">Montant</th>
                  <th className="pb-3 px-4 font-medium">Cryptos acceptées</th>
                  <th className="pb-3 px-4 font-medium">Statut</th>
                  <th className="pb-3 px-4 font-medium text-right">Lien</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-4 px-4 font-mono font-bold text-gray-900 text-xs">
                      #{inv.invoiceNumber}
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-semibold text-gray-900">
                        {inv.clientName}
                      </div>
                      <div className="text-xs text-gray-500">{inv.description}</div>
                    </td>
                    <td className="py-4 px-4 font-bold text-gray-900">
                      ${inv.amount.toFixed(2)} {inv.currency}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5">
                        {inv.acceptedCryptos.map((c) => (
                          <span
                            key={c}
                            className="text-[10px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-mono font-semibold"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(inv.shareableUrl);
                          success("Lien copié !", inv.shareableUrl);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-[#F5C200] hover:text-[#0f172a] text-gray-700 transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copier</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FacturesPage() {
  return (
    <ToastProvider>
      <AppLayout>
        <FacturesContent />
      </AppLayout>
    </ToastProvider>
  );
}
