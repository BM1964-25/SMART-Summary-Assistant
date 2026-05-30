import { requestClaudePdfSummary, requestClaudeSummary, testClaudeConnection } from "./anthropicClient.js";
import { extractTextFromPdf } from "./pdfExtractor.js";
import { extractTextFromDocx } from "./docxExtractor.js";
import {
  BUILTSMART_CONFIG,
  checkAppAccess,
  createCheckoutSession,
  estimateAiUsage,
  getAiCreditBalance,
  getBuiltSmartConfigStatus,
  getCurrentUser,
  getOwnApiKey,
  getOwnApiKeyStatus,
  loginWithMagicLink,
  logout,
  redeemLicenseCode,
  removeOwnApiKey,
  runAiAction,
  saveOwnApiKey,
  startTrial
} from "./builtsmartLicense.js";

const MAX_CHARS = 180000;
const RECOMMENDED_CHARS = 100000;
const STORAGE_KEY = "smart-summary-anthropic-key";
const SESSION_KEY = "smart-summary-session-active";
const HISTORY_KEY = "smart-summary-history";
const PROFILE_KEY = "smart-summary-profiles";
const SETTINGS_KEY = "smart-summary-settings";
const MAX_HISTORY_ITEMS = 20;
const DEFAULT_PROXY_URL = resolveLocalProxyUrl("/api/anthropic/messages");
const DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-20250514";
const DEMO_SOURCE_TEXT = [
  "Projektstatus SMART Kundenportal - Lenkungskreis 20.05.2026",
  "",
  "Ziel des Projekts ist die Einführung eines Self-Service-Portals für Bestandskunden. Das Portal soll Support-Anfragen reduzieren, Vertragsinformationen transparenter machen und einfache Änderungsprozesse ohne manuelle E-Mail-Schleifen ermöglichen.",
  "",
  "Aktueller Stand: Das UX-Konzept ist freigegeben, die technische Basis steht, und der erste Prototyp deckt Login, Vertragsübersicht und Anfrageformular ab. Die Pilotgruppe aus 25 Kunden startet voraussichtlich am 15.06.2026.",
  "",
  "Risiken: Die finale Datenschutzfreigabe steht noch aus. Außerdem ist die Schnittstelle zum CRM stabil, aber die Antwortzeiten liegen in Lasttests teilweise über dem Zielwert von 800 ms. Das Support-Team benötigt noch Schulungsmaterial für neue Eskalationswege.",
  "",
  "Entscheidungsbedarf: Der Lenkungskreis soll entscheiden, ob der Pilot mit reduziertem Funktionsumfang startet oder um zwei Wochen verschoben wird. Empfehlung des Projektteams ist ein Start mit reduziertem Umfang, sofern die Datenschutzfreigabe bis 31.05.2026 vorliegt.",
  "",
  "Nächste Schritte: Datenschutzfreigabe klären, CRM-Performance optimieren, Pilotkommunikation vorbereiten, Support-Schulung abschließen und Go/No-Go-Entscheidung am 03.06.2026 treffen."
].join("\n");
const BUILT_IN_PROFILES = [
  {
    id: "builtin-management",
    name: "Management Briefing",
    builtIn: true,
    settings: {
      template: "Management Briefing",
      audience: "Management",
      language: "Deutsch",
      focus: "Management Summary",
      tone: "Prägnant",
      actionMode: "Entscheidung vorbereiten",
      length: "detailed",
      format: "Executive Summary"
    }
  },
  {
    id: "builtin-risk",
    name: "Risikoanalyse",
    builtIn: true,
    settings: {
      template: "Risikoanalyse",
      audience: "Management",
      language: "Deutsch",
      focus: "Risiken",
      tone: "Kritisch",
      actionMode: "Offene Punkte markieren",
      length: "detailed",
      format: "Tabelle"
    }
  },
  {
    id: "builtin-meeting",
    name: "Meeting-Protokoll",
    builtIn: true,
    settings: {
      template: "Meeting-Protokoll",
      audience: "Fachteam",
      language: "Deutsch",
      focus: "Aufgaben und To-dos",
      tone: "Neutral",
      actionMode: "Nächste Schritte ableiten",
      length: "detailed",
      format: "Stichpunkte"
    }
  },
  {
    id: "builtin-project",
    name: "Projektstatus",
    builtIn: true,
    settings: {
      template: "Projektstatus",
      audience: "Management",
      language: "Deutsch",
      focus: "Management Summary",
      tone: "Prägnant",
      actionMode: "Entscheidung vorbereiten",
      length: "detailed",
      format: "Executive Summary"
    }
  },
  {
    id: "builtin-customer",
    name: "Kundenfassung",
    builtIn: true,
    settings: {
      template: "Standard-Zusammenfassung",
      audience: "Kunde",
      language: "Deutsch",
      focus: "Kernaussagen",
      tone: "Beratend",
      actionMode: "Nur zusammenfassen",
      length: "medium",
      format: "Fließtext"
    }
  },
  {
    id: "builtin-technical",
    name: "Technische Analyse",
    builtIn: true,
    settings: {
      template: "Standard-Zusammenfassung",
      audience: "Technisch",
      language: "Deutsch",
      focus: "Kritische Punkte",
      tone: "Neutral",
      actionMode: "Offene Punkte markieren",
      length: "detailed",
      format: "Stichpunkte"
    }
  }
];

function resolveLocalProxyUrl(path) {
  const isLocalServer = ["127.0.0.1", "localhost"].includes(window.location.hostname);
  return isLocalServer ? `${window.location.origin}${path}` : `http://127.0.0.1:8182${path}`;
}

const apiKeyState = {
  value: "",
  isVisible: false,
  isConnected: false,
  isBusy: false,
  busyAction: ""
};

const builtSmartState = {
  user: null,
  access: null,
  aiBalance: null,
  isBusy: false,
  busyAction: "",
  configStatus: getBuiltSmartConfigStatus()
};

const workflowState = {
  settingsTouched: false
};

const visualPdfState = {
  fileName: "",
  base64: ""
};

let currentSummaryText = "Noch keine Zusammenfassung erstellt.";

