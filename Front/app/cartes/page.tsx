"use client";

import React, { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/ui/StatCard";
import { VirtualCardItem } from "@/components/cards/VirtualCardItem";
import { CategoryDonutChart } from "@/components/cards/CategoryDonutChart";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import {
  MOCK_CARDS,
  MOCK_CARD_EXPENSES,
  MOCK_CARD_STATS,
  MOCK_USER,
} from "@/lib/mock-data";
import { VirtualCard } from "@/types";
import { Plus, X, ShieldAlert, CreditCard, ArrowRight, ShieldCheck, ArrowLeftRight, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

function CartesContent() {
  const { success, info, error: toastError } = useToast();
  const [cards, setCards] = useState<VirtualCard[]>(MOCK_CARDS);
  const [expenses, setExpenses] = useState(MOCK_CARD_EXPENSES);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isKycModalOpen, setIsKycModalOpen] = useState(false);

  // KYC Verification state required by Bitnob
  const [kycStatus, setKycStatus] = useState<"unverified" | "pending_review" | "approved">("unverified");
  const [kycIdType, setKycIdType] = useState<"national_id" | "passport" | "drivers_license">("national_id");
  const [kycIdNumber, setKycIdNumber] = useState("");
  const [kycDateOfBirth, setKycDateOfBirth] = useState("1995-06-15");
  const [kycLine1, setKycLine1] = useState("Almadies Zone 8");
  const [kycCity, setKycCity] = useState("Dakar");
  const [kycCountry, setKycCountry] = useState("SEN");
  const [isSubmittingKyc, setIsSubmittingKyc] = useState(false);

  // New card modal form state
  const [newCardName, setNewCardName] = useState(MOCK_USER.name.toUpperCase());
  const [newCardLimit, setNewCardLimit] = useState(1000);
  const [newCardTheme, setNewCardTheme] = useState<"yellow" | "black" | "silver">("yellow");

  const handleOpenCardCreation = () => {
    if (kycStatus !== "approved") {
      info(
        "Vérification KYC requise",
        "Conformément aux exigences Bitnob, veuillez valider votre identité avant d'émettre une carte."
      );
      setIsKycModalOpen(true);
      return;
    }
    setIsModalOpen(true);
  };

  const handleSubmitKyc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kycIdNumber.trim()) {
      toastError("Numéro de pièce manquant", "Veuillez renseigner votre numéro de pièce officielle.");
      return;
    }

    setIsSubmittingKyc(true);
    try {
      const res = await fetch("/api/cards/kyc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "amadou@sunupay.com",
          idType: kycIdType,
          idNumber: kycIdNumber.trim(),
          dateOfBirth: kycDateOfBirth,
          line1: kycLine1.trim(),
          city: kycCity.trim(),
          country: kycCountry,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setKycStatus("approved");
        setIsKycModalOpen(false);
        success(
          "Identité approuvée par Bitnob",
          "Votre profil KYC est validé. La création de cartes virtuelles est désormais débloquée."
        );
        // Directement ouvrir le formulaire de création de carte
        setIsModalOpen(true);
      } else {
        toastError("Erreur KYC", data.error || "Impossible de valider les documents auprès de Bitnob.");
      }
    } catch {
      toastError("Erreur réseau", "Impossible de joindre le service de conformité Bitnob.");
    } finally {
      setIsSubmittingKyc(false);
    }
  };

  const handleToggleCardStatus = (id: string) => {
    setCards((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const nextStatus = c.status === "active" ? "frozen" : "active";
          if (nextStatus === "frozen") {
            info("Carte gelée", `La carte **** ${c.last4} a été mise en pause.`);
          } else {
            success("Carte réactivée", `La carte **** ${c.last4} est maintenant utilisable.`);
          }
          return { ...c, status: nextStatus };
        }
        return c;
      })
    );
  };

  const handleCreateDemoCard = (e: React.FormEvent) => {
    e.preventDefault();
    const randomLast4 = Math.floor(1000 + Math.random() * 9000).toString();
    const newCard: VirtualCard = {
      id: `card-${Date.now()}`,
      cardNumber: `5340 8892 4110 ${randomLast4}`,
      maskedNumber: `•••• •••• •••• ${randomLast4}`,
      last4: randomLast4,
      cardHolder: newCardName.trim().toUpperCase() || "AMADOU DIONE",
      expiryDate: "11/29",
      cvv: "591",
      brand: "mastercard",
      cardType: "virtual",
      status: "active",
      balance: newCardLimit,
      monthlyLimit: newCardLimit,
      spentThisMonth: 0,
      theme: newCardTheme,
    };

    setCards([newCard, ...cards]);
    setIsModalOpen(false);
    success(
      "Carte virtuelle émise avec succès",
      `Carte Mastercard **** ${randomLast4} activée via le profil client Bitnob approuvé.`
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Row: Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              Mes cartes
            </h1>
            {kycStatus === "approved" ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>KYC Bitnob Approuvé</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>KYC Requis</span>
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Émettez et gérez vos cartes virtuelles sécurisées pour vos paiements en ligne et dépenses professionnelles.
          </p>
        </div>

        <button
          onClick={handleOpenCardCreation}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#F5C200] hover:bg-[#E5B500] text-[#0f172a] font-bold text-sm shadow-md shadow-[#F5C200]/25 transition-all duration-150 transform hover:-translate-y-0.5 active:translate-y-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Créer une carte</span>
        </button>
      </div>

      {/* KYC Compliance Banner if not yet approved */}
      {kycStatus !== "approved" && (
        <div className="p-4 rounded-2xl bg-[#FFFBEB] border border-[#FDE68A] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fadeIn">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-[#F5C200] text-[#0F172A] shrink-0 mt-0.5">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-[#92400E]">
                Vérification d&apos;identité (KYC) requise par Bitnob
              </div>
              <p className="text-xs text-[#B45309] mt-0.5 leading-relaxed max-w-2xl">
                Conformément aux normes réglementaires et aux exigences du partenaire Bitnob, l&apos;émission de cartes virtuelles nécessite la validation préalable de votre identité.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsKycModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white font-bold text-xs shrink-0 transition-colors shadow-xs"
          >
            <span>Vérifier mon identité</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top 4 Stat Cards - Uni-couleur & Compact */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Dépenses totales */}
        <StatCard
          title="Dépenses totales"
          value={`$${MOCK_CARD_STATS.totalSpent.toFixed(2)}`}
          variant="white"
          allowMask
          icon={
            <div className="w-6 h-6 rounded-full bg-[#FFF9E6] text-[#E5B500] flex items-center justify-center shrink-0 border border-[#F5C200]/30 shadow-xs">
              <Wallet className="w-3.5 h-3.5" />
            </div>
          }
          badge={{
            text: `+${MOCK_CARD_STATS.spentGrowthPct}% ce mois`,
            trend: "up",
          }}
        />

        {/* Cartes actives */}
        <StatCard
          title="Cartes actives"
          value={`${cards.filter((c) => c.status === "active").length}`}
          subValue={`sur ${MOCK_CARD_STATS.maxCardsCount} maximum`}
          variant="white"
          icon={
            <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200/60 shadow-xs">
              <CreditCard className="w-3.5 h-3.5" />
            </div>
          }
        />

        {/* Limite totale */}
        <StatCard
          title="Limite totale"
          value={`$${MOCK_CARD_STATS.totalLimit.toLocaleString("fr-FR")}`}
          subValue={`dont $${MOCK_CARD_STATS.usedLimit.toLocaleString("fr-FR")} utilisé`}
          variant="white"
          icon={
            <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-200/60 shadow-xs">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
          }
        />

        {/* Transactions */}
        <StatCard
          title="Transactions"
          value={`${MOCK_CARD_STATS.transactionsThisMonth}`}
          subValue="ce mois"
          variant="white"
          icon={
            <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 border border-slate-200/60 shadow-xs">
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </div>
          }
        />
      </div>

      {/* Middle Row: Mes Cartes Carousel & Dépenses par catégorie */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Virtual Cards List / Carousel */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-[#EAECEF] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900">Mes cartes</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Cartes Mastercard sécurisées avec contrôle du plafond
              </p>
            </div>
            <span className="text-xs bg-amber-50 text-amber-800 font-semibold px-2.5 py-1 rounded-full border border-amber-200/60">
              {cards.length} configurées
            </span>
          </div>

          {/* Horizontal scroll cards container */}
          <div className="flex items-center gap-4 overflow-x-auto pb-4 pt-1 px-1">
            {cards.map((card) => (
              <VirtualCardItem
                key={card.id}
                card={card}
                onToggleStatus={handleToggleCardStatus}
              />
            ))}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs text-gray-500">
            <span>Cliquez sur l&apos;interrupteur pour geler/dégeler une carte</span>
            <span className="font-semibold text-gray-700">3DS Ready</span>
          </div>
        </div>

        {/* Dépenses par catégorie (Donut Chart) */}
        <div className="lg:col-span-5">
          <CategoryDonutChart />
        </div>
      </div>

      {/* Enveloppes Budgétaires Cloisonnées (Bitnob Hackathon Scenario) */}
      <div className="bg-white rounded-2xl border border-[#EAECEF] p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-gray-900">
                Enveloppes budgétaires par carte virtuelle
              </h3>
              <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                Bitnob Virtual Cards
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Chaque usage dispose de son propre budget cloisonné et de sa carte dédiée avec gel automatique à épuisement.
            </p>
          </div>

          <span className="text-xs text-gray-400 font-medium">Rechargement auto le 1er du mois</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          {/* Enveloppe 1: Meta Ads */}
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-900 text-sm">Meta Ads</span>
              <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full animate-pulse">
                Alerte : Solde bas
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-xl font-black text-gray-900">$14.50</span>
                <span className="text-xs text-gray-500"> / $100.00</span>
              </div>
              <span className="text-xs text-rose-600 font-bold">85.5% consommé</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
              <div className="bg-rose-500 h-full rounded-full" style={{ width: "85.5%" }} />
            </div>
            <p className="text-[11px] text-gray-500 leading-tight">
              Gel automatique activé si solde = $0. Carte liée : **** 4321
            </p>
          </div>

          {/* Enveloppe 2: Outils SaaS */}
          <div className="p-4 rounded-xl border border-gray-200 bg-white space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-900 text-sm">Outils (Notion, Figma, Canva)</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                Sain
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-xl font-black text-gray-900">$24.99</span>
                <span className="text-xs text-gray-500"> / $50.00</span>
              </div>
              <span className="text-xs text-emerald-600 font-bold">50% consommé</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
              <div className="bg-[#F5C200] h-full rounded-full" style={{ width: "50%" }} />
            </div>
            <p className="text-[11px] text-gray-500 leading-tight">
              Dépenses courantes logicielles. Carte liée : **** 9867
            </p>
          </div>

          {/* Enveloppe 3: Formation */}
          <div className="p-4 rounded-xl border border-gray-200 bg-white space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-900 text-sm">Formation & Livres</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                Intact
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-xl font-black text-gray-900">$30.00</span>
                <span className="text-xs text-gray-500"> / $30.00</span>
              </div>
              <span className="text-xs text-gray-500 font-bold">0% consommé</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
              <div className="bg-gray-300 h-full rounded-full" style={{ width: "0%" }} />
            </div>
            <p className="text-[11px] text-gray-500 leading-tight">
              Abonnements & documentation. Carte liée : **** 1123
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Row: Historique des dépenses */}
      <div className="bg-white rounded-2xl border border-[#EAECEF] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-bold text-gray-900">
              Historique des dépenses
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Paiements récents débités sur vos cartes virtuelles
            </p>
          </div>

          <button className="text-xs font-bold text-gray-700 hover:text-black">
            Voir tout →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                <th className="pb-3 px-4 font-medium">Marchand</th>
                <th className="pb-3 px-4 font-medium">Catégorie</th>
                <th className="pb-3 px-4 font-medium">Montant</th>
                <th className="pb-3 px-4 font-medium">Carte</th>
                <th className="pb-3 px-4 font-medium text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-sm">
              {expenses.map((exp) => (
                <tr key={exp.id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-gray-900">
                    {exp.merchant}
                  </td>
                  <td className="py-3.5 px-4 text-xs text-gray-500">
                    {exp.category}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-gray-900">
                    ${exp.amount.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-gray-600">
                    •••• {exp.cardLast4}
                  </td>
                  <td className="py-3.5 px-4 text-right text-xs text-gray-500">
                    {exp.date}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Card Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-[#0f172a]/60 backdrop-blur-sm"
            onClick={() => setIsModalOpen(false)}
          />

          <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-md w-full p-6 z-10 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#F5C200]" />
                <h3 className="text-base font-bold text-gray-900">
                  Créer une carte virtuelle
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Clear Demonstration Notice as required by prompt */}
            <div className="my-4 p-3 bg-amber-50 rounded-xl border border-amber-200/60 flex items-start gap-2.5 text-xs text-amber-900 leading-relaxed">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p>
                <strong>Environnement de Démonstration :</strong> Cette interface simule la création de cartes virtuelles. Aucune carte bancaire réelle n&apos;est émise tant que l&apos;API émetteur n&apos;est pas connectée.
              </p>
            </div>

            <form onSubmit={handleCreateDemoCard} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Nom sur la carte
                </label>
                <input
                  type="text"
                  required
                  value={newCardName}
                  onChange={(e) => setNewCardName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm uppercase bg-white border border-gray-200 rounded-xl focus:border-[#F5C200] outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Plafond mensuel ($ USD)
                </label>
                <input
                  type="number"
                  min="50"
                  max="10000"
                  step="50"
                  required
                  value={newCardLimit}
                  onChange={(e) => setNewCardLimit(parseInt(e.target.value) || 500)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:border-[#F5C200] outline-none font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1.5">
                  Style visuel de la carte
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewCardTheme("yellow")}
                    className={cn(
                      "p-2.5 rounded-xl border font-bold text-center transition-all",
                      newCardTheme === "yellow"
                        ? "border-[#F5C200] bg-[#FFFBEB] text-[#0f172a] shadow-sm"
                        : "border-gray-200 text-gray-500"
                    )}
                  >
                    Gold Sunu
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCardTheme("black")}
                    className={cn(
                      "p-2.5 rounded-xl border font-bold text-center transition-all",
                      newCardTheme === "black"
                        ? "border-[#0f172a] bg-[#0f172a] text-white shadow-sm"
                        : "border-gray-200 text-gray-500"
                    )}
                  >
                    Navy Bitnob
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCardTheme("silver")}
                    className={cn(
                      "p-2.5 rounded-xl border font-bold text-center transition-all",
                      newCardTheme === "silver"
                        ? "border-slate-400 bg-slate-100 text-slate-800 shadow-sm"
                        : "border-gray-200 text-gray-500"
                    )}
                  >
                    Silver
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold bg-[#F5C200] hover:bg-[#E5B500] text-[#0f172a] rounded-xl shadow-md shadow-[#F5C200]/25"
                >
                  Émettre la carte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bitnob KYC Verification Modal */}
      {isKycModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 bg-[#0F172A] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#F5C200] text-[#0F172A]">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-white">
                    Vérification d&apos;identité KYC
                  </h3>
                  <span className="text-[10px] text-amber-300 font-bold uppercase tracking-wider">
                    Conformité obligatoire Bitnob
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsKycModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitKyc} className="p-6 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 leading-relaxed">
                <span className="font-bold">Pourquoi cette vérification ?</span>
                <p className="text-[11px] text-blue-800 mt-0.5">
                  L&apos;émission de cartes virtuelles internationales exige l&apos;approbation de votre identité par notre partenaire Bitnob. Vos données sont vérifiées de manière chiffrée.
                </p>
              </div>

              {/* ID Type */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Type de pièce d&apos;identité <span className="text-rose-500">*</span>
                </label>
                <select
                  value={kycIdType}
                  onChange={(e: any) => setKycIdType(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl font-medium focus:border-[#F5C200] outline-none"
                >
                  <option value="national_id">Carte Nationale d&apos;Identité (CNI / NIN)</option>
                  <option value="passport">Passeport biométrique</option>
                  <option value="drivers_license">Permis de conduire officiel</option>
                </select>
              </div>

              {/* ID Number & Birth Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Numéro de la pièce <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ex: 1759199200341"
                    value={kycIdNumber}
                    onChange={(e) => setKycIdNumber(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl font-medium focus:border-[#F5C200] outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Date de naissance <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={kycDateOfBirth}
                    onChange={(e) => setKycDateOfBirth(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl font-medium focus:border-[#F5C200] outline-none"
                  />
                </div>
              </div>

              {/* Address: Line 1, City, Country */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Adresse de résidence <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: 14 Rue des Almadies"
                  value={kycLine1}
                  onChange={(e) => setKycLine1(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl font-medium focus:border-[#F5C200] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Ville <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Dakar"
                    value={kycCity}
                    onChange={(e) => setKycCity(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl font-medium focus:border-[#F5C200] outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Pays <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={kycCountry}
                    onChange={(e) => setKycCountry(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl font-medium focus:border-[#F5C200] outline-none"
                  >
                    <option value="SEN">Sénégal (SEN)</option>
                    <option value="NGA">Nigéria (NGA)</option>
                    <option value="GHA">Ghana (GHA)</option>
                    <option value="CIV">Côte d&apos;Ivoire (CIV)</option>
                    <option value="CMR">Cameroun (CMR)</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsKycModalOpen(false)}
                  className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingKyc}
                  className="px-5 py-2.5 font-bold bg-[#F5C200] hover:bg-[#E5B500] text-[#0f172a] rounded-xl shadow-md shadow-[#F5C200]/25 disabled:opacity-50"
                >
                  {isSubmittingKyc ? "Vérification en cours..." : "Valider mon identité"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CartesPage() {
  return (
    <ToastProvider>
      <AppLayout>
        <CartesContent />
      </AppLayout>
    </ToastProvider>
  );
}
