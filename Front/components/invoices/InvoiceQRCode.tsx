"use client";

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";

interface InvoiceQRCodeProps {
  value: string;
  size?: number;
  className?: string;
}

export function InvoiceQRCode({ value, size = 180, className }: InvoiceQRCodeProps) {
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      color: {
        dark: "#0f172a",
        light: "#FFFFFF",
      },
    })
      .then((url) => setDataUrl(url))
      .catch((err) => console.error("Error generating QR code:", err));
  }, [value, size]);

  return (
    <div className="relative inline-flex items-center justify-center p-3 bg-white rounded-2xl border border-gray-100 shadow-inner">
      {dataUrl ? (
        <img
          src={dataUrl}
          alt="QR Code de paiement"
          width={size}
          height={size}
          className="rounded-lg"
        />
      ) : (
        <div
          style={{ width: size, height: size }}
          className="bg-gray-100 animate-pulse rounded-lg flex items-center justify-center text-xs text-gray-400"
        >
          Génération du QR...
        </div>
      )}

      {/* SunuPay yellow badge in center of QR */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-8 h-8 rounded-lg bg-[#F5C200] border-2 border-white flex items-center justify-center shadow-md">
          <span className="text-xs font-black text-[#0f172a]">S</span>
        </div>
      </div>
    </div>
  );
}
