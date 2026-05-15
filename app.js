import { requestClaudeSummary, testClaudeConnection } from "./anthropicClient.js";
import { extractTextFromPdf } from "./pdfExtractor.js";
import { extractTextFromDocx } from "./docxExtractor.js";
import {
  clearLicenseSession,
  loadStoredLicense,
  normalizeLicenseKey,
  saveLicenseKey,
  setLicenseSessionActive,
  verifyLicenseKey
} from "./licenseClient.js";

const MAX_CHARS = 180000;
const RECOMMENDED_CHARS = 100000;
const STORAGE_KEY = "smart-summary-anthropic-key";
const SESSION_KEY = "smart-summary-session-active";
const DEFAULT_PROXY_URL = "/api/anthropic/messages";
const DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-20250514";

const apiKeyState = {
  value: "",
  isVisible: false,
  isConnected: false,
  isBusy: false
};

const licenseState = {
  key: "",
  active: false,
  isBusy: false
};

const elements = {
  sourceText: document.querySelector("#sourceText"),
  charCount: document.querySelector("#charCount"),
  textQuality: document.querySelector("#textQuality"),
  pdfInput: document.querySelector("#pdfInput"),
  dropZone: document.querySelector("#dropZone"),
  fileSelectBtn: document.querySelector("#fileSelectBtn"),
  pdfStatus: document.querySelector("#pdfStatus"),
  apiKey: document.querySelector("#apiKey"),
  rememberKey: document.querySelector("#rememberKey"),
  toggleKey: document.querySelector("#toggleKey"),
  apiKeyCard: document.querySelector(".api-key-card"),
  apiKeyDetails: document.querySelector("#apiKeyDetails"),
  keyHint: document.querySelector("#keyHint"),
  keyFeedback: document.querySelector("#keyFeedback"),
  connectionBadge: document.querySelector("#connectionBadge"),
  saveKeyBtn: document.querySelector("#saveKeyBtn"),
  connectBtn: document.querySelector("#connectBtn"),
  testConnectionBtn: document.querySelector("#testConnectionBtn"),
  disconnectBtn: document.querySelector("#disconnectBtn"),
  licenseKey: document.querySelector("#licenseKey"),
  saveLicenseBtn: document.querySelector("#saveLicenseBtn"),
  verifyLicenseBtn: document.querySelector("#verifyLicenseBtn"),
  licenseBadge: document.querySelector("#licenseBadge"),
  licenseFeedback: document.querySelector("#licenseFeedback"),
  lengthSelect: document.querySelector("#lengthSelect"),
  languageSelect: document.querySelector("#languageSelect"),
  focusSelect: document.querySelector("#focusSelect"),
  formatSelect: document.querySelector("#formatSelect"),
  summarizeBtn: document.querySelector("#summarizeBtn"),
  summaryOutput: document.querySelector("#summaryOutput"),
  copyBtn: document.querySelector("#copyBtn"),
  exportMdBtn: document.querySelector("#exportMdBtn"),
  exportTxtBtn: document.querySelector("#exportTxtBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  statusText: document.querySelector("#statusText"),
  statusDot: document.querySelector("#statusDot")
};

init();

function init() {
  const savedKey = localStorage.getItem(STORAGE_KEY);
  const savedLicense = loadStoredLicense();
  licenseState.key = savedLicense.key;
  licenseState.active = savedLicense.active;

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
  renderApiKeyComponent();
  renderLicenseComponent();
  setApiKeyPanelOpen(false);
  setKeyFeedback(hasSavedKey ? "Gespeicherter API-Key geladen." : "Noch kein gültiger API-Key gespeichert.", hasSavedKey ? "success" : "info");
  setStatus(hasSavedKey ? "Bereit" : "API-Key fehlt", hasSavedKey ? "ready" : "warn");
}

function bindEvents() {
  elements.sourceText.addEventListener("input", () => {
    updateCharacterCount();
    const hasText = elements.sourceText.value.trim().length > 0;
    setStatus(hasText ? "Text erkannt" : "Bereit", "ready");
  });

  elements.pdfInput.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) processSelectedFile(file);
  });
  elements.fileSelectBtn.addEventListener("click", () => elements.pdfInput.click());
  elements.dropZone.addEventListener("dragenter", handleDragEnter);
  elements.dropZone.addEventListener("dragover", handleDragEnter);
  elements.dropZone.addEventListener("dragleave", handleDragLeave);
  elements.dropZone.addEventListener("drop", handleFileDrop);
  elements.summarizeBtn.addEventListener("click", handleSummarize);
  elements.copyBtn.addEventListener("click", copySummary);
  elements.exportMdBtn.addEventListener("click", () => exportSummary("md"));
  elements.exportTxtBtn.addEventListener("click", () => exportSummary("txt"));
  elements.resetBtn.addEventListener("click", resetWorkspace);
  elements.saveKeyBtn.addEventListener("click", handleSaveKey);
  elements.connectBtn.addEventListener("click", handleConnect);
  elements.testConnectionBtn.addEventListener("click", handleConnectionTest);
  elements.disconnectBtn.addEventListener("click", handleDisconnect);
  elements.saveLicenseBtn.addEventListener("click", handleSaveLicense);
  elements.verifyLicenseBtn.addEventListener("click", handleVerifyLicense);
  elements.licenseKey.addEventListener("input", () => {
    licenseState.active = false;
    clearLicenseSession();
    renderLicenseComponent();
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
  elements.rememberKey.addEventListener("change", () => {
    persistSettings();
    setKeyFeedback(elements.rememberKey.checked ? "Lokale Speicherung aktiviert." : "Lokale Speicherung deaktiviert.", "info");
  });
}

function handleSaveLicense() {
  const key = normalizeLicenseKey(elements.licenseKey.value);
  licenseState.key = key;
  licenseState.active = false;
  clearLicenseSession();
  saveLicenseKey(key);
  setLicenseFeedback(key ? "Lizenzschlüssel gespeichert. Bitte Lizenz prüfen." : "Bitte Lizenzschlüssel eingeben.", key ? "info" : "error");
  renderLicenseComponent();
}

async function handleVerifyLicense() {
  const key = normalizeLicenseKey(elements.licenseKey.value || licenseState.key);
  licenseState.isBusy = true;
  renderLicenseComponent();
  setLicenseFeedback("Lizenz wird geprüft...", "loading");

  try {
    const result = await verifyLicenseKey(key);
    licenseState.key = result.licenseKey;
    licenseState.active = true;
    saveLicenseKey(result.licenseKey);
    setLicenseSessionActive();
    setLicenseFeedback(`Lizenz aktiv (${result.plan}).`, "success");
  } catch (error) {
    licenseState.active = false;
    clearLicenseSession();
    setLicenseFeedback(error.message, "error");
  } finally {
    licenseState.isBusy = false;
    renderLicenseComponent();
  }
}

function handleSaveKey() {
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

  apiKeyState.isConnected = false;
  sessionStorage.removeItem(SESSION_KEY);
  persistSettings();
  renderApiKeyComponent();
  setKeyFeedback(elements.rememberKey.checked ? "API-Key lokal gespeichert." : "API-Key für diese Sitzung übernommen.", "success");
  setStatus("Bereit", "ready");
}

async function handleConnect() {
  if (!ensureApiKeyForAction()) return;

  setApiBusy(true, "Verbindung wird vorbereitet...");
  await shortPause();
  apiKeyState.isConnected = true;
  sessionStorage.setItem(SESSION_KEY, "true");
  setApiBusy(false);
  renderApiKeyComponent();
  setKeyFeedback("Verbindung aktiv. Für technische Prüfung nutze Verbindung überprüfen.", "success");
  setStatus("Bereit", "ready");
}

async function handleConnectionTest() {
  if (!ensureApiKeyForAction()) return;

  setApiBusy(true, "Verbindung wird überprüft...");
  setStatus("Analyse läuft", "warn");

  try {
    await testClaudeConnection({
      apiKey: apiKeyState.value,
      proxyUrl: DEFAULT_PROXY_URL,
      model: DEFAULT_CLAUDE_MODEL
    });

    apiKeyState.isConnected = true;
    sessionStorage.setItem(SESSION_KEY, "true");
    setKeyFeedback("Verbindung erfolgreich geprüft.", "success");
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

async function processSelectedFile(file) {
  try {
    setStatus("Text erkannt", "ready");
    elements.pdfStatus.textContent = `${file.name} wird ausgelesen...`;
    const extractedText = await extractTextFromFile(file);

    if (!extractedText.trim()) {
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

  if (file.type === "application/pdf" || extension === "pdf") {
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

async function handleSummarize() {
  const text = elements.sourceText.value.trim();
  const apiKey = apiKeyState.value;

  if (!apiKey) {
    setStatus("API-Key fehlt", "warn");
    elements.summaryOutput.textContent = "Bitte trage im Einstellungsbereich deinen Anthropic API-Key ein.";
    return;
  }

  if (!text) {
    setStatus("Fehler bei Verarbeitung", "danger");
    elements.summaryOutput.textContent = "Bitte füge zuerst einen Text ein oder lade eine PDF-Datei hoch.";
    return;
  }

  if (text.length > MAX_CHARS) {
    setStatus("Fehler bei Verarbeitung", "danger");
    elements.summaryOutput.textContent = `Der Text ist mit ${text.length.toLocaleString("de-DE")} Zeichen zu groß. Bitte kürze ihn auf maximal ${MAX_CHARS.toLocaleString("de-DE")} Zeichen.`;
    return;
  }

  persistSettings();
  elements.summarizeBtn.disabled = true;

  try {
    setStatus("Analyse läuft", "warn");
    await shortPause();
    setStatus("Zusammenfassung wird erstellt", "warn");

    const summary = await requestClaudeSummary({
      apiKey,
      proxyUrl: DEFAULT_PROXY_URL,
      model: DEFAULT_CLAUDE_MODEL,
      text,
      length: elements.lengthSelect.value,
      language: elements.languageSelect.value,
      focus: elements.focusSelect.value,
      format: elements.formatSelect.value
    });

    setStatus("Qualität wird geprüft", "warn");
    await shortPause();
    elements.summaryOutput.textContent = summary;
    setStatus("Ausgabe fertig", "ready");
  } catch (error) {
    handleApiFailure(error);
    elements.summaryOutput.textContent = [
      "Die Anfrage konnte nicht verarbeitet werden.",
      "",
      error.message,
      "",
      getApiRecoveryHint(error)
    ].join("\n");
  } finally {
    elements.summarizeBtn.disabled = false;
  }
}

function updateCharacterCount() {
  const count = elements.sourceText.value.length;
  elements.charCount.textContent = `${count.toLocaleString("de-DE")} Zeichen`;
  elements.charCount.classList.toggle("warn", count > RECOMMENDED_CHARS && count <= MAX_CHARS);
  elements.charCount.classList.toggle("danger", count > MAX_CHARS);
  updateTextQuality(count);
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
  elements.statusText.textContent = label === "Bereit" ? "System bereit" : label;
  elements.statusDot.classList.toggle("warn", type === "warn");
  elements.statusDot.classList.toggle("danger", type === "danger");
}

function persistSettings() {
  if (elements.rememberKey.checked && apiKeyState.value) {
    localStorage.setItem(STORAGE_KEY, apiKeyState.value);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }

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
  elements.connectBtn.textContent = apiKeyState.isConnected ? "Verbindung OK" : "Verbindung";
  elements.connectBtn.classList.toggle("is-connected", apiKeyState.isConnected);
  elements.connectBtn.setAttribute("aria-pressed", String(apiKeyState.isConnected));
  elements.keyHint.textContent = apiKeyState.value
    ? "Gespeicherter Key wird teilweise angezeigt. Das Auge zeigt den vollständigen Schlüssel."
    : "Gib deinen Anthropic API-Key ein. Ohne Key wird keine KI-Anfrage gesendet.";

  setButtonLoading(elements.saveKeyBtn, apiKeyState.isBusy);
  elements.saveKeyBtn.disabled = apiKeyState.isBusy;
  elements.connectBtn.disabled = apiKeyState.isBusy || !apiKeyState.value;
  elements.testConnectionBtn.disabled = apiKeyState.isBusy || !apiKeyState.value;
  elements.disconnectBtn.disabled = apiKeyState.isBusy || !apiKeyState.isConnected;
}

function renderLicenseComponent() {
  if (licenseState.key && elements.licenseKey.value !== licenseState.key) {
    elements.licenseKey.value = licenseState.key;
  }

  elements.licenseBadge.textContent = licenseState.active ? "Lizenz aktiv" : "Nicht aktiviert";
  elements.licenseBadge.classList.toggle("is-connected", licenseState.active);
  elements.saveLicenseBtn.disabled = licenseState.isBusy;
  elements.verifyLicenseBtn.disabled = licenseState.isBusy || !elements.licenseKey.value.trim();
}

function setLicenseFeedback(message, type) {
  elements.licenseFeedback.textContent = message;
  elements.licenseFeedback.classList.remove("success", "error", "loading", "info");
  elements.licenseFeedback.classList.add(type);
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
    return "Hinweis: Der lokale Proxy funktioniert. Ersetze den API-Key im Einstellungsbereich und klicke danach auf Speichern und Verbindung überprüfen.";
  }

  if (error?.code === "PERMISSION_DENIED") {
    return "Hinweis: Prüfe im Anthropic-Konto, ob dein Key Zugriff auf Claude Sonnet 4 hat.";
  }

  return "Hinweis: Prüfe lokalen Proxy, Internetverbindung, API-Key und den gewählten Anthropic-Modellzugriff.";
}

function setApiBusy(isBusy, message = "") {
  apiKeyState.isBusy = isBusy;
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

function setKeyFeedback(message, type) {
  elements.keyFeedback.textContent = message;
  elements.keyFeedback.classList.remove("success", "error", "loading", "info");
  elements.keyFeedback.classList.add(type);
}

async function copySummary() {
  const summary = elements.summaryOutput.textContent.trim();
  if (!summary || summary === "Noch keine Zusammenfassung erstellt.") return;

  await navigator.clipboard.writeText(summary);
  setStatus("Ausgabe fertig", "ready");
}

function exportSummary(extension) {
  const summary = elements.summaryOutput.textContent.trim();
  if (!summary || summary === "Noch keine Zusammenfassung erstellt.") return;

  const mime = extension === "md" ? "text/markdown" : "text/plain";
  const blob = new Blob([summary], { type: `${mime};charset=utf-8` });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `smart-summary.${extension}`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function resetWorkspace() {
  elements.sourceText.value = "";
  elements.pdfInput.value = "";
  elements.pdfStatus.textContent = "Keine Datei ausgewählt";
  elements.summaryOutput.textContent = "Noch keine Zusammenfassung erstellt.";
  updateCharacterCount();
  setStatus(apiKeyState.value ? "Bereit" : "API-Key fehlt", apiKeyState.value ? "ready" : "warn");
}

function shortPause() {
  return new Promise((resolve) => window.setTimeout(resolve, 250));
}