const elements = {
  layout: document.querySelector(".layout"),
  viewModeButtons: document.querySelectorAll("[data-view-mode]"),
  sourceText: document.querySelector("#sourceText"),
  clearSourceBtn: document.querySelector("#clearSourceBtn"),
  charCount: document.querySelector("#charCount"),
  textQuality: document.querySelector("#textQuality"),
  tokenEstimate: document.querySelector("#tokenEstimate"),
  paragraphEstimate: document.querySelector("#paragraphEstimate"),
  languageEstimate: document.querySelector("#languageEstimate"),
  structureEstimate: document.querySelector("#structureEstimate"),
  pdfInput: document.querySelector("#pdfInput"),
  dropZone: document.querySelector("#dropZone"),
  fileSelectBtn: document.querySelector("#fileSelectBtn"),
  loadDemoBtn: document.querySelector("#loadDemoBtn"),
  pdfStatus: document.querySelector("#pdfStatus"),
  apiKey: document.querySelector("#apiKey"),
  rememberKey: document.querySelector("#rememberKey"),
  toggleKey: document.querySelector("#toggleKey"),
  clearApiKeyBtn: document.querySelector("#clearApiKeyBtn"),
  apiKeyCard: document.querySelector("#apiKeyCard"),
  apiKeyDetails: document.querySelector("#apiKeyDetails"),
  keyHint: document.querySelector("#keyHint"),
  keyFeedback: document.querySelector("#keyFeedback"),
  connectionBadge: document.querySelector("#connectionBadge"),
  saveKeyBtn: document.querySelector("#saveKeyBtn"),
  connectBtn: document.querySelector("#connectBtn"),
  testConnectionBtn: document.querySelector("#testConnectionBtn"),
  disconnectBtn: document.querySelector("#disconnectBtn"),
  useOwnApiKey: document.querySelector("#useOwnApiKey"),
  builtSmartAccessCard: document.querySelector("#builtSmartAccessCard"),
  loginEmail: document.querySelector("#loginEmail"),
  sendMagicLinkBtn: document.querySelector("#sendMagicLinkBtn"),
  logoutBtn: document.querySelector("#logoutBtn"),
  refreshAccessBtn: document.querySelector("#refreshAccessBtn"),
  startTrialBtn: document.querySelector("#startTrialBtn"),
  checkoutBtn: document.querySelector("#checkoutBtn"),
  aiCreditCheckoutBtn: document.querySelector("#aiCreditCheckoutBtn"),
  refreshAiCreditBtn: document.querySelector("#refreshAiCreditBtn"),
  licenseCode: document.querySelector("#licenseCode"),
  redeemLicenseBtn: document.querySelector("#redeemLicenseBtn"),
  accessBadge: document.querySelector("#accessBadge"),
  aiBalanceStatus: document.querySelector("#aiBalanceStatus"),
  aiModeStatus: document.querySelector("#aiModeStatus"),
  aiCreditFeedback: document.querySelector("#aiCreditFeedback"),
  accessFeedback: document.querySelector("#accessFeedback"),
  exportAppDataBtn: document.querySelector("#exportAppDataBtn"),
  importAppDataBtn: document.querySelector("#importAppDataBtn"),
  importAppDataInput: document.querySelector("#importAppDataInput"),
  backupFeedback: document.querySelector("#backupFeedback"),
  profileSelect: document.querySelector("#profileSelect"),
  applyProfileBtn: document.querySelector("#applyProfileBtn"),
  saveProfileBtn: document.querySelector("#saveProfileBtn"),
  deleteProfileBtn: document.querySelector("#deleteProfileBtn"),
  profileFeedback: document.querySelector("#profileFeedback"),
  templateSelect: document.querySelector("#templateSelect"),
  lengthSelect: document.querySelector("#lengthSelect"),
  languageSelect: document.querySelector("#languageSelect"),
  focusSelect: document.querySelector("#focusSelect"),
  formatSelect: document.querySelector("#formatSelect"),
  audienceSelect: document.querySelector("#audienceSelect"),
  toneSelect: document.querySelector("#toneSelect"),
  actionModeSelect: document.querySelector("#actionModeSelect"),
  summarizeBtn: document.querySelector("#summarizeBtn"),
  summaryOutput: document.querySelector("#summaryOutput"),
  copyBtn: document.querySelector("#copyBtn"),
  copyResultIconBtn: document.querySelector("#copyResultIconBtn"),
  exportMdBtn: document.querySelector("#exportMdBtn"),
  exportTxtBtn: document.querySelector("#exportTxtBtn"),
  exportHtmlBtn: document.querySelector("#exportHtmlBtn"),
  printPdfBtn: document.querySelector("#printPdfBtn"),
  clearResultBtn: document.querySelector("#clearResultBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  historyList: document.querySelector("#historyList"),
  clearHistoryBtn: document.querySelector("#clearHistoryBtn"),
  statusText: document.querySelector("#statusText"),
  statusDot: document.querySelector("#statusDot"),
  statusPanel: document.querySelector("#statusPanel"),
  helpSearch: document.querySelector("#helpSearch"),
  helpToggle: document.querySelector("#helpToggle"),
  helpButton: document.querySelector(".help-button"),
  helpClose: document.querySelector(".modal-close"),
  helpSections: document.querySelectorAll("[data-help-section]"),
  helpEmpty: document.querySelector("#helpEmpty"),
  workflowSteps: document.querySelectorAll("[data-workflow-step]"),
  licenseWorkflowSteps: document.querySelectorAll("[data-license-step]"),
  builtSmartAiChoice: document.querySelector("#builtSmartAiChoice"),
  ownApiChoice: document.querySelector("#ownApiChoice")
};

init();

function init() {
  const savedKey = localStorage.getItem(STORAGE_KEY);

  const hasSavedKey = Boolean(savedKey && isPlausibleApiKey(savedKey));

  if (hasSavedKey) {
    apiKeyState.value = savedKey;
    apiKeyState.isConnected = sessionStorage.getItem(SESSION_KEY) === "true";
    elements.rememberKey.checked = true;
  } else if (savedKey) {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  }

  updateCharacterCount();
  bindEvents();
  loadSavedSettings();
  setViewMode(getDefaultViewMode());
  renderProfiles();
  renderApiKeyComponent();
  renderBuiltSmartAccess();
  updateWorkflowState();
  refreshBuiltSmartAccess({ silent: true });
  renderHistory();
  setApiKeyPanelOpen(false);
  setKeyFeedback(hasSavedKey ? "Gespeicherter API-Key geladen." : "Noch kein gültiger API-Key gespeichert.", hasSavedKey ? "success" : "info");
  setStatus(hasSavedKey ? "Bereit" : "API-Key fehlt", hasSavedKey ? "ready" : "warn");
}

function bindEvents() {
  elements.sourceText.addEventListener("input", () => {
    clearVisualPdfState();
    updateCharacterCount();
    const hasText = elements.sourceText.value.trim().length > 0;
    setStatus(hasText ? "Text erkannt" : "Bereit", "ready");
  });
  elements.clearSourceBtn.addEventListener("click", clearSourceContent);

  elements.pdfInput.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) processSelectedFile(file);
  });
  elements.fileSelectBtn.addEventListener("click", () => elements.pdfInput.click());
  elements.loadDemoBtn.addEventListener("click", loadDemoSource);
  elements.dropZone.addEventListener("dragenter", handleDragEnter);
  elements.dropZone.addEventListener("dragover", handleDragEnter);
  elements.dropZone.addEventListener("dragleave", handleDragLeave);
  elements.dropZone.addEventListener("drop", handleFileDrop);
  elements.viewModeButtons.forEach((button) => {
    button.addEventListener("click", () => setViewMode(button.dataset.viewMode));
  });
  elements.helpSearch.addEventListener("input", filterHelpSections);
  elements.helpButton.addEventListener("keydown", handleHelpButtonKeydown);
  elements.helpClose.addEventListener("keydown", handleHelpCloseKeydown);
  elements.summarizeBtn.addEventListener("click", handleSummarize);
  elements.copyBtn.addEventListener("click", copySummary);
  elements.copyResultIconBtn.addEventListener("click", copySummary);
  elements.exportMdBtn.addEventListener("click", () => exportSummary("md"));
  elements.exportTxtBtn.addEventListener("click", () => exportSummary("txt"));
  elements.exportHtmlBtn.addEventListener("click", exportSummaryHtml);
  elements.printPdfBtn.addEventListener("click", printSummaryAsPdf);
  elements.clearResultBtn.addEventListener("click", clearSummaryResult);
  elements.resetBtn.addEventListener("click", resetWorkspace);
  elements.historyList.addEventListener("click", handleHistoryClick);
  elements.clearHistoryBtn.addEventListener("click", clearHistory);
  elements.statusPanel.addEventListener("click", openAccessSetupFromStatus);
  elements.apiKeyDetails.addEventListener("click", handleApiKeyActionClick);
  elements.useOwnApiKey.addEventListener("change", handleOwnApiModeChange);
  elements.sendMagicLinkBtn.addEventListener("click", handleMagicLinkLogin);
  elements.logoutBtn.addEventListener("click", handleLogout);
  elements.refreshAccessBtn.addEventListener("click", () => refreshBuiltSmartAccess());
  elements.startTrialBtn.addEventListener("click", handleStartTrial);
  elements.checkoutBtn.addEventListener("click", handleCheckout);
  elements.aiCreditCheckoutBtn.addEventListener("click", handleAiCreditCheckout);
  elements.refreshAiCreditBtn.addEventListener("click", () => refreshBuiltSmartAccess());
  elements.redeemLicenseBtn.addEventListener("click", handleRedeemLicenseCode);
  elements.exportAppDataBtn.addEventListener("click", exportLocalAppData);
  elements.importAppDataBtn.addEventListener("click", () => elements.importAppDataInput.click());
  elements.importAppDataInput.addEventListener("change", handleImportLocalAppData);
  elements.applyProfileBtn.addEventListener("click", applySelectedProfile);
  elements.saveProfileBtn.addEventListener("click", saveCurrentProfile);
  elements.deleteProfileBtn.addEventListener("click", deleteSelectedProfile);
  elements.profileSelect.addEventListener("change", () => {
    updateProfileActions();
    applySelectedProfile();
  });
  [
    elements.templateSelect,
    elements.lengthSelect,
    elements.languageSelect,
    elements.focusSelect,
    elements.formatSelect,
    elements.audienceSelect,
    elements.toneSelect,
    elements.actionModeSelect
  ].forEach((select) => {
    select.addEventListener("change", handleSummarySettingsChange);
  });
  elements.toggleKey.addEventListener("click", () => {
    apiKeyState.isVisible = !apiKeyState.isVisible;
    renderApiKeyComponent();
  });

  elements.apiKey.addEventListener("input", () => {
    apiKeyState.value = elements.apiKey.value.trim();
    apiKeyState.isConnected = false;
    sessionStorage.removeItem(SESSION_KEY);
    renderApiKeyComponent({ keepInput: true });
    setStatus(apiKeyState.value ? "Bereit" : "API-Key fehlt", apiKeyState.value ? "ready" : "warn");
  });
  elements.apiKey.addEventListener("focus", () => {
    if (!apiKeyState.isVisible && apiKeyState.value && elements.apiKey.value === maskApiKey(apiKeyState.value)) {
      elements.apiKey.value = "";
      elements.apiKey.type = "password";
      elements.apiKey.placeholder = "Neuen API-Key eingeben oder Auge zum Anzeigen nutzen";
      setKeyFeedback("Bearbeitungsmodus aktiv. Bestehender Key bleibt erhalten, bis du speicherst.", "info");
    }
  });
  elements.apiKey.addEventListener("blur", () => {
    if (!elements.apiKey.value.trim() && apiKeyState.value) {
      renderApiKeyComponent();
    }
  });
  elements.loginEmail.addEventListener("input", updateLicenseWorkflowState);
  elements.rememberKey.addEventListener("change", () => {
    persistSettings();
    setKeyFeedback(elements.rememberKey.checked ? "Speicherung in diesem Browser aktiviert." : "Speicherung in diesem Browser deaktiviert.", "info");
  });
}

function filterHelpSections() {
  const query = elements.helpSearch.value.trim().toLowerCase();
  let visibleCount = 0;

  elements.helpSections.forEach((section) => {
    const matches = !query || section.textContent.toLowerCase().includes(query);
    section.hidden = !matches;
    if (matches) visibleCount += 1;
  });

  elements.helpEmpty.hidden = visibleCount > 0;
}

function handleHelpButtonKeydown(event) {
  if (!["Enter", " "].includes(event.key)) return;

  event.preventDefault();
  elements.helpToggle.checked = !elements.helpToggle.checked;
}

function handleHelpCloseKeydown(event) {
  if (!["Enter", " "].includes(event.key)) return;

  event.preventDefault();
  elements.helpToggle.checked = false;
}

async function handleMagicLinkLogin() {
  const email = elements.loginEmail.value.trim();
  setBuiltSmartBusy(true, "login", "Magic Link wird gesendet...");

  try {
    const result = await loginWithMagicLink(email);
    if (!result.ok) {
      setAccessFeedback(getBuiltSmartReasonMessage(result), "error");
      return;
    }
    setAccessFeedback("Magic Link gesendet. Bitte E-Mail öffnen und den Login bestätigen.", "success");
  } finally {
    setBuiltSmartBusy(false);
  }
}

async function handleLogout() {
  setBuiltSmartBusy(true, "logout", "Logout wird ausgeführt...");
  await logout();
  builtSmartState.user = null;
  builtSmartState.access = null;
  builtSmartState.aiBalance = null;
  setBuiltSmartBusy(false);
  renderBuiltSmartAccess();
  setAccessFeedback("Logout erfolgreich. Lokale App-Inhalte bleiben erhalten.", "info");
}

