"use client";

import React, { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { MOCK_USER } from "@/lib/mock-data";
import {
  User,
  Key,
  Shield,
  Bell,
  Database,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Save,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";

function ParametresContent() {
  const { success } = useToast();
  const [activeTab, setActiveTab] = useState<"profile" | "integrations" | "security">("profile");

  // Profile form
  const [name, setName] = useState(MOCK_USER.name);
  const [title, setTitle] = useState(MOCK_USER.title);
  const [email, setEmail] = useState(MOCK_USER.email);
  const [phone, setPhone] = useState(MOCK_USER.phone);

  // Integrations form
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseAnonKey, setSupabaseAnonKey] = useState("");
  const [bitnobApiKey, setBitnobApiKey] = useState("");
  const [bitnobWebhookSecret, setBitnobWebhookSecret] = useState("");

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    success("Profil mis à jour", "Vos coordonnées ont été enregistrées.");
  };

  const handleSaveIntegrations = (e: React.FormEvent) => {
    e.preventDefault();
    success(
      "Configuration sauvegardée",
      "Vos clés d'API et paramètres d'intégration backend sont enregistrés localement."
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
          Paramètres
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Gérez votre profil professionnel, vos clés API et vos connexions Supabase / Bitnob.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200">
        {[
          { id: "profile", label: "Profil & Entreprise", icon: User },
          { id: "integrations", label: "Intégrations & API (Bitnob / Supabase)", icon: Database },
          { id: "security", label: "Sécurité & 2FA", icon: Shield },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={cn(
                "flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all",
                activeTab === t.id
                  ? "border-[#F5C200] text-gray-900"
                  : "border-transparent text-gray-400 hover:text-gray-700"
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === "profile" && (
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#EAECEF] shadow-sm">
          <form onSubmit={handleSaveProfile} className="space-y-5">
            <h2 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3">
              Informations du compte
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Nom complet
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:border-[#F5C200] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Statut / Activité
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:border-[#F5C200] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Adresse e-mail
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:border-[#F5C200] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Numéro de téléphone
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:border-[#F5C200] outline-none"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#F5C200] hover:bg-[#E5B500] text-[#0f172a] font-bold text-xs shadow-md shadow-[#F5C200]/25 transition-all"
              >
                <Save className="w-4 h-4" />
                <span>Enregistrer les modifications</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === "integrations" && (
        <div className="space-y-6">
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200/80 flex items-start gap-3 text-xs text-amber-900 leading-relaxed">
            <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Architecture de sécurité Bitnob & Supabase :</p>
              <p className="mt-1">
                Toutes les requêtes sensibles et la vérification des signatures de webhooks sont exécutées dans le backend Next.js (API routes serveur). Aucune clé secrète n&apos;est exposée dans le navigateur client.
              </p>
            </div>
          </div>

          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#EAECEF] shadow-sm">
            <form onSubmit={handleSaveIntegrations} className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-900">
                    Configuration Bitnob (Passerelle Crypto / Mobile Money)
                  </h3>
                  <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-mono">
                    Sandbox / Production
                  </span>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Bitnob API Secret Key (Server-side)
                    </label>
                    <input
                      type="password"
                      value={bitnobApiKey}
                      onChange={(e) => setBitnobApiKey(e.target.value)}
                      placeholder="sk_test_..."
                      className="w-full px-3.5 py-2.5 text-xs font-mono bg-white border border-gray-200 rounded-xl focus:border-[#F5C200] outline-none"
                    />
                    <span className="text-[11px] text-gray-400 mt-1 block">
                      Définir également dans votre fichier <code className="text-gray-700">.env.local</code> comme <code className="text-gray-700">BITNOB_SECRET_KEY</code>.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Webhook Secret (Validation HMAC)
                    </label>
                    <input
                      type="password"
                      value={bitnobWebhookSecret}
                      onChange={(e) => setBitnobWebhookSecret(e.target.value)}
                      placeholder="whsec_..."
                      className="w-full px-3.5 py-2.5 text-xs font-mono bg-white border border-gray-200 rounded-xl focus:border-[#F5C200] outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 mb-3">
                  Configuration Supabase (PostgreSQL & Auth)
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Supabase Project URL
                    </label>
                    <input
                      type="text"
                      value={supabaseUrl}
                      onChange={(e) => setSupabaseUrl(e.target.value)}
                      placeholder="https://xyzcompany.supabase.co"
                      className="w-full px-3.5 py-2.5 text-xs font-mono bg-white border border-gray-200 rounded-xl focus:border-[#F5C200] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Supabase Public Anon Key
                    </label>
                    <input
                      type="password"
                      value={supabaseAnonKey}
                      onChange={(e) => setSupabaseAnonKey(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      className="w-full px-3.5 py-2.5 text-xs font-mono bg-white border border-gray-200 rounded-xl focus:border-[#F5C200] outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#F5C200] hover:bg-[#E5B500] text-[#0f172a] font-bold text-xs shadow-md shadow-[#F5C200]/25 transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>Enregistrer les clés d&apos;intégration</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === "security" && (
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#EAECEF] shadow-sm space-y-6 text-xs">
          <h2 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3">
            Sécurité du portefeuille
          </h2>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
            <div>
              <div className="font-bold text-gray-900">
                Authentification à deux facteurs (2FA)
              </div>
              <div className="text-gray-500 mt-0.5">
                Exiger un code OTP pour confirmer chaque transfert Mobile Money.
              </div>
            </div>
            <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full font-bold">
              Activé
            </span>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
            <div>
              <div className="font-bold text-gray-900">
                Prévention du double traitement de webhooks
              </div>
              <div className="text-gray-500 mt-0.5">
                Idempotency keys automatiques sur toutes les requêtes de retrait.
              </div>
            </div>
            <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full font-bold">
              Protégé
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ParametresPage() {
  return (
    <ToastProvider>
      <AppLayout>
        <ParametresContent />
      </AppLayout>
    </ToastProvider>
  );
}
