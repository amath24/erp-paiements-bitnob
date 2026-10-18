import { NextRequest, NextResponse } from "next/server";
import { bitnobServerClient } from "@/lib/bitnob/client";
import {
  findUserByEmail,
  createSunuPayUser,
  updateUserBitnobSync,
} from "@/lib/auth/user-store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      firstName,
      lastName,
      email,
      phone,
      countryCode,
      password,
      confirmPassword,
    } = body;

    // ─────────────────────────────────────────────────────────────
    // 1. Validation rigoureuse des champs obligatoires
    // ─────────────────────────────────────────────────────────────
    if (!firstName || !firstName.trim()) {
      return NextResponse.json(
        { success: false, error: "Le prénom est obligatoire." },
        { status: 400 }
      );
    }

    if (!lastName || !lastName.trim()) {
      return NextResponse.json(
        { success: false, error: "Le nom de famille est obligatoire." },
        { status: 400 }
      );
    }

    if (!email || !email.trim() || !email.includes("@") || !email.includes(".")) {
      return NextResponse.json(
        { success: false, error: "Veuillez fournir une adresse e-mail valide." },
        { status: 400 }
      );
    }

    if (!phone || !phone.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Le numéro de téléphone avec indicatif international est obligatoire.",
        },
        { status: 400 }
      );
    }

    // Phone format: international dial code prefix (e.g. +221..., +234..., +33...)
    const cleanPhone = phone.trim().replace(/\s+/g, "");
    if (!cleanPhone.startsWith("+") || cleanPhone.length < 9) {
      return NextResponse.json(
        {
          success: false,
          error: "Le numéro de téléphone doit débuter par son indicatif international (ex: +221, +234).",
        },
        { status: 400 }
      );
    }

    if (!password || password.length < 8) {
      return NextResponse.json(
        {
          success: false,
          error: "Le mot de passe doit comporter au moins 8 caractères.",
        },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        {
          success: false,
          error: "Le mot de passe et sa confirmation ne correspondent pas.",
        },
        { status: 400 }
      );
    }

    const normEmail = email.trim().toLowerCase();

    // ─────────────────────────────────────────────────────────────
    // 2. Gestion des doublons SunuPay
    // ─────────────────────────────────────────────────────────────
    const existingSunuPayUser = await findUserByEmail(normEmail);
    if (existingSunuPayUser) {
      return NextResponse.json(
        {
          success: false,
          alreadyExists: true,
          error: "Un compte SunuPay existe déjà avec cette adresse e-mail. Veuillez vous connecter.",
        },
        { status: 409 }
      );
    }

    // ─────────────────────────────────────────────────────────────
    // 3. Création du compte d'authentification SunuPay
    // ─────────────────────────────────────────────────────────────
    const { user: sunupayUser } = await createSunuPayUser({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normEmail,
      phone: cleanPhone,
      countryCode: countryCode || "SN",
      password,
    });

    // ─────────────────────────────────────────────────────────────
    // 4. Déclenchement côté serveur de la création client Bitnob
    // (Zéro secret exposé au frontend, pas de mot de passe Bitnob généré)
    // ─────────────────────────────────────────────────────────────
    let bitnobResult;
    try {
      bitnobResult = await bitnobServerClient.createCustomer({
        email: normEmail,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phoneNumber: cleanPhone,
        countryCode: countryCode || "SN",
        customerType: "individual",
        reference: sunupayUser.bitnobReference,
      });
    } catch (bitnobErr: any) {
      bitnobResult = {
        isDemo: false,
        success: false,
        error: bitnobErr?.message || "Erreur de connexion avec l'API Bitnob",
      };
    }

    // ─────────────────────────────────────────────────────────────
    // 5. Enregistrement sécurisé de l'état de synchronisation
    // ─────────────────────────────────────────────────────────────
    if (bitnobResult && bitnobResult.success && bitnobResult.customer) {
      // Succès complet : Compte SunuPay + Profil client Bitnob synchronisé
      await updateUserBitnobSync(sunupayUser.id, {
        bitnobCustomerId: bitnobResult.customer.id,
        bitnobSyncStatus: "synced",
      });

      return NextResponse.json(
        {
          success: true,
          message:
            "Votre compte SunuPay a été créé avec succès et votre profil client Bitnob est synchronisé.",
          user: {
            id: sunupayUser.id,
            firstName: sunupayUser.firstName,
            lastName: sunupayUser.lastName,
            email: sunupayUser.email,
            phone: sunupayUser.phone,
            countryCode: sunupayUser.countryCode,
            bitnobCustomerId: bitnobResult.customer.id,
            bitnobSyncStatus: "synced",
          },
          bitnob: {
            status: "synced",
            customerId: bitnobResult.customer.id,
            message: bitnobResult.message || "Profil client Bitnob actif.",
            isDemo: bitnobResult.isDemo,
          },
        },
        { status: 201 }
      );
    } else {
      // Compte SunuPay créé, mais Bitnob reste à synchroniser (tolérance aux pannes réseau)
      const errorMsg =
        bitnobResult?.error || "Synchronisation du profil Bitnob temporairement différée.";

      await updateUserBitnobSync(sunupayUser.id, {
        bitnobSyncStatus: "pending_retry",
        bitnobSyncError: errorMsg,
      });

      return NextResponse.json(
        {
          success: true,
          message:
            "Votre compte SunuPay a été créé avec succès. La synchronisation de votre profil Bitnob est en attente et sera réessayée automatiquement.",
          user: {
            id: sunupayUser.id,
            firstName: sunupayUser.firstName,
            lastName: sunupayUser.lastName,
            email: sunupayUser.email,
            phone: sunupayUser.phone,
            countryCode: sunupayUser.countryCode,
            bitnobSyncStatus: "pending_retry",
          },
          bitnob: {
            status: "pending_retry",
            error: errorMsg,
            message:
              "Profil Bitnob en attente de synchronisation. Vos identifiants SunuPay sont actifs et fonctionnels.",
          },
        },
        { status: 201 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || "Une erreur inattendue est survenue lors de l'inscription.",
      },
      { status: 500 }
    );
  }
}
