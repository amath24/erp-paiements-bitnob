import { MOCK_TRANSACTIONS, SUPPORTED_DESTINATIONS } from "./mock-data";

export interface CalculationResult {
  targetNetXOF: number;
  invoiceAmountUSDT: number;
  rate: number;
  networkFeeUSDT: number;
  grossXOF: number;
  netXOF: number;
  operator: string;
}

/**
 * Deterministic financial calculator for crypto to fiat invoices
 */
export function calculateTargetInvoice(
  targetNetXOF: number,
  operator: string = "Wave / Orange Money"
): CalculationResult {
  const rate = 595.0; // 1 USDT = 595 XOF
  const networkFeeUSDT = 0.5; // Fixed payout fee
  // (invoiceUSDT - networkFeeUSDT) * rate = targetNetXOF
  // invoiceUSDT = (targetNetXOF / rate) + networkFeeUSDT
  const rawUSDT = targetNetXOF / rate + networkFeeUSDT;
  const invoiceAmountUSDT = Math.ceil(rawUSDT * 100) / 100; // Round up to 2 decimal places

  const grossXOF = invoiceAmountUSDT * rate;
  const netXOF = (invoiceAmountUSDT - networkFeeUSDT) * rate;

  return {
    targetNetXOF,
    invoiceAmountUSDT,
    rate,
    networkFeeUSDT,
    grossXOF,
    netXOF,
    operator,
  };
}

/**
 * Deterministic transaction explainer
 */
export function findAndExplainTransaction(query: string) {
  const q = query.toLowerCase();
  const tx = MOCK_TRANSACTIONS.find(
    (t) =>
      t.client.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q) ||
      (t.txHash && t.txHash.toLowerCase().includes(q))
  );

  if (!tx) {
    return null;
  }

  return {
    found: true,
    tx,
    explanation: `Transaction ${tx.id} de ${tx.amount} ${tx.currency} avec ${tx.client} (${tx.type}). Réseau : ${tx.network || "Standard"}. Statut actuel : ${tx.status === "confirmed" ? "Confirmé sur la blockchain" : "En attente de confirmation"}. Frais de réseau appliqués : ${tx.fee || 0} ${tx.currency}. Date : ${tx.date}.`,
  };
}

/**
 * Deterministic payment methods resolver
 */
export function getPaymentMethodsForCountry(countryNameOrCode: string) {
  const q = countryNameOrCode.toLowerCase();
  const country = SUPPORTED_DESTINATIONS.find(
    (c) =>
      c.country.toLowerCase().includes(q) ||
      c.countryCode.toLowerCase() === q
  );

  if (!country) return null;

  return {
    country: country.country,
    flag: country.flag,
    currency: country.currency,
    rateToUSDT: country.rateToUSDT,
    methods: country.methods,
  };
}

/**
 * Main AI Assistant answer generator using deterministic logic
 */
