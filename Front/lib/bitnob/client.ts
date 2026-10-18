import crypto from "crypto";

export interface BitnobConfig {
  baseUrl?: string;
  clientId?: string;
  clientSecret?: string;
  secretKey?: string; // Legacy v1 fallback
  isProduction?: boolean;
  webhookSecret?: string;
}

export interface BulkTransferItem {
  row_index: number;
  chain?: string;
  currency: string;
  address?: string;
  account_number?: string;
  phone_number?: string;
  country?: string;
  operator?: string;
  amount: string | number; // in base units
  description?: string;
  recipient_name?: string;
}

export interface CreateBatchDraftPayload {
  description: string;
  items: BulkTransferItem[];
}

export interface CreateCustomerPayload {
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  countryCode?: string; // e.g. "SN", "NG", "GH", "CI"
  customerType?: "individual" | "business";
  reference?: string;
}

export interface CustomerKycPayload {
  idType: "national_id" | "passport" | "drivers_license" | "voters_card";
  idNumber: string;
  dateOfBirth: string; // YYYY-MM-DD
  line1: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string; // e.g. "SN", "NG", "GH", "CI"
}

export interface BitnobCustomerRecord {
  id: string;
  companyId?: string;
  customerType: "individual" | "business";
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  countryCode?: string;
  isActive: boolean;
  kycStatus?: "unverified" | "pending" | "approved" | "rejected";
  createdAt: string;
  updatedAt?: string;
}

export interface BitnobCustomerResult {
  isDemo: boolean;
  success: boolean;
  message?: string;
  customer?: BitnobCustomerRecord;
  error?: string;
}

export class BitnobClient {
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private secretKey: string;
  private webhookSecret: string;

  constructor(config?: BitnobConfig) {
    this.baseUrl =
      config?.baseUrl ||
      (config?.isProduction
        ? "https://api.bitnob.com"
        : "https://sandboxapi.bitnob.co");
    this.clientId = config?.clientId || process.env.BITNOB_CLIENT_ID || "";
    this.clientSecret = config?.clientSecret || process.env.BITNOB_CLIENT_SECRET || "";
    this.secretKey = config?.secretKey || process.env.BITNOB_SECRET_KEY || "";
    this.webhookSecret = config?.webhookSecret || process.env.BITNOB_WEBHOOK_SECRET || "";
  }

  public isConfigured(): boolean {
    return Boolean(
      (this.clientId && this.clientSecret) ||
      (this.secretKey && this.secretKey.startsWith("sk_"))
    );
  }

  /**
   * Generates Bitnob API v2 HMAC SHA256 Authentication Headers
   * Formula: HmacSHA256(clientId:timestamp:nonce:compactBody, clientSecret)
   */
  private generateV2Headers(body?: any): Record<string, string> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString("hex");
    const payload = body ? JSON.stringify(body) : "";

    const stringToSign = `${this.clientId}:${timestamp}:${nonce}:${payload}`;
    const signature = crypto
      .createHmac("sha256", this.clientSecret)
      .update(stringToSign)
      .digest("hex");

