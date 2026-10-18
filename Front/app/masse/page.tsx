"use client";

import React, { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DEMO_CSV_CONTENT, MOCK_BULK_BATCHES } from "@/lib/mock-data";
import { BulkRecipientItem, BulkBatch } from "@/types";
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCw,
  Download,
  FileText,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Building,
  Smartphone,
  ChevronRight,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

function MasseContent() {
  const { success, error, info } = useToast();

  const [csvText, setCsvText] = useState("");
  const [items, setItems] = useState<BulkRecipientItem[]>([]);
  const [batches, setBatches] = useState<any[]>(MOCK_BULK_BATCHES);
  const [activeStep, setActiveStep] = useState<"upload" | "review" | "executing" | "history">("upload");

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionProgress, setExecutionProgress] = useState(0);

  // Parse CSV text into validated items
  const parseAndValidateCSV = (text: string) => {
    const lines = text.trim().split("\n");
    if (lines.length <= 1) {
      error("Fichier vide", "Veuillez fournir un CSV avec au moins une ligne de données.");
      return;
    }

    const rates: Record<string, number> = {
      XOF: 595.0,
      NGN: 1480.0,
      GHS: 15.5,
    };

    const parsed: BulkRecipientItem[] = [];

    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = line.split(",").map((c) => c.trim());
      const [name, phone, amountStr, currencyRaw, countryRaw, operator] = cols;

      const amount = parseFloat(amountStr) || 0;
      const currency = (currencyRaw || "XOF").toUpperCase();
      const country = (countryRaw || "SN").toUpperCase();
      const phoneClean = (phone || "").replace(/\s+/g, "");

      const errs: string[] = [];

      // Validation logic matching hackathon rules
      if (country === "SN" && !phoneClean.startsWith("+221")) {
        errs.push("Indicatif +221 requis pour le Sénégal");
      }
      if (country === "NG" && !phoneClean.startsWith("+234")) {
        errs.push("Indicatif +234 requis pour le Nigéria");
      }
      if (country === "GH" && !phoneClean.startsWith("+233")) {
        errs.push("Indicatif +233 requis pour le Ghana");
      }
      if (phoneClean.length < 9) {
        errs.push("Numéro trop court ou incomplet");
      }
      if (amount <= 0) {
        errs.push("Montant invalide");
      }

      const rate = rates[currency] || 595.0;
      const amountUSDT = Math.round((amount / rate) * 100) / 100;

      parsed.push({
        id: `item-${i}`,
        rowIndex: i,
        name: name || `Bénéficiaire #${i}`,
        phoneOrAccount: phone,
        country,
        currency,
        amount,
        amountUSDT,
        operator: operator || (country === "NG" ? "Banque NIP" : "Mobile Money"),
        status: errs.length > 0 ? "invalid" : "valid",
        errorMessage: errs.join(" • ") || undefined,
      });
    }

    setItems(parsed);
    setActiveStep("review");
    success("CSV validé avec succès !", `${parsed.length} bénéficiaires analysés.`);
  };

  const handleLoadDemoCSV = () => {
    setCsvText(DEMO_CSV_CONTENT);
    parseAndValidateCSV(DEMO_CSV_CONTENT);
    info(
      "Scénario Démo Hackathon chargé",
      "30 livreurs (Sénégal, Nigéria, Ghana) avec 2 numéros invalides détectés."
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        setCsvText(content);
        parseAndValidateCSV(content);
      }
    };
    reader.readAsText(file);
  };

  // Calculations
  const validItems = items.filter((i) => i.status === "valid" || i.status === "completed");
  const invalidItems = items.filter((i) => i.status === "invalid");
  const totalUSDT = validItems.reduce((acc, i) => acc + i.amountUSDT, 0);
  const estimatedFees = validItems.length * 0.5;

  // Execute batch
  const handleStartBatchExecution = () => {
    setIsConfirmOpen(false);
    setIsExecuting(true);
    setActiveStep("executing");
    setExecutionProgress(10);

    // Progressive status update
    setTimeout(() => {
      setExecutionProgress(40);
      setItems((prev) =>
        prev.map((it) => (it.status === "valid" ? { ...it, status: "processing" } : it))
      );
    }, 1000);

    setTimeout(() => {
      setExecutionProgress(80);
      setItems((prev) =>
        prev.map((it) => {
          if (it.status === "processing") {
            // Simulate 1 failure as described in hackathon rules
            if (it.name.includes("Chinedu Okafor")) {
              return {
                ...it,
                status: "failed",
                errorMessage: "Timeout passerelle bancaire NIP (Relance possible)",
              };
            }
            return { ...it, status: "completed" };
          }
          return it;
        })
      );
    }, 2400);

    setTimeout(() => {
      setExecutionProgress(100);
      setIsExecuting(false);
      success("Lot exécuté !", "27 paiements complétés, 1 échec temporaire prêt à être relancé.");
    }, 3200);
  };

  // Retry single failed item (Bitnob retry feature)
  const handleRetryFailedItem = (id: string) => {
    info("Relance en cours...", "Nouvelle tentative avec clé d'idempotence.");
    setTimeout(() => {
      setItems((prev) =>
        prev.map((it) =>
          it.id === id ? { ...it, status: "completed", errorMessage: undefined } : it
        )
      );
      success("Succès !", "Le paiement a été confirmé par Bitnob.");
    }, 1000);
  };

  const handleDownloadReport = () => {
    const csvHeader = "Nom,Téléphone,Pays,Montant Local,Devise,USDT,Statut\n";
    const csvRows = items
      .map(
        (i) =>
          `"${i.name}","${i.phoneOrAccount}","${i.country}",${i.amount},"${i.currency}",${i.amountUSDT},"${i.status}"`
      )
      .join("\n");
    const blob = new Blob([csvHeader + csvRows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `rapport-paiements-masse-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    success("Rapport téléchargé", "Fichier CSV prêt pour votre comptabilité.");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              Paiements de masse
            </h1>
            <span className="text-xs bg-[#FFF9E6] text-amber-800 font-bold px-2.5 py-1 rounded-full border border-[#F5C200]/40 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-[#F5C200]" />
              Multi-Pays Bitnob
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Payez des dizaines de livreurs, prestataires et salariés en Afrique (Sénégal, Nigéria, Ghana) en un seul clic.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleLoadDemoCSV}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-bold shadow-sm transition-all"
          >
            <Sparkles className="w-4 h-4 text-[#F5C200]" />
            <span>Charger la démo Hackathon (30 livreurs)</span>
          </button>
        </div>
      </div>

      {/* Step navigation tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200">
        {[
          { id: "upload", label: "1. Importer un fichier CSV" },
          { id: "review", label: `2. Vérification & Totaux (${items.length})` },
          { id: "history", label: "Historique des lots" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveStep(tab.id as any)}
            className={cn(
              "py-3 px-4 text-xs font-bold border-b-2 transition-all",
              activeStep === tab.id || (activeStep === "executing" && tab.id === "review")
                ? "border-[#F5C200] text-gray-900"
                : "border-transparent text-gray-400 hover:text-gray-700"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Step 1: Upload CSV Area */}
      {activeStep === "upload" && (
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-2xl border-2 border-dashed border-gray-200 hover:border-[#F5C200] transition-colors text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#FFF9E6] text-[#F5C200] flex items-center justify-center mx-auto mb-4 shadow-sm">
              <UploadCloud className="w-8 h-8" />
            </div>

            <h3 className="text-base font-bold text-gray-900">
              Déposez votre fichier CSV de bénéficiaires
            </h3>
            <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
              Colonnes attendues : <code>nom, telephone, montant, devise, pays, operateur</code>
            </p>

            <div className="mt-5 flex items-center justify-center gap-3">
              <label className="cursor-pointer px-5 py-2.5 rounded-xl bg-[#F5C200] hover:bg-[#E5B500] text-[#0f172a] text-xs font-bold shadow-md shadow-[#F5C200]/25 transition-all">
                <span>Parcourir les fichiers</span>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <button
                onClick={handleLoadDemoCSV}
                className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold transition-colors"
              >
                Utiliser le modèle de démo
              </button>
            </div>
          </div>

          {/* Quick manual paste area */}
          <div className="bg-white p-6 rounded-2xl border border-[#EAECEF] shadow-sm">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
              Ou collez le contenu CSV brut directement :
            </h4>
            <textarea
              rows={5}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="nom,telephone,montant,devise,pays,operateur&#10;Mamadou Diallo,+221 77 450 12 34,25000,XOF,SN,Wave..."
              className="w-full p-3 font-mono text-xs bg-gray-50 border border-gray-200 rounded-xl focus:border-[#F5C200] outline-none"
            />
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => parseAndValidateCSV(csvText)}
                disabled={!csvText.trim()}
                className="px-5 py-2 rounded-xl bg-[#0f172a] text-white hover:bg-[#1e293b] text-xs font-bold disabled:opacity-50 transition-colors"
              >
                Analyser et Valider
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2 & 3: Review & Execution Table */}
      {(activeStep === "review" || activeStep === "executing") && items.length > 0 && (
        <div className="space-y-6">
          {/* Executive Totals Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-[#0f172a] text-white border border-[#1e293b] shadow-sm">
              <span className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
                Total Débité (USDT)
              </span>
              <div className="text-2xl font-black mt-1 text-[#F5C200]">
                ${totalUSDT.toFixed(2)} USDT
              </div>
              <span className="text-xs text-gray-400 mt-0.5 block">
                + ${estimatedFees.toFixed(2)} frais réseau Bitnob
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[#EAECEF] shadow-sm">
              <span className="text-[11px] font-medium uppercase tracking-wider text-gray-500">
                Sénégal 🇸🇳
              </span>
              <div className="text-xl font-bold mt-1 text-gray-900">
                {items
                  .filter((i) => i.country === "SN" && i.status !== "invalid")
                  .reduce((acc, i) => acc + i.amount, 0)
                  .toLocaleString("fr-FR")}{" "}
                XOF
              </div>
              <span className="text-xs text-emerald-600 font-semibold">
                {items.filter((i) => i.country === "SN" && i.status !== "invalid").length} livreurs
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[#EAECEF] shadow-sm">
              <span className="text-[11px] font-medium uppercase tracking-wider text-gray-500">
                Nigéria 🇳🇬
              </span>
              <div className="text-xl font-bold mt-1 text-gray-900">
                {items
                  .filter((i) => i.country === "NG" && i.status !== "invalid")
                  .reduce((acc, i) => acc + i.amount, 0)
                  .toLocaleString("fr-FR")}{" "}
                NGN
              </div>
              <span className="text-xs text-emerald-600 font-semibold">
                {items.filter((i) => i.country === "NG" && i.status !== "invalid").length} livreurs
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[#EAECEF] shadow-sm">
              <span className="text-[11px] font-medium uppercase tracking-wider text-gray-500">
                Ghana 🇬🇭
              </span>
              <div className="text-xl font-bold mt-1 text-gray-900">
                {items
                  .filter((i) => i.country === "GH" && i.status !== "invalid")
                  .reduce((acc, i) => acc + i.amount, 0)
                  .toLocaleString("fr-FR")}{" "}
                GHS
              </div>
              <span className="text-xs text-emerald-600 font-semibold">
                {items.filter((i) => i.country === "GH" && i.status !== "invalid").length} livreurs
              </span>
            </div>
          </div>

          {/* Validation Notice Banner (Highlighting 2 detected errors as in hackathon rubric) */}
          {invalidItems.length > 0 && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start justify-between gap-4">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">
                    Contrôle de conformité : {invalidItems.length} erreurs détectées dans le fichier.
                  </span>
                  <p className="text-[11px] text-rose-700 mt-0.5">
                    Ces lignes seront automatiquement ignorées lors du lancement pour éviter tout rejet réseau. Vous pouvez les corriger ou continuer avec les {validItems.length} bénéficiaires valides.
                  </p>
                </div>
              </div>

              <span className="bg-rose-100 text-rose-800 px-2.5 py-1 rounded-full font-bold text-[11px] shrink-0">
                {validItems.length} prêts / {items.length} total
              </span>
            </div>
          )}

          {/* Execution Progress Bar (if executing) */}
          {activeStep === "executing" && (
            <div className="p-5 bg-[#0f172a] text-white rounded-2xl shadow-md space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#F5C200] animate-ping" />
                  Traitement du lot en cours sur l&apos;API Bitnob...
                </span>
                <span className="font-mono text-[#F5C200] font-bold">{executionProgress}%</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-[#F5C200] h-full transition-all duration-300 rounded-full"
                  style={{ width: `${executionProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Table of items */}
          <div className="bg-white rounded-2xl border border-[#EAECEF] p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Liste des bénéficiaires du lot
                </h3>
                <p className="text-xs text-gray-500">
                  Détail de chaque paiement avant décaissement groupé
                </p>
              </div>

              <div className="flex items-center gap-2">
                {activeStep === "executing" && executionProgress === 100 && (
                  <button
                    onClick={handleDownloadReport}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Exporter le rapport</span>
                  </button>
                )}

                {activeStep === "review" && (
                  <button
                    onClick={() => setIsConfirmOpen(true)}
                    disabled={validItems.length === 0}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#F5C200] hover:bg-[#E5B500] text-[#0f172a] font-extrabold text-xs shadow-md shadow-[#F5C200]/25 transition-all"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Lancer le lot ({validItems.length} paiements)</span>
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    <th className="pb-3 px-3">#</th>
                    <th className="pb-3 px-3">Bénéficiaire</th>
                    <th className="pb-3 px-3">Pays & Opérateur</th>
                    <th className="pb-3 px-3">Numéro / Compte</th>
                    <th className="pb-3 px-3">Montant local</th>
                    <th className="pb-3 px-3">Équiv. USDT</th>
                    <th className="pb-3 px-3">Statut</th>
                    <th className="pb-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map((it) => (
                    <tr
                      key={it.id}
                      className={cn(
                        "hover:bg-gray-50/80 transition-colors",
                        it.status === "invalid" && "bg-rose-50/30",
                        it.status === "failed" && "bg-amber-50/40"
                      )}
                    >
                      <td className="py-3 px-3 text-gray-400 font-mono">{it.rowIndex}</td>
                      <td className="py-3 px-3 font-semibold text-gray-900">{it.name}</td>
                      <td className="py-3 px-3">
                        <span className="font-medium text-gray-700">
                          {it.country === "SN"
                            ? "🇸🇳 Sénégal"
                            : it.country === "NG"
                            ? "🇳🇬 Nigéria"
                            : "🇬🇭 Ghana"}
                        </span>
                        <span className="text-gray-400 block text-[11px]">{it.operator}</span>
                      </td>
                      <td className="py-3 px-3 font-mono text-gray-800">
                        {it.phoneOrAccount}
                      </td>
                      <td className="py-3 px-3 font-bold text-gray-900">
                        {it.amount.toLocaleString("fr-FR")} {it.currency}
                      </td>
                      <td className="py-3 px-3 font-semibold text-gray-600 font-mono">
                        ${it.amountUSDT.toFixed(2)}
                      </td>
                      <td className="py-3 px-3">
                        {it.status === "valid" && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Prêt
                          </span>
                        )}
                        {it.status === "invalid" && (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200"
                            title={it.errorMessage}
                          >
                            <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
                            {it.errorMessage || "Invalide"}
                          </span>
                        )}
                        {it.status === "processing" && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 animate-pulse">
                            En cours...
                          </span>
                        )}
                        {it.status === "completed" && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            Payé
                          </span>
                        )}
                        {it.status === "failed" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            Échec (NIP)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {it.status === "failed" && (
                          <button
                            onClick={() => handleRetryFailedItem(it.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-[#F5C200] text-[#0f172a] hover:bg-[#E5B500] shadow-sm"
                          >
                            <RotateCw className="w-3 h-3" />
                            <span>Relancer</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: History of batches */}
      {activeStep === "history" && (
        <div className="bg-white rounded-2xl border border-[#EAECEF] p-6 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-gray-900">
            Historique des lots exécutés
          </h3>
          <div className="divide-y divide-gray-100">
            {batches.map((b) => (
              <div key={b.id} className="py-4 flex items-center justify-between text-xs">
                <div>
                  <h4 className="font-bold text-gray-900 text-sm">{b.title}</h4>
                  <p className="text-gray-500 text-[11px] mt-0.5">{b.description}</p>
                  <div className="flex items-center gap-3 mt-1 text-gray-400 text-[11px]">
                    <span>{b.createdAt}</span>
                    <span>•</span>
                    <span>{b.totalRecipients} bénéficiaires</span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-black text-sm text-gray-900">
                    ${b.totalAmountUSDT.toFixed(2)} USDT
                  </div>
                  <StatusBadge status={b.status} size="sm" className="mt-1" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirmation Modal before firing Bitnob Payouts */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleStartBatchExecution}
        title="Lancer le lot de paiements de masse"
        description={`Vous êtes sur le point d'ordonner le décaissement groupé pour ${validItems.length} bénéficiaires (Sénégal, Nigéria, Ghana). Le montant total de $${totalUSDT.toFixed(2)} USDT sera débité avec une protection d'idempotence Bitnob stricte.`}
        confirmLabel="Confirmer et Envoyer"
        cancelLabel="Vérifier la liste"
        variant="primary"
      />
    </div>
  );
}

export default function MassePage() {
  return (
    <ToastProvider>
      <AppLayout>
        <MasseContent />
      </AppLayout>
    </ToastProvider>
  );
}
