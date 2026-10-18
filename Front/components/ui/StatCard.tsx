"use client";

import React, { useState } from "react";
import { Eye, EyeOff, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  badge?: {
    text: string;
    trend?: "up" | "down" | "neutral";
  };
  icon?: React.ReactNode;
  variant?: "dark" | "yellow" | "white";
  allowMask?: boolean;
  className?: string;
}

export function StatCard({
  title,
  value,
  subValue,
  badge,
  icon,
  variant = "white",
  allowMask = false,
  className,
}: StatCardProps) {
  const [isMasked, setIsMasked] = useState(false);

  const getContainerStyle = () => {
    switch (variant) {
      case "dark":
        return "bg-[#0f172a] text-white border-[#1e293b] shadow-sm";
      case "yellow":
        return "bg-[#FFFBEB] text-gray-900 border-[#FDE68A] shadow-sm";
      case "white":
      default:
        return "bg-white text-gray-900 border-[#EAECEF] shadow-sm hover:border-gray-300";
    }
  };

  const getTitleStyle = () => {
    switch (variant) {
      case "dark":
        return "text-gray-400";
      case "yellow":
        return "text-amber-800";
      case "white":
      default:
        return "text-gray-500";
    }
  };

  const getSubvalueStyle = () => {
    switch (variant) {
      case "dark":
        return "text-gray-400";
      case "yellow":
        return "text-amber-700/80";
      case "white":
      default:
        return "text-gray-500";
    }
  };

  return (
    <div
      className={cn(
        "p-3.5 sm:p-4 rounded-xl border transition-all duration-200 flex flex-col justify-between relative overflow-hidden group",
        getContainerStyle(),
        className
      )}
    >
      {/* Top row: Title and Icon or Mask Toggle */}
      <div className="flex items-center justify-between mb-1">
        <span className={cn("text-[10px] font-bold uppercase tracking-wider", getTitleStyle())}>
          {title}
        </span>

        <div className="flex items-center gap-1.5">
          {allowMask && (
            <button
              onClick={() => setIsMasked(!isMasked)}
              className={cn(
                "p-1 rounded-lg transition-colors",
                variant === "dark"
                  ? "text-gray-400 hover:text-white hover:bg-white/10"
                  : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              )}
              aria-label={isMasked ? "Afficher le montant" : "Masquer le montant"}
            >
              {isMasked ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          )}

          {icon && <div className="shrink-0">{icon}</div>}
        </div>
      </div>

      {/* Main Value */}
      <div className="my-0.5">
        <div className="text-lg sm:text-xl font-extrabold tracking-tight font-sans">
          {isMasked ? "••••••••" : value}
        </div>

        {subValue && (
          <div className={cn("text-[10px] sm:text-[11px] font-medium mt-0.5", getSubvalueStyle())}>
            {isMasked ? "••••" : subValue}
          </div>
        )}
      </div>

      {/* Optional Badge */}
      {badge && (
        <div className="mt-2 flex items-center">
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full",
              badge.trend === "up" && "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
              badge.trend === "down" && "bg-rose-50 text-rose-700 border border-rose-200/60",
              badge.trend === "neutral" && "bg-gray-100 text-gray-600",
              variant === "dark" && badge.trend === "up" && "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40"
            )}
          >
            {badge.trend === "up" && <TrendingUp className="w-3 h-3 stroke-[2.5]" />}
            {badge.trend === "down" && <TrendingDown className="w-3 h-3 stroke-[2.5]" />}
            <span>{badge.text}</span>
          </span>
        </div>
      )}
    </div>
  );
}
