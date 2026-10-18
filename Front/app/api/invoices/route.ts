import { NextRequest, NextResponse } from "next/server";
import { bitnobServerClient } from "@/lib/bitnob/client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientName, description, amount, currency, acceptedCryptos, dueDate, notes } = body;

    if (!clientName || !description || !amount || amount <= 0) {
      return NextResponse.json(
        { error: "Veuillez fournir un nom de client, une description et un montant valide." },
        { status: 400 }
      );
    }

    const invoiceNumber = `SP-${Math.floor(1000 + Math.random() * 9000)}`;

    const checkoutResult = await bitnobServerClient.createCheckout({
      amount: Math.round(amount * 100), // in cents
      currency: "USDT",
      customerEmail: "client@example.com",
      description: `${description} (Facture ${invoiceNumber})`,
      reference: invoiceNumber,
      callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://sunupay.io"}/api/webhooks/bitnob`,
      successUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://sunupay.io"}/pay/${invoiceNumber}?status=success`,
    });

    const newInvoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber,
      clientName,
      description,
      amount,
      currency: currency || "USD",
      acceptedCryptos: acceptedCryptos || ["BTC", "USDT", "USDC"],
      dueDate,
      notes,
      status: "pending",
      createdAt: new Date().toISOString(),
      shareableUrl: checkoutResult.checkoutUrl || `https://sunupay.io/pay/${invoiceNumber}`,
      isDemo: checkoutResult.isDemo,
    };

    return NextResponse.json({ success: true, invoice: newInvoice });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Erreur interne lors de la création de la facture" },
      { status: 500 }
    );
  }
}