async function handleStartTrial() {
  setBuiltSmartBusy(true, "trial", "Free Trial wird gestartet...");
  const result = await startTrial(BUILTSMART_CONFIG.appKey);
  setBuiltSmartBusy(false);

  if (!result.ok) {
    setAccessFeedback(getBuiltSmartReasonMessage(result), "error");
    await refreshBuiltSmartAccess({ silent: true });
    return;
  }

  setAccessFeedback("3-Tage Free Trial aktiv. Enthalten sind 5 kostenlose BuiltSmart AI KI-Anfragen.", "success");
  await refreshBuiltSmartAccess({ silent: true });
}

async function handleRedeemLicenseCode() {
  const code = elements.licenseCode.value.trim();
  if (!code) {
    setAccessFeedback("Bitte zuerst einen Lizenzschlüssel eingeben.", "error");
    return;
  }

  setBuiltSmartBusy(true, "redeem", "Lizenzschlüssel wird aktiviert...");
  const result = await redeemLicenseCode(BUILTSMART_CONFIG.appKey, code);
  setBuiltSmartBusy(false);

  if (!result.ok) {
    setAccessFeedback(getBuiltSmartReasonMessage(result), "error");
    return;
  }

  elements.licenseCode.value = "";
  setAccessFeedback("Lizenzschlüssel aktiviert. App-Zugriff ist freigeschaltet.", "success");
  await refreshBuiltSmartAccess({ silent: true });
}

async function handleCheckout() {
  setBuiltSmartBusy(true, "checkout", "Checkout wird vorbereitet...");
  const result = await createCheckoutSession(BUILTSMART_CONFIG.appKey, 1);
  setBuiltSmartBusy(false);

  if (!result.ok || !result.url) {
    setAccessFeedback(getBuiltSmartReasonMessage(result), "error");
    return;
  }

  window.location.href = result.url;
}

async function handleAiCreditCheckout() {
  if (!builtSmartState.user) {
    setAiCreditFeedback("Bitte zuerst per Magic Link einloggen. Danach kann das Guthaben deinem Nutzerzugriff zugeordnet werden.", "error");
    elements.builtSmartAccessCard.open = true;
    return;
  }

  setBuiltSmartBusy(true, "aiCredits", "Guthaben-Checkout wird vorbereitet...");
  setAiCreditFeedback("Guthaben-Checkout wird vorbereitet...", "loading");
  const result = await createCheckoutSession(BUILTSMART_CONFIG.appKey, 1, "ai_credits");
  setBuiltSmartBusy(false);

  if (!result.ok || !result.url) {
    setAiCreditFeedback(`${getBuiltSmartReasonMessage(result)} Hinweis: Der zentrale Vertrag muss einen Guthaben-Plan wie planKey \"ai_credits\" bereitstellen.`, "error");
    return;
  }

  window.location.href = result.url;
}

async function refreshBuiltSmartAccess({ silent = false } = {}) {
  if (!silent) setAccessFeedback("BuiltSmart Status wird geprüft...", "loading");
  setBuiltSmartBusy(true, "refresh");

  try {
    const [userResult, accessResult, balanceResult] = await Promise.all([
      getCurrentUser(),
      checkAppAccess(BUILTSMART_CONFIG.appKey),
      getAiCreditBalance()
    ]);

    builtSmartState.user = userResult.user || null;
    builtSmartState.access = accessResult;
    builtSmartState.aiBalance = balanceResult.ok ? balanceResult.balance : null;
    renderBuiltSmartAccess();

    if (!silent) {
      setAccessFeedback(getAccessSummaryMessage(accessResult, balanceResult), accessResult.access ? "success" : "info");
      setAiCreditFeedback(getAiCreditSummaryMessage(balanceResult), balanceResult.ok ? "success" : "info");
    }
  } finally {
    setBuiltSmartBusy(false);
    renderBuiltSmartAccess();
  }
}

function handleOwnApiModeChange() {
  persistSettings();
  renderApiKeyComponent();
  renderBuiltSmartAccess();
  setKeyFeedback(elements.useOwnApiKey.checked ? "Eigener API-Key wird für KI-Anfragen verwendet." : "BuiltSmart AI Guthaben wird für KI-Anfragen verwendet.", "info");
}

function handleSummarySettingsChange() {
  workflowState.settingsTouched = true;
  persistSettings();
  updateWorkflowState();
}

