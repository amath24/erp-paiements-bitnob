"use client";

import React, { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { FeeSummary } from "@/components/ui/FeeSummary";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import {
  MOCK_TRANSFERS,
  SUPPORTED_DESTINATIONS,
} from "@/lib/mock-data";
import { Transfer, TransferMethod } from "@/types";
import {
  ArrowRight,
  Smartphone,
  Building2,
  Banknote,
  Send,
  CheckCircle2,
  MoreVertical,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";

function TransfertsContent() {
  const { success, error } = useToast();

  const [transfers, setTransfers] = useState<Transfer[]>(MOCK_TRANSFERS);
  const [selectedCountryCode, setSelectedCountryCode] = useState("SN");
  const [amountSent, setAmountSent] = useState<number>(100);
  const [currencySent, setCurrencySent] = useState("USDT");
  const [method, setMethod] = useState<TransferMethod>("mobile_money");
  const [selectedOperator, setSelectedOperator] = useState("Orange Money");
  const [phonePrefix, setPhonePrefix] = useState("+221");
  const [phoneNumber, setPhoneNumber] = useState("77 123 45 67");
  const [recipientName, setRecipientName] = useState("Sadio Diallo");
  const [notes, setNotes] = useState("Ex: Paiement fournisseur");

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Active country configuration
  const currentCountry =
    SUPPORTED_DESTINATIONS.find((c) => c.countryCode === selectedCountryCode) ||
    SUPPORTED_DESTINATIONS[0];

  const currentMethodConfig = currentCountry.methods.find(
    (m) => m.id === method
  );
  const availableOperators =
    currentMethodConfig?.operators || currentCountry.methods[0]?.operators || [];

  // Calculations
  const rate = currentCountry.rateToUSDT;
  const grossReceived = amountSent * rate;
  const estimatedFee = 0.5; // 0.50 USDT
  const netReceived = (amountSent - estimatedFee) * rate;

  const handleCountryChange = (code: string) => {
    setSelectedCountryCode(code);
    const country = SUPPORTED_DESTINATIONS.find((c) => c.countryCode === code);
    if (country) {
      if (code === "SN") setPhonePrefix("+221");
      else if (code === "CI") setPhonePrefix("+225");
      else if (code === "BJ") setPhonePrefix("+229");
      else if (code === "ML") setPhonePrefix("+223");
      else if (code === "NG") setPhonePrefix("+234");
      else if (code === "KE") setPhonePrefix("+254");

      const defaultOp = country.methods[0]?.operators[0] || "";
      setSelectedOperator(defaultOp);
    }
  };

  const handleInitiateTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (amountSent <= 0) {
      error("Montant invalide", "Veuillez saisir un montant supérieur à 0.");
      return;
    }
    if (method === "mobile_money" && !phoneNumber.trim()) {
      error("Numéro requis", "Veuillez renseigner le numéro de mobile du bénéficiaire.");
      return;
    }
    setIsConfirmOpen(true);
  };

  const handleConfirmTransfer = () => {
    setIsProcessing(true);
    setTimeout(() => {
      const newTransfer: Transfer = {
        id: `tr-${Date.now()}`,
        recipientName: recipientName || "Bénéficiaire",
        recipientCountry: currentCountry.country,
        countryCode: currentCountry.countryCode,
        method,
        operator: selectedOperator,
        phoneNumber: `${phonePrefix} ${phoneNumber}`,
        amountSent,
        currencySent: currencySent as any,
        amountReceived: Math.round(netReceived),
        currencyReceived: currentCountry.currency,
        fee: estimatedFee,
        exchangeRate: rate,
        status: "processing",
        date: "À l'instant",
        estimatedDelivery: "Quelques minutes",
        notes,
      };

      setTransfers([newTransfer, ...transfers]);
      setIsProcessing(false);
      setIsConfirmOpen(false);
      success(
        "Transfert initié !",
        `${amountSent} ${currencySent} envoyés vers ${selectedOperator} (${currentCountry.country}).`
      );
    }, 1200);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
          Transférer de l&apos;argent
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Envoyez de l&apos;argent à vos partenaires, proches ou bénéficiaires en Afrique et dans le monde.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Form: Détails du transfert */}
        <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-2xl border border-[#EAECEF] shadow-sm">
          <h2 className="text-base font-bold text-gray-900 mb-6">
            Détails du transfert
          </h2>

          <form onSubmit={handleInitiateTransfer} className="space-y-5">
            {/* Montant à envoyer */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Montant à envoyer
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={amountSent || ""}
                    onChange={(e) => setAmountSent(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2.5 text-sm bg-white border border-gray-200 focus:border-[#F5C200] focus:ring-2 focus:ring-[#F5C200]/20 rounded-xl text-gray-900 font-bold outline-none"
                    placeholder="100"
                  />
                </div>
                <div className="w-32 shrink-0">
                  <select
                    value={currencySent}
                    onChange={(e) => setCurrencySent(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-[#F5F6F9] border border-gray-200 rounded-xl font-bold text-gray-900 outline-none cursor-pointer focus:border-[#F5C200]"
                  >
                    <option value="USDT">USDT</option>
                    <option value="USDC">USDC</option>
                    <option value="BTC">BTC</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Pays de destination */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Pays de destination
              </label>
              <select
                value={selectedCountryCode}
                onChange={(e) => handleCountryChange(e.target.value)}
                className="w-full px-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl text-gray-900 font-medium outline-none focus:border-[#F5C200] cursor-pointer"
              >
                {SUPPORTED_DESTINATIONS.map((c) => (
                  <option key={c.countryCode} value={c.countryCode}>
                    {c.flag} {c.country} ({c.currency})
                  </option>
                ))}
              </select>
            </div>

            {/* Méthode de réception */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                Méthode de réception
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setMethod("mobile_money")}
                  className={cn(
                    "flex flex-col sm:flex-row items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all text-center",
                    method === "mobile_money"
                      ? "bg-[#FFFBEB] border-[#F5C200] text-gray-900 shadow-sm"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  )}
                >
                  <Smartphone className="w-4 h-4 text-[#F5C200] shrink-0" />
                  <span>Mobile Money</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMethod("bank_account")}
                  className={cn(
                    "flex flex-col sm:flex-row items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all text-center",
                    method === "bank_account"
                      ? "bg-[#FFFBEB] border-[#F5C200] text-gray-900 shadow-sm"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  )}
                >
                  <Building2 className="w-4 h-4 text-[#F5C200] shrink-0" />
                  <span>Compte bancaire</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMethod("cash_pickup")}
                  className={cn(
                    "flex flex-col sm:flex-row items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all text-center",
                    method === "cash_pickup"
                      ? "bg-[#FFFBEB] border-[#F5C200] text-gray-900 shadow-sm"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  )}
                >
                  <Banknote className="w-4 h-4 text-[#F5C200] shrink-0" />
                  <span>Cash pickup</span>
                </button>
              </div>
            </div>

            {/* Opérateur */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Opérateur
              </label>
              <select
                value={selectedOperator}
                onChange={(e) => setSelectedOperator(e.target.value)}
                className="w-full px-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl text-gray-900 font-medium outline-none focus:border-[#F5C200] cursor-pointer"
              >
                {availableOperators.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
            </div>

            {/* Numéro de téléphone or Account */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                {method === "mobile_money"
                  ? "Numéro de téléphone"
                  : method === "bank_account"
                  ? "IBAN / Numéro de compte bancaire"
                  : "Numéro de pièce d'identité (CNI/Passeport)"}
              </label>
              <div className="flex gap-2">
                {method === "mobile_money" && (
                  <div className="w-24 shrink-0">
                    <input
                      type="text"
                      readOnly
                      value={phonePrefix}
                      className="w-full px-3 py-2.5 text-sm bg-[#F5F6F9] border border-gray-200 rounded-xl font-medium text-gray-700 text-center outline-none"
                    />
                  </div>
                )}
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder={
                    method === "mobile_money"
                      ? "77 123 45 67"
                      : "SN08 0100 1020 3040 50"
                  }
                  className="flex-1 px-4 py-2.5 text-sm bg-white border border-gray-200 focus:border-[#F5C200] focus:ring-2 focus:ring-[#F5C200]/20 rounded-xl text-gray-900 outline-none"
                />
              </div>
            </div>

            {/* Bénéficiaire */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Nom complet du bénéficiaire
              </label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Ex: Sadio Diallo"
                className="w-full px-4 py-2.5 text-sm bg-white border border-gray-200 focus:border-[#F5C200] focus:ring-2 focus:ring-[#F5C200]/20 rounded-xl text-gray-900 outline-none"
              />
            </div>

            {/* Notes (optionnel) */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Notes (optionnel)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Paiement fournisseur"
                className="w-full px-4 py-2.5 text-sm bg-white border border-gray-200 focus:border-[#F5C200] rounded-xl text-gray-900 outline-none"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-3.5 px-6 rounded-xl bg-[#F5C200] hover:bg-[#E5B500] text-[#0f172a] font-extrabold text-sm shadow-md shadow-[#F5C200]/25 transition-all duration-150 transform active:scale-[0.99] flex items-center justify-center gap-2"
              >
                <span>Continuer</span>
                <ArrowRight className="w-4 h-4 stroke-[3]" />
              </button>
            </div>
          </form>
        </div>

        {/* Right side: Résumé du transfert + Transferts récents */}
        <div className="lg:col-span-5 space-y-6">
          {/* Résumé du transfert (Mockup Screen 3 Top Right) */}
          <FeeSummary
            amountSent={amountSent}
            currencySent={currencySent}
            fiatEquivalent={grossReceived}
            fiatCurrency={currentCountry.currency}
            amountReceived={netReceived}
            currencyReceived={currentCountry.currency}
            estimatedFee={estimatedFee}
            feeCurrency={currencySent}
            exchangeRate={rate}
            exchangeRateText={`1 ${currencySent} = ${rate.toLocaleString("fr-FR")} ${currentCountry.currency}`}
            estimatedDelivery="Quelques minutes"
          />

          {/* Transferts récents (Mockup Screen 3 Bottom Right) */}
          <div className="bg-white p-6 rounded-2xl border border-[#EAECEF] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">
                Transferts récents
              </h3>
              <button className="text-xs font-bold text-gray-700 hover:text-black">
                Voir tout →
              </button>
            </div>

            <div className="divide-y divide-gray-100">
              {transfers.slice(0, 3).map((tr) => (
                <div
                  key={tr.id}
                  className="py-3.5 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 font-bold flex items-center justify-center shrink-0">
                      {tr.countryCode === "SN"
                        ? "🇸🇳"
                        : tr.countryCode === "ML"
                        ? "🇲🇱"
                        : "🌍"}
                    </div>
                    <div>
                      <div className="font-bold text-gray-900">
                        {tr.recipientName}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {tr.recipientCountry} • {tr.operator}
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex items-center gap-3">
                    <div>
                      <div className="font-bold text-gray-900">
                        {tr.amountSent} {tr.currencySent}
                      </div>
                      <div className="text-[11px] text-gray-400">
                        {tr.amountReceived.toLocaleString("fr-FR")}{" "}
                        {tr.currencyReceived}
                      </div>
                    </div>
                    <StatusBadge status={tr.status} size="sm" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmTransfer}
        isLoading={isProcessing}
        title="Confirmer l'envoi du transfert"
        description={`Vous êtes sur le point d'envoyer ${amountSent} ${currencySent} vers ${recipientName} (${selectedOperator} - ${currentCountry.country}). Le bénéficiaire recevra environ ${Math.round(netReceived).toLocaleString("fr-FR")} ${currentCountry.currency}.`}
        confirmLabel="Confirmer le transfert"
        cancelLabel="Vérifier les détails"
        variant="primary"
      />
    </div>
  );
}

export default function TransfertsPage() {
  return (
    <ToastProvider>
      <AppLayout>
        <TransfertsContent />
      </AppLayout>
    </ToastProvider>
  );
}