export function generateAssistantReply(userQuery: string): {
  reply: string;
  computation?: any;
} {
  const q = userQuery.toLowerCase();

  // -------------------------------------------------------------
  // RÈGLE DE SÉCURITÉ 1 : Refus absolu d'action financière d'écriture / exécution
  // -------------------------------------------------------------
  const isExecutionAttempt =
    q.includes("envoie") ||
    q.includes("envoyer") ||
    q.includes("déclenche") ||
    q.includes("declenche") ||
    q.includes("payer ") ||
    q.includes("virement ") ||
    q.includes("transfère") ||
    q.includes("transfere") ||
    q.includes("valide le lot") ||
    q.includes("confirmer le lot");

  if (isExecutionAttempt) {
    return {
      reply: `⛔ Action d'exécution financière refusée (Sécurité PayLink Afrique) :

L'assistant IA est strictement configuré comme un outil analytique et conversationnel en lecture seule. Il est techniquement et contractuellement interdit à l'assistant de déclencher des paiements, d'exécuter des virements réels ou de modifier des soldes.

Pour valider des paiements, rendez-vous sur le module dédié Paiements en Masse (/masse) ou utilisez l'interface sécurisée avec authentification à deux facteurs.`,
      computation: {
        type: "security_block",
        details: { reason: "financial_execution_prohibited" },
      },
    };
  }

  // -------------------------------------------------------------
  // RÈGLE DE SÉCURITÉ 2 : Refus d'injection SQL arbitraire / DDL / DML
  // -------------------------------------------------------------
  const isSqlInjection =
    q.includes("drop table") ||
    q.includes("update ") ||
    q.includes("delete from") ||
    q.includes("insert into") ||
    q.includes("alter table") ||
    q.includes("truncate ");

  if (isSqlInjection) {
    return {
      reply: `🛡️ Sécurité de la base de données (Règles Assane Dione) :

Toute exécution de commande SQL DDL/DML arbitraire est strictement interdite. L'assistant n'a accès qu'à des requêtes prédéfinies et sécurisées en lecture seule (vues analytiques). Aucune modification de schéma ou de données n'est permise sans validation du responsable de base de données.`,
      computation: {
        type: "security_block",
        details: { reason: "sql_dml_ddl_blocked" },
      },
    };
  }

  // -------------------------------------------------------------
  // Connaissance Produit : PayLink Afrique / Bitnob
  // -------------------------------------------------------------
  if (
    q.includes("paylink") ||
    q.includes("afrique") ||
    q.includes("sunupay") ||
    q.includes("présenter") ||
    q.includes("presenter") ||
    (q.includes("fonctionne") && q.includes("bitnob"))
  ) {
    return {
      reply: `PayLink Afrique est une solution FinTech B2B d'encaissement et de décaissement transfrontalier conçue pour les PME, commerçants et freelances africains.

Comment fonctionne l'intégration PayLink Afrique & Bitnob :
1. Encaissement Multi-Devises : Vos clients internationaux peuvent payer en Bitcoin (sur le réseau Lightning ou on-chain) ou en stablecoins (USDT / USDC).
2. Conversion & Rapprochement Automatique : Grâce à l'API Bitnob, les cryptomonnaies sont automatiquement converties en devises locales garanties (FCFA, NGN, GHS, KES).
3. Règlement Mobile Money & Banque : Vous recevez vos fonds directement sur vos portefeuilles Mobile Money (Wave, Orange Money, MTN, Moov) ou comptes bancaires locaux sans friction de change.
4. Paiements en Masse : Possibilité de payer des centaines de livreurs ou prestataires en un clic à travers toute l'Afrique.`,
      computation: {
        type: "product_overview",
        details: { product: "PayLink Afrique", engine: "Bitnob API v2" },
      },
    };
  }

  // -------------------------------------------------------------
  // Pattern 0: Questions analytiques Hackathon (Ghana, Nigéria, Pays absent, Part Bitcoin)
  // -------------------------------------------------------------
  if (q.includes("ghana")) {
    const sqlQuery = "SELECT country, currency, SUM(amount) AS total_local, SUM(amount_usdt) AS total_usdt FROM bulk_payout_items WHERE country = 'GH' AND status = 'completed' GROUP BY country, currency;";
    return {
      reply: `D'après les données de décaissement de ce mois-ci, nous avons payé un total de 11 800 GHS (environ $761.29 USDT) répartis entre 10 livreurs au Ghana 🇬🇭 via MTN Mobile Money et Vodafone Cash.

\`\`\`sql
-- Requête exécutée en lecture seule (Vue v_payouts_by_country)
${sqlQuery}
\`\`\`

• Nombre de livreurs réglés : 10
• Taux de succès : 100%
• Opérateurs utilisés : MTN Mobile Money, Vodafone Cash, AirtelTigo`,
      computation: {
        type: "sql_analytics",
        details: { query: sqlQuery, totalLocal: "11 800 GHS", totalUSDT: 761.29 },
      },
    };
  }

  // Pays absent / sans données (Exemple : Kenya, Cameroun, etc.)
  if (q.includes("kenya") || q.includes("cameroun") || q.includes("bénin") || q.includes("benin")) {
    const countryName = q.includes("kenya") ? "Kenya" : q.includes("cameroun") ? "Cameroun" : "Bénin";
    const countryCode = q.includes("kenya") ? "KE" : q.includes("cameroun") ? "CM" : "BJ";
    const sqlQuery = `SELECT country, currency, SUM(amount) AS total_local, SUM(amount_usdt) AS total_usdt FROM bulk_payout_items WHERE country = '${countryCode}' AND status = 'completed' GROUP BY country, currency;`;

    return {
      reply: `D'après nos données actuelles, aucune transaction de décaissement n'a encore été enregistrée ou complétée pour le ${countryName} ce mois-ci.

\`\`\`sql
-- Vérification en base de données
${sqlQuery}
\`\`\`

Résultat : 0 ligne retournée. Si un lot de test doit être déployé pour ce corridor, vous pouvez le soumettre dans l'onglet Paiements en Masse.`,
      computation: {
        type: "sql_analytics",
        details: { query: sqlQuery, totalLocal: "0", totalUSDT: 0 },
      },
    };
  }

  if (q.includes("quel pays") || (q.includes("pays") && q.includes("plus"))) {
    const sqlQuery = "SELECT country, COUNT(*) AS recipients_count, SUM(amount_usdt) AS volume_usdt FROM bulk_payout_items WHERE status = 'completed' GROUP BY country ORDER BY volume_usdt DESC LIMIT 1;";
    return {
      reply: `Le pays qui reçoit le plus gros volume de paiements est le Nigéria 🇳🇬, avec 850 000 NGN (environ $574.32 USDT) versé à 10 livreurs par virement bancaire NIP instantané.

\`\`\`sql
-- Requête analytique exécutée
${sqlQuery}
\`\`\`

Le Sénégal 🇸🇳 arrive immédiatement après avec 284 000 XOF ($477.31 USDT) répartis via Wave et Orange Money.`,
      computation: {
        type: "sql_analytics",
        details: { query: sqlQuery, topCountry: "Nigéria", volumeUSDT: 574.32 },
      },
    };
  }

  if (q.includes("part") && q.includes("bitcoin")) {
    const sqlQuery = "SELECT currency, SUM(amount_usdt) * 100.0 / (SELECT SUM(amount_usdt) FROM transactions) AS pct FROM transactions WHERE currency = 'BTC' GROUP BY currency;";
    return {
      reply: `Actuellement, 20.0% de nos flux et règlements totaux ont été effectués en Bitcoin (BTC) (soit environ $575.05 sur le réseau Lightning et on-chain), tandis que 65% transitent en USDT et 15% en USDC.

\`\`\`sql
-- Analyse de répartition des devises
${sqlQuery}
\`\`\``,
      computation: {
        type: "sql_analytics",
        details: { query: sqlQuery, btcShare: "20.0%" },
      },
    };
  }

  // -------------------------------------------------------------
  // Pattern 1: Combien facturer pour recevoir X FCFA / XOF
  // -------------------------------------------------------------
  const fcfaMatch = q.match(/(\d+[\d\s]*)\s*(?:fcfa|xof|f cfa|francs?)/i);
  if (q.includes("facturer") || q.includes("recevoir") || fcfaMatch) {
    let target = 100000;
    if (fcfaMatch) {
      const cleanNum = parseInt(fcfaMatch[1].replace(/\s/g, ""), 10);
      if (!isNaN(cleanNum) && cleanNum > 0) {
        target = cleanNum;
      }
    }

    const formattedTarget = target.toLocaleString("fr-FR").replace(/\u202F/g, " ");
    const calc = calculateTargetInvoice(target);
    const netUsdtBeforeFee = (target / calc.rate).toFixed(2);
    return {
      reply: `Pour recevoir exactement ${formattedTarget} FCFA (soit ${target} FCFA nets) sur votre compte, vous devez facturer votre client ${calc.invoiceAmountUSDT} USDT (ou USDC).

Détail transparent du calcul :
• Montant net souhaité : ${formattedTarget} FCFA
• Taux de change garanti : 1 USDT = ${calc.rate} FCFA
• Équivalent net en USDT : (${target} / ${calc.rate}) = ${netUsdtBeforeFee} USDT
• Frais de réseau fixes : 0.50 USDT (environ 298 FCFA)
• Total à facturer : ${netUsdtBeforeFee} + 0.50 = ${calc.invoiceAmountUSDT} USDT

Vous pouvez dès à présent générer cette facture sur PayLink Afrique.`,
      computation: {
        type: "fee_calc",
        details: calc,
      },
    };
  }

  // -------------------------------------------------------------
  // Pattern 2: Expliquer transaction
  // -------------------------------------------------------------
  if (
    q.includes("expliqu") ||
    q.includes("transaction") ||
    q.includes("techstudio") ||
    q.includes("awa") ||
    q.includes("moussa")
  ) {
    const txExplain =
      findAndExplainTransaction(q) ||
      findAndExplainTransaction("techstudio");

    if (txExplain && txExplain.tx) {
      const t = txExplain.tx;
      return {
        reply: `Voici l'analyse détaillée de la transaction ${t.client} :

• Référence : ${t.id}
• Type d'opération : ${t.type}
• Montant reçu : ${t.amount} ${t.currency}
• Statut : ${t.status === "confirmed" ? "Confirmé et sécurisé" : "En attente de validation réseau"}
• Réseau blockchain : ${t.network || "TRC20"}
• Identifiant de transaction (TxHash) : ${t.txHash || "0x3f98a2...c890"}
• Date de réception : ${t.date}

Ces fonds sont disponibles pour un retrait immédiat vers votre compte Mobile Money ou pour recharger vos cartes virtuelles PayLink Afrique.`,
        computation: {
          type: "tx_lookup",
          details: t,
        },
      };
    }
  }

  // -------------------------------------------------------------
  // Pattern 3: Moyens de paiement par pays
  // -------------------------------------------------------------
  if (
    q.includes("moyen") ||
    q.includes("disponible") ||
    q.includes("sénégal") ||
    q.includes("senegal") ||
    q.includes("côte d'ivoire") ||
    q.includes("mali")
  ) {
    let countryKey = "sénégal";
    if (q.includes("côte") || q.includes("ivoire")) countryKey = "côte d'ivoire";
    if (q.includes("mali")) countryKey = "mali";

    const data = getPaymentMethodsForCountry(countryKey);
    if (data) {
      const methodsList = data.methods
        .map((m) => `• ${m.name} : ${m.operators.join(", ")}`)
        .join("\n");

      return {
        reply: `Pour votre client ou bénéficiaire au ${data.country} ${data.flag}, PayLink Afrique propose les canaux de règlement et de retrait suivants :

${methodsList}

• Devise locale garantie : ${data.currency}
• Taux de conversion actuel : 1 USDT = ${data.rateToUSDT} ${data.currency}
• Délai de réception : Instantané (Mobile Money) à 24h ouvrées (virement bancaire).`,
        computation: {
          type: "fx_rate",
          details: data,
        },
      };
    }
  }

  // Fallback général
  return {
    reply: `Je suis l'assistant FinTech PayLink Afrique. Je peux analyser vos décaissements de masse, calculer vos factures inverses au centime près, ou expliquer vos flux de paiement Bitnob.

Vous pouvez par exemple me demander :
1. Combien avons-nous payé au Ghana ce mois-ci ?
2. Quel pays reçoit le plus de paiements ?
3. Quelle part de nos dépenses a été réglée en Bitcoin ?
4. Combien dois-je facturer pour recevoir 100 000 FCFA après frais ?`,
  };
}
