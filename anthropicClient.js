export const DEFAULT_MODEL = "claude-sonnet-4-20250514";

export function buildPrompts({ text, length, language, focus, format }) {
  const lengthMap = {
    short: "Kurz: exakt 2 bis 3 präzise Sätze.",
    medium: "Mittel: ein kompakter, gut lesbarer Absatz.",
    detailed: "Detailliert: strukturierte Stichpunkte mit klaren Unterpunkten, sofern sinnvoll."
  };

  const systemPrompt = [
    "Du bist ein professioneller Analyse- und Zusammenfassungsassistent für Business-Nutzer.",
    "Fasse ausschließlich den bereitgestellten Inhalt zusammen.",
    "Ergänze keine unbelegten Aussagen und erfinde keine Fakten.",
    "Übernimm Zahlen, Fakten, Namen, Einschränkungen und Unsicherheiten korrekt.",
    "Mache Widersprüche, fehlende Angaben oder Unklarheiten kenntlich, wenn sie für das Verständnis relevant sind.",
    `Halte die Ausgabesprache strikt ein: ${language}.`,
    `Halte die gewünschte Länge strikt ein: ${lengthMap[length]}.`,
    `Berücksichtige konsequent diesen Fokus: ${focus}.`,
    `Nutze exakt dieses Ausgabeformat: ${format}.`
  ].join("\n");

  const userPrompt = [
    "Analysiere und fasse den folgenden Inhalt zusammen.",
    "",
    "Anforderungen:",
    `- Sprache: ${language}`,
    `- Länge: ${lengthMap[length]}`,
    `- Fokus: ${focus}`,
    `- Ausgabeformat: ${format}`,
    "- Keine unbelegten Ergänzungen.",
    "- Fakten, Zahlen und Einschränkungen präzise übernehmen.",
    "- Bei Tabellenformat eine sauber lesbare Markdown-Tabelle verwenden.",
    "",
    "Inhalt:",
    text
  ].join("\n");

  return { systemPrompt, userPrompt };
}

export async function requestClaudeSummary({ apiKey, proxyUrl, model, text, length, language, focus, format }) {
  const { systemPrompt, userPrompt } = buildPrompts({ text, length, language, focus, format });

  const response = await fetch(proxyUrl || "/api/anthropic/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey
    },
    body: JSON.stringify({
      model: model || DEFAULT_MODEL,
      max_tokens: resolveTokenBudget(length, format),
      temperature: 0.2,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt
        }
      ]
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw createAnthropicError(payload, response.status);
  }

  const textBlocks = Array.isArray(payload.content)
    ? payload.content.filter((block) => block.type === "text").map((block) => block.text)
    : [];

  const summary = textBlocks.join("\n\n").trim();
  if (!summary) {
    throw new Error("Claude hat keine lesbare Zusammenfassung zurückgegeben.");
  }

  return summary;
}

export async function testClaudeConnection({ apiKey, proxyUrl, model }) {
  const response = await fetch(proxyUrl || "/api/anthropic/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey
    },
    body: JSON.stringify({
      model: model || DEFAULT_MODEL,
      max_tokens: 12,
      temperature: 0,
      system: "Antworte ausschließlich mit OK.",
      messages: [
        {
          role: "user",
          content: "Teste die Verbindung. Antworte nur mit OK."
        }
      ]
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw createAnthropicError(payload, response.status);
  }

  return true;
}

function resolveTokenBudget(length, format) {
  if (format === "Tabelle" || length === "detailed") return 1800;
  if (length === "short") return 500;
  return 900;
}

function createAnthropicError(payload, status) {
  const rawMessage = payload?.error?.message || payload?.message || `API-Anfrage fehlgeschlagen (${status})`;
  const rawType = payload?.error?.type || "";
  const normalized = `${rawType} ${rawMessage}`.toLowerCase();
  const error = new Error(rawMessage);

  if (status === 401 || normalized.includes("invalid x-api-key") || normalized.includes("authentication")) {
    error.code = "INVALID_API_KEY";
    error.message = "Anthropic hat den API-Key abgelehnt. Bitte prüfe, ob der Schlüssel vollständig und aktiv ist, und speichere ihn erneut.";
    return error;
  }

  if (status === 403 || normalized.includes("permission")) {
    error.code = "PERMISSION_DENIED";
    error.message = "Der API-Key ist gültig, hat aber keinen Zugriff auf dieses Modell oder diese Anfrage.";
    return error;
  }

  error.code = "ANTHROPIC_API_ERROR";
  return error;
}
