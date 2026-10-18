import { NextRequest, NextResponse } from "next/server";
import { bitnobServerClient } from "@/lib/bitnob/client";

// In-memory set to prevent duplicate webhook replays
const processedEventIds = new Set<string>();

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-bitnob-signature") || "";

    // Signature verification if webhook secret is configured
    if (process.env.BITNOB_WEBHOOK_SECRET) {
      const isValid = bitnobServerClient.verifyWebhookSignature(
        rawBody,
        signature
      );
      if (!isValid) {
        return NextResponse.json(
          { error: "Signature HMAC invalide." },
          { status: 401 }
        );
      }
    }

    const payload = JSON.parse(rawBody);
    const eventId = payload.id || payload.reference;

    // Idempotency check: prevent double processing
    if (eventId && processedEventIds.has(eventId)) {
      return NextResponse.json(
        { message: "Événement déjà traité (Idempotent)." },
        { status: 200 }
      );
    }

    if (eventId) {
      processedEventIds.add(eventId);
    }

    const eventType = payload.event;
    console.log(`[SunuPay Webhook] Événement reçu : ${eventType}`, payload);

    // Handle events
    switch (eventType) {
      case "checkout.received":
      case "charge.success":
        // Invoice was paid by customer
        break;
      case "payout.success":
        // Transfer completed to mobile money
        break;
      case "payout.failed":
        // Transfer failed
        break;
      default:
        break;
    }

    return NextResponse.json({ received: true, event: eventType });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erreur de traitement webhook" },
      { status: 500 }
    );
  }
}
