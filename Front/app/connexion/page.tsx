"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  Shield,
  Loader2,
  CheckCircle2,
  AlertCircle,
  KeyRound,
} from "lucide-react";
import { SunuPayLogo, BitnobLogo, BtrustLogo } from "@/components/ui/PartnerLogos";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";

export default function ConnexionPage() {
  const router = useRouter();
  const [email, setEmail] = useState("amadou@sunupay.com");
  const [password, setPassword] = useState("••••••••••••");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email || !email.includes("@")) {
      setErrorMsg("Veuillez saisir une adresse e-mail valide.");
      return;
    }

    if (!password || password.length < 6) {
      setErrorMsg("Le mot de passe doit comporter au moins 6 caractères.");
      return;
    }

    setIsLoading(true);

    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          // If real supabase returns error, display readable message
          setErrorMsg(error.message || "Identifiants invalides. Veuillez réessayer.");
          setIsLoading(false);
          return;
        }
      }

      // Successful auth simulation or live Supabase success
      setSuccessMsg("Connexion réussie ! Redirection vers votre espace...");
      setTimeout(() => {
        router.push("/dashboard");
      }, 700);
    } catch (err: any) {
      setErrorMsg(err?.message || "Une erreur inattendue est survenue.");
      setIsLoading(false);
    }
  };

  const handleSsoClick = () => {
    setIsLoading(true);
    setSuccessMsg("Redirection vers votre fournisseur d'identité SSO...");
    setTimeout(() => {
      router.push("/dashboard");
    }, 900);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB] flex flex-col justify-between selection:bg-[#F5C200] selection:text-[#0F172A]">
      {/* Top Bar */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between">
        <Link href="/" className="transition-opacity hover:opacity-90">
          <SunuPayLogo size="md" />
        </Link>

        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-gray-600 hover:text-[#0F172A] transition-colors py-1.5 px-3 rounded-lg hover:bg-gray-100"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour à l&apos;accueil</span>
        </Link>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md">
          {/* Header Title */}
          <div className="text-center mb-8">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0F172A] tracking-tight">
              Bon retour !
            </h1>
            <p className="text-sm text-gray-500 mt-2 max-w-sm mx-auto">
              Connectez-vous à votre espace SunuPay pour accéder à toutes vos fonctionnalités.
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-2xl border border-[#EAECEF] p-6 sm:p-8 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Error feedback */}
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Success feedback */}
              {successMsg && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-start gap-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Field 1: Email */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-bold text-gray-700 mb-1.5"
                >
                  Adresse e-mail
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre@email.com"
                    required
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#F5C200] focus:ring-2 focus:ring-[#F5C200]/20 transition-all"
                  />
                </div>
              </div>

              {/* Field 2: Mot de passe */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-bold text-gray-700 mb-1.5"
                >
                  Mot de passe
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Votre mot de passe"
                    required
                    className="w-full pl-10 pr-10 py-2.5 text-sm bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#F5C200] focus:ring-2 focus:ring-[#F5C200]/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember me & Forgot password */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-gray-600">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded text-[#F5C200] focus:ring-[#F5C200] border-gray-300 rounded-md"
                  />
                  <span>Se souvenir de moi</span>
                </label>

                <a
                  href="#forgot"
                  onClick={(e) => {
                    e.preventDefault();
                    setErrorMsg("Veuillez contacter le support ou votre administrateur pour réinitialiser vos accès.");
                  }}
                  className="font-medium text-gray-500 hover:text-[#0F172A] transition-colors underline-offset-2 hover:underline"
                >
                  Mot de passe oublié ?
                </a>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-3 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#F5C200] hover:bg-[#E5B500] text-[#0F172A] font-bold text-sm shadow-md shadow-[#F5C200]/20 transition-all transform active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Connexion en cours...</span>
                  </>
                ) : (
                  <>
                    <span>Se connecter</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="relative my-4 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <span className="relative bg-white px-3 text-xs text-gray-400 font-medium lowercase">
                  ou
                </span>
              </div>

              {/* SSO Button */}
              <button
                type="button"
                onClick={handleSsoClick}
                disabled={isLoading}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white hover:bg-gray-50 text-gray-800 font-semibold text-xs border border-gray-200 shadow-xs transition-colors"
              >
                <KeyRound className="w-4 h-4 text-gray-500" />
                <span>Se connecter avec SSO</span>
              </button>

              {/* Inscription link */}
              <div className="text-center pt-2 text-xs text-gray-500">
                <span>Pas encore de compte ? </span>
                <Link
                  href="/inscription"
                  className="font-bold text-[#D97706] hover:text-[#B45309] hover:underline"
                >
                  Créer un compte
                </Link>
              </div>

              {/* Security Encart */}
              <div className="mt-5 p-3.5 rounded-xl bg-[#F0F5FA] border border-[#DCE7F2] flex items-start gap-3 text-left">
                <div className="p-1 rounded-lg bg-blue-100 text-[#0F172A] shrink-0 mt-0.5">
                  <Shield className="w-4 h-4 text-[#0F172A]" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#0F172A]">
                    Votre sécurité est notre priorité
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                    Vos données sont protégées et chiffrées conformément aux standards de sécurité bancaire et blockchain.
                  </p>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* Dakar African Renaissance Graphic & Slogan */}
        <div className="w-full max-w-lg mt-10 flex flex-col items-center text-center">
          <div className="relative w-full max-w-sm h-40 sm:h-48 overflow-hidden rounded-2xl flex items-center justify-center">
            <Image
              src="/images/dakar-monument.jpg"
              alt="Monument de la Renaissance Africaine - Dakar"
              width={400}
              height={260}
              className="object-contain max-h-full transition-transform duration-500 hover:scale-105"
              priority
            />
          </div>

          <div className="mt-2 text-center">
            <p className="text-xs sm:text-sm font-semibold tracking-wide text-slate-700 italic font-serif">
              « Ensemble pour une Afrique plus connectée »
            </p>
            <div className="w-16 h-1 bg-[#F5C200] rounded-full mx-auto mt-1" />
          </div>
        </div>
      </main>

      {/* Bottom Dark Banner - #0F172A */}
      <footer className="w-full bg-[#0F172A] text-white py-6 border-t border-[#1e293b]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="transition-opacity hover:opacity-90">
            <SunuPayLogo variant="dark" size="sm" />
          </Link>

          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6">
            <span className="text-[10px] font-bold tracking-widest text-[#94a3b8] uppercase">
              Organisé par
            </span>
            <div className="flex items-center gap-5">
              <BitnobLogo variant="dark" size="sm" />
              <BtrustLogo variant="dark" size="sm" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
