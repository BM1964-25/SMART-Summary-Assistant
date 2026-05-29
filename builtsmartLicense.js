const CONFIG = {
  appName: "SMART Summary Assistant",
  appKey: "smart_summary_assistant",
  supabaseUrl: "",
  supabaseAnonKey: "",
  checkoutFunctionUrl: "",
  aiFunctionUrl: ""
};

const SESSION_STORAGE_KEY = `${CONFIG.appKey}-builtsmart-session`;
const OWN_API_KEY_PREFIX = `${CONFIG.appKey}-own-api-key`;

export const BUILTSMART_CONFIG = { ...CONFIG };

export function getBuiltSmartConfigStatus() {
  const missing = [];
  if (!CONFIG.supabaseUrl) missing.push("Supabase URL");
  if (!CONFIG.supabaseAnonKey) missing.push("Supabase Anon Key");
  if (!CONFIG.checkoutFunctionUrl) missing.push("Zentrale Checkout Function URL");
  if (!CONFIG.aiFunctionUrl) missing.push("Zentrale AI Function URL");
  return { ok: missing.length === 0, missing };
}

export async function loginWithMagicLink(email) {
  if (!isValidEmail(email)) return { ok: false, reason: "invalid_email" };
  const configStatus = requireSupabaseConfig();
  if (!configStatus.ok) return configStatus;

  const response = await fetch(`${normalizeUrl(CONFIG.supabaseUrl)}/auth/v1/otp`, {
    method: "POST",
    headers: getPublicHeaders(),
    body: JSON.stringify({
      email,
      create_user: true,
      type: "magiclink",
      options: {
        email_redirect_to: getCleanRedirectUrl()
      }
    })
  });

  if (!response.ok) return normalizeError(await readPayload(response), "magic_link_failed");
  return { ok: true, message: "magic_link_sent" };
}

export async function logout() {
  const session = await getStoredSession();

  if (session?.access_token && CONFIG.supabaseUrl && CONFIG.supabaseAnonKey) {
    await fetch(`${normalizeUrl(CONFIG.supabaseUrl)}/auth/v1/logout`, {
      method: "POST",
      headers: getAuthHeaders(session.access_token)
    }).catch(() => null);
  }

  clearStoredSession();
  return { ok: true };
}

export async function getCurrentUser() {
  const redirectSession = readSessionFromRedirect();
  if (redirectSession) storeSession(redirectSession);

  const session = await getStoredSession();
  if (!session?.access_token) return { ok: true, user: null };

  const configStatus = requireSupabaseConfig();
  if (!configStatus.ok) return { ok: true, user: null, warning: configStatus.reason };

  const response = await fetch(`${normalizeUrl(CONFIG.supabaseUrl)}/auth/v1/user`, {
    headers: getAuthHeaders(session.access_token)
  });

  if (!response.ok) {
    clearStoredSession();
    return { ok: true, user: null };
  }

  const payload = await response.json();
  return {
    ok: true,
    user: {
      id: payload.id,
      email: payload.email
    }
  };
}

export async function checkAppAccess(appKey = CONFIG.appKey) {
  return callRpc("check_app_access", { p_app_key: appKey }, (payload) => ({
    ok: true,
    access: Boolean(payload.access),
    ...payload
  }));
}

export async function startTrial(appKey = CONFIG.appKey) {
  return callRpc("start_app_trial", { p_app_key: appKey });
}

export async function redeemLicenseCode(appKey = CONFIG.appKey, code) {
  return callRpc("redeem_license_code", { p_app_key: appKey, p_code: code });
}

export async function createCheckoutSession(appKey = CONFIG.appKey, quantity = 1, planKey = "yearly") {
  const session = await requireAuthenticatedSession();
  if (!session.ok) return session;
  if (!CONFIG.checkoutFunctionUrl) return missingConfig(["Zentrale Checkout Function URL"]);

  const response = await fetch(CONFIG.checkoutFunctionUrl, {
    method: "POST",
    headers: getAuthHeaders(session.accessToken),
    body: JSON.stringify({
      appKey,
      planKey,
      quantity,
      successUrl: withCheckoutState("success"),
      cancelUrl: withCheckoutState("cancel")
    })
  });

  return readContractResponse(response, "checkout_failed");
}

export async function getAiCreditBalance() {
  return callAiFunction({ type: "get_ai_credit_balance" });
}

export async function estimateAiUsage(action, payload) {
  return callAiFunction({
    type: "estimate_ai_usage",
    appKey: CONFIG.appKey,
    action,
    payload
  });
}

export async function runAiAction(action, payload) {
  return callAiFunction({
    type: "run_ai_action",
    appKey: CONFIG.appKey,
    action,
    payload
  });
}