function openAccessSetupFromStatus() {
  const accessPanel = document.querySelector("details.api-panel");
  if (accessPanel) accessPanel.open = true;
  elements.apiKeyCard.open = true;
  elements.apiKeyCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

function handleApiKeyActionClick(event) {
  const button = event.target.closest("button");
  if (!button) return;

  const actions = {
    saveKeyBtn: handleSaveKey,
    connectBtn: handleConnect,
    testConnectionBtn: handleConnectionTest,
    disconnectBtn: handleDisconnect,
    clearApiKeyBtn: clearOwnApiKey
  };

  const action = actions[button.id];
  if (!action || button.disabled) return;

  event.preventDefault();
  action();
}

async function handleSaveKey() {
  const candidate = normalizeKeyInput(elements.apiKey.value);

  if (!candidate && !apiKeyState.value) {
    setKeyFeedback("Bitte gib zuerst einen Anthropic API-Key ein.", "error");
    setStatus("API-Key fehlt", "warn");
    setApiKeyPanelOpen(true);
    return;
  }

  if (candidate) {
    if (!isPlausibleApiKey(candidate)) {
      apiKeyState.isConnected = false;
      sessionStorage.removeItem(SESSION_KEY);
      setKeyFeedback("Der eingegebene Wert sieht nicht wie ein Anthropic API-Key aus. Er muss mit sk-ant- beginnen.", "error");
      setStatus("API-Key fehlt", "warn");
      setApiKeyPanelOpen(true);
      return;
    }

    apiKeyState.value = candidate;
  }

  elements.rememberKey.checked = true;
  elements.useOwnApiKey.checked = true;
  apiKeyState.isConnected = false;
  sessionStorage.removeItem(SESSION_KEY);
  persistSettings();
  renderApiKeyComponent();
  renderBuiltSmartAccess();
  setApiBusy(true, "save", "API-Key gespeichert. Verbindung wird geprüft...");
  setStatus("Analyse läuft", "warn");

  try {
    await testClaudeConnection({
      apiKey: apiKeyState.value,
      proxyUrl: DEFAULT_PROXY_URL,
      model: DEFAULT_CLAUDE_MODEL
    });

    apiKeyState.isConnected = true;
    sessionStorage.setItem(SESSION_KEY, "true");
    setKeyFeedback("Verbindung OK. Eigener API-Key wurde gespeichert und von Anthropic akzeptiert.", "success");
    setStatus("Bereit", "ready");
  } catch (error) {
    handleApiFailure(error);
  } finally {
    setApiBusy(false);
    renderApiKeyComponent();
  }
}

async function handleConnect() {
  if (!ensureApiKeyForAction()) return;

  setApiBusy(true, "connect", "Verbindung wird hergestellt...");
  setStatus("Analyse läuft", "warn");

  try {
    await testClaudeConnection({
      apiKey: apiKeyState.value,
      proxyUrl: DEFAULT_PROXY_URL,
      model: DEFAULT_CLAUDE_MODEL
    });

    apiKeyState.isConnected = true;
    sessionStorage.setItem(SESSION_KEY, "true");
    setKeyFeedback("Verbindung OK. Anthropic ist erreichbar und der API-Key wurde akzeptiert.", "success");
    setStatus("Bereit", "ready");
  } catch (error) {
    handleApiFailure(error);
  } finally {
    setApiBusy(false);
    renderApiKeyComponent();
  }
}

async function handleConnectionTest() {
  if (!ensureApiKeyForAction()) return;

  setApiBusy(true, "test", "Verbindung wird überprüft...");
  setStatus("Analyse läuft", "warn");

  try {
    await testClaudeConnection({
      apiKey: apiKeyState.value,
      proxyUrl: DEFAULT_PROXY_URL,
      model: DEFAULT_CLAUDE_MODEL
    });

    apiKeyState.isConnected = true;
    sessionStorage.setItem(SESSION_KEY, "true");
    setKeyFeedback("Verbindung erfolgreich geprüft. Anthropic hat den Test-Request beantwortet.", "success");
    setStatus("Bereit", "ready");
  } catch (error) {
    handleApiFailure(error);
  } finally {
    setApiBusy(false);
    renderApiKeyComponent();
  }
}

function handleDisconnect() {
  apiKeyState.isConnected = false;
  sessionStorage.removeItem(SESSION_KEY);
  renderApiKeyComponent();
  setKeyFeedback("Verbindung getrennt. Der gespeicherte API-Key bleibt erhalten.", "info");
  setStatus(apiKeyState.value ? "Bereit" : "API-Key fehlt", apiKeyState.value ? "ready" : "warn");
}

function clearOwnApiKey() {
  apiKeyState.value = "";
  apiKeyState.isVisible = false;
  apiKeyState.isConnected = false;
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(STORAGE_KEY);
  removeOwnApiKey("anthropic");
  elements.rememberKey.checked = false;
  elements.useOwnApiKey.checked = false;
  elements.apiKey.value = "";
  elements.apiKey.type = "password";
  persistSettings();
  renderApiKeyComponent();
  renderBuiltSmartAccess();
  setKeyFeedback("Eigener API-Key gelöscht. BuiltSmart AI Guthaben bleibt als Standardmodus verfügbar.", "info");
  setStatus("API-Key gelöscht", "warn");
}

function handleDragEnter(event) {
  event.preventDefault();
  elements.dropZone.classList.add("is-dragging");
}

function handleDragLeave(event) {
  event.preventDefault();
  if (!elements.dropZone.contains(event.relatedTarget)) {
    elements.dropZone.classList.remove("is-dragging");
  }
}

function handleFileDrop(event) {
  event.preventDefault();
  elements.dropZone.classList.remove("is-dragging");
  const file = event.dataTransfer?.files?.[0];
  if (file) processSelectedFile(file);
}

function clearSourceContent() {
  elements.sourceText.value = "";
  elements.pdfInput.value = "";
  elements.pdfStatus.textContent = "Keine Datei ausgewählt";
  clearVisualPdfState();
  updateCharacterCount();
  setStatus(apiKeyState.value ? "Bereit" : "API-Key fehlt", apiKeyState.value ? "ready" : "warn");
  elements.sourceText.focus();
}

async function processSelectedFile(file) {
  try {
    clearVisualPdfState();
    setStatus("Text erkannt", "ready");
    elements.pdfStatus.textContent = `${file.name} wird ausgelesen...`;
    const extractedText = await extractTextFromFile(file);

    if (!extractedText.trim()) {
      if (isPdfFile(file)) {
        visualPdfState.fileName = file.name;
        visualPdfState.base64 = await fileToBase64(file);
        elements.sourceText.value = "";
        elements.pdfStatus.textContent = `${file.name}: kein markierbarer Text erkannt. Visuelle PDF-Analyse wird bei der Zusammenfassung genutzt.`;
        updateCharacterCount();
        elements.textQuality.textContent = "Textqualität: PDF bereit für visuelle Analyse";
        elements.textQuality.className = "quality-badge info";
        setStatus("PDF für visuelle Analyse bereit", "ready");
        return;
      }

      throw new Error("In dieser Datei konnte kein auswertbarer Text erkannt werden.");
    }

    elements.sourceText.value = extractedText;
    elements.pdfStatus.textContent = `${file.name} ausgelesen`;
    updateCharacterCount();
    setStatus("Text erkannt", "ready");
  } catch (error) {
    elements.pdfStatus.textContent = error.message;
    setStatus("Fehler bei Verarbeitung", "danger");
  }
}

async function extractTextFromFile(file) {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (isPdfFile(file)) {
    return extractTextFromPdf(file);
  }

  if (["txt", "md", "csv", "html", "htm", "rtf"].includes(extension)) {
    return file.text();
  }

  if (extension === "docx") {
    return extractTextFromDocx(file);
  }

  throw new Error("Dieses Dateiformat wird noch nicht unterstützt.");
}

function isPdfFile(file) {
  return file?.type === "application/pdf" || file?.name?.toLowerCase().endsWith(".pdf");
}

async function fileToBase64(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

function clearVisualPdfState() {
  visualPdfState.fileName = "";
  visualPdfState.base64 = "";
}

async function handleSummarize() {
  const text = elements.sourceText.value.trim();
  const hasVisualPdf = Boolean(visualPdfState.base64);
  const useOwnKey = elements.useOwnApiKey.checked;

  if (!text && !hasVisualPdf) {
    setStatus("Fehler bei Verarbeitung", "danger");
    setSummaryOutput("Bitte füge zuerst einen Text ein oder lade eine PDF-Datei hoch.");
    return;
  }

  if (text.length > MAX_CHARS) {
    setStatus("Fehler bei Verarbeitung", "danger");
    setSummaryOutput(`Der Text ist mit ${text.length.toLocaleString("de-DE")} Zeichen zu groß. Bitte kürze ihn auf maximal ${MAX_CHARS.toLocaleString("de-DE")} Zeichen.`);
    return;
  }

  persistSettings();
  workflowState.settingsTouched = true;
  updateWorkflowState();
  setSummaryButtonsDisabled(true);

  try {
    setStatus("Analyse läuft", "warn");
    const actionPayload = buildSummaryActionPayload(text, hasVisualPdf);

    if (useOwnKey) {
      if (!ensureApiKeyForAction()) return;
      if (!confirmOwnApiAction(actionPayload)) return;
    } else {
      const hasAppAccess = await ensureBuiltSmartAppAccess();
      if (!hasAppAccess) return;
      const canRun = await confirmBuiltSmartAiAction(actionPayload);
      if (!canRun) return;
    }

    await shortPause();
    setStatus("Zusammenfassung wird erstellt", "warn");

    const summary = useOwnKey
      ? await runOwnApiSummary(text, hasVisualPdf)
      : await runBuiltSmartSummary(actionPayload);

    setStatus("Qualität wird geprüft", "warn");
    await shortPause();
    setSummaryOutput(summary);
    saveSummaryToHistory(summary);
    setViewMode("result");
    setStatus("Ausgabe fertig", "ready");
    if (!useOwnKey) await refreshBuiltSmartAccess({ silent: true });
  } catch (error) {
    if (useOwnKey) handleApiFailure(error);
    else setAccessFeedback(error.message || "BuiltSmart KI-Anfrage fehlgeschlagen.", "error");
    setSummaryOutput([
      "Die Anfrage konnte nicht verarbeitet werden.",
      "",
      error.message,
      "",
      useOwnKey ? getApiRecoveryHint(error) : "Hinweis: Prüfe Login, App-Zugriff, KI-Guthaben oder nutze optional einen eigenen API-Key."
    ].join("\n"));
  } finally {
    setSummaryButtonsDisabled(false);
  }
}

function buildSummaryActionPayload(text, hasVisualPdf) {
  return {
    inputLength: text.length || visualPdfState.base64.length,
    outputMode: elements.lengthSelect.value,
    text,
    pdfBase64: hasVisualPdf ? visualPdfState.base64 : "",
    fileName: hasVisualPdf ? visualPdfState.fileName : "",
    length: elements.lengthSelect.value,
    language: elements.languageSelect.value,
    focus: elements.focusSelect.value,
    format: elements.formatSelect.value,
    template: elements.templateSelect.value,
    audience: elements.audienceSelect.value,
    tone: elements.toneSelect.value,
    actionMode: elements.actionModeSelect.value
  };
}

async function confirmBuiltSmartAiAction(payload) {
  const estimate = await estimateAiUsage("summarize", {
    inputLength: payload.inputLength,
    outputMode: payload.outputMode
  });

  if (!estimate.ok || estimate.reason === "insufficient_ai_credits" || estimate.estimate?.hasEnoughBalance === false) {
    setAccessFeedback(getBuiltSmartReasonMessage(estimate), "error");
    setAiCreditFeedback("Kein BuiltSmart AI Guthaben verfügbar. Du kannst Guthaben kaufen oder Option 2 mit eigenem API-Key nutzen.", "error");
    setStatus("KI-Guthaben fehlt", "warn");
    elements.apiKeyCard.open = true;
    return false;
  }

  const label = estimate.estimate?.label || `${estimate.estimate?.credits || 1} KI-Anfrage`;
  const source = estimate.estimate?.willUseTrialCredit ? "Free-Trial-Guthaben" : "BuiltSmart AI Guthaben";
  return window.confirm(`Diese Zusammenfassung verbraucht voraussichtlich ${label} aus ${source}. Jetzt fortfahren?`);
}

function confirmOwnApiAction(payload) {
  const estimatedTokens = Math.max(1, Math.ceil(payload.inputLength / 4));
  return window.confirm(`Diese Zusammenfassung nutzt deinen eigenen Anthropic API-Key. Geschätzter Eingabeumfang: ca. ${estimatedTokens.toLocaleString("de-DE")} Token. Abrechnung und Nutzung laufen über dein Anthropic-Konto. Jetzt fortfahren?`);
}

async function ensureBuiltSmartAppAccess() {
  const access = await checkAppAccess(BUILTSMART_CONFIG.appKey);
  builtSmartState.access = access;
  renderBuiltSmartAccess();

  if (!access.ok || !access.access) {
    setAccessFeedback(getBuiltSmartReasonMessage(access), "error");
    setStatus("Zugriff fehlt", "warn");
    elements.builtSmartAccessCard.open = true;
    return false;
  }

  return true;
}

async function runBuiltSmartSummary(payload) {
  const result = await runAiAction("summarize", payload);
  if (!result.ok) throw new Error(getBuiltSmartReasonMessage(result));
  const summary = result.result?.text || result.text;
  if (!summary) throw new Error("Die zentrale BuiltSmart AI Funktion hat kein Ergebnis zurückgegeben.");
  return summary;
}

async function runOwnApiSummary(text, hasVisualPdf) {
  const apiKey = apiKeyState.value;
  return hasVisualPdf
    ? requestClaudePdfSummary({
        apiKey,
        proxyUrl: DEFAULT_PROXY_URL,
        model: DEFAULT_CLAUDE_MODEL,
        pdfBase64: visualPdfState.base64,
        fileName: visualPdfState.fileName,
        length: elements.lengthSelect.value,
        language: elements.languageSelect.value,
        focus: elements.focusSelect.value,
        format: elements.formatSelect.value,
        template: elements.templateSelect.value,
        audience: elements.audienceSelect.value,
        tone: elements.toneSelect.value,
        actionMode: elements.actionModeSelect.value
      })
    : requestClaudeSummary({
        apiKey,
        proxyUrl: DEFAULT_PROXY_URL,
        model: DEFAULT_CLAUDE_MODEL,
        text,
        length: elements.lengthSelect.value,
        language: elements.languageSelect.value,
        focus: elements.focusSelect.value,
        format: elements.formatSelect.value,
        template: elements.templateSelect.value,
        audience: elements.audienceSelect.value,
        tone: elements.toneSelect.value,
        actionMode: elements.actionModeSelect.value
      });
}

function setSummaryOutput(text, isPlaceholder = false) {
  currentSummaryText = text;
  if (isPlaceholder) {
    elements.summaryOutput.textContent = text;
  } else {
    elements.summaryOutput.innerHTML = renderStructuredOutput(text);
  }
  elements.summaryOutput.classList.toggle("is-placeholder", isPlaceholder);
  updateWorkflowState();
}

function renderStructuredOutput(markdownText) {
  const lines = markdownText.split(/\r?\n/);
  const blocks = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();

    if (!line) continue;

    if (isMarkdownTableStart(lines, index)) {
      const tableLines = [];
      while (index < lines.length && lines[index].trim().includes("|")) {
        tableLines.push(lines[index].trim());
        index += 1;
      }
      index -= 1;
      blocks.push(renderTable(tableLines));
      continue;
    }

    if (/^#{1,4}\s+/.test(line)) {
      const level = Math.min(line.match(/^#+/)?.[0].length || 3, 4);
      blocks.push(`<h${level}>${escapeHtml(line.replace(/^#{1,4}\s+/, ""))}</h${level}>`);
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(`<li>${escapeHtml(lines[index].trim().replace(/^[-*]\s+/, ""))}</li>`);
        index += 1;
      }
      index -= 1;
      blocks.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(`<li>${escapeHtml(lines[index].trim().replace(/^\d+\.\s+/, ""))}</li>`);
        index += 1;
      }
      index -= 1;
      blocks.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    const paragraphLines = [line];
    while (
      index + 1 < lines.length &&
      lines[index + 1].trim() &&
      !/^#{1,4}\s+/.test(lines[index + 1].trim()) &&
      !/^[-*]\s+/.test(lines[index + 1].trim()) &&
      !/^\d+\.\s+/.test(lines[index + 1].trim()) &&
      !isMarkdownTableStart(lines, index + 1)
    ) {
      paragraphLines.push(lines[index + 1].trim());
      index += 1;
    }
    blocks.push(`<p>${escapeHtml(paragraphLines.join(" "))}</p>`);
  }

  return blocks.join("");
}

function isMarkdownTableStart(lines, index) {
  const current = lines[index]?.trim() || "";
  const next = lines[index + 1]?.trim() || "";
  return current.includes("|") && /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(next);
}

function renderTable(tableLines) {
  const rows = tableLines
    .filter((line) => !/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line))
    .map((line) => line.replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()));

  if (!rows.length) return "";

  const [header, ...bodyRows] = rows;
  const headerHtml = header.map((cell) => `<th>${escapeHtml(cell)}</th>`).join("");
  const bodyHtml = bodyRows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("");

  return `<div class="summary-table-wrap"><table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getCurrentProfileSettings() {
  return {
    template: elements.templateSelect.value,
    audience: elements.audienceSelect.value,
    language: elements.languageSelect.value,
    focus: elements.focusSelect.value,
    tone: elements.toneSelect.value,
    actionMode: elements.actionModeSelect.value,
    length: elements.lengthSelect.value,
    format: elements.formatSelect.value
  };
}

function applyProfileSettings(settings) {
  setSelectValue(elements.templateSelect, settings.template);
  setSelectValue(elements.audienceSelect, settings.audience);
  setSelectValue(elements.languageSelect, settings.language);
  setSelectValue(elements.focusSelect, settings.focus);
  setSelectValue(elements.toneSelect, settings.tone);
  setSelectValue(elements.actionModeSelect, settings.actionMode);
  setSelectValue(elements.lengthSelect, settings.length);
  setSelectValue(elements.formatSelect, settings.format);
}

function setSelectValue(select, value) {
  if (!value) return;
  const option = Array.from(select.options).find((item) => item.value === value || item.textContent === value);
  if (option) select.value = option.value;
}

function loadCustomProfiles() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROFILE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCustomProfiles(profiles) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profiles));
}

function getAllProfiles() {
  return [...BUILT_IN_PROFILES, ...loadCustomProfiles()];
}

function renderProfiles(selectedId = elements.profileSelect?.value || "") {
  const customProfiles = loadCustomProfiles();
  const options = [
    '<option value="">Profil auswählen...</option>',
    '<optgroup label="Vordefiniert">',
    ...BUILT_IN_PROFILES.map((profile) => `<option value="${escapeHtml(profile.id)}">${escapeHtml(profile.name)}</option>`),
    "</optgroup>"
  ];

  if (customProfiles.length) {
    options.push(
      '<optgroup label="Eigene Profile">',
      ...customProfiles.map((profile) => `<option value="${escapeHtml(profile.id)}">${escapeHtml(profile.name)}</option>`),
      "</optgroup>"
    );
  }

  elements.profileSelect.innerHTML = options.join("");
  if (getAllProfiles().some((profile) => profile.id === selectedId)) {
    elements.profileSelect.value = selectedId;
  } else {
    elements.profileSelect.value = "";
  }
  updateProfileActions();
}

function getSelectedProfile() {
  return getAllProfiles().find((profile) => profile.id === elements.profileSelect.value);
}

function updateProfileActions() {
  const profile = getSelectedProfile();
  elements.applyProfileBtn.disabled = !profile;
  elements.deleteProfileBtn.disabled = !profile || profile.builtIn;
}

function applySelectedProfile() {
  const profile = getSelectedProfile();
  if (!profile) return;

  applyProfileSettings(profile.settings);
  workflowState.settingsTouched = true;
  persistSettings();
  updateWorkflowState();
  setProfileFeedback(`Profil angewendet: ${profile.name}`);
}

function saveCurrentProfile() {
  const rawName = window.prompt("Name für das neue Profil:", "Mein Profil");
  const name = rawName?.trim();
  if (!name) return;

  const customProfiles = loadCustomProfiles();
  const existingIndex = customProfiles.findIndex((profile) => profile.name.toLowerCase() === name.toLowerCase());
  const existingProfile = existingIndex >= 0 ? customProfiles[existingIndex] : null;

  if (existingProfile && !window.confirm(`Profil "${name}" überschreiben?`)) return;

  const profile = {
    id: existingProfile?.id || `custom-${Date.now()}`,
    name,
    builtIn: false,
    settings: getCurrentProfileSettings()
  };

  if (existingIndex >= 0) {
    customProfiles[existingIndex] = profile;
  } else {
    customProfiles.push(profile);
  }

  saveCustomProfiles(customProfiles);
  renderProfiles(profile.id);
  setProfileFeedback(`Profil gespeichert: ${name}`);
}

function deleteSelectedProfile() {
  const profile = getSelectedProfile();
  if (!profile || profile.builtIn) return;
  if (!window.confirm(`Profil "${profile.name}" wirklich löschen?`)) return;

  saveCustomProfiles(loadCustomProfiles().filter((item) => item.id !== profile.id));
  renderProfiles("");
  setProfileFeedback("Profil gelöscht");
}

function setProfileFeedback(message) {
  elements.profileFeedback.textContent = message;
}

function updateCharacterCount() {
  const text = elements.sourceText.value;
  const count = text.length;
  elements.charCount.textContent = `${count.toLocaleString("de-DE")} Zeichen`;
  elements.charCount.classList.toggle("warn", count > RECOMMENDED_CHARS && count <= MAX_CHARS);
  elements.charCount.classList.toggle("danger", count > MAX_CHARS);
  updateTextQuality(count);
  updateSourceInsights(text, count);
  updateWorkflowState();
}

function loadDemoSource() {
  clearVisualPdfState();
  elements.sourceText.value = DEMO_SOURCE_TEXT;
  elements.pdfInput.value = "";
  elements.pdfStatus.textContent = "Demoquelle geladen";
  elements.templateSelect.value = "Projektstatus";
  elements.focusSelect.value = "Management Summary";
  elements.formatSelect.value = "Executive Summary";
  elements.audienceSelect.value = "Management";
  elements.toneSelect.value = "Prägnant";
  elements.actionModeSelect.value = "Entscheidung vorbereiten";
  elements.lengthSelect.value = "detailed";
  workflowState.settingsTouched = true;
  persistSettings();
  updateCharacterCount();
  setViewMode("source");
  setStatus("Demoquelle geladen", "ready");
  setSummaryOutput("Noch keine Zusammenfassung erstellt.", true);
}

function getDefaultViewMode() {
  return window.matchMedia("(max-width: 1050px)").matches ? "source" : "split";
}

function setViewMode(mode) {
  const allowedModes = ["source", "result", "split"];
  const nextMode = allowedModes.includes(mode) ? mode : "split";

  elements.layout.dataset.view = nextMode;
  elements.viewModeButtons.forEach((button) => {
    const isActive = button.dataset.viewMode === nextMode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
}

function updateSourceInsights(text, count = text.length) {
  const trimmed = text.trim();
  const tokenEstimate = Math.ceil(count / 4);
  const paragraphs = trimmed ? trimmed.split(/\n\s*\n/).filter(Boolean).length : 0;
  const structure = getStructureEstimate(trimmed, paragraphs);

  elements.tokenEstimate.textContent = `ca. ${tokenEstimate.toLocaleString("de-DE")}`;
  elements.paragraphEstimate.textContent = paragraphs.toLocaleString("de-DE");
  elements.languageEstimate.textContent = detectLikelyLanguage(trimmed);
  elements.structureEstimate.textContent = structure;
}

function getStructureEstimate(text, paragraphCount) {
  if (!text) return "keine Quelle";

  const headingMatches = text.match(/(^|\n)\s{0,3}(#{1,3}\s+\S|[A-ZÄÖÜ][^\n]{2,80}\n[-=]{3,})/g) || [];
  const listMatches = text.match(/(^|\n)\s*([-*]|\d+\.)\s+\S/g) || [];

  if (headingMatches.length >= 2 || listMatches.length >= 4) return "gut strukturiert";
  if (paragraphCount >= 3) return "Absätze erkannt";
  if (text.length >= 300) return "Fließtext";
  return "sehr kurz";
}

function detectLikelyLanguage(text) {
  if (!text) return "-";

  const sample = text.toLowerCase().slice(0, 4000);
  const germanHits = countMatches(sample, [" der ", " die ", " das ", " und ", " nicht ", " ist ", " für ", " mit "]);
  const englishHits = countMatches(sample, [" the ", " and ", " of ", " to ", " is ", " for ", " with ", " not "]);
  const frenchHits = countMatches(sample, [" le ", " la ", " les ", " et ", " des ", " pour ", " avec ", " pas "]);
  const scores = [
    ["Deutsch", germanHits],
    ["Englisch", englishHits],
    ["Französisch", frenchHits]
  ].sort((a, b) => b[1] - a[1]);

  return scores[0][1] > 0 ? scores[0][0] : "unklar";
}

function countMatches(value, needles) {
  return needles.reduce((total, needle) => total + value.split(needle).length - 1, 0);
}

function updateTextQuality(count = elements.sourceText.value.length) {
  if (!count) {
    elements.textQuality.textContent = "Textqualität: noch keine Quelle";
    elements.textQuality.className = "quality-badge";
    return;
  }

  if (count > MAX_CHARS) {
    elements.textQuality.textContent = "Textqualität: Text zu groß";
    elements.textQuality.className = "quality-badge danger";
    return;
  }

  if (count > RECOMMENDED_CHARS) {
    elements.textQuality.textContent = "Textqualität: lang, ggf. kürzen";
    elements.textQuality.className = "quality-badge warn";
    return;
  }

  if (count < 300) {
    elements.textQuality.textContent = "Textqualität: sehr kurz";
    elements.textQuality.className = "quality-badge warn";
    return;
  }

  elements.textQuality.textContent = "Textqualität: gut";
  elements.textQuality.className = "quality-badge success";
}

function setStatus(label, type) {
  const displayLabel = label === "Bereit"
    ? "System bereit"
    : label === "API-Key fehlt"
      ? "API-Key fehlt - Zugang einrichten"
      : label;
  elements.statusText.textContent = displayLabel;
  elements.statusDot.classList.toggle("warn", type === "warn");
  elements.statusDot.classList.toggle("danger", type === "danger");
  elements.statusPanel.classList.toggle("is-actionable", label === "API-Key fehlt");
  elements.statusPanel.setAttribute("aria-label", label === "API-Key fehlt" ? "API-Key fehlt - Zugang einrichten" : displayLabel);
}

function updateWorkflowState() {
  const hasAccess = Boolean(builtSmartState.access?.access || (elements.useOwnApiKey.checked && apiKeyState.isConnected));
  const hasSource = elements.sourceText.value.trim().length > 0 || Boolean(visualPdfState.base64);
  const hasSettings = workflowState.settingsTouched;
  const hasResult = currentSummaryText.trim() && currentSummaryText !== "Noch keine Zusammenfassung erstellt.";
  const stateByStep = {
    access: hasAccess,
    source: hasSource,
    settings: hasSettings,
    result: hasResult
  };

  elements.workflowSteps.forEach((step) => {
    const isComplete = Boolean(stateByStep[step.dataset.workflowStep]);
    step.classList.toggle("is-complete", isComplete);
    step.classList.toggle("is-active", isComplete);
  });
}

function persistSettings() {
  if (apiKeyState.value) {
    localStorage.setItem(STORAGE_KEY, apiKeyState.value);
    saveOwnApiKey("anthropic", apiKeyState.value);
  } else {
    localStorage.removeItem(STORAGE_KEY);
    if (!apiKeyState.value) removeOwnApiKey("anthropic");
  }

  localStorage.setItem(SETTINGS_KEY, JSON.stringify({
    useOwnApiKey: elements.useOwnApiKey.checked,
    template: elements.templateSelect.value,
    length: elements.lengthSelect.value,
    language: elements.languageSelect.value,
    focus: elements.focusSelect.value,
    format: elements.formatSelect.value,
    audience: elements.audienceSelect.value,
    tone: elements.toneSelect.value,
    actionMode: elements.actionModeSelect.value
  }));
}

function renderApiKeyComponent(options = {}) {
  if (!options.keepInput) {
    elements.apiKey.type = apiKeyState.isVisible || apiKeyState.value ? "text" : "password";
    elements.apiKey.value = apiKeyState.isVisible ? apiKeyState.value : maskApiKey(apiKeyState.value);
    elements.apiKey.placeholder = apiKeyState.value ? "" : "sk-ant-...";
  }

  elements.toggleKey.setAttribute("aria-pressed", String(apiKeyState.isVisible));
  elements.toggleKey.setAttribute("aria-label", apiKeyState.isVisible ? "API-Key verbergen" : "API-Key anzeigen");
  elements.toggleKey.classList.toggle("is-active", apiKeyState.isVisible);
  elements.connectionBadge.textContent = apiKeyState.isConnected ? "Verbunden" : "Nicht verbunden";
  elements.connectionBadge.classList.toggle("is-connected", apiKeyState.isConnected);
  elements.connectionBadge.classList.toggle("is-warning", elements.useOwnApiKey.checked && !apiKeyState.isConnected);
  elements.connectionBadge.classList.toggle("is-muted", !elements.useOwnApiKey.checked);
  elements.connectBtn.textContent = apiKeyState.isConnected ? "Verbindung OK" : "Verbindung";
  elements.connectBtn.classList.toggle("is-connected", apiKeyState.isConnected);
  elements.connectBtn.setAttribute("aria-pressed", String(apiKeyState.isConnected));
  elements.keyHint.textContent = apiKeyState.value
    ? "Gespeicherter eigener Key wird teilweise angezeigt. Das Auge zeigt den vollständigen Schlüssel."
    : "Optional: eigener Anthropic API-Key für lokale KI-Nutzung. BuiltSmart AI Guthaben funktioniert ohne eigenen Key.";

  setButtonLoading(elements.saveKeyBtn, apiKeyState.busyAction === "save");
  setButtonLoading(elements.connectBtn, apiKeyState.busyAction === "connect");
  setButtonLoading(elements.testConnectionBtn, apiKeyState.busyAction === "test");
  setButtonLoading(elements.disconnectBtn, apiKeyState.busyAction === "disconnect");
  elements.saveKeyBtn.disabled = apiKeyState.isBusy;
  elements.connectBtn.disabled = apiKeyState.isBusy;
  elements.testConnectionBtn.disabled = apiKeyState.isBusy;
  elements.disconnectBtn.disabled = apiKeyState.isBusy || !apiKeyState.isConnected;
  elements.useOwnApiKey.checked = Boolean(elements.useOwnApiKey.checked);
  updateWorkflowState();
}

function loadSavedSettings() {
  const savedOwnKey = getOwnApiKey("anthropic");
  if (!apiKeyState.value && isPlausibleApiKey(savedOwnKey)) {
    apiKeyState.value = savedOwnKey;
    elements.rememberKey.checked = true;
  }

  try {
    const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    elements.useOwnApiKey.checked = Boolean(settings.useOwnApiKey);
  } catch {
    elements.useOwnApiKey.checked = false;
  }
}

function renderBuiltSmartAccess() {
  const access = builtSmartState.access;
  const balance = builtSmartState.aiBalance;
  const user = builtSmartState.user;
  const ownApiKeyActive = getOwnApiKeyStatus("anthropic").active && elements.useOwnApiKey.checked;
  const builtSmartAiActive = !ownApiKeyActive;
  const accessState = resolveAccessState(access);

  elements.aiBalanceStatus.textContent = getAiBalanceLabel(balance);
  elements.aiModeStatus.textContent = builtSmartAiActive ? `BuiltSmart AI${balance ? ` · ${getAiBalanceLabel(balance)}` : ""}` : "Eigener API-Key aktiv";
  elements.builtSmartAiChoice.classList.toggle("is-selected", builtSmartAiActive);
  elements.ownApiChoice.classList.toggle("is-selected", ownApiKeyActive);
  elements.accessBadge.textContent = accessState.label;
  elements.accessBadge.classList.toggle("is-connected", accessState.kind === "active");
  elements.accessBadge.classList.toggle("is-warning", accessState.kind === "warning");

  setButtonLoading(elements.sendMagicLinkBtn, builtSmartState.busyAction === "login");
  setButtonLoading(elements.logoutBtn, builtSmartState.busyAction === "logout");
  setButtonLoading(elements.refreshAccessBtn, builtSmartState.busyAction === "refresh");
  setButtonLoading(elements.startTrialBtn, builtSmartState.busyAction === "trial");
  setButtonLoading(elements.checkoutBtn, builtSmartState.busyAction === "checkout");
  setButtonLoading(elements.aiCreditCheckoutBtn, builtSmartState.busyAction === "aiCredits");
  setButtonLoading(elements.refreshAiCreditBtn, builtSmartState.busyAction === "refresh");
  setButtonLoading(elements.redeemLicenseBtn, builtSmartState.busyAction === "redeem");

  elements.sendMagicLinkBtn.disabled = builtSmartState.isBusy;
  elements.logoutBtn.disabled = builtSmartState.isBusy || !user;
  elements.refreshAccessBtn.disabled = builtSmartState.isBusy;
  elements.startTrialBtn.disabled = builtSmartState.isBusy || !user || !access?.trialAvailable;
  elements.checkoutBtn.disabled = builtSmartState.isBusy || !user;
  elements.aiCreditCheckoutBtn.disabled = builtSmartState.isBusy;
  elements.refreshAiCreditBtn.disabled = builtSmartState.isBusy;
  elements.redeemLicenseBtn.disabled = builtSmartState.isBusy || !user;
  updateLicenseWorkflowState();
  updateWorkflowState();
}

function updateLicenseWorkflowState() {
  const emailEntered = isValidEmailInput(elements.loginEmail.value);
  const loggedIn = Boolean(builtSmartState.user);
  const appAccessActive = Boolean(builtSmartState.access?.access);
  const statusChecked = Boolean(loggedIn && builtSmartState.access);
  const stateByStep = {
    email: emailEntered,
    login: loggedIn,
    access: appAccessActive,
    status: statusChecked
  };

  elements.licenseWorkflowSteps.forEach((step) => {
    step.classList.toggle("is-complete", Boolean(stateByStep[step.dataset.licenseStep]));
  });
}

function setBuiltSmartBusy(isBusy, action = "", message = "") {
  builtSmartState.isBusy = isBusy;
  builtSmartState.busyAction = isBusy ? action : "";
  if (message && action === "aiCredits") setAiCreditFeedback(message, "loading");
  else if (message) setAccessFeedback(message, "loading");
  renderBuiltSmartAccess();
}

function setAccessFeedback(message, type) {
  elements.accessFeedback.textContent = message;
  elements.accessFeedback.classList.remove("success", "error", "loading", "info");
  elements.accessFeedback.classList.add(type);
}

function setAiCreditFeedback(message, type) {
  elements.aiCreditFeedback.textContent = message;
  elements.aiCreditFeedback.classList.remove("success", "error", "loading", "info");
  elements.aiCreditFeedback.classList.add(type);
}

function resolveAccessState(access) {
  if (!builtSmartState.user) return { label: "Nicht eingeloggt", kind: "warning" };
  if (!access) return { label: "Nicht geprüft", kind: "warning" };
  if (access.reason === "config_missing") return { label: "Konfiguration offen", kind: "warning" };
  if (access.access && access.source === "trial") return { label: "Free Trial aktiv", kind: "active" };
  if (access.access) return { label: "Lizenz aktiv", kind: "active" };
  if (access.reason === "trial_expired") return { label: "Free Trial abgelaufen", kind: "warning" };
  if (access.reason === "license_expired") return { label: "Lizenz abgelaufen", kind: "warning" };
  if (access.trialAvailable) return { label: "Free Trial verfügbar", kind: "warning" };
  return { label: "Kein Zugriff", kind: "warning" };
}

function getAccessStatusLabel(access) {
  if (!access) return "Nicht geprüft";
  if (access.reason === "config_missing") return "Backend-Werte fehlen";
  if (access.access && access.source === "trial") return `Free Trial bis ${formatDate(access.validUntil)}`;
  if (access.access) return `Aktiv bis ${formatDate(access.validUntil)}`;
  if (access.reason === "trial_expired") return "Free Trial abgelaufen";
  if (access.reason === "license_expired") return "Lizenz abgelaufen";
  if (access.trialAvailable) return "Free Trial verfügbar";
  return getBuiltSmartReasonMessage(access);
}

function getAiBalanceLabel(balance) {
  if (!balance) return "Nicht geprüft";
  const trial = Number(balance.includedTrialRequestsRemaining || 0);
  const paid = Number(balance.paidCreditsRemaining || 0);
  if (trial + paid <= 0) return "Kein KI-Guthaben";
  return `${trial} Free Trial · ${paid} bezahlt`;
}

function getAccessSummaryMessage(access, balance) {
  if (access?.reason === "config_missing") return getBuiltSmartReasonMessage(access);
  if (!builtSmartState.user) return "Bitte per E-Mail/Magic Link einloggen.";
  if (access?.access) return `App-Zugriff aktiv. KI-Guthaben: ${getAiBalanceLabel(balance?.balance || balance)}.`;
  return getBuiltSmartReasonMessage(access);
}

function getAiCreditSummaryMessage(balanceResult = {}) {
  if (!builtSmartState.user) return "Bitte zuerst einloggen. Danach kann BuiltSmart AI Guthaben geprüft oder gekauft werden.";
  if (!balanceResult.ok) return getBuiltSmartReasonMessage(balanceResult);
  return `BuiltSmart AI Guthaben: ${getAiBalanceLabel(balanceResult.balance)}.`;
}

function getBuiltSmartReasonMessage(result = {}) {
  if (result.reason === "config_missing") {
    return `Zentrale BuiltSmart Konfiguration fehlt noch: ${(result.missing || builtSmartState.configStatus.missing).join(", ")}.`;
  }

  const messages = {
    not_authenticated: "Bitte zuerst per E-Mail/Magic Link einloggen.",
    invalid_email: "Bitte eine gültige E-Mail-Adresse eingeben.",
    no_entitlement: "Für diese App ist noch keine aktive Lizenz vorhanden.",
    trial_already_used: "Der Free Trial wurde für diesen Nutzerzugriff bereits genutzt.",
    trial_expired: "Der Free Trial ist abgelaufen. Bitte Jahreslizenz aktivieren oder kaufen.",
    license_expired: "Die Lizenz ist abgelaufen oder gekündigt.",
    code_not_found: "Dieser Lizenzschlüssel wurde nicht gefunden.",
    code_inactive: "Dieser Lizenzschlüssel ist nicht aktiv.",
    code_fully_redeemed: "Dieser Lizenzschlüssel wurde bereits vollständig eingelöst.",
    invalid_quantity: "Die gewählte Lizenzanzahl ist ungültig.",
    plan_not_found: "Der angeforderte Checkout-Plan wurde im Backend nicht gefunden.",
    checkout_failed: "Checkout konnte nicht erstellt werden.",
    insufficient_ai_credits: "Kein BuiltSmart AI Guthaben verfügbar.",
    no_app_access: "Für diese App besteht aktuell kein Zugriff.",
    provider_error: "Der KI-Anbieter hat die Anfrage nicht verarbeitet."
  };

  return result.message || messages[result.reason] || "BuiltSmart Anfrage konnte nicht verarbeitet werden.";
}

function formatDate(value) {
  if (!value) return "unbekannt";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "unbekannt" : date.toLocaleDateString("de-DE");
}

function maskApiKey(key) {
  if (!key) return "";
  const visiblePrefix = key.slice(0, Math.min(7, key.length));
  return `${visiblePrefix}••••••••`;
}

function normalizeKeyInput(value) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("•")) return "";
  return trimmed;
}

function isPlausibleApiKey(value) {
  return /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(value.trim());
}

function isValidEmailInput(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function ensureApiKeyForAction() {
  const candidate = normalizeKeyInput(elements.apiKey.value);
  if (candidate) {
    if (!isPlausibleApiKey(candidate)) {
      setKeyFeedback("Der eingegebene Wert sieht nicht wie ein Anthropic API-Key aus. Bitte prüfe ihn und klicke Speichern.", "error");
      setStatus("API-Key fehlt", "warn");
      renderApiKeyComponent({ keepInput: true });
      return false;
    }

    apiKeyState.value = candidate;
  }

  if (!apiKeyState.value || !isPlausibleApiKey(apiKeyState.value)) {
    setKeyFeedback("Bitte speichere zuerst einen Anthropic API-Key.", "error");
    setStatus("API-Key fehlt", "warn");
    setApiKeyPanelOpen(true);
    renderApiKeyComponent();
    return false;
  }

  return true;
}

function handleApiFailure(error) {
  apiKeyState.isConnected = false;
  sessionStorage.removeItem(SESSION_KEY);
  setStatus("Fehler bei API-Anfrage", "danger");
  setKeyFeedback(getApiFeedbackMessage(error), "error");
  setApiKeyPanelOpen(true);
}

function setApiKeyPanelOpen(isOpen) {
  elements.apiKeyCard.open = isOpen;
}

function getApiFeedbackMessage(error) {
  if (error?.code === "INVALID_API_KEY") {
    return "API-Key ungültig. Bitte neuen Schlüssel einfügen, speichern und Verbindung überprüfen.";
  }

  return `Verbindung fehlgeschlagen: ${error.message}`;
}

function getApiRecoveryHint(error) {
  if (error?.code === "INVALID_API_KEY") {
    return "Hinweis: Die Verbindung zur App funktioniert. Ersetze den API-Key im Einstellungsbereich und klicke danach auf Speichern und Verbindung überprüfen.";
  }

  if (error?.code === "PERMISSION_DENIED") {
    return "Hinweis: Prüfe im Anthropic-Konto, ob dein Key Zugriff auf Claude Sonnet 4 hat.";
  }

  return "Hinweis: Prüfe Internetverbindung, API-Key und den gewählten Anthropic-Modellzugriff.";
}

function setApiBusy(isBusy, action = "", message = "") {
  apiKeyState.isBusy = isBusy;
  apiKeyState.busyAction = isBusy ? action : "";
  elements.saveKeyBtn.disabled = isBusy;
  elements.connectBtn.disabled = isBusy;
  elements.testConnectionBtn.disabled = isBusy;
  elements.disconnectBtn.disabled = isBusy;
  if (message) setKeyFeedback(message, "loading");
  renderApiKeyComponent({ keepInput: true });
}

function setButtonLoading(button, isLoading) {
  button.classList.toggle("is-loading", isLoading);
}

function setSummaryButtonsDisabled(isDisabled) {
  elements.summarizeBtn.disabled = isDisabled;
  setButtonLoading(elements.summarizeBtn, isDisabled);
}

function setKeyFeedback(message, type) {
  elements.keyFeedback.textContent = message;
  elements.keyFeedback.classList.remove("success", "error", "loading", "info");
  elements.keyFeedback.classList.add(type);
}

async function copySummary() {
  const summary = currentSummaryText.trim();
  if (!summary || summary === "Noch keine Zusammenfassung erstellt.") return;

  await navigator.clipboard.writeText(summary);
  setStatus("Ausgabe fertig", "ready");
}

function exportSummary(extension) {
  const summary = currentSummaryText.trim();
  if (!summary || summary === "Noch keine Zusammenfassung erstellt.") return;

  const mime = extension === "md" ? "text/markdown" : "text/plain";
  const blob = new Blob([summary], { type: `${mime};charset=utf-8` });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `smart-summary.${extension}`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function exportSummaryHtml() {
  const summary = currentSummaryText.trim();
  if (!summary || summary === "Noch keine Zusammenfassung erstellt.") return;

  const title = `SMART Summary Export - ${new Date().toLocaleDateString("de-DE")}`;
  const html = [
    "<!DOCTYPE html>",
    "<html lang=\"de\">",
    "<head>",
    "<meta charset=\"UTF-8\">",
    `<title>${escapeHtml(title)}</title>`,
    "<style>",
    "body{font-family:Inter,Arial,sans-serif;max-width:880px;margin:40px auto;padding:0 24px;color:#142033;line-height:1.55}",
    "h1{font-size:24px;margin-bottom:8px} .meta{color:#607086;margin-bottom:28px}",
    "table{width:100%;border-collapse:collapse} th,td{border:1px solid #d8e0ea;padding:8px;text-align:left;vertical-align:top} th{background:#f1f6fc}",
    "</style>",
    "</head>",
    "<body>",
    "<h1>SMART Summary Export</h1>",
    `<p class=\"meta\">${escapeHtml(new Date().toLocaleString("de-DE"))}</p>`,
    renderStructuredOutput(summary),
    "</body>",
    "</html>"
  ].join("\n");

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "smart-summary.html";
  link.click();
  URL.revokeObjectURL(link.href);
}

