import React from "react";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  variant?: "light" | "dark"; // "light" = dark text for light bg, "dark" = white text for dark bg
  size?: "sm" | "md" | "lg";
}

/**
 * Official Bitnob Logo
 */
export function BitnobLogo({ className, variant = "light", size = "md" }: LogoProps) {
  const isDark = variant === "dark";
  const iconColor = isDark ? "#FFFFFF" : "#0F172A";
  const textColor = isDark ? "text-white" : "text-[#0F172A]";

  const iconSizes = {
    sm: "w-5 h-5",
    md: "w-7 h-7",
    lg: "w-9 h-9",
  };

  const textSizes = {
    sm: "text-base",
    md: "text-xl",
    lg: "text-2xl",
  };

  return (
    <div className={cn("inline-flex items-center gap-2 select-none", className)}>
      {/* Bitnob geometric connected nodes emblem */}
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn(iconSizes[size], "shrink-0")}
      >
        <circle cx="10" cy="16" r="6" stroke={iconColor} strokeWidth="3.2" />
        <circle cx="22" cy="16" r="6" stroke={iconColor} strokeWidth="3.2" />
        <path
          d="M10 13H22"
          stroke={iconColor}
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <circle cx="22" cy="16" r="2.5" fill={isDark ? "#F5C200" : iconColor} />
      </svg>
      <span className={cn("font-extrabold tracking-tight font-sans", textSizes[size], textColor)}>
        Bitnob
      </span>
    </div>
  );
}

/**
 * Official Btrust Logo
 */
export function BtrustLogo({ className, variant = "light", size = "md" }: LogoProps) {
  const isDark = variant === "dark";
  const iconBg = isDark ? "#FFFFFF" : "#0F172A";
  const iconSymbol = isDark ? "#0F172A" : "#FFFFFF";
  const textColor = isDark ? "text-white" : "text-[#0F172A]";

  const iconSizes = {
    sm: "w-5 h-5",
    md: "w-7 h-7",
    lg: "w-9 h-9",
  };

  const textSizes = {
    sm: "text-base",
    md: "text-xl",
    lg: "text-2xl",
  };

  return (
    <div className={cn("inline-flex items-center gap-2 select-none", className)}>
      {/* Btrust rounded badge with Bitcoin B cutout */}
      <div
        className={cn(
          iconSizes[size],
          "rounded-lg flex items-center justify-center font-black shrink-0 transition-transform shadow-xs"
        )}
        style={{ backgroundColor: iconBg }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-4 h-4"
        >
          {/* Stylized 'B' with Bitcoin spurs */}
          <path
            d="M6 4H13C15.2091 4 17 5.79086 17 8C17 9.8 15.8 11.3 14.1 11.8C16.3 12.3 18 13.9 18 16C18 18.2091 16.2091 20 14 20H6V4Z"
            fill={iconSymbol}
          />
          <path
            d="M9 7H12.5C13.3284 7 14 7.67157 14 8.5C14 9.32843 13.3284 10 12.5 10H9V7Z"
            fill={iconBg}
          />
          <path
            d="M9 14H13C13.8284 14 14.5 14.6716 14.5 15.5C14.5 16.3284 13.8284 17 13 17H9V14Z"
            fill={iconBg}
          />
        </svg>
      </div>
      <span className={cn("font-extrabold tracking-tight font-sans", textSizes[size], textColor)}>
        Btrust
      </span>
    </div>
  );
}

/**
 * PayLink Afrique Brand Logo
 */
export function PayLinkLogo({ className, variant = "light", size = "md" }: LogoProps) {
  const isDark = variant === "dark";
  const textColor = isDark ? "text-white" : "text-[#0F172A]";

  const iconSizes = {
    sm: "w-7 h-7 text-xs",
    md: "w-8 h-8 text-sm",
    lg: "w-10 h-10 text-base",
  };

  const textSizes = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl",
  };

  return (
    <div className={cn("inline-flex items-center gap-2.5 select-none group", className)}>
      <div
        className={cn(
          iconSizes[size],
          "rounded-xl bg-gradient-to-tr from-[#E5B500] to-[#F5C200] flex items-center justify-center shadow-md shadow-[#F5C200]/25 group-hover:scale-105 transition-transform duration-200 shrink-0"
        )}
      >
        <svg
          className="w-4 h-4 text-[#0F172A]"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 2L3 7v10l9 5 9-5V7l-9-5zm1.5 13.5c-2.5.2-4.5-1-4.5-2.5h2c0 .6 1 .9 2.5.8 1.4-.1 2-.7 2-1.3 0-.7-.5-1.1-2.2-1.5-2.6-.6-3.8-1.5-3.8-3.2 0-1.8 1.5-3 3.5-3.1 2.2-.1 4.1.8 4.2 2.3h-2c0-.5-.8-.8-2.2-.7-1.2.1-1.8.6-1.8 1.2 0 .7.6 1.1 2.4 1.5 2.5.6 3.6 1.6 3.6 3.3 0 2-1.7 3.1-3.7 3.2z" />
        </svg>
      </div>
      <div className="flex items-baseline gap-1.5">
        <div className="flex items-baseline">
          <span className={cn("font-extrabold tracking-tight", textSizes[size], textColor)}>Pay</span>
          <span className={cn("font-extrabold tracking-tight text-[#F5C200]", textSizes[size])}>Link</span>
        </div>
        <span
          className={cn(
            "text-[10px] font-extrabold tracking-wider uppercase px-1.5 py-0.5 rounded-md",
            isDark
              ? "bg-[#F5C200]/20 text-[#FDE047] border border-[#F5C200]/30"
              : "bg-[#FFF9E6] text-[#B45309] border border-[#FDE68A]"
          )}
        >
          Afrique
        </span>
      </div>
    </div>
  );
}

// Backwards-compatible alias
export const SunuPayLogo = PayLinkLogo;