export function saveOwnApiKey(provider, key) {
  const normalizedProvider = normalizeProvider(provider);
  const normalizedKey = String(key || "").trim();
  if (!normalizedKey) return { ok: false, reason: "invalid_api_key" };
  localStorage.setItem(`${OWN_API_KEY_PREFIX}-${normalizedProvider}`, normalizedKey);
  return { ok: true, provider: normalizedProvider };
}

export function removeOwnApiKey(provider) {
  const normalizedProvider = normalizeProvider(provider);
  localStorage.removeItem(`${OWN_API_KEY_PREFIX}-${normalizedProvider}`);
  return { ok: true, provider: normalizedProvider };
}

export function getOwnApiKey(provider) {
  return localStorage.getItem(`${OWN_API_KEY_PREFIX}-${normalizeProvider(provider)}`) || "";
}

export function getOwnApiKeyStatus(provider) {
  return {
    ok: true,
    provider: normalizeProvider(provider),
    active: Boolean(getOwnApiKey(provider))
  };
}

async function callRpc(functionName, params, mapper = (payload) => payload) {
  const session = await requireAuthenticatedSession();
  if (!session.ok) return session;
  const configStatus = requireSupabaseConfig();
  if (!configStatus.ok) return configStatus;

  const response = await fetch(`${normalizeUrl(CONFIG.supabaseUrl)}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: getAuthHeaders(session.accessToken),
    body: JSON.stringify(params)
  });

  const payload = await readContractResponse(response, functionName);
  return payload.ok === false ? payload : mapper(payload);
}

async function callAiFunction(body) {
  const session = await requireAuthenticatedSession();
  if (!session.ok) return session;
  if (!CONFIG.aiFunctionUrl) return missingConfig(["Zentrale AI Function URL"]);

  const response = await fetch(CONFIG.aiFunctionUrl, {
    method: "POST",
    headers: getAuthHeaders(session.accessToken),
    body: JSON.stringify(body)
  });

  return readContractResponse(response, "ai_function_failed");
}

async function requireAuthenticatedSession() {
  const userResult = await getCurrentUser();
  if (!userResult.user) return { ok: false, access: false, reason: "not_authenticated" };
  const session = await getStoredSession();
  return { ok: true, accessToken: session.access_token, user: userResult.user };
}

function requireSupabaseConfig() {
  const missing = [];
  if (!CONFIG.supabaseUrl) missing.push("Supabase URL");
  if (!CONFIG.supabaseAnonKey) missing.push("Supabase Anon Key");
  return missing.length ? missingConfig(missing) : { ok: true };
}

function missingConfig(missing) {
  return {
    ok: false,
    access: false,
    reason: "config_missing",
    missing
  };
}

function getPublicHeaders() {
  return {
    "Content-Type": "application/json",
    apikey: CONFIG.supabaseAnonKey
  };
}

function getAuthHeaders(accessToken) {
  return {
    ...getPublicHeaders(),
    Authorization: `Bearer ${accessToken}`
  };
}

async function readContractResponse(response, fallbackReason) {
  const payload = await readPayload(response);
  if (!response.ok) return normalizeError(payload, fallbackReason);
  return payload && typeof payload === "object" ? payload : { ok: true };
}

async function readPayload(response) {
  return response.json().catch(() => ({}));
}

function normalizeError(payload, fallbackReason) {
  return {
    ok: false,
    access: false,
    reason: payload?.reason || payload?.error || fallbackReason,
    message: payload?.message || payload?.error || "Die zentrale BuiltSmart-Schnittstelle konnte die Anfrage nicht verarbeiten."
  };
}

async function getStoredSession() {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;

  try {
    const session = JSON.parse(raw);
    if (session.expires_at && Number(session.expires_at) * 1000 < Date.now()) {
      clearStoredSession();
      return null;
    }
    return session;
  } catch {
    clearStoredSession();
    return null;
  }
}

function storeSession(session) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

function clearStoredSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

function readSessionFromRedirect() {
  if (!window.location.hash.includes("access_token")) return null;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = params.get("access_token");
  if (!accessToken) return null;

  const session = {
    access_token: accessToken,
    refresh_token: params.get("refresh_token") || "",
    expires_at: params.get("expires_at") || "",
    token_type: params.get("token_type") || "bearer"
  };

  window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
  return session;
}

function getCleanRedirectUrl() {
  return `${window.location.origin}${window.location.pathname}${window.location.search}`;
}

function withCheckoutState(state) {
  const url = new URL(window.location.href);
  url.searchParams.set("checkout", state);
  return url.toString();
}

function normalizeUrl(url) {
  return url.replace(/\/+$/, "");
}

function normalizeProvider(provider) {
  return String(provider || "anthropic").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}
