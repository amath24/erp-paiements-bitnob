"use client";

import React, { useState } from "react";
import { Copy, Check, ExternalLink, ShieldCheck } from "lucide-react";
import { InvoiceQRCode } from "./InvoiceQRCode";
import { CryptoAsset } from "@/types";
import { CryptoIcon } from "../ui/CryptoIcon";
import { useToast } from "../ui/Toast";

interface InvoicePreviewCardProps {
  invoiceNumber: string;
  clientName: string;
  description: string;
  amount: number;
  currency: string;
  acceptedCryptos: CryptoAsset[];
  shareableUrl: string;
}

export function InvoicePreviewCard({
  invoiceNumber,
  clientName,
  description,
  amount,
  currency,
  acceptedCryptos,
  shareableUrl,
}: InvoicePreviewCardProps) {
  const [copied, setCopied] = useState(false);
  const { success } = useToast();

  const handleCopy = () => {
    navigator.clipboard.writeText(shareableUrl);
    setCopied(true);
    success("Lien copié !", "Le lien de paiement est dans votre presse-papiers.");
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="bg-white rounded-2xl border border-[#EAECEF] shadow-md overflow-hidden flex flex-col justify-between">
      {/* Top Dark Header */}
      <div className="bg-[#0f172a] p-5 text-white">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#F5C200] flex items-center justify-center text-[#0f172a] font-bold text-xs">
              S
            </div>
            <span className="font-bold text-base tracking-tight">SunuPay</span>
          </div>
          <span className="text-[10px] bg-white/10 text-gray-300 px-2 py-0.5 rounded-full font-medium">
            Facture certifiée
          </span>
        </div>
        <p className="text-xs text-gray-400">
          Votre client paie globalement, vous recevez localement.
        </p>
      </div>

      {/* Invoice Core Info */}
      <div className="p-6 space-y-5">
        <div className="flex items-start justify-between pb-4 border-b border-gray-100">
          <div>
            <h4 className="text-base font-bold text-gray-900 leading-snug">
              {description || "Description de la prestation"}
            </h4>
            <span className="text-xs text-gray-400 font-mono mt-0.5 block">
              Facture #{invoiceNumber || "SP-1042"}
            </span>
          </div>

          <div className="text-right">
            <span className="text-xs text-gray-400 block">Montant</span>
            <span className="text-xl font-extrabold text-gray-900 font-sans block">
              ${amount ? amount.toFixed(2) : "0.00"} {currency}
            </span>
          </div>
        </div>

        {/* Client Row */}
        <div className="flex items-center justify-between text-xs py-1">
          <span className="text-gray-400">Client</span>
          <span className="font-semibold text-gray-900">
            {clientName || "Nom du client"}
          </span>
        </div>

        {/* QR Code Container */}
        <div className="flex flex-col items-center justify-center py-2">
          <InvoiceQRCode value={shareableUrl} size={170} />
          <p className="text-[11px] text-gray-400 mt-2 text-center">
            Scannez avec un wallet crypto ou cliquez sur le lien
          </p>
        </div>

        {/* Accepted Payment Assets */}
        <div className="pt-3 border-t border-gray-100">
          <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider block mb-2 text-center">
            Pay with
          </span>
          <div className="flex items-center justify-center gap-3">
            {acceptedCryptos.includes("BTC") && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-100 text-xs font-medium text-gray-700">
                <CryptoIcon symbol="BTC" size="sm" />
                <span>Bitcoin</span>
              </div>
            )}
            {acceptedCryptos.includes("USDT") && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-100 text-xs font-medium text-gray-700">
                <CryptoIcon symbol="USDT" size="sm" />
                <span>USDT</span>
              </div>
            )}
            {acceptedCryptos.includes("USDC") && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-100 text-xs font-medium text-gray-700">
                <CryptoIcon symbol="USDC" size="sm" />
                <span>USDC</span>
              </div>
            )}
          </div>
        </div>

        {/* Shareable URL Bar with Copy */}
        <div className="pt-2">
          <div className="flex items-center bg-[#F5F6F9] border border-gray-200 rounded-xl p-1.5 focus-within:border-[#F5C200] transition-colors">
            <input
              type="text"
              readOnly
              value={shareableUrl}
              className="bg-transparent text-xs text-gray-600 px-2.5 flex-1 font-mono focus:outline-none select-all truncate"
            />
            <button
              onClick={handleCopy}
              className="p-2 rounded-lg bg-white hover:bg-gray-100 text-gray-700 shadow-sm border border-gray-200 transition-colors shrink-0"
              title="Copier le lien"
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
