# Contrat d'Interface API (Section 4)

Ce document formalise les endpoints de l'ERP de Paiements, les types attendus et les reponses standardisees pour le travail conjoint Backend (P1), IA (P3) et Frontend (P4/P5).

---

## Conventions Generales
- **Format d'echange :** JSON avec cles en `camelCase` pour les requetes et reponses client.
- **Gestion des erreurs :** Reponse systematique avec `{ "error": "Description claire de l'erreur" }`.
- **Status HTTP :**
  - `200 OK` : Succes.
  - `400 Bad Request` : Donnees de formulaire ou requete invalides.
  - `404 Not Found` : Facture ou ressource introuvable.
  - `500 Internal Error` : Erreur serveur.

---

## 1. Endpoints Factures & Lightning (P1 Backend)

### POST `/api/pay/create-invoice`
Cree une facture Lightning via l'API Bitnob v2, genere un QR code BOLT11 et enregistre la facture en base de donnees.
- **Corps :**
  ```json
  {
    "satoshis": 1500,
    "description": "Paiement commande #104",
    "customerName": "Aminata Diallo"
  }
  ```
- **Reponse (200) :**
  ```json
  {
    "id": "inv_bitnob_id_123",
    "reference": "inv_1713374829_a1b2",
    "paymentRequest": "lntb15u1p...",
    "amountSat": 1500,
    "status": "pending",
    "expiresAt": "2026-10-17T20:30:00Z",
    "qrCodeUrl": "data:image/png;base64,iVBORw0KGgo..."
  }
  ```

### GET `/api/pay/status/{id}`
Interroge l'etat actuel d'une facture (polling frontend).
- **Reponse (200) :**
  ```json
  {
    "id": "inv_bitnob_id_123",
    "status": "paid",
    "paid": true,
    "amountSat": 1500,
    "demo": false
  }
  ```

### POST `/api/pay/demo-pay/{id}`
Simule le reglement immediat d'une facture sans transaction reelle (disponible uniquement si `DEMO_MODE=true`).
- **Reponse (200) :**
  ```json
  {
    "id": "inv_bitnob_id_123",
    "status": "paid",
    "paid": true,
    "demo": true,
    "amountSat": 1500
  }
  ```

### POST `/api/settle/{id}`
Declenche la conversion BTC -> USDT et le payout vers Mobile Money (Wave ou Orange Money).
- **Corps :**
  ```json
  {
    "xofAmount": 10000,
    "beneficiary": "+221771234567"
  }
  ```
- **Reponse (200) :**
  ```json
  {
    "ok": true,
    "timeline": [
      { "step": "trade", "status": "simulated_success" },
      { "step": "payout", "status": "completed", "reference": "payout_ref_456" }
    ]
  }
  ```

### POST `/webhooks/bitnob`
Route de notification asynchrone appelee par Bitnob.
- **En-tetes :** `x-bitnob-signature`, `x-bitnob-event-id`
- **Corps :** Corps brut Bitnob (FastAPI lit `await request.body()`).
- **Reponse :** `200 OK`

---

## 2. Endpoints ERP & KPIs (P2 Base de donnees)

### GET `/api/erp/kpis`
Renvoie les indicateurs financiers agreges issus des vues SQL.
- **Reponse (200) :**
  ```json
  {
    "todayRevenueXof": 125000,
    "todayInvoicesCount": 14,
    "paidInvoicesCount": 12,
    "pendingInvoicesCount": 2,
    "totalSatsCollected": 450000,
    "settledXofTotal": 95000
  }
  ```

### GET `/api/erp/invoices`
Renvoie la liste des factures recentes enregistrees dans la base de donnees.
- **Parametres :** `?limit=20&status=paid` (optionnels)
- **Reponse (200) :**
  ```json
  [
    {
      "id": "inv_123",
      "reference": "inv_1713374829_a1b2",
      "amountSat": 1500,
      "amountXof": 7500,
      "status": "paid",
      "description": "Vente POS Comptoir",
      "customerName": "Client Comptoir",
      "createdAt": "2026-10-17T18:30:00Z"
    }
  ]
  ```

---

## 3. Endpoints Assistant IA (P3)

### POST `/api/ai/query`
Permet de poser des questions en langage naturel a propos des finances et de l'activite de l'ERP.
- **Corps :**
  ```json
  {
    "question": "Quel est le total des ventes aujourd'hui et combien de factures sont payees ?"
  }
  ```
- **Reponse (200) :**
  ```json
  {
    "answer": "Aujourd'hui, 12 factures ont ete reglees pour un chiffre d'affaires total de 125 000 XOF (so Empress de 450 000 satoshis).",
    "sql": "SELECT today_revenue_xof, paid_invoices_count FROM v_kpis;",
    "data": [
      { "today_revenue_xof": 125000, "paid_invoices_count": 12 }
    ]
  }
  ```
- **Securite (`sql_guard.py`) :** Seules les requetes `SELECT` sur les vues et tables autorisees sont executees. Tout mot-cle destructeur (`DROP`, `DELETE`, `UPDATE`, `INSERT`, `ALTER`) renvoie une erreur 400.
