import { NextRequest, NextResponse } from "next/server";
import { bitnobServerClient } from "@/lib/bitnob/client";
import {
  findUserById,
  findUserByEmail,
  updateUserBitnobSync,
} from "@/lib/auth/user-store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, email } = body;

    let user = null;
    if (userId) {
      user = await findUserById(userId);
    } else if (email) {
      user = await findUserByEmail(email);
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Utilisateur SunuPay introuvable." },
        { status: 404 }
      );
    }

    // 1. If already synced, don't duplicate on Bitnob
    if (user.bitnobSyncStatus === "synced" && user.bitnobCustomerId) {
      return NextResponse.json({
        success: true,
        message: "Ce compte SunuPay possède déjà un profil client Bitnob synchronisé.",
        status: "synced",
        customerId: user.bitnobCustomerId,
      });
    }

    // 2. Trigger Bitnob Customer Creation / Check
    const result = await bitnobServerClient.createCustomer({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phone,
      countryCode: user.countryCode || "SN",
      customerType: "individual",
      reference: user.bitnobReference || `retry_${Date.now()}`,
    });

    if (result.success && result.customer) {
      await updateUserBitnobSync(user.id, {
        bitnobCustomerId: result.customer.id,
        bitnobSyncStatus: "synced",
      });

      return NextResponse.json({
        success: true,
        message: "Profil client Bitnob synchronisé avec succès.",
        status: "synced",
        customerId: result.customer.id,
        isDemo: result.isDemo,
      });
    } else {
      await updateUserBitnobSync(user.id, {
        bitnobSyncStatus: "pending_retry",
        bitnobSyncError: result.error || "Tentative échouée",
      });

      return NextResponse.json(
        {
          success: false,
          message: "Échec de synchronisation avec Bitnob. Une nouvelle tentative pourra être effectuée ultérieurement.",
          status: "pending_retry",
          error: result.error,
        },
        { status: 502 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || "Erreur interne lors de la tentative de synchronisation Bitnob.",
      },
      { status: 500 }
    );
  }
}
