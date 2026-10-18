import { NextRequest, NextResponse } from "next/server";
import { bitnobServerClient } from "@/lib/bitnob/client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      recipientName,
      recipientCountry,
      operator,
      phoneNumber,
      accountNumber,
      amountSent,
      currencySent,
      reference,
    } = body;

    if (!recipientName || !amountSent || amountSent <= 0) {
      return NextResponse.json(
        { error: "Montant ou bénéficiaire manquant." },
        { status: 400 }
      );
    }

    const txRef = reference || `TR-${Date.now()}`;

    const payoutResult = await bitnobServerClient.sendPayout({
      amount: amountSent,
      currency: currencySent || "USDT",
      country: recipientCountry || "SN",
      beneficiaryName: recipientName,
      accountNumberOrPhone: phoneNumber || accountNumber || "",
      operator: operator || "Orange Money",
      reference: txRef,
    });

    return NextResponse.json({
      success: true,
      reference: txRef,
      isDemo: payoutResult.isDemo,
      result: payoutResult,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Erreur de traitement du transfert." },
      { status: 500 }
    );
  }
}
