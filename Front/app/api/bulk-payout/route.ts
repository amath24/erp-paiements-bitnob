import { NextRequest, NextResponse } from "next/server";
import { bitnobServerClient } from "@/lib/bitnob/client";

interface ValidateItemPayload {
  rowIndex: number;
  name: string;
  phone: string;
  amount: number;
  currency: string;
  country: string;
  operator?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, items, batchId } = body;

    // Action 1: Confirm batch execution
    if (action === "confirm" && batchId) {
      const result = await bitnobServerClient.confirmBatch(batchId);
      return NextResponse.json({
        success: true,
        batchId,
        status: "processing",
        message: "Lot de paiements en cours d'exécution sur les rails Bitnob.",
        result,
      });
    }

    // Action 2: Retry failed items
    if (action === "retry" && batchId) {
      const result = await bitnobServerClient.retryBatchFailedItems(batchId);
      return NextResponse.json({
        success: true,
        batchId,
        message: "Lignes échouées relancées.",
        result,
      });
    }

    // Action 3: Validate and prepare batch
    if (!items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: "Veuillez fournir un tableau d'éléments à valider." },
        { status: 400 }
      );
    }

    const rates: Record<string, number> = {
      XOF: 595.0,
      NGN: 1480.0,
      GHS: 15.5,
    };

    const feePerItemUSDT = 0.5;

    const validatedItems = items.map((it: ValidateItemPayload, index: number) => {
      const errors: string[] = [];
      const country = (it.country || "SN").toUpperCase();
      const currency = (it.currency || "XOF").toUpperCase();
      const phone = (it.phone || "").replace(/\s+/g, "");

      // 1. Check country-currency match
      if (country === "SN" && currency !== "XOF") {
        errors.push("Le Sénégal utilise le XOF (FCFA).");
      }
      if (country === "NG" && currency !== "NGN") {
        errors.push("Le Nigéria utilise le NGN (Naira).");
      }
      if (country === "GH" && currency !== "GHS") {
        errors.push("Le Ghana utilise le GHS (Cedi).");
      }

      // 2. Check international phone prefixes
      if (country === "SN" && !phone.startsWith("+221")) {
        errors.push("Numéro non sénégalais (+221 requis).");
      }
      if (country === "NG" && !phone.startsWith("+234")) {
        errors.push("Numéro non nigérian (+234 requis).");
      }
      if (country === "GH" && !phone.startsWith("+233")) {
        errors.push("Numéro non ghanéen (+233 requis).");
      }

      // 3. Check min length
      if (phone.length < 9) {
        errors.push("Format de numéro incomplet.");
      }

      // 4. Check amount
      if (!it.amount || it.amount <= 0) {
        errors.push("Montant invalide ou nul.");
      }

      const rate = rates[currency] || 595.0;
      const amountUSDT = Math.round((it.amount / rate) * 100) / 100;

      return {
        id: `item-${index + 1}`,
        rowIndex: index + 1,
        name: it.name || "Bénéficiaire",
        phoneOrAccount: it.phone,
        country,
        currency,
        amount: it.amount,
        amountUSDT,
        operator: it.operator || "Mobile Money",
        status: errors.length > 0 ? "invalid" : "valid",
        errorMessage: errors.join(" • ") || undefined,
      };
    });

    const validCount = validatedItems.filter((i) => i.status === "valid").length;
    const invalidCount = validatedItems.filter((i) => i.status === "invalid").length;

    // Totals per currency
    const totalAmountLocal: Record<string, number> = {};
    let totalAmountUSDT = 0;

    validatedItems
      .filter((i) => i.status === "valid")
      .forEach((i) => {
        totalAmountLocal[i.currency] = (totalAmountLocal[i.currency] || 0) + i.amount;
        totalAmountUSDT += i.amountUSDT;
      });

    const estimatedFeesUSDT = validCount * feePerItemUSDT;

    return NextResponse.json({
      success: true,
      batch: {
        id: `batch-${Date.now()}`,
        totalRecipients: validatedItems.length,
        validCount,
        invalidCount,
        totalAmountLocal,
        totalAmountUSDT: Math.round(totalAmountUSDT * 100) / 100,
        estimatedFeesUSDT,
        items: validatedItems,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Erreur de traitement du lot de paiements." },
      { status: 500 }
    );
  }
}