    return {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Auth-Client": this.clientId,
      "X-Auth-Timestamp": timestamp,
      "X-Auth-Nonce": nonce,
      "X-Auth-Signature": signature,
    };
  }

  /**
   * Validates inbound Webhook HMAC signature
   */
  public verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.webhookSecret) {
      console.warn("[Bitnob] BITNOB_WEBHOOK_SECRET non configuré.");
      return false;
    }
    // Check both SHA512 (v1) and SHA256 (v2)
    const hash512 = crypto
      .createHmac("sha512", this.webhookSecret)
      .update(payload)
      .digest("hex");
    const hash256 = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(payload)
      .digest("hex");

    return signature === hash512 || signature === hash256;
  }

  /**
   * Bulk Transfers — Create Draft Batch
   * Endpoint: POST /api/bulk-transfers
   */
  public async createDraftBatch(payload: CreateBatchDraftPayload) {
    if (!this.isConfigured()) {
      return {
        isDemo: true,
        success: true,
        data: {
          batch: {
            id: `batch-${Date.now()}`,
            description: payload.description,
            status: "draft",
            total_items: payload.items.length,
            created_at: new Date().toISOString(),
          },
        },
      };
    }

    try {
      const headers = this.clientId
        ? this.generateV2Headers(payload)
        : {
            Authorization: `Bearer ${this.secretKey}`,
            "Content-Type": "application/json",
          };

      const res = await fetch(`${this.baseUrl}/api/bulk-transfers`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      return { isDemo: false, success: res.ok, data };
    } catch (err: any) {
      return { isDemo: false, success: false, error: err?.message };
    }
  }

  /**
   * Bulk Transfers — Confirm and Execute Batch
   * Endpoint: POST /api/bulk-transfers/:batchId/confirm
   */
  public async confirmBatch(batchId: string) {
    if (!this.isConfigured()) {
      return {
        isDemo: true,
        success: true,
        message: "Lot confirmé et en cours d'exécution (Sandbox)",
        batchId,
      };
    }

    try {
      const headers = this.clientId
        ? this.generateV2Headers({})
        : {
            Authorization: `Bearer ${this.secretKey}`,
            "Content-Type": "application/json",
          };

      const res = await fetch(`${this.baseUrl}/api/bulk-transfers/${batchId}/confirm`, {
        method: "POST",
        headers,
      });

      const data = await res.json();
      return { isDemo: false, success: res.ok, data };
    } catch (err: any) {
      return { isDemo: false, success: false, error: err?.message };
    }
  }

  /**
   * Bulk Transfers — Retry Failed Items
   * Endpoint: POST /api/bulk-transfers/:batchId/retry
   */
  public async retryBatchFailedItems(batchId: string) {
    if (!this.isConfigured()) {
      return {
        isDemo: true,
        success: true,
        message: "Lignes échouées relancées avec succès.",
      };
    }

    try {
      const headers = this.clientId
        ? this.generateV2Headers({})
        : {
            Authorization: `Bearer ${this.secretKey}`,
            "Content-Type": "application/json",
          };

      const res = await fetch(`${this.baseUrl}/api/bulk-transfers/${batchId}/retry`, {
        method: "POST",
        headers,
      });

      const data = await res.json();
      return { isDemo: false, success: res.ok, data };
    } catch (err: any) {
      return { isDemo: false, success: false, error: err?.message };
    }
  }

  /**
   * Lightning Invoices — Create invoice
   * Endpoint: POST /api/lightning/invoices
   */
  public async createLightningInvoice(amountSat: number, description: string) {
    if (!this.isConfigured()) {
      return {
        isDemo: true,
        success: true,
        paymentRequest: `lnbc${amountSat}0n1p...paylink`,
        reference: `ln-${Date.now()}`,
      };
    }

    try {
      const body = { amount: amountSat, description };
      const headers = this.clientId
        ? this.generateV2Headers(body)
        : {
            Authorization: `Bearer ${this.secretKey}`,
            "Content-Type": "application/json",
          };

      const res = await fetch(`${this.baseUrl}/api/lightning/invoices`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      const data = await res.json();
      return { isDemo: false, success: res.ok, data };
    } catch (err: any) {
      return { isDemo: false, success: false, error: err?.message };
    }
  }

  /**
   * Hosted Crypto Checkout
   */
  public async createCheckout(payload: {
    amount: number;
    currency: string;
    customerEmail: string;
    description: string;
    reference: string;
    callbackUrl?: string;
    successUrl?: string;
  }) {
    if (!this.isConfigured()) {
      return {
        isDemo: true,
        success: true,
        checkoutUrl: `https://paylink.africa/pay/${payload.reference}`,
        reference: payload.reference,
      };
    }

    try {
      const headers = this.clientId
        ? this.generateV2Headers(payload)
        : {
            Authorization: `Bearer ${this.secretKey}`,
            "Content-Type": "application/json",
          };

      const res = await fetch(`${this.baseUrl}/api/checkout`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      return { isDemo: false, success: res.ok, data };
    } catch (err: any) {
      return { isDemo: false, success: false, error: err?.message };
    }
  }

  /**
   * Single Mobile Money / Bank payout
   */
  public async sendPayout(payload: {
    amount: number;
    currency: string;
    country: string;
    beneficiaryName: string;
    accountNumberOrPhone: string;
    operator: string;
    reference: string;
  }) {
    if (!this.isConfigured()) {
      return {
        isDemo: true,
        success: true,
        status: "processing",
        reference: payload.reference,
      };
    }

    try {
      const headers = this.clientId
        ? this.generateV2Headers(payload)
        : {
            Authorization: `Bearer ${this.secretKey}`,
            "Content-Type": "application/json",
          };

      const res = await fetch(`${this.baseUrl}/api/payouts`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      return { isDemo: false, success: res.ok, data };
    } catch (err: any) {
      return { isDemo: false, success: false, error: err?.message };
    }
  }

  /**
   * Customers — Create Customer Profile
   * Endpoint: POST /api/customers
   * Checks for existing profile first to guarantee idempotency and avoid duplicates.
   */
  public async createCustomer(payload: CreateCustomerPayload): Promise<BitnobCustomerResult> {
    const emailNorm = payload.email.trim().toLowerCase();

    // 1. Anti-doublon check: see if customer already exists on Bitnob
    const existing = await this.getCustomerByEmail(emailNorm);
    if (existing) {
      return {
        isDemo: !this.isConfigured(),
        success: true,
        message: "Profil client Bitnob existant synchronisé sans duplication.",
        customer: existing,
      };
    }

    // 2. Fallback to realistic sandbox / demo mode if API keys not configured
    if (!this.isConfigured()) {
      const demoId = `cust_bitnob_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
      return {
        isDemo: true,
        success: true,
        message: "Profil client Bitnob créé avec succès (Sandbox)",
        customer: {
          id: demoId,
          customerType: payload.customerType || "individual",
          email: emailNorm,
          firstName: payload.firstName.trim(),
          lastName: payload.lastName.trim(),
          phoneNumber: payload.phoneNumber.trim(),
          countryCode: payload.countryCode || "SN",
          isActive: true,
          kycStatus: "unverified",
          createdAt: new Date().toISOString(),
        },
      };
    }

    // 3. Official Bitnob API v2 / v1 call
    try {
      const bitnobBody = {
        email: emailNorm,
        first_name: payload.firstName.trim(),
        last_name: payload.lastName.trim(),
        phone_number: payload.phoneNumber.trim(),
        country_code: payload.countryCode || "SN",
        customer_type: payload.customerType || "individual",
        reference: payload.reference || `paylink_ref_${Date.now()}`,
      };

      const headers = this.clientId
        ? this.generateV2Headers(bitnobBody)
        : {
            Authorization: `Bearer ${this.secretKey}`,
            "Content-Type": "application/json",
          };

      const res = await fetch(`${this.baseUrl}/api/customers`, {
        method: "POST",
        headers,
        body: JSON.stringify(bitnobBody),
      });

      const resData = await res.json();

      if (res.ok && resData.data) {
        const d = resData.data;
        return {
          isDemo: false,
          success: true,
          message: resData.message || "Profil client Bitnob créé avec succès.",
          customer: {
            id: d.id,
            companyId: d.company_id,
            customerType: d.customer_type || "individual",
            email: d.email,
            firstName: d.first_name,
            lastName: d.last_name,
            phoneNumber: d.phone_number,
            countryCode: payload.countryCode || "SN",
            isActive: d.is_active ?? true,
            kycStatus: d.id_number ? "approved" : "unverified",
            createdAt: d.created_at || new Date().toISOString(),
          },
        };
      }

      return {
        isDemo: false,
        success: false,
        error: resData.message || resData.detail || "Échec de création du client sur Bitnob",
      };
    } catch (err: any) {
      return {
        isDemo: false,
        success: false,
        error: err?.message || "Erreur réseau lors de la communication avec l'API Bitnob",
      };
    }
  }

  /**
   * Customers — Find Customer by Email
   * Endpoint: GET /api/customers?email=...
   */
  public async getCustomerByEmail(email: string): Promise<BitnobCustomerRecord | null> {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      const url = `${this.baseUrl}/api/customers?email=${encodeURIComponent(email.trim().toLowerCase())}`;
      const headers = this.clientId
        ? this.generateV2Headers()
        : {
            Authorization: `Bearer ${this.secretKey}`,
            "Content-Type": "application/json",
          };

      const res = await fetch(url, { method: "GET", headers });
      if (!res.ok) return null;

      const json = await res.json();
      const list = json?.data?.customers || [];
      const match = list.find(
        (c: any) => c.email?.toLowerCase() === email.trim().toLowerCase()
      );

      if (!match) return null;

      return {
        id: match.id,
        companyId: match.company_id,
        customerType: match.customer_type || "individual",
        email: match.email,
        firstName: match.first_name,
        lastName: match.last_name,
        phoneNumber: match.phone_number,
        isActive: match.is_active ?? true,
        kycStatus: match.id_number ? "approved" : "unverified",
        createdAt: match.created_at || new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  /**
   * Customers — Get Customer by ID
   * Endpoint: GET /api/customers/:customerId
   */
  public async getCustomer(customerId: string): Promise<BitnobCustomerRecord | null> {
    if (!this.isConfigured()) {
      return {
        id: customerId,
        customerType: "individual",
        email: "client@paylink.africa",
        firstName: "Client",
        lastName: "PayLink",
        phoneNumber: "+221770000000",
        isActive: true,
        kycStatus: "unverified",
        createdAt: new Date().toISOString(),
      };
    }

    try {
      const url = `${this.baseUrl}/api/customers/${customerId}`;
      const headers = this.clientId
        ? this.generateV2Headers()
        : {
            Authorization: `Bearer ${this.secretKey}`,
            "Content-Type": "application/json",
          };

      const res = await fetch(url, { method: "GET", headers });
      if (!res.ok) return null;

      const json = await res.json();
      const d = json?.data;
      if (!d) return null;

      return {
        id: d.id,
        companyId: d.company_id,
        customerType: d.customer_type || "individual",
        email: d.email,
        firstName: d.first_name,
        lastName: d.last_name,
        phoneNumber: d.phone_number,
        isActive: d.is_active ?? true,
        kycStatus: d.id_number ? "approved" : "unverified",
        createdAt: d.created_at || new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  /**
   * Customers / Cards — Submit Customer KYC
   * Required for Virtual Card issuance.
   * Endpoint: PUT /api/customers/:customerId
   */
  public async updateCustomerKyc(
    customerId: string,
    kyc: CustomerKycPayload
  ): Promise<{ success: boolean; isDemo: boolean; kycStatus: string; error?: string }> {
    if (!this.isConfigured()) {
      return {
        isDemo: true,
        success: true,
        kycStatus: "approved",
      };
    }

    try {
      const body = {
        id_type: kyc.idType,
        id_number: kyc.idNumber,
        date_of_birth: kyc.dateOfBirth,
        line1: kyc.line1,
        city: kyc.city,
        state: kyc.state || "Dakar",
        postal_code: kyc.postalCode || "12000",
        country: kyc.country || "SEN",
      };

      const headers = this.clientId
        ? this.generateV2Headers(body)
        : {
            Authorization: `Bearer ${this.secretKey}`,
            "Content-Type": "application/json",
          };

      const res = await fetch(`${this.baseUrl}/api/customers/${customerId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (res.ok) {
        return {
          isDemo: false,
          success: true,
          kycStatus: "approved",
        };
      }

      return {
        isDemo: false,
        success: false,
        kycStatus: "pending",
        error: data.message || "Erreur de validation KYC Bitnob",
      };
    } catch (err: any) {
      return {
        isDemo: false,
        success: false,
        kycStatus: "unverified",
        error: err?.message || "Erreur de connexion Bitnob KYC",
      };
    }
  }
}

export const bitnobServerClient = new BitnobClient();

