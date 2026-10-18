import { NextRequest, NextResponse } from "next/server";
import { bitnobServerClient } from "@/lib/bitnob/client";
import {
  findUserById,
  findUserByEmail,
  updateUserKycStatus,
} from "@/lib/auth/user-store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId,
      email,
      idType,
      idNumber,
      dateOfBirth,
      line1,
      city,
      state,
      postalCode,
      country,
    } = body;

    let user = null;
    if (userId) {
      user = await findUserById(userId);
    } else if (email) {
      user = await findUserByEmail(email);
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Utilisateur PayLink Afrique introuvable." },
        { status: 404 }
      );
    }

    // 1. Validation of required KYC fields for card issuance compliance
    if (!idType || !["national_id", "passport", "drivers_license", "voters_card"].includes(idType)) {
      return NextResponse.json(
        {
          success: false,
          error: "Veuillez sélectionner un type de pièce d'identité valide (Carte Nationale, Passeport ou Permis).",
        },
        { status: 400 }
      );
    }

    if (!idNumber || !idNumber.trim()) {
      return NextResponse.json(
        { success: false, error: "Le numéro de la pièce d'identité est obligatoire." },
        { status: 400 }
      );
    }

    if (!dateOfBirth || !dateOfBirth.trim()) {
      return NextResponse.json(
        { success: false, error: "La date de naissance est requise pour la vérification KYC." },
        { status: 400 }
      );
    }

    if (!line1 || !city || !country) {
      return NextResponse.json(
        { success: false, error: "L'adresse résidentielle complète (rue, ville, pays) est obligatoire." },
        { status: 400 }
      );
    }

    // 2. Submit KYC to Bitnob (server-side only)
    const customerId = user.bitnobCustomerId || `demo_cust_${user.id}`;
    const kycResult = await bitnobServerClient.updateCustomerKyc(customerId, {
      idType,
      idNumber: idNumber.trim(),
      dateOfBirth: dateOfBirth.trim(),
      line1: line1.trim(),
      city: city.trim(),
      state: state?.trim() || "Dakar",
      postalCode: postalCode?.trim() || "12000",
      country: country.trim(),
    });

    if (kycResult.success) {
      await updateUserKycStatus(user.id, "approved", {
        idType,
        idNumber: idNumber.trim(),
        dateOfBirth: dateOfBirth.trim(),
        line1: line1.trim(),
        city: city.trim(),
        country: country.trim(),
      });

      return NextResponse.json({
        success: true,
        kycStatus: "approved",
        message: "Vérification d'identité KYC validée avec succès par Bitnob. Vous pouvez désormais créer des cartes virtuelles.",
        isDemo: kycResult.isDemo,
      });
    } else {
      await updateUserKycStatus(user.id, "pending_review", {
        idType,
        idNumber: idNumber.trim(),
      });

      return NextResponse.json(
        {
          success: false,
          kycStatus: "pending_review",
          error: kycResult.error || "Examen des documents KYC en cours.",
        },
        { status: 422 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || "Erreur interne lors de la vérification KYC.",
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const email = searchParams.get("email");

    let user = null;
    if (userId) {
      user = await findUserById(userId);
    } else if (email) {
      user = await findUserByEmail(email);
    }

    if (!user) {
      return NextResponse.json({ kycStatus: "unverified" });
    }

    return NextResponse.json({
      kycStatus: user.kycStatus || "unverified",
      bitnobCustomerId: user.bitnobCustomerId,
      bitnobSyncStatus: user.bitnobSyncStatus,
    });
  } catch {
    return NextResponse.json({ kycStatus: "unverified" });
  }
}
