"use client";

import React, { useState } from "react";
import {
  Search,
  Bell,
  Menu,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import Link from "next/link";
import { MOCK_USER } from "@/lib/mock-data";

interface AppHeaderProps {
  onOpenMobileMenu?: () => void;
  sidebarCollapsed?: boolean;
  onToggleCollapse?: () => void;
  title?: string;
  subtitle?: string;
}

export function AppHeader({
  onOpenMobileMenu,
  sidebarCollapsed,
  onToggleCollapse,
}: AppHeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(2);

  const notifications = [
    {
      id: 1,
      title: "Paiement reçu",
      message: "TechStudio NG vous a envoyé 50.00 USDT via TRON.",
      time: "Il y a 10 min",
      type: "success",
    },
    {
      id: 2,
      title: "Facture générée",
      message: "Lien de paiement SP-1042 prêt pour partage.",
      time: "Il y a 1h",
      type: "info",
    },
  ];

  return (
    <header className="sticky top-0 z-20 w-full bg-white/95 backdrop-blur-md border-b border-[#EAECEF] px-4 md:px-8 py-3.5 flex items-center justify-between">
      {/* Left: Mobile trigger & Search */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <button
          onClick={onOpenMobileMenu}
          className="p-2 -ml-2 text-gray-700 hover:text-black md:hidden rounded-lg hover:bg-gray-100"
          aria-label="Ouvrir le menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Desktop Sidebar Toggle Icon */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="hidden md:flex p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors items-center justify-center -ml-2"
            title={sidebarCollapsed ? "Agrandir le menu" : "Réduire le menu"}
            aria-label="Basculer la barre latérale"
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="w-5 h-5 text-[#0f172a]" />
            ) : (
              <PanelLeftClose className="w-5 h-5 text-gray-500" />
            )}
          </button>
        )}

        {/* Search input with keyboard shortcut hint */}
        <div className="relative w-full max-w-md hidden sm:block">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher une facture, un client, une transaction..."
            className="w-full pl-10 pr-12 py-2 text-sm bg-[#F5F6F9] border border-transparent focus:border-[#F5C200] rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white transition-all duration-150"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden md:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-gray-400 bg-white border border-gray-200 rounded">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5 sm:gap-4">
        {/* Notifications Popover */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              if (unreadCount > 0) setUnreadCount(0);
            }}
            className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 z-50">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-gray-900">Notifications</h4>
                  <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                    2 récentes
                  </span>
                </div>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="py-2 space-y-2.5">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className="p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100/80 transition-colors flex items-start gap-3 text-xs"
                  >
                    <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-600 mt-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">{n.title}</div>
                      <div className="text-gray-600 text-[11px] mt-0.5">{n.message}</div>
                      <div className="text-gray-400 text-[10px] mt-1">{n.time}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-gray-100 text-center">
                <span className="text-[11px] text-gray-500">
                  Toutes les notifications sont à jour
                </span>
              </div>
            </div>
          )}
        </div>

        {/* User Mini Badge */}
        <Link
          href="/parametres"
          className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-[#0f172a] text-[#F5C200] font-bold text-xs flex items-center justify-center border border-gray-200">
            AD
          </div>
        </Link>
      </div>
    </header>
  );
}
