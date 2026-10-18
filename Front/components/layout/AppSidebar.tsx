"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  CreditCard,
  ArrowLeftRight,
  WalletCards,
  BarChart3,
  Bot,
  Settings,
  X,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MOCK_USER } from "@/lib/mock-data";

interface AppSidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/factures", label: "Factures", icon: FileText },
  { href: "/paiements", label: "Paiements", icon: CreditCard },
  { href: "/masse", label: "Paiements de masse", icon: ArrowLeftRight, badge: "Nouveau" },
  { href: "/transferts", label: "Transferts unitaires", icon: ArrowLeftRight },
  { href: "/cartes", label: "Cartes & Enveloppes", icon: WalletCards },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/assistant", label: "Assistant IA", icon: Bot },
  { href: "/parametres", label: "Paramètres", icon: Settings },
];

export function AppSidebar({
  mobileOpen,
  onCloseMobile,
  collapsed = false,
  onToggleCollapse,
}: AppSidebarProps) {
  const pathname = usePathname();

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#0f172a] text-white select-none overflow-hidden">
      {/* Brand Header */}
      <div
        className={cn(
          "flex items-center border-b border-[#1e293b] transition-all",
          collapsed ? "flex-col justify-center py-4 px-2 gap-2" : "justify-between px-4 py-4"
        )}
      >
        <Link href="/dashboard" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#E5B500] to-[#F5C200] flex items-center justify-center shadow-md shadow-[#F5C200]/20 group-hover:scale-105 transition-transform duration-200 shrink-0">
            {/* Custom geometric 'S' logo */}
            <svg
              className="w-4 h-4 text-[#0f172a]"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2L3 7v10l9 5 9-5V7l-9-5zm1.5 13.5c-2.5.2-4.5-1-4.5-2.5h2c0 .6 1 .9 2.5.8 1.4-.1 2-.7 2-1.3 0-.7-.5-1.1-2.2-1.5-2.6-.6-3.8-1.5-3.8-3.2 0-1.8 1.5-3 3.5-3.1 2.2-.1 4.1.8 4.2 2.3h-2c0-.5-.8-.8-2.2-.7-1.2.1-1.8.6-1.8 1.2 0 .7.6 1.1 2.4 1.5 2.5.6 3.6 1.6 3.6 3.3 0 2-1.7 3.1-3.7 3.2z" />
            </svg>
          </div>
          {!collapsed && (
            <div className="flex items-baseline">
              <span className="text-lg font-bold tracking-tight text-white">Sunu</span>
              <span className="text-lg font-bold tracking-tight text-[#F5C200]">Pay</span>
            </div>
          )}
        </Link>

        {/* Close/Collapse Button (Desktop) */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="hidden md:flex p-1.5 text-slate-400 hover:text-white hover:bg-[#1e293b] rounded-lg transition-colors items-center justify-center"
            title={collapsed ? "Agrandir le menu" : "Fermer le menu"}
            aria-label={collapsed ? "Agrandir la barre latérale" : "Fermer la barre latérale"}
          >
            {collapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        )}

        {/* Close Button (Mobile) */}
        {mobileOpen && (
          <button
            onClick={onCloseMobile}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg md:hidden"
            aria-label="Fermer le menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Links - Hidden scrollbars & optimized density */}
      <div className="flex-1 px-2.5 py-3 space-y-1 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onCloseMobile}
              title={collapsed ? item.label : undefined}
              className={cn(
                "group flex items-center rounded-xl text-xs font-medium transition-all duration-150 relative",
                collapsed
                  ? "justify-center p-2.5"
                  : "justify-between px-3 py-2",
                isActive
                  ? "bg-[#F5C200] text-[#0f172a] shadow-sm font-bold"
                  : "text-[#94a3b8] hover:text-white hover:bg-[#1e293b]"
              )}
            >
              <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-2.5")}>
                <Icon
                  className={cn(
                    "w-4 h-4 shrink-0 transition-colors",
                    isActive
                      ? "text-[#0f172a]"
                      : "text-[#64748b] group-hover:text-white"
                  )}
                />
                {!collapsed && <span>{item.label}</span>}
              </div>

              {!collapsed && item.badge && !isActive && (
                <span className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded-full bg-[#1e293b] text-[#F5C200] border border-[#F5C200]/30">
                  {item.badge}
                </span>
              )}

              {collapsed && item.badge && !isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#F5C200] absolute top-1.5 right-1.5" />
              )}
            </Link>
          );
        })}
      </div>

      {/* Quick AI Callout */}
      <div className="px-2.5 pb-2.5">
        <Link
          href="/assistant"
          onClick={onCloseMobile}
          title={collapsed ? "Assistant FinTech IA" : undefined}
          className={cn(
            "block rounded-xl bg-gradient-to-br from-[#1e293b] to-[#0f172a] border border-[#334155] hover:border-[#F5C200]/40 transition-colors group",
            collapsed ? "p-2 text-center" : "p-2.5"
          )}
        >
          <div className={cn("flex items-center gap-2", collapsed ? "justify-center" : "mb-1")}>
            <Sparkles className="w-4 h-4 text-[#F5C200] shrink-0" />
            {!collapsed && (
              <span className="text-[11px] font-bold text-white">Assistant IA</span>
            )}
          </div>
          {!collapsed && (
            <p className="text-[10px] text-[#94a3b8] leading-tight line-clamp-2">
              Calculs de frais & rapprochement direct.
            </p>
          )}
        </Link>
      </div>

      {/* User Profile Footer */}
      <div className="p-2.5 border-t border-[#1e293b]">
        <div
          className={cn(
            "flex items-center rounded-xl hover:bg-[#1e293b] transition-colors cursor-pointer group",
            collapsed ? "justify-center p-1.5" : "justify-between p-1.5"
          )}
          title={collapsed ? `${MOCK_USER.name} (${MOCK_USER.title})` : undefined}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative shrink-0">
              <div className="w-8 h-8 rounded-full bg-[#F5C200] text-[#0f172a] font-bold flex items-center justify-center overflow-hidden border border-[#F5C200]/40">
                <span className="text-xs font-bold">AD</span>
              </div>
              <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-[#0f172a]" />
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-white group-hover:text-[#F5C200] transition-colors truncate">
                  {MOCK_USER.name}
                </span>
                <span className="text-[10px] text-[#94a3b8] truncate">{MOCK_USER.title}</span>
              </div>
            )}
          </div>
          {!collapsed && (
            <div className="text-[#64748b] group-hover:text-white shrink-0">
              <Settings className="w-3.5 h-3.5" />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar (w-56 normal / w-16 collapsed) */}
      <aside
        className={cn(
          "hidden md:flex flex-col shrink-0 h-screen sticky top-0 border-r border-[#1e293b] z-30 transition-all duration-300 ease-in-out",
          collapsed ? "w-16" : "w-56"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-[#0f172a]/60 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-64 max-w-[85vw] h-full z-10 shadow-2xl">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
