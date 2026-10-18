"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Play,
  ArrowLeftRight,
  CreditCard,
  FileText,
  Bot,
  ShieldCheck,
  Clock,
  LayoutGrid,
  Sparkles,
  Menu,
  X,
  CheckCircle2,
  TrendingUp,
  BarChart3,
  Lock,
  Globe,
  Wallet,
} from "lucide-react";
import { SunuPayLogo, BitnobLogo, BtrustLogo } from "@/components/ui/PartnerLogos";

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-[#0F172A] selection:bg-[#F5C200] selection:text-[#0F172A] scroll-smooth">
      {/* ─────────────────────────────────────────────────────────────
          1. NAVIGATION BAR
      ───────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#F0F2F5] transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Brand Logo */}
          <Link href="#accueil" className="transition-transform hover:scale-[1.02]">
            <SunuPayLogo size="md" />
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-gray-600">
            <Link href="#accueil" className="hover:text-[#0F172A] transition-colors">
              Accueil
            </Link>
            <Link href="#fonctionnalites" className="hover:text-[#0F172A] transition-colors">
              Fonctionnalités
            </Link>
            <Link href="#avantages" className="hover:text-[#0F172A] transition-colors">
              Avantages
            </Link>
            <Link href="#a-propos" className="hover:text-[#0F172A] transition-colors">
              À propos
            </Link>
            <Link href="#ia" className="hover:text-[#0F172A] transition-colors flex items-center gap-1">
              <span>IA</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#F5C200]" />
            </Link>
          </div>

          {/* Right Action Button */}
          <div className="hidden sm:flex items-center gap-3">
            <Link
              href="/inscription"
              className="text-xs sm:text-sm font-bold text-gray-700 hover:text-[#0F172A] px-3 py-2 transition-colors"
            >
              S&apos;inscrire
            </Link>
            <Link
              href="/connexion"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-[#F5C200] hover:bg-[#E5B500] text-[#0F172A] font-bold text-xs sm:text-sm shadow-md shadow-[#F5C200]/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              Se connecter
            </Link>
          </div>

          {/* Mobile Menu Trigger */}
          <div className="flex sm:hidden items-center gap-2">
            <Link
              href="/connexion"
              className="px-3.5 py-1.5 rounded-full bg-[#F5C200] text-[#0F172A] font-bold text-xs"
            >
              Connexion
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-gray-600 hover:text-[#0F172A] rounded-lg"
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-b border-gray-200 bg-white px-4 pt-2 pb-6 space-y-3 animate-fadeIn">
            <Link
              href="#accueil"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-base font-semibold text-gray-800"
            >
              Accueil
            </Link>
            <Link
              href="#fonctionnalites"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-base font-semibold text-gray-800"
            >
              Fonctionnalités
            </Link>
            <Link
              href="#avantages"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-base font-semibold text-gray-800"
            >
              Avantages
            </Link>
            <Link
              href="#a-propos"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-base font-semibold text-gray-800"
            >
              À propos
            </Link>
            <Link
              href="#ia"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-base font-semibold text-gray-800"
            >
              Assistant IA
            </Link>
            <div className="pt-2">
              <Link
                href="/connexion"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full inline-flex items-center justify-center py-3 rounded-xl bg-[#F5C200] text-[#0F172A] font-bold text-sm shadow-sm"
              >
                Se connecter à SunuPay
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ─────────────────────────────────────────────────────────────
          2. HERO SECTION
      ───────────────────────────────────────────────────────────── */}
      <section id="accueil" className="relative pt-12 pb-20 md:pt-20 md:pb-32 overflow-hidden">
        {/* Subtle decorative background gradient glows */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#FFF9E6] rounded-full blur-3xl -z-10 opacity-70 pointer-events-none" />
        <div className="absolute bottom-10 left-10 w-72 h-72 bg-[#FEF08A]/30 rounded-full blur-3xl -z-10 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Column: Hero Text */}
            <div className="lg:col-span-6 space-y-6 text-left">
              {/* Pill Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] text-xs font-bold tracking-tight">
                <span className="w-2 h-2 rounded-full bg-[#F5C200] animate-pulse" />
                <span>Solution de paiements et de gestion financière</span>
              </div>

              {/* Main Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-extrabold text-[#0F172A] tracking-tight leading-[1.12]">
                Simplifiez vos paiements. <br />
                Maîtrisez vos <span className="text-[#EAB308]">finances.</span>
              </h1>

              {/* Subheading */}
              <p className="text-base sm:text-lg text-gray-600 leading-relaxed max-w-xl">
                SunuPay est une plateforme intelligente qui centralise vos opérations financières,
                facilite vos paiements et vous aide à prendre de meilleures décisions grâce à l&apos;IA.
              </p>

              {/* CTA Buttons Row */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                <Link
                  href="/connexion"
                  className="inline-flex items-center justify-center gap-3 px-7 py-3.5 rounded-full bg-[#F5C200] hover:bg-[#E5B500] text-[#0F172A] font-bold text-sm sm:text-base shadow-lg shadow-[#F5C200]/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                >
                  <span>Se connecter</span>
                  <div className="w-6 h-6 rounded-full bg-[#0F172A] text-white flex items-center justify-center">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </Link>

                <Link
                  href="#fonctionnalites"
                  className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-full bg-white hover:bg-gray-50 text-gray-800 font-semibold text-sm sm:text-base border border-gray-200 shadow-xs transition-colors"
                >
                  <div className="w-6 h-6 rounded-full bg-[#FFF9E6] text-[#B45309] flex items-center justify-center">
                    <Play className="w-3 h-3 fill-current ml-0.5" />
                  </div>
                  <span>Découvrir SunuPay</span>
                </Link>
              </div>

              {/* Key Trust Signals */}
              <div className="pt-6 border-t border-gray-100 flex items-center gap-6 text-xs text-gray-500">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Bitnob API v2 intégrée</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Bitcoin & Stablecoins</span>
                </div>
              </div>
            </div>

            {/* Right Column: Hero Visual Product Mockup */}
            <div className="lg:col-span-6 relative flex items-center justify-center">
              {/* Yellow Backdrop Shape */}
              <div className="absolute inset-0 bg-gradient-to-tr from-[#FEF08A]/60 via-[#FDE047]/20 to-transparent rounded-3xl transform rotate-1 scale-95 -z-10" />

              {/* Main Tablet / Desktop Dashboard Frame */}
              <div className="relative w-full max-w-lg bg-[#0F172A] rounded-2xl p-2.5 shadow-2xl border-4 border-slate-800/80 transform hover:scale-[1.01] transition-transform duration-300">
                {/* Simulated Screen Inner */}
                <div className="bg-[#F8F9FA] rounded-xl overflow-hidden text-left border border-slate-700/50">
                  {/* Mock Screen Top Bar */}
                  <div className="bg-[#0F172A] px-4 py-2.5 flex items-center justify-between text-white border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-md bg-[#F5C200] text-[#0F172A] flex items-center justify-center font-bold text-[10px]">
                        S
                      </div>
                      <span className="text-xs font-bold tracking-tight">SunuPay</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="text-[10px] text-slate-300">En direct</span>
                    </div>
                  </div>

                  {/* Mock Dashboard Body */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-gray-900">Bonjour, Entreprise !</div>
                        <div className="text-[10px] text-gray-400">Aperçu financier en temps réel</div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        +14.2% ce mois
                      </span>
                    </div>

                    {/* Mock Balances Row */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-2.5 rounded-xl bg-white border border-gray-200 shadow-xs">
                        <div className="text-[9px] font-semibold text-gray-500 uppercase">Total payé</div>
                        <div className="text-xs font-extrabold text-gray-900 mt-0.5">12 450 000 XOF</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white border border-gray-200 shadow-xs">
                        <div className="text-[9px] font-semibold text-gray-500 uppercase">Destinataires</div>
                        <div className="text-xs font-extrabold text-gray-900 mt-0.5">18 450</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white border border-gray-200 shadow-xs">
                        <div className="text-[9px] font-semibold text-gray-500 uppercase">USDT</div>
                        <div className="text-xs font-extrabold text-gray-900 mt-0.5">96 460 $</div>
                      </div>
                    </div>

                    {/* Mock Chart Area */}
                    <div className="p-3 bg-white rounded-xl border border-gray-200 shadow-xs">
                      <div className="text-[10px] font-bold text-gray-800 mb-2">Volume des transferts</div>
                      <div className="h-16 flex items-end gap-2 justify-between px-1">
                        {[40, 65, 50, 85, 70, 95, 80, 100].map((val, idx) => (
                          <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                            <div
                              className="w-full rounded-t-sm transition-all"
                              style={{
                                height: `${val}%`,
                                backgroundColor: idx % 2 === 0 ? "#0F172A" : "#F5C200",
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Overlaid Smartphone Mockup (As seen in the maquette) */}
              <div className="absolute -bottom-6 -right-2 sm:-right-4 w-40 sm:w-48 bg-[#0F172A] rounded-3xl p-2 shadow-2xl border-2 border-slate-700/80 transform rotate-3 hover:rotate-0 transition-transform duration-300">
                <div className="bg-white rounded-2xl p-2.5 text-left border border-gray-100">
                  <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-2" />
                  <div className="text-[9px] text-gray-400 uppercase font-semibold">Solde disponible</div>
                  <div className="text-xs font-extrabold text-gray-900">12 450 000 XOF</div>
                  <div className="mt-2.5 space-y-1.5">
                    <div className="p-1.5 rounded-lg bg-amber-50 text-[9px] font-bold text-amber-900 flex items-center justify-between">
                      <span>Wave</span>
                      <span>99.8%</span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-orange-50 text-[9px] font-bold text-orange-900 flex items-center justify-between">
                      <span>Orange</span>
                      <span>99.5%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Handwritten Note Annotation */}
              <div className="absolute -bottom-10 left-8 sm:left-12 flex items-center gap-2 select-none">
                <span className="font-serif italic text-xs sm:text-sm font-bold text-[#0F172A] tracking-wide">
                  « Votre finance, notre priorité ! »
                </span>
                <svg className="w-6 h-6 text-[#F5C200] -rotate-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          3. SECTION DES FONCTIONNALITÉS
      ───────────────────────────────────────────────────────────── */}
      <section id="fonctionnalites" className="py-20 md:py-28 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Eyebrow & Title */}
          <div className="max-w-2xl mx-auto mb-16">
            <span className="text-xs font-extrabold tracking-widest text-[#D97706] uppercase">
              Nos fonctionnalités
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0F172A] tracking-tight mt-2">
              Une plateforme complète pour votre entreprise
            </h2>
          </div>

          {/* 4 Feature Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
            {/* Card 1: Paiements de masse */}
            <div className="p-6 rounded-2xl bg-white border border-[#EAECEF] hover:border-[#F5C200]/60 shadow-sm hover:shadow-md transition-all duration-200 group flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-[#FFF9E6] text-[#D97706] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <ArrowLeftRight className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-[#0F172A] mb-2">
                  Paiements de masse
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
                  Envoyez vos paiements en quelques clics, à vos employés, fournisseurs ou partenaires.
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-gray-100 flex items-center gap-1 text-xs font-bold text-[#0F172A] group-hover:text-[#D97706] transition-colors">
                <span>Découvrir le module</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Card 2: Suivi des transactions */}
            <div className="p-6 rounded-2xl bg-white border border-[#EAECEF] hover:border-[#F5C200]/60 shadow-sm hover:shadow-md transition-all duration-200 group flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-[#FFF9E6] text-[#D97706] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <CreditCard className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-[#0F172A] mb-2">
                  Suivi des transactions
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
                  Suivez vos opérations en temps réel et gardez le contrôle sur vos finances.
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-gray-100 flex items-center gap-1 text-xs font-bold text-[#0F172A] group-hover:text-[#D97706] transition-colors">
                <span>Consulter les flux</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Card 3: Gestion financière */}
            <div className="p-6 rounded-2xl bg-white border border-[#EAECEF] hover:border-[#F5C200]/60 shadow-sm hover:shadow-md transition-all duration-200 group flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-[#FFF9E6] text-[#D97706] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-[#0F172A] mb-2">
                  Gestion financière
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
                  Retrouvez toutes vos factures, vos soldes et vos rapports au même endroit.
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-gray-100 flex items-center gap-1 text-xs font-bold text-[#0F172A] group-hover:text-[#D97706] transition-colors">
                <span>Gérer les factures</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Card 4: Assistant IA */}
            <div className="p-6 rounded-2xl bg-white border border-[#EAECEF] hover:border-[#F5C200]/60 shadow-sm hover:shadow-md transition-all duration-200 group flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-[#FFF9E6] text-[#D97706] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <Bot className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-[#0F172A] mb-2">
                  Assistant IA
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
                  Posez vos questions, obtenez des analyses et prenez des décisions éclairées.
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-gray-100 flex items-center gap-1 text-xs font-bold text-[#0F172A] group-hover:text-[#D97706] transition-colors">
                <span>Interroger l&apos;IA</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          4. SECTION ASSISTANT IA (DARK BACKGROUND #0F172A)
      ───────────────────────────────────────────────────────────── */}
      <section id="ia" className="py-20 md:py-28 bg-[#0F172A] text-white relative overflow-hidden">
        {/* Subtle radial glow for atmosphere */}
        <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-[#F5C200]/10 rounded-full blur-3xl -z-0 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            {/* Left Column: Mascot & Interactive Conversation Card */}
            <div className="lg:col-span-6 relative flex flex-col items-center">
              {/* 3D Robot Mascot Image */}
              <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-3xl overflow-hidden shadow-2xl border border-slate-700/50 bg-[#0F172A] flex items-center justify-center">
                <Image
                  src="/images/ai-robot-mascot.jpg"
                  alt="Assistant IA SunuPay Mascot"
                  width={300}
                  height={300}
                  className="object-cover w-full h-full transform hover:scale-105 transition-transform duration-300"
                />
              </div>

              {/* Floating User Speech Bubble */}
              <div className="absolute -top-4 sm:-top-6 right-2 sm:right-6 bg-[#F5C200] text-[#0F172A] px-4 py-2.5 rounded-2xl rounded-bl-none shadow-xl text-xs sm:text-sm font-bold max-w-xs animate-bounce [animation-duration:4s]">
                Quel est le montant total des paiements ce mois-ci ?
              </div>

              {/* Floating Response Card */}
              <div className="mt-4 sm:-mt-8 sm:ml-20 w-full max-w-sm bg-white text-[#0F172A] p-4 sm:p-5 rounded-2xl shadow-2xl border border-gray-100 text-left relative z-20">
                <div className="text-xs font-bold text-gray-800 mb-2">
                  Voici un résumé de vos paiements :
                </div>
                <div className="space-y-1 text-xs text-gray-600 font-medium">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#F5C200]" />
                    <span>Total : <strong>5 240 000 XOF</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#F5C200]" />
                    <span>Transactions : <strong>46</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#F5C200]" />
                    <span>Taux de succès : <strong>98%</strong></span>
                  </div>
                </div>

                {/* Mini Volume Bar Chart in Card */}
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-end gap-1.5 h-8">
                  {[25, 40, 60, 50, 75, 90, 80, 100].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t-xs bg-[#F5C200]"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: AI Explanations */}
            <div className="lg:col-span-6 space-y-6 text-left">
              <span className="text-xs font-extrabold tracking-widest text-[#F5C200] uppercase">
                Assistant IA
              </span>

              <h2 className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold text-white tracking-tight leading-tight">
                Un assistant intelligent <br />
                à vos côtés
              </h2>

              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                Posez vos questions en langage naturel et obtenez des réponses claires, précises
                et basées sur vos données. Votre assistant IA vous aide à comprendre vos finances,
                à repérer les anomalies et à identifier les opportunités.
              </p>

              <div className="pt-2">
                <Link
                  href="/assistant"
                  className="inline-flex items-center gap-3 px-6 py-3.5 rounded-full bg-[#F5C200] hover:bg-[#E5B500] text-[#0F172A] font-bold text-sm sm:text-base shadow-lg shadow-[#F5C200]/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                >
                  <span>En savoir plus</span>
                  <div className="w-6 h-6 rounded-full bg-[#0F172A] text-white flex items-center justify-center">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          5. SECTION « POURQUOI CHOISIR SUNUPAY ? »
      ───────────────────────────────────────────────────────────── */}
      <section id="avantages" className="py-20 md:py-28 bg-[#F8F9FB] border-t border-gray-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0F172A] tracking-tight">
              Pourquoi choisir SunuPay ?
            </h2>
            <p className="text-sm sm:text-base text-gray-500 mt-3 leading-relaxed">
              Une solution pensée pour les entreprises africaines, alliant simplicité, sécurité et performance.
            </p>
          </div>

          {/* 4 Advantage Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-center">
            {/* Avantage 1: Sécurité */}
            <div className="p-6 rounded-2xl bg-white border border-[#EAECEF] shadow-sm flex flex-col items-center">
              <div className="w-12 h-12 rounded-2xl bg-[#FFF9E6] text-[#D97706] flex items-center justify-center mb-4">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-[#0F172A] mb-1.5">
                Sécurité renforcée
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Vos données et vos transactions sont protégées.
              </p>
            </div>

            {/* Avantage 2: Gain de temps */}
            <div className="p-6 rounded-2xl bg-white border border-[#EAECEF] shadow-sm flex flex-col items-center">
              <div className="w-12 h-12 rounded-2xl bg-[#FFF9E6] text-[#D97706] flex items-center justify-center mb-4">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-[#0F172A] mb-1.5">
                Gain de temps
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Automatisez vos tâches et concentrez-vous sur l&apos;essentiel.
              </p>
            </div>

            {/* Avantage 3: Tout en un seul endroit */}
            <div className="p-6 rounded-2xl bg-white border border-[#EAECEF] shadow-sm flex flex-col items-center">
              <div className="w-12 h-12 rounded-2xl bg-[#FFF9E6] text-[#D97706] flex items-center justify-center mb-4">
                <LayoutGrid className="w-6 h-6" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-[#0F172A] mb-1.5">
                Tout en un seul endroit
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Une seule plateforme pour toutes vos opérations.
              </p>
            </div>

            {/* Avantage 4: Accompagnement IA */}
            <div className="p-6 rounded-2xl bg-white border border-[#EAECEF] shadow-sm flex flex-col items-center">
              <div className="w-12 h-12 rounded-2xl bg-[#FFF9E6] text-[#D97706] flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-[#0F172A] mb-1.5">
                Accompagnement IA
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Des réponses et des analyses à portée de main.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          6. ORGANISATEURS ET PARTENAIRES DU HACKATHON
      ───────────────────────────────────────────────────────────── */}
      <section id="a-propos" className="py-16 md:py-24 bg-white border-t border-gray-100 text-center">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="text-[11px] font-extrabold tracking-widest text-[#D97706] uppercase">
            Organisateurs et partenaires du hackathon
          </span>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight mt-2 mb-12">
            Un hackathon rendu possible grâce à
          </h2>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-16">
            {/* Bitnob Card */}
            <div className="p-6 sm:p-8 rounded-2xl bg-[#F8F9FA] hover:bg-[#FFF9E6] border border-gray-200/80 hover:border-[#F5C200] transition-all flex items-center justify-center shadow-xs min-w-[220px]">
              <BitnobLogo variant="light" size="lg" />
            </div>

            {/* Btrust Card */}
            <div className="p-6 sm:p-8 rounded-2xl bg-[#F8F9FA] hover:bg-[#FFF9E6] border border-gray-200/80 hover:border-[#F5C200] transition-all flex items-center justify-center shadow-xs min-w-[220px]">
              <BtrustLogo variant="light" size="lg" />
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          7. FOOTER (DARK BACKGROUND #0F172A)
      ───────────────────────────────────────────────────────────── */}
      <footer className="w-full bg-[#0F172A] text-white pt-16 pb-12 border-t border-[#1e293b]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top Row */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 pb-12 border-b border-[#1e293b]">
            <div className="space-y-3">
              <SunuPayLogo variant="dark" size="md" />
              <p className="text-xs text-slate-400 max-w-sm">
                Plus qu&apos;une plateforme, un partenaire pour votre croissance.
              </p>
            </div>

            {/* Navigation links & Socials */}
            <div className="flex flex-wrap items-center gap-6 sm:gap-8 text-xs sm:text-sm text-slate-300">
              <Link href="#accueil" className="hover:text-white transition-colors">
                Accueil
              </Link>
              <Link href="#fonctionnalites" className="hover:text-white transition-colors">
                Fonctionnalités
              </Link>
              <Link href="#avantages" className="hover:text-white transition-colors">
                Avantages
              </Link>
              <Link href="#a-propos" className="hover:text-white transition-colors">
                À propos
              </Link>
              <Link href="/inscription" className="text-slate-300 hover:text-white transition-colors">
                Inscription
              </Link>
              <Link href="/connexion" className="text-[#F5C200] font-semibold hover:underline">
                Connexion
              </Link>
            </div>
          </div>

          {/* Bottom Row */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
            <div>
              © 2026 SunuPay. Tous droits réservés.
            </div>

            <div className="flex items-center gap-6">
              <Link href="#accueil" className="hover:text-white transition-colors">
                Conditions d&apos;utilisation
              </Link>
              <Link href="#accueil" className="hover:text-white transition-colors">
                Politique de confidentialité
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
