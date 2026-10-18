import React from "react";
import { cn } from "@/lib/utils";

interface CryptoIconProps {
  symbol: "BTC" | "USDT" | "USDC" | string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function CryptoIcon({ symbol, size = "md", className }: CryptoIconProps) {
  const s = symbol.toUpperCase();

  const sizeClasses = {
    sm: "w-6 h-6 text-xs font-black",
    md: "w-7 h-7 text-sm",
    lg: "w-9 h-9 text-base",
  }[size];

  if (s === "BTC" || s === "BITCOIN") {
    return (
      <div
        className={cn(
          "rounded-full bg-[#F7931A] text-white font-bold flex items-center justify-center shrink-0 shadow-sm",
          sizeClasses,
          className
        )}
        title="Bitcoin"
      >
        ₿
      </div>
    );
  }

  if (s === "USDT" || s === "TETHER") {
    return (
      <div
        className={cn(
          "rounded-full bg-[#26A17B] text-white font-bold flex items-center justify-center shrink-0 shadow-sm",
          sizeClasses,
          className
        )}
        title="Tether USDT"
      >
        ₮
      </div>
    );
  }

  if (s === "USDC") {
    return (
      <div
        className={cn(
          "rounded-full bg-[#2775CA] text-white font-bold flex items-center justify-center shrink-0 shadow-sm",
          sizeClasses,
          className
        )}
        title="USD Coin"
      >
        $
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-full bg-gray-800 text-[#F5C200] font-bold flex items-center justify-center shrink-0",
        sizeClasses,
        className
      )}
    >
      {symbol.slice(0, 2)}
    </div>
  );
}
