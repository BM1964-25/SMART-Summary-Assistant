const LICENSE_STORAGE_KEY = "smart-summary-license-key";
const LICENSE_SESSION_KEY = "smart-summary-license-active";
const DEFAULT_LICENSE_ENDPOINT = "/api/license/verify";

export function loadStoredLicense() {
  return {
    key: localStorage.getItem(LICENSE_STORAGE_KEY) || "",
    active: sessionStorage.getItem(LICENSE_SESSION_KEY) === "true"
  };
}

export function saveLicenseKey(key) {
  localStorage.setItem(LICENSE_STORAGE_KEY, key);
}

export function clearLicenseSession() {
  sessionStorage.removeItem(LICENSE_SESSION_KEY);
}

export function setLicenseSessionActive() {
  sessionStorage.setItem(LICENSE_SESSION_KEY, "true");
}

export async function verifyLicenseKey(key, endpoint = DEFAULT_LICENSE_ENDPOINT) {
  const normalizedKey = normalizeLicenseKey(key);

  if (!isPlausibleLicenseKey(normalizedKey)) {
    throw createLicenseError("Der Lizenzschlüssel muss im Format SMART-XXXX-XXXX-XXXX vorliegen.");
  }

  if (location.protocol === "file:") {
    return verifyOfflineDemoLicense(normalizedKey);
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseKey: normalizedKey, product: "smart-summary-assistant" })
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload.valid !== true) {
      throw createLicenseError(payload.message || "Lizenz konnte nicht bestätigt werden.");
    }

    return {
      valid: true,
      mode: "api",
      licenseKey: normalizedKey,
      plan: payload.plan || "Standard"
    };
  } catch (error) {
    if (error.code === "LICENSE_INVALID") throw error;
    throw createLicenseError("Lizenz-API nicht erreichbar. Bitte später erneut prüfen.");
  }
}

export function normalizeLicenseKey(key) {
  return key.trim().toUpperCase();
}

export function isPlausibleLicenseKey(key) {
  return /^SMART-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key);
}

function verifyOfflineDemoLicense(key) {
  if (key === "SMART-DEMO-2026-LOCAL") {
    return {
      valid: true,
      mode: "local-demo",
      licenseKey: key,
      plan: "Demo"
    };
  }

  throw createLicenseError("Lizenz lokal nicht gültig. Für produktive Verkäufe wird die Lizenz über die Lizenz-API geprüft.");
}

function createLicenseError(message) {
  const error = new Error(message);
  error.code = "LICENSE_INVALID";
  return error;
}
