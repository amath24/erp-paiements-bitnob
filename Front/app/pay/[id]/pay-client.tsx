"use client";

import React, { useState } from "react";
import Link from "next/link";
import { InvoiceQRCode } from "@/components/invoices/InvoiceQRCode";
import { CryptoIcon } from "@/components/ui/CryptoIcon";
import { CryptoAsset } from "@/types";
import {
  Copy,
  Check,
  ShieldCheck,
  Clock,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";

interface PayClientProps {
  id: string;
}

export function PayClient({ id }: PayClientProps) {
  const { success } = useToast();
  const [selectedAsset, setSelectedAsset] = useState<CryptoAsset>("USDT");
  const [copied, setCopied] = useState(false);
  const [hasSimulatedPayment, setHasSimulatedPayment] = useState(false);

  const invoiceAmountUSD = 50.0;
  const addresses: Record<CryptoAsset, string> = {
    USDT: "TJz7XqP9kK2Wq8546bYF4tCjB2ZLm99q1a",
    BTC: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    USDC: "0x71C6793F1CE835266Bc89c204982c57805",
  };

  const assetDetails: Record<
    CryptoAsset,
    { network: string; cryptoAmount: string }
  > = {
    USDT: { network: "TRON (TRC20)", cryptoAmount: "50.00 USDT" },
    BTC: { network: "Bitcoin Network / Lightning", cryptoAmount: "0.00085 BTC" },
    USDC: { network: "Ethereum / Polygon (ERC20)", cryptoAmount: "50.00 USDC" },
  };

  const currentAddress = addresses[selectedAsset];

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(currentAddress);
    setCopied(true);
    success("Adresse copiée !", "Collez-la dans votre portefeuille de paiement.");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB] flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="max-w-md w-full bg-white rounded-3xl border border-[#EAECEF] shadow-xl overflow-hidden">
        {/* Brand Top Banner */}
        <div className="bg-[#0f172a] p-6 text-white text-center relative">
          <Link
            href="/"
            className="absolute left-5 top-5 p-1.5 rounded-lg bg-white/10 text-gray-300 hover:text-white"
            title="Retour à l'application"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-xl bg-[#F5C200] flex items-center justify-center text-[#0f172a] font-black text-sm">
              S
            </div>
            <span className="font-extrabold text-lg tracking-tight">
              Sunu<span className="text-[#F5C200]">Pay</span> Checkout
            </span>
          </div>

          <p className="text-xs text-gray-400">
            Passerelle de règlement sécurisée pour freelances et entreprises
          </p>
        </div>

        {/* Invoice Summary */}
        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Facture #{id}</span>
            <span className="flex items-center gap-1 text-emerald-600 font-semibold">
              <Clock className="w-3.5 h-3.5" /> En attente de paiement
            </span>
          </div>

          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900">Logo Design</h2>
            <div className="text-right">
              <span className="text-2xl font-black text-gray-900">
                ${invoiceAmountUSD.toFixed(2)}
              </span>
              <span className="text-xs text-gray-400 block">USD</span>
            </div>
          </div>
        </div>

        {hasSimulatedPayment ? (
          /* Payment Confirmed State */
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                Paiement reçu avec succès !
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                La transaction a été validée sur le réseau {assetDetails[selectedAsset].network}. Un reçu a été envoyé au commerçant.
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl text-xs font-mono text-gray-600 text-left space-y-1">
              <div>Réf : SP-{id}</div>
              <div>Montant : {assetDetails[selectedAsset].cryptoAmount}</div>
              <div>TxHash : 0x4f82...a901</div>
            </div>
            <Link
              href="/"
              className="inline-block w-full py-3 rounded-xl bg-[#F5C200] text-[#0f172a] font-bold text-sm shadow-md"
            >
              Retourner au Dashboard
            </Link>
          </div>
        ) : (
          /* Payment Form & QR code */
          <div className="p-6 space-y-6">
            {/* Asset Selector Tabs */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2 text-center">
                Sélectionnez votre devise de paiement
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["USDT", "BTC", "USDC"] as CryptoAsset[]).map((asset) => (
                  <button
                    key={asset}
                    type="button"
                    onClick={() => setSelectedAsset(asset)}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs font-bold transition-all ${
                      selectedAsset === asset
                        ? "border-[#F5C200] bg-[#FFFBEB] text-[#0f172a] shadow-sm"
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    <CryptoIcon symbol={asset} size="sm" />
                    <span>{asset}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* QR Code and Exact Amount */}
            <div className="flex flex-col items-center">
              <div className="text-sm font-extrabold text-gray-900 mb-2">
                Envoyez exactement :{" "}
                <span className="text-[#D4A300]">
                  {assetDetails[selectedAsset].cryptoAmount}
                </span>
              </div>
              <InvoiceQRCode value={currentAddress} size={180} />
              <span className="text-[11px] text-gray-400 mt-2">
                Réseau supporté :{" "}
                <strong>{assetDetails[selectedAsset].network}</strong>
              </span>
            </div>

            {/* Address Input + Copy */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                Adresse de dépôt {selectedAsset}
              </label>
              <div className="flex items-center bg-[#F5F6F9] border border-gray-200 rounded-xl p-1.5 focus-within:border-[#F5C200]">
                <input
                  type="text"
                  readOnly
                  value={currentAddress}
                  className="bg-transparent text-xs text-gray-700 px-2 font-mono flex-1 outline-none select-all truncate"
                />
                <button
                  onClick={handleCopyAddress}
                  className="p-2 rounded-lg bg-white hover:bg-gray-100 text-gray-700 shadow-sm border border-gray-200 shrink-0"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Simulation Demo Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setHasSimulatedPayment(true)}
                className="w-full py-3 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-bold transition-colors flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4 text-[#F5C200]" />
                <span>Simuler le paiement reçu (Démo)</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 text-center text-xs text-gray-400 flex items-center gap-1.5">
        <ShieldCheck className="w-4 h-4 text-emerald-500" />
        <span>Paiement crypté et protégé par SunuPay Gateway</span>
      </div>
    </div>
  );
}
