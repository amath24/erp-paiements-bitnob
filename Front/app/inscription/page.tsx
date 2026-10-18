"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Phone,
  ArrowRight,
  ArrowLeft,
  Shield,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { SunuPayLogo, BitnobLogo, BtrustLogo } from "@/components/ui/PartnerLogos";

const COUNTRY_DIAL_CODES = [
  { code: "SN", dial: "+221", name: "Sénégal 🇸🇳" },
  { code: "NG", dial: "+234", name: "Nigéria 🇳🇬" },
  { code: "GH", dial: "+233", name: "Ghana 🇬🇭" },
  { code: "CI", dial: "+225", name: "Côte d'Ivoire 🇨🇮" },
  { code: "CM", dial: "+237", name: "Cameroun 🇨🇲" },
  { code: "BJ", dial: "+229", name: "Bénin 🇧🇯" },
  { code: "ML", dial: "+223", name: "Mali 🇲🇱" },
  { code: "TG", dial: "+228", name: "Togo 🇹🇬" },
  { code: "FR", dial: "+33", name: "France 🇫🇷" },
  { code: "US", dial: "+1", name: "États-Unis 🇺🇸" },
];

export default function InscriptionPage() {
  const router = useRouter();

  // Form Fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [dialCode, setDialCode] = useState("+221");
  const [phoneNational, setPhoneNational] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(true);

  // UI States
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRetryingSync, setIsRetryingSync] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Results State
  const [registrationResult, setRegistrationResult] = useState<{
    success: boolean;
    user?: any;
    bitnob?: {
      status: "synced" | "pending_retry" | "failed";
      customerId?: string;
      message?: string;
      error?: string;
    };
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setRegistrationResult(null);

    // Validation des champs obligatoires
    if (!firstName.trim()) {
      setErrorMsg("Veuillez saisir votre prénom.");
      return;
    }

    if (!lastName.trim()) {
      setErrorMsg("Veuillez saisir votre nom de famille.");
      return;
    }

    if (!email.trim() || !email.includes("@") || !email.includes(".")) {
      setErrorMsg("Veuillez saisir une adresse e-mail valide.");
      return;
    }

    if (!phoneNational.trim()) {
      setErrorMsg("Veuillez saisir votre numéro de téléphone.");
      return;
    }

    const fullPhone = `${dialCode}${phoneNational.trim().replace(/^0+/, "").replace(/\s+/g, "")}`;

    if (password.length < 8) {
      setErrorMsg("Le mot de passe doit comporter au moins 8 caractères.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("La confirmation du mot de passe ne correspond pas.");
      return;
    }

    if (!acceptTerms) {
      setErrorMsg("Veuillez accepter les conditions d'utilisation pour continuer.");
      return;
    }

    setIsLoading(true);

    try {
      const selectedCountry = COUNTRY_DIAL_CODES.find((c) => c.dial === dialCode)?.code || "SN";

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone: fullPhone,
          countryCode: selectedCountry,
          password,
          confirmPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "Une erreur est survenue lors de l'inscription.");
        setIsLoading(false);
        return;
      }

      setRegistrationResult(data);
      setIsLoading(false);

      // Si le profil Bitnob est synchronisé directement, rediriger après 2.5s pour laisser le temps de lire
      if (data.bitnob?.status === "synced") {
        setTimeout(() => {
          router.push("/dashboard");
        }, 2200);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Erreur réseau. Veuillez vérifier votre connexion.");
      setIsLoading(false);
    }
  };

  const handleRetryBitnobSync = async () => {
    if (!registrationResult?.user?.id && !registrationResult?.user?.email) return;

    setIsRetryingSync(true);
    try {
      const res = await fetch("/api/auth/sync-bitnob", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: registrationResult.user.id,
          email: registrationResult.user.email,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setRegistrationResult((prev: any) => ({
          ...prev,
          bitnob: {
            status: "synced",
            customerId: data.customerId,
            message: "Profil Bitnob synchronisé avec succès.",
          },
        }));
      } else {
        setErrorMsg(data.message || data.error || "La tentative de synchronisation a échoué.");
      }
    } catch {
      setErrorMsg("Impossible de joindre le service de synchronisation.");
    } finally {
      setIsRetryingSync(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB] flex flex-col justify-between selection:bg-[#F5C200] selection:text-[#0F172A]">
      {/* Top Bar */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between">
        <Link href="/" className="transition-opacity hover:opacity-90">
          <SunuPayLogo size="md" />
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/connexion"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-gray-600 hover:text-[#0F172A] transition-colors py-1.5 px-3 rounded-lg hover:bg-gray-100"
          >
            <span>Déjà un compte ?</span>
            <span className="text-[#D97706] font-bold">Se connecter</span>
          </Link>

          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-gray-600 hover:text-[#0F172A] transition-colors py-1.5 px-3 rounded-lg hover:bg-gray-100"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Retour à l&apos;accueil</span>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-lg">
          {/* Header Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] text-[11px] font-bold uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5 text-[#F5C200]" />
              <span>Ouverture de compte SunuPay</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0F172A] tracking-tight">
              Rejoignez SunuPay
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-2 max-w-md mx-auto leading-relaxed">
              Créez votre compte en quelques instants pour centraliser vos paiements transfrontaliers, vos factures et bénéficier de l&apos;écosystème Bitnob.
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-2xl border border-[#EAECEF] p-6 sm:p-8 shadow-sm">
            {/* Success with Bitnob synced */}
            {registrationResult?.bitnob?.status === "synced" && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm space-y-2 mb-6 animate-fadeIn">
                <div className="flex items-center gap-2 font-bold text-emerald-900">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>Compte SunuPay & Profil Bitnob prêts !</span>
                </div>
                <p className="text-xs text-emerald-700 leading-relaxed">
                  Votre compte SunuPay a été créé et votre profil client officiel a été provisionné chez Bitnob.
                </p>
                <div className="p-2 rounded-lg bg-white/80 border border-emerald-200 text-[11px] font-mono text-emerald-800 flex items-center justify-between">
                  <span>ID Bitnob :</span>
                  <span className="font-bold">{registrationResult.bitnob.customerId}</span>
                </div>
                <div className="pt-2 flex items-center justify-between">
                  <span className="text-[11px] text-emerald-600">Redirection vers le tableau de bord...</span>
                  <button
                    onClick={() => router.push("/dashboard")}
                    className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs"
                  >
                    Accéder maintenant
                  </button>
                </div>
              </div>
            )}

            {/* Success with Bitnob pending retry */}
            {registrationResult?.bitnob?.status === "pending_retry" && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm space-y-3 mb-6 animate-fadeIn">
                <div className="flex items-center gap-2 font-bold text-amber-950">
                  <CheckCircle2 className="w-5 h-5 text-amber-600 shrink-0" />
                  <span>Compte SunuPay créé avec succès</span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Vos identifiants SunuPay sont actifs. La synchronisation automatique avec l&apos;API Bitnob est temporairement en attente (réseau ou permissions API).
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                  <button
                    onClick={handleRetryBitnobSync}
                    disabled={isRetryingSync}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white font-semibold text-xs transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRetryingSync ? "animate-spin" : ""}`} />
                    <span>{isRetryingSync ? "Synchronisation en cours..." : "Réessayer la synchronisation Bitnob"}</span>
                  </button>
                  <button
                    onClick={() => router.push("/dashboard")}
                    className="w-full sm:w-auto inline-flex items-center justify-center px-3.5 py-2 rounded-lg bg-white border border-amber-300 hover:bg-amber-100/50 text-amber-900 font-semibold text-xs"
                  >
                    Continuer vers le tableau de bord
                  </button>
                </div>
              </div>
            )}

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 mb-5 animate-fadeIn">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-semibold block">{errorMsg}</span>
                  {errorMsg.includes("existe déjà") && (
                    <Link
                      href="/connexion"
                      className="inline-flex items-center gap-1 font-bold text-rose-800 underline underline-offset-2 hover:text-rose-950"
                    >
                      <span>Se connecter à mon compte existant</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* Form */}
            {!registrationResult && (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Names Row (Prénom & Nom) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label
                      htmlFor="firstName"
                      className="block text-xs font-bold text-gray-700 mb-1.5"
                    >
                      Prénom <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        id="firstName"
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Amadou"
                        required
                        className="w-full pl-10 pr-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#F5C200] focus:ring-2 focus:ring-[#F5C200]/20 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="lastName"
                      className="block text-xs font-bold text-gray-700 mb-1.5"
                    >
                      Nom de famille <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        id="lastName"
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Dione"
                        required
                        className="w-full pl-10 pr-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#F5C200] focus:ring-2 focus:ring-[#F5C200]/20 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label
                    htmlFor="email"
                    className="block text-xs font-bold text-gray-700 mb-1.5"
                  >
                    Adresse e-mail <span className="text-rose-500">*</span>
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
                      placeholder="amadou.dione@entreprise.com"
                      required
                      className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#F5C200] focus:ring-2 focus:ring-[#F5C200]/20 transition-all"
                    />
                  </div>
                </div>

                {/* Phone with International Dial Code */}
                <div>
                  <label
                    htmlFor="phone"
                    className="block text-xs font-bold text-gray-700 mb-1.5"
                  >
                    Téléphone avec indicatif international <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={dialCode}
                      onChange={(e) => setDialCode(e.target.value)}
                      className="w-36 py-2.5 px-2.5 text-xs font-bold bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-[#F5C200] focus:ring-2 focus:ring-[#F5C200]/20 cursor-pointer"
                    >
                      {COUNTRY_DIAL_CODES.map((c) => (
                        <option key={c.code} value={c.dial}>
                          {c.dial} ({c.name})
                        </option>
                      ))}
                    </select>

                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <Phone className="w-4 h-4" />
                      </div>
                      <input
                        id="phone"
                        type="tel"
                        value={phoneNational}
                        onChange={(e) => setPhoneNational(e.target.value)}
                        placeholder="77 123 45 67"
                        required
                        className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#F5C200] focus:ring-2 focus:ring-[#F5C200]/20 transition-all"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">
                    Exemple complet : {dialCode} {phoneNational || "771234567"}
                  </p>
                </div>

                {/* Password */}
                <div>
                  <label
                    htmlFor="password"
                    className="block text-xs font-bold text-gray-700 mb-1.5"
                  >
                    Mot de passe <span className="text-rose-500">*</span>
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
                      placeholder="Minimum 8 caractères"
                      required
                      minLength={8}
                      className="w-full pl-10 pr-10 py-2.5 text-sm bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#F5C200] focus:ring-2 focus:ring-[#F5C200]/20 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                      aria-label="Afficher ou masquer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-xs font-bold text-gray-700 mb-1.5"
                  >
                    Confirmez le mot de passe <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Répétez le mot de passe"
                      required
                      className="w-full pl-10 pr-10 py-2.5 text-sm bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#F5C200] focus:ring-2 focus:ring-[#F5C200]/20 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                      aria-label="Afficher ou masquer"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Terms checkbox */}
                <div className="pt-1">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={acceptTerms}
                      onChange={(e) => setAcceptTerms(e.target.checked)}
                      className="w-4 h-4 rounded text-[#F5C200] focus:ring-[#F5C200] border-gray-300 rounded-md mt-0.5"
                    />
                    <span>
                      J&apos;accepte les conditions d&apos;utilisation de SunuPay et la synchronisation sécurisée de mon profil chez Bitnob.
                    </span>
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-4 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#F5C200] hover:bg-[#E5B500] text-[#0F172A] font-bold text-sm shadow-md shadow-[#F5C200]/20 transition-all transform active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Création de votre compte...</span>
                    </>
                  ) : (
                    <>
                      <span>Créer mon compte SunuPay</span>
                      <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                    </>
                  )}
                </button>

                {/* Login link */}
                <div className="text-center pt-3 text-xs text-gray-500">
                  <span>Vous avez déjà un compte ? </span>
                  <Link
                    href="/connexion"
                    className="font-bold text-[#0F172A] hover:underline"
                  >
                    Se connecter
                  </Link>
                </div>

                {/* Security Box */}
                <div className="mt-5 p-3.5 rounded-xl bg-[#F0F5FA] border border-[#DCE7F2] flex items-start gap-3 text-left">
                  <div className="p-1 rounded-lg bg-blue-100 text-[#0F172A] shrink-0 mt-0.5">
                    <Shield className="w-4 h-4 text-[#0F172A]" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#0F172A]">
                      Sécurité et souveraineté de vos accès
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                      Vos identifiants SunuPay restent uniques et exclusifs. Aucun mot de passe n&apos;est transmis ni généré chez Bitnob. Toutes les requêtes d&apos;interconnexion sont chiffrées côté serveur.
                    </p>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Dakar African Renaissance Graphic & Slogan */}
        <div className="w-full max-w-lg mt-10 flex flex-col items-center text-center">
          <div className="relative w-full max-w-sm h-36 sm:h-44 overflow-hidden rounded-2xl flex items-center justify-center">
            <Image
              src="/images/dakar-monument.jpg"
              alt="Monument de la Renaissance Africaine - Dakar"
              width={380}
              height={240}
              className="object-contain max-h-full transition-transform duration-500 hover:scale-105"
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
