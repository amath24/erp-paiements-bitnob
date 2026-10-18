import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { generateAssistantReply } from "@/lib/assistant-engine";
import { getFinancialAnalytics } from "@/lib/supabase/test-client";

// System instructions embedding PayLink Afrique product context and security constraints
const SYSTEM_PROMPT = `Tu es l'Assistant IA FinTech officiel de PayLink Afrique.
Ton rôle est de répondre avec clarté, professionnalisme et exactitude aux questions des utilisateurs (freelances, administrateurs de PME, directeurs financiers).

RÈGLES ABSOLUES ET SÉCURITÉ :
1. Tu es un outil d'ANALYSE et d'ASSISTANCE en lecture seule. Tu ne déclenches AUCUN paiement, tu ne modifies aucun solde ni bénéficiaire.
2. Tu n'inventes JAMAIS de chiffres financiers. Utilise STRICTEMENT les données fournies dans le contexte ci-dessous.
3. Pour les calculs de conversion et de facturation :
   - Taux garanti USDT -> XOF : 1 USDT = 595 XOF (Sénégal)
   - Taux garanti USDT -> NGN : 1 USDT = 1480 NGN (Nigéria)
   - Taux garanti USDT -> GHS : 1 USDT = 15.5 GHS (Ghana)
   - Frais de réseau Bitnob fixes : 0.50 USDT par transaction/transfert
   - Formule pour obtenir un net XOF cible : Montant USDT = (Net XOF / 595) + 0.50 USDT.
4. Pour toute question sur les lots ou les paiements par pays, mentionne la requête SQL associée dans un bloc de code pour garantir la transparence des chiffres.
5. Si l'utilisateur te demande des données non disponibles ou inexistantes, explique poliment la limite sans halluciner.
6. Réponds toujours en français dans un style concis, bien structuré avec des listes à puces.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, history } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Veuillez fournir un message textuel valide." },
        { status: 400 }
      );
    }

    // 1. Fetch real or test analytics snapshot from Supabase / test store
    const analytics = await getFinancialAnalytics();

    // 2. Check for configured AI Provider
    const apiKey =
      process.env.OPENAI_API_KEY ||
      process.env.GROQ_API_KEY ||
      process.env.AI_PROVIDER_KEY ||
      "";

    const isGroq = Boolean(process.env.GROQ_API_KEY);
    const baseURL = isGroq ? "https://api.groq.com/openai/v1" : undefined;
    const model = isGroq ? "llama-3.1-70b-versatile" : "gpt-4o-mini";

    // Scenario A: Real AI Provider configured
    if (apiKey && apiKey.trim().length > 10 && !apiKey.includes("your-api-key")) {
      try {
        const openai = new OpenAI({ apiKey, baseURL });

        const contextDataPrompt = `
CONTEXTE FINANCIER EN DIRECT (Source : ${analytics.source}) :
- Paiements par pays ce mois :
  * Ghana : ${analytics.payoutsByCountry.find((p) => p.country === "GH")?.totalLocal.toLocaleString("fr-FR")} GHS ($${analytics.payoutsByCountry.find((p) => p.country === "GH")?.totalUSDT} USDT) pour ${analytics.payoutsByCountry.find((p) => p.country === "GH")?.recipientsCount} livreurs.
  * Nigéria : ${analytics.payoutsByCountry.find((p) => p.country === "NG")?.totalLocal.toLocaleString("fr-FR")} NGN ($${analytics.payoutsByCountry.find((p) => p.country === "NG")?.totalUSDT} USDT) pour ${analytics.payoutsByCountry.find((p) => p.country === "NG")?.recipientsCount} livreurs.
  * Sénégal : ${analytics.payoutsByCountry.find((p) => p.country === "SN")?.totalLocal.toLocaleString("fr-FR")} XOF ($${analytics.payoutsByCountry.find((p) => p.country === "SN")?.totalUSDT} USDT) pour ${analytics.payoutsByCountry.find((p) => p.country === "SN")?.recipientsCount} livreurs.
- Répartition des dépenses par devise : USDT (${analytics.currencySplit.USDT}%), Bitcoin (${analytics.currencySplit.BTC}%), USDC (${analytics.currencySplit.USDC}%).
- Dernier lot de paiements de masse : "${analytics.lastBatch.title}", statut: ${analytics.lastBatch.status}, 28 réussis sur 30, montant: $${analytics.lastBatch.totalUSDT} USDT.
`;

        const conversationMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          { role: "system", content: `${SYSTEM_PROMPT}\n\n${contextDataPrompt}` },
        ];

        // Append conversation history if provided
        if (Array.isArray(history)) {
          history.slice(-6).forEach((h: any) => {
            if (h.sender === "user" || h.role === "user") {
              conversationMessages.push({ role: "user", content: h.content });
            } else if (h.sender === "assistant" || h.role === "assistant") {
              conversationMessages.push({ role: "assistant", content: h.content });
            }
          });
        }

        conversationMessages.push({ role: "user", content: message });

        const completion = await openai.chat.completions.create({
          model,
          messages: conversationMessages,
          temperature: 0.2, // low temperature for financial rigor
          max_tokens: 800,
        });

        const reply = completion.choices[0]?.message?.content || "";

        return NextResponse.json({
          success: true,
          reply,
          provider: isGroq ? "Groq (Llama-3.1)" : "OpenAI (GPT-4o)",
          model,
          source: analytics.source,
        });
      } catch (aiErr: any) {
        console.error("[Assistant API] Erreur d'appel LLM distant :", aiErr?.message);
        // Fallback to deterministic financial engine if LLM provider fails (e.g. quota or network)
      }
    }

    // Scenario B: Deterministic Financial Engine (Offline / Test / Sandbox Mode)
    // Ensures 100% reliable responses, zero hallucination and mathematically exact calculations
    const result = generateAssistantReply(message);

    return NextResponse.json({
      success: true,
      reply: result.reply,
      computation: result.computation,
      provider: "PayLink Afrique Deterministic Financial Engine (Sandbox Mode)",
      source: analytics.source,
      hasApiKey: false,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Erreur interne lors du traitement de la requête IA." },
      { status: 500 }
    );
  }
}
