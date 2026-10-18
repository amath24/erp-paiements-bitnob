import React from "react";
import { cn } from "@/lib/utils";

export type BadgeStatus =
  | "confirmed"
  | "completed"
  | "paid"
  | "pending"
  | "processing"
  | "draft"
  | "expired"
  | "failed"
  | "active"
  | "frozen";

interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
  size?: "sm" | "md";
}

export function StatusBadge({
  status,
  label,
  className,
  size = "md",
}: StatusBadgeProps) {
  const normalized = status.toLowerCase();

  let text = label;
  let style = "bg-gray-100 text-gray-700 border-gray-200";
  let dotColor = "bg-gray-400";

  switch (normalized) {
    case "confirmed":
    case "confirmé":
    case "completed":
    case "complété":
    case "paid":
    case "payée":
    case "active":
      text = text || (normalized === "paid" ? "Payée" : normalized === "active" ? "Active" : "Confirmé");
      style = "bg-emerald-50 text-emerald-700 border-emerald-200/80";
      dotColor = "bg-emerald-500";
      break;

    case "pending":
    case "en attente":
    case "processing":
    case "en cours":
      text = text || (normalized === "processing" || normalized === "en cours" ? "En cours" : "En attente");
      style = "bg-amber-50 text-amber-700 border-amber-200/80";
      dotColor = "bg-amber-500 animate-pulse";
      break;

    case "draft":
    case "brouillon":
      text = text || "Brouillon";
      style = "bg-gray-100 text-gray-700 border-gray-200";
      dotColor = "bg-gray-400";
      break;

    case "expired":
    case "expirée":
      text = text || "Expirée";
      style = "bg-neutral-100 text-neutral-600 border-neutral-300";
      dotColor = "bg-neutral-500";
      break;

    case "failed":
    case "échouée":
    case "cancelled":
    case "frozen":
      text = text || (normalized === "frozen" ? "Gelée" : "Échouée");
      style = "bg-rose-50 text-rose-700 border-rose-200/80";
      dotColor = "bg-rose-500";
      break;

    default:
      text = text || status;
      break;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium rounded-full border transition-colors",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        style,
        className
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColor)} />
      <span>{text}</span>
    </span>
  );
}
