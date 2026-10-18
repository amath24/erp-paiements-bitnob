// ===================================================================
// SUITE DE TESTS : INSCRIPTION SUNUPAY & SYNCHRONISATION BITNOB
// ===================================================================

const BASE_URL = process.env.TEST_URL || "http://localhost:3000";

async function runTests() {
  console.log("===================================================================");
  console.log("🧪 SUITE DE TESTS OFFICIELLE : INSCRIPTION SUNUPAY & PROFIL BITNOB");
  console.log("===================================================================");

  let passed = 0;
  let failed = 0;

  // Helper assertion
  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ ${message}`);
      passed++;
    } else {
      console.error(`  ❌ ÉCHEC: ${message}`);
      failed++;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 1 : Validation des champs obligatoires & mots de passe
  // ─────────────────────────────────────────────────────────────
  console.log("\n▶ [TEST_01_VALIDATION] : Rejet des formulaires incomplets ou invalides");
  try {
    // 1.a Champ manquant
    const resEmpty = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "",
        lastName: "Dione",
        email: "amadou@test.sn",
        phone: "+221771234567",
        password: "Password123!",
        confirmPassword: "Password123!",
      }),
    });
    const dataEmpty = await resEmpty.json();
    assert(resEmpty.status === 400 && dataEmpty.error.includes("prénom"), "Rejet si prénom absent (400)");

    // 1.b Mot de passe court (< 8 car)
    const resShort = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "Amadou",
        lastName: "Dione",
        email: "amadou@test.sn",
        phone: "+221771234567",
        password: "123",
        confirmPassword: "123",
      }),
    });
    const dataShort = await resShort.json();
    assert(resShort.status === 400 && dataShort.error.includes("8 caractères"), "Rejet si mot de passe < 8 caractères");

    // 1.c Mots de passe non concordants
    const resMismatch = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "Amadou",
        lastName: "Dione",
        email: "amadou@test.sn",
        phone: "+221771234567",
        password: "Password123!",
        confirmPassword: "DifferentPassword123!",
      }),
    });
    const dataMismatch = await resMismatch.json();
    assert(resMismatch.status === 400 && dataMismatch.error.includes("correspondent pas"), "Rejet si mot de passe et confirmation diffèrent");

    // 1.d Téléphone sans indicatif international (+)
    const resPhone = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "Amadou",
        lastName: "Dione",
        email: "amadou@test.sn",
        phone: "771234567",
        password: "Password123!",
        confirmPassword: "Password123!",
      }),
    });
    const dataPhone = await resPhone.json();
    assert(resPhone.status === 400 && dataPhone.error.includes("indicatif"), "Rejet si téléphone sans indicatif international (+)");
  } catch (err) {
    console.error("Erreur TEST_01:", err);
    failed++;
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 2 : Inscription réussie + Création automatique Bitnob
  // ─────────────────────────────────────────────────────────────
  console.log("\n▶ [TEST_02_INSCRIPTION_SUCCESS] : Création compte SunuPay + Profil client Bitnob");
  const testEmail = `fatou.${Date.now()}@sunupay-test.com`;
  let createdUserId = null;
  try {
    const resSuccess = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "Fatou",
        lastName: "Sow",
        email: testEmail,
        phone: "+221785551234",
        countryCode: "SN",
        password: "SecuredPassword2026!",
        confirmPassword: "SecuredPassword2026!",
      }),
    });

    const dataSuccess = await resSuccess.json();
    assert(resSuccess.status === 201 && dataSuccess.success === true, "Compte SunuPay créé avec code 201 Created");
    assert(dataSuccess.user && dataSuccess.user.email === testEmail.toLowerCase(), "Utilisateur SunuPay initialisé avec ses données");
    assert(dataSuccess.bitnob && dataSuccess.bitnob.status === "synced", "Profil client Bitnob automatiquement synchronisé");
    assert(dataSuccess.bitnob.customerId && dataSuccess.bitnob.customerId.length > 5, "Identifiant client Bitnob assigné");
    createdUserId = dataSuccess.user.id;
  } catch (err) {
    console.error("Erreur TEST_02:", err);
    failed++;
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 3 : Gestion stricte des doublons (anti-duplication)
  // ─────────────────────────────────────────────────────────────
  console.log("\n▶ [TEST_03_DOUBLONS] : Rejet de la tentative avec un e-mail déjà existant");
  try {
    const resDuplicate = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "Fatou Deuxieme",
        lastName: "Sow",
        email: testEmail, // Même adresse e-mail
        phone: "+221785551234",
        countryCode: "SN",
        password: "AnotherPassword123!",
        confirmPassword: "AnotherPassword123!",
      }),
    });

    const dataDuplicate = await resDuplicate.json();
    assert(resDuplicate.status === 409, "Statut 409 Conflict retourné");
    assert(dataDuplicate.alreadyExists === true, "Signalement explicite alreadyExists=true");
    assert(dataDuplicate.error.includes("existe déjà"), "Message clair invitant à se connecter plutôt que dupliquer");
  } catch (err) {
    console.error("Erreur TEST_03:", err);
    failed++;
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 4 : Idempotence de synchronisation Bitnob (/api/auth/sync-bitnob)
  // ─────────────────────────────────────────────────────────────
  console.log("\n▶ [TEST_04_SYNC_IDEMPOTENCE] : Synchronisation idempotente sans créer de 2e compte");
  try {
    const resSync = await fetch(`${BASE_URL}/api/auth/sync-bitnob`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: createdUserId,
        email: testEmail,
      }),
    });

    const dataSync = await resSync.json();
    assert(resSync.status === 200 && dataSync.success === true, "Appel de synchronisation réussi (200)");
    assert(dataSync.status === "synced", "Maintien de l'état 'synced'");
  } catch (err) {
    console.error("Erreur TEST_04:", err);
    failed++;
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 5 : Vérification d'identité KYC requise pour Cartes (/api/cards/kyc)
  // ─────────────────────────────────────────────────────────────
  console.log("\n▶ [TEST_05_CARDS_KYC_GATE] : Parcours séparé de vérification KYC pour les cartes virtuelles");
  try {
    // 5.a Rejet si numéro de pièce manquant
    const resKycMissing = await fetch(`${BASE_URL}/api/cards/kyc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        idType: "national_id",
        idNumber: "",
        dateOfBirth: "1994-04-12",
        line1: "Rue 10",
        city: "Dakar",
        country: "SEN",
      }),
    });
    assert(resKycMissing.status === 400, "Rejet KYC si numéro de pièce manquant (400)");

    // 5.b Soumission KYC complète avec succès
    const resKycSuccess = await fetch(`${BASE_URL}/api/cards/kyc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        idType: "national_id",
        idNumber: "1759199400234",
        dateOfBirth: "1994-04-12",
        line1: "14 Rue des Almadies",
        city: "Dakar",
        country: "SEN",
      }),
    });
    const dataKycSuccess = await resKycSuccess.json();
    assert(resKycSuccess.status === 200 && dataKycSuccess.kycStatus === "approved", "Vérification KYC approuvée par Bitnob");
  } catch (err) {
    console.error("Erreur TEST_05:", err);
    failed++;
  }

  // ─────────────────────────────────────────────────────────────
  // RÉSULTAT FINAL
  // ─────────────────────────────────────────────────────────────
  console.log("\n===================================================================");
  console.log(`📊 BILAN DES TESTS : ${passed} validés, ${failed} échecs.`);
  console.log("===================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