function exportLocalAppData() {
  const payload = {
    schema: "builtsmart-local-app-data",
    appKey: BUILTSMART_CONFIG.appKey,
    appName: BUILTSMART_CONFIG.appName,
    exportedAt: new Date().toISOString(),
    data: {
      sourceText: elements.sourceText.value,
      currentSummaryText,
      pdfStatus: elements.pdfStatus.textContent,
      history: loadHistory(),
      profiles: loadCustomProfiles(),
      settings: getCurrentSummarySettings()
    }
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `smart-summary-local-data-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  setBackupFeedback("Lokale App-Daten exportiert. Lizenzdaten, Sessions und API-Keys wurden nicht exportiert.", "success");
}

async function handleImportLocalAppData(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const payload = JSON.parse(await file.text());
    if (payload.schema !== "builtsmart-local-app-data" || payload.appKey !== BUILTSMART_CONFIG.appKey) {
      throw new Error("Diese JSON-Datei gehört nicht zu dieser App oder hat ein unbekanntes Format.");
    }

    const data = payload.data || {};
    elements.sourceText.value = String(data.sourceText || "");
    clearVisualPdfState();
    elements.pdfInput.value = "";
    elements.pdfStatus.textContent = data.pdfStatus || "Keine Datei ausgewählt";
    setSummaryOutput(data.currentSummaryText || "Noch keine Zusammenfassung erstellt.", !data.currentSummaryText || data.currentSummaryText === "Noch keine Zusammenfassung erstellt.");

    if (Array.isArray(data.history)) saveHistory(data.history);
    if (Array.isArray(data.profiles)) saveCustomProfiles(data.profiles);
    if (data.settings) applyImportedSummarySettings(data.settings);

    updateCharacterCount();
    renderProfiles();
    renderHistory();
    setViewMode(getDefaultViewMode());
    setBackupFeedback("Lokale App-Daten importiert. Lizenzdaten, Sessions und API-Keys wurden nicht verändert.", "success");
  } catch (error) {
    setBackupFeedback(error.message || "Import fehlgeschlagen.", "error");
  } finally {
    elements.importAppDataInput.value = "";
  }
}

function getCurrentSummarySettings() {
  return {
    template: elements.templateSelect.value,
    length: elements.lengthSelect.value,
    language: elements.languageSelect.value,
    focus: elements.focusSelect.value,
    format: elements.formatSelect.value,
    audience: elements.audienceSelect.value,
    tone: elements.toneSelect.value,
    actionMode: elements.actionModeSelect.value
  };
}

function applyImportedSummarySettings(settings) {
  setSelectValue(elements.templateSelect, settings.template);
  setSelectValue(elements.lengthSelect, settings.length);
  setSelectValue(elements.languageSelect, settings.language);
  setSelectValue(elements.focusSelect, settings.focus);
  setSelectValue(elements.formatSelect, settings.format);
  setSelectValue(elements.audienceSelect, settings.audience);
  setSelectValue(elements.toneSelect, settings.tone);
  setSelectValue(elements.actionModeSelect, settings.actionMode);
  workflowState.settingsTouched = true;
  persistSettings();
  updateWorkflowState();
}

function setBackupFeedback(message, type) {
  elements.backupFeedback.textContent = message;
  elements.backupFeedback.classList.remove("success", "error", "loading", "info");
  elements.backupFeedback.classList.add(type);
}

function printSummaryAsPdf() {
  const summary = currentSummaryText.trim();
  if (!summary || summary === "Noch keine Zusammenfassung erstellt.") return;
  window.print();
}

function resetWorkspace() {
  const hasSource = elements.sourceText.value.trim().length > 0 || Boolean(visualPdfState.base64);
  const hasSummary = currentSummaryText.trim() && currentSummaryText !== "Noch keine Zusammenfassung erstellt.";

  if ((hasSource || hasSummary) && !window.confirm("Arbeitsbereich wirklich leeren? Quelle und aktuelles Ergebnis werden entfernt. API-Key, Lizenz und Verlauf bleiben erhalten.")) {
    return;
  }

  elements.sourceText.value = "";
  clearVisualPdfState();
  elements.pdfInput.value = "";
  elements.pdfStatus.textContent = "Keine Datei ausgewählt";
  workflowState.settingsTouched = false;
  setSummaryOutput("Noch keine Zusammenfassung erstellt.", true);
  updateCharacterCount();
  setViewMode(getDefaultViewMode());
  setStatus(apiKeyState.value ? "Bereit" : "API-Key fehlt", apiKeyState.value ? "ready" : "warn");
}

function clearSummaryResult() {
  setSummaryOutput("Noch keine Zusammenfassung erstellt.", true);
  setStatus("Ergebnis gelöscht", "ready");
}

function loadHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(items) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY_ITEMS)));
}

function saveSummaryToHistory(summary) {
  const text = summary.trim();
  if (!text) return;

  const source = elements.sourceText.value.trim() || (visualPdfState.fileName ? `[Visuelle PDF-Analyse: ${visualPdfState.fileName}]` : "");
  const item = {
    id: String(Date.now()),
    createdAt: new Date().toISOString(),
    summary: text,
    source,
    sourcePreview: source.slice(0, 140),
    template: elements.templateSelect.value,
    length: elements.lengthSelect.value,
    format: elements.formatSelect.value,
    language: elements.languageSelect.value,
    focus: elements.focusSelect.value,
    tone: elements.toneSelect.value,
    actionMode: elements.actionModeSelect.value,
    audience: elements.audienceSelect.value
  };

  const history = loadHistory().filter((entry) => entry.summary !== text);
  saveHistory([item, ...history]);
  renderHistory();
}

function renderHistory() {
  const history = loadHistory();
  elements.clearHistoryBtn.disabled = history.length === 0;

  if (!history.length) {
    elements.historyList.innerHTML = '<p class="history-empty">Noch keine gespeicherte Zusammenfassung.</p>';
    return;
  }

  elements.historyList.innerHTML = history.map((item) => {
    const date = new Date(item.createdAt);
    const dateLabel = Number.isNaN(date.getTime())
      ? "Unbekanntes Datum"
      : date.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
    const meta = [
      item.template || "Zusammenfassung",
      item.format || "Format offen",
      item.language || "Sprache offen",
      item.audience || "Zielgruppe offen"
    ].join(" · ");
    return [
      `<article class="history-item">`,
      `<time datetime="${escapeHtml(item.createdAt || "")}">${escapeHtml(dateLabel)}</time>`,
      `<strong>${escapeHtml(meta)}</strong>`,
      `<p>${escapeHtml(item.sourcePreview || "Keine Quellenvorschau gespeichert.")}</p>`,
      `<div class="history-item-actions">`,
      `<button type="button" data-history-id="${escapeHtml(item.id)}">Laden</button>`,
      `<button type="button" class="danger" data-history-delete-id="${escapeHtml(item.id)}">Löschen</button>`,
      `</div>`,
      `</article>`
    ].join("");
  }).join("");
}

function handleHistoryClick(event) {
  const deleteButton = event.target.closest("[data-history-delete-id]");
  if (deleteButton) {
    deleteHistoryItem(deleteButton.dataset.historyDeleteId);
    return;
  }

  const button = event.target.closest("[data-history-id]");
  if (!button) return;

  const item = loadHistory().find((entry) => entry.id === button.dataset.historyId);
  if (!item) return;

  if (item.source) {
    clearVisualPdfState();
    elements.sourceText.value = item.source;
    elements.pdfStatus.textContent = "Quelle aus Verlauf geladen";
    updateCharacterCount();
  }

  applyHistorySettings(item);
  setSummaryOutput(item.summary);
  setViewMode("result");
  setStatus("Verlauf geladen", "ready");
}

function applyHistorySettings(item) {
  setSelectValue(elements.templateSelect, item.template);
  setSelectValue(elements.lengthSelect, item.length);
  setSelectValue(elements.languageSelect, item.language);
  setSelectValue(elements.focusSelect, item.focus);
  setSelectValue(elements.formatSelect, item.format);
  setSelectValue(elements.audienceSelect, item.audience);
  setSelectValue(elements.toneSelect, item.tone);
  setSelectValue(elements.actionModeSelect, item.actionMode);
  workflowState.settingsTouched = true;
  elements.profileSelect.value = "";
  updateProfileActions();
  persistSettings();
  updateWorkflowState();
}

function deleteHistoryItem(id) {
  const history = loadHistory();
  const nextHistory = history.filter((entry) => entry.id !== id);
  if (nextHistory.length === history.length) return;

  saveHistory(nextHistory);
  renderHistory();
  setStatus("Verlaufseintrag gelöscht", "ready");
}

function clearHistory() {
  const history = loadHistory();
  if (!history.length) return;
  if (!window.confirm("Verlauf wirklich leeren? Die gespeicherten Zusammenfassungen werden aus diesem Browser entfernt.")) return;

  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
  setStatus("Verlauf geleert", "ready");
}

function shortPause() {
  return new Promise((resolve) => window.setTimeout(resolve, 250));
}
