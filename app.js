import { requestClaudePdfSummary, requestClaudeSummary, testClaudeConnection } from "./anthropicClient.js";
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
const HISTORY_KEY = "smart-summary-history";
const PROFILE_KEY = "smart-summary-profiles";
const MAX_HISTORY_ITEMS = 20;
const DEFAULT_PROXY_URL = resolveLocalProxyUrl("/api/anthropic/messages");
const DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-20250514";
const DEMO_LICENSE_KEY = "SMART-DEMO-2026-LOCAL";
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

const licenseState = {
  key: "",
  active: false,
  isBusy: false
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
  apiKeyCard: document.querySelector("#apiKeyCard"),
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
  useDemoLicenseBtn: document.querySelector("#useDemoLicenseBtn"),
  licenseBadge: document.querySelector("#licenseBadge"),
  licenseFeedback: document.querySelector("#licenseFeedback"),
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
  helpSearch: document.querySelector("#helpSearch"),
  helpToggle: document.querySelector("#helpToggle"),
  helpButton: document.querySelector(".help-button"),
  helpClose: document.querySelector(".modal-close"),
  helpSections: document.querySelectorAll("[data-help-section]"),
  helpEmpty: document.querySelector("#helpEmpty")
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
  setViewMode(getDefaultViewMode());
  renderProfiles();
  renderApiKeyComponent();
  renderLicenseComponent();
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
  elements.saveKeyBtn.addEventListener("click", handleSaveKey);
  elements.connectBtn.addEventListener("click", handleConnect);
  elements.testConnectionBtn.addEventListener("click", handleConnectionTest);
  elements.disconnectBtn.addEventListener("click", handleDisconnect);
  elements.saveLicenseBtn.addEventListener("click", handleSaveLicense);
  elements.verifyLicenseBtn.addEventListener("click", handleVerifyLicense);
  elements.useDemoLicenseBtn.addEventListener("click", useDemoLicense);
  elements.applyProfileBtn.addEventListener("click", applySelectedProfile);
  elements.saveProfileBtn.addEventListener("click", saveCurrentProfile);
  elements.deleteProfileBtn.addEventListener("click", deleteSelectedProfile);
  elements.profileSelect.addEventListener("change", () => {
    updateProfileActions();
    applySelectedProfile();
  });
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

function handleSaveLicense() {
  const key = normalizeLicenseKey(elements.licenseKey.value);
  licenseState.key = key;
  licenseState.active = false;
  clearLicenseSession();
  saveLicenseKey(key);
  setLicenseFeedback(key ? "Lizenzschlüssel gespeichert. Bitte Lizenz prüfen." : "Bitte Lizenzschlüssel eingeben.", key ? "info" : "error");
  renderLicenseComponent();
}

function useDemoLicense() {
  elements.licenseKey.value = DEMO_LICENSE_KEY;
  licenseState.key = DEMO_LICENSE_KEY;
  licenseState.active = false;
  clearLicenseSession();
  saveLicenseKey(DEMO_LICENSE_KEY);
  renderLicenseComponent();
  setLicenseFeedback("Demo-Lizenz eingetragen. Klicke auf Lizenz prüfen.", "info");
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
  setKeyFeedback(elements.rememberKey.checked ? "API-Key in diesem Browser gespeichert." : "API-Key für diese Sitzung übernommen.", "success");
  setStatus("Bereit", "ready");
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
  const apiKey = apiKeyState.value;
  const hasVisualPdf = Boolean(visualPdfState.base64);

  if (!apiKey) {
    setStatus("API-Key fehlt", "warn");
    setSummaryOutput("Bitte trage im Einstellungsbereich deinen Anthropic API-Key ein.");
    return;
  }

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
  setSummaryButtonsDisabled(true);

  try {
    setStatus("Analyse läuft", "warn");
    await shortPause();
    setStatus("Zusammenfassung wird erstellt", "warn");

    const summary = hasVisualPdf
      ? await requestClaudePdfSummary({
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
      : await requestClaudeSummary({
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

    setStatus("Qualität wird geprüft", "warn");
    await shortPause();
    setSummaryOutput(summary);
    saveSummaryToHistory(summary);
    setViewMode("result");
    setStatus("Ausgabe fertig", "ready");
  } catch (error) {
    handleApiFailure(error);
    setSummaryOutput([
      "Die Anfrage konnte nicht verarbeitet werden.",
      "",
      error.message,
      "",
      getApiRecoveryHint(error)
    ].join("\n"));
  } finally {
    setSummaryButtonsDisabled(false);
  }
}

function setSummaryOutput(text, isPlaceholder = false) {
  currentSummaryText = text;
  if (isPlaceholder) {
    elements.summaryOutput.textContent = text;
  } else {
    elements.summaryOutput.innerHTML = renderStructuredOutput(text);
  }
  elements.summaryOutput.classList.toggle("is-placeholder", isPlaceholder);
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
  const hasOption = Array.from(select.options).some((option) => option.value === value);
  if (hasOption) select.value = value;
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

  setButtonLoading(elements.saveKeyBtn, apiKeyState.busyAction === "save");
  setButtonLoading(elements.connectBtn, apiKeyState.busyAction === "connect");
  setButtonLoading(elements.testConnectionBtn, apiKeyState.busyAction === "test");
  setButtonLoading(elements.disconnectBtn, apiKeyState.busyAction === "disconnect");
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
  setButtonLoading(elements.verifyLicenseBtn, licenseState.isBusy);
  elements.saveLicenseBtn.disabled = licenseState.isBusy;
  elements.verifyLicenseBtn.disabled = licenseState.isBusy || !elements.licenseKey.value.trim();
  elements.useDemoLicenseBtn.disabled = licenseState.isBusy;
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
  elements.profileSelect.value = "";
  updateProfileActions();
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
