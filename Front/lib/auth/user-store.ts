import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";

export type BitnobSyncStatus = "synced" | "pending_retry" | "failed";
export type KycStatus = "unverified" | "pending_review" | "approved";

export interface SunuPayUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  countryCode: string;
  createdAt: string;
  bitnobCustomerId?: string;
  bitnobSyncStatus: BitnobSyncStatus;
  bitnobSyncError?: string;
  bitnobReference: string;
  bitnobSyncedAt?: string;
  kycStatus: KycStatus;
  kycData?: {
    idType?: string;
    idNumber?: string;
    dateOfBirth?: string;
    line1?: string;
    city?: string;
    country?: string;
  };
}

// Global server memory store (persists across hot-reloads and requests within server lifecycle)
const globalUsers = (globalThis as any).__sunupay_users_store || new Map<string, SunuPayUser>();
(globalThis as any).__sunupay_users_store = globalUsers;

// Pre-seed with the demo mock user if empty
if (globalUsers.size === 0) {
  const defaultUser: SunuPayUser = {
    id: "usr_sunupay_amadou_01",
    firstName: "Amadou",
    lastName: "Dione",
    email: "amadou@sunupay.com",
    phone: "+221771234567",
    countryCode: "SN",
    createdAt: "2026-01-15T10:00:00.000Z",
    bitnobCustomerId: "019edc65-bc3f-7bc4-980b-e328a940ef5d",
    bitnobSyncStatus: "synced",
    bitnobReference: "ref_seed_amadou",
    bitnobSyncedAt: "2026-01-15T10:01:00.000Z",
    kycStatus: "approved",
  };
  globalUsers.set(defaultUser.email.toLowerCase(), defaultUser);
}

/**
 * Find user by normalized email address
 */
export async function findUserByEmail(email: string): Promise<SunuPayUser | null> {
  const normEmail = email.trim().toLowerCase();
  if (globalUsers.has(normEmail)) {
    return globalUsers.get(normEmail)!;
  }
  return null;
}

/**
 * Find user by SunuPay ID
 */
export async function findUserById(id: string): Promise<SunuPayUser | null> {
  for (const user of globalUsers.values()) {
    if (user.id === id) return user;
  }
  return null;
}

/**
 * Creates a SunuPay authentication user
 * Safely writes to Supabase if configured, while preserving sandbox safety and duplicate detection.
 */
export async function createSunuPayUser(params: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  countryCode?: string;
  password?: string;
}): Promise<{ user: SunuPayUser; alreadyExisted: boolean }> {
  const normEmail = params.email.trim().toLowerCase();

  // 1. Check for duplicate registration
  const existing = await findUserByEmail(normEmail);
  if (existing) {
    return { user: existing, alreadyExisted: true };
  }

  // 2. Derive unique ID and reference
  const userId = `usr_sp_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  const reference = `sunupay_reg_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;

  // 3. Supabase integration (if configured)
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.auth.signUp({
        email: normEmail,
        password: params.password || "TempPass123!SunuPay",
        options: {
          data: {
            first_name: params.firstName.trim(),
            last_name: params.lastName.trim(),
            phone: params.phone.trim(),
            bitnob_sync_status: "pending_retry",
            bitnob_reference: reference,
          },
        },
      });
    } catch (err) {
      console.warn("[Supabase Auth] Fallback local user store used:", err);
    }
  }

  // 4. Construct user record
  const newUser: SunuPayUser = {
    id: userId,
    firstName: params.firstName.trim(),
    lastName: params.lastName.trim(),
    email: normEmail,
    phone: params.phone.trim(),
    countryCode: params.countryCode || "SN",
    createdAt: new Date().toISOString(),
    bitnobSyncStatus: "pending_retry",
    bitnobReference: reference,
    kycStatus: "unverified",
  };

  globalUsers.set(normEmail, newUser);
  return { user: newUser, alreadyExisted: false };
}

/**
 * Updates Bitnob synchronization state for an existing SunuPay user
 */
export async function updateUserBitnobSync(
  userId: string,
  syncData: {
    bitnobCustomerId?: string;
    bitnobSyncStatus: BitnobSyncStatus;
    bitnobSyncError?: string;
  }
): Promise<SunuPayUser | null> {
  const user = await findUserById(userId);
  if (!user) return null;

  user.bitnobSyncStatus = syncData.bitnobSyncStatus;
  if (syncData.bitnobCustomerId) {
    user.bitnobCustomerId = syncData.bitnobCustomerId;
    user.bitnobSyncedAt = new Date().toISOString();
    user.bitnobSyncError = undefined;
  }
  if (syncData.bitnobSyncError) {
    user.bitnobSyncError = syncData.bitnobSyncError;
  }

  globalUsers.set(user.email.toLowerCase(), user);

  // Sync to Supabase user_metadata if configured
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.auth.updateUser({
        data: {
          bitnob_customer_id: user.bitnobCustomerId,
          bitnob_sync_status: user.bitnobSyncStatus,
          bitnob_synced_at: user.bitnobSyncedAt,
          bitnob_sync_error: user.bitnobSyncError,
        },
      });
    } catch {
      // non-blocking
    }
  }

  return user;
}

/**
 * Updates KYC status for Virtual Card compliance
 */
export async function updateUserKycStatus(
  userId: string,
  kycStatus: KycStatus,
  kycData?: any
): Promise<SunuPayUser | null> {
  const user = await findUserById(userId);
  if (!user) return null;

  user.kycStatus = kycStatus;
  if (kycData) {
    user.kycData = kycData;
  }

  globalUsers.set(user.email.toLowerCase(), user);
  return user;
}

export function getAllUsers(): SunuPayUser[] {
  return Array.from(globalUsers.values());
}
