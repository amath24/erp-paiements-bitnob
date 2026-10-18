import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  amount: number,
  currency: string = "USD",
  locale: string = "fr-FR"
): string {
  if (currency === "BTC") {
    return `${amount.toFixed(4)} BTC`;
  }
  if (currency === "USDT" || currency === "USDC") {
    return `${amount.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
  }
  if (currency === "XOF" || currency === "FCFA") {
    return `${Math.round(amount).toLocaleString(locale)} XOF`;
  }
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateStr: string | Date, includeTime: boolean = true): string {
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  const options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  };
  return date.toLocaleDateString("fr-FR", options);
}
