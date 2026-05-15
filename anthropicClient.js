export const DEFAULT_MODEL = "claude-sonnet-4-20250514";

export function buildPrompts({ text, length, language, focus, format }) {
  const lengthMap = {
    short: "Kurz: exakt 2 bis 3 präzise Sätze.",
    medium: "Mittel: ein kompakter, gut lesbarer Absatz.",
    detailed: "Detailliert: strukturierte Stichpunkte mit klaren Unterpunkten, sofern sinnvoll."
  };

  const focusMap = {
    Allgemein: "Erstelle eine ausgewogene Gesamtsicht mit Zweck, Kontext, wichtigsten Inhalten und relevanten Schlussfolgerungen.",
    Kernaussagen: "Priorisiere die zentralen Aussagen, Hauptargumente und wirklich entscheidenden Botschaften. Lasse Nebenaspekte weg.",
    "Fakten und Zahlen": "Priorisiere belegte Fakten, Kennzahlen, Datumsangaben, Namen, Mengen, Quellenbezüge und Einschränkungen. Keine Zahl ohne Kontext wiedergeben.",
    Handlungsempfehlungen: "Leite nur Empfehlungen ab, die klar aus dem Inhalt begründbar sind. Trenne Empfehlung, Begründung und Voraussetzung.",
    "Pro und Contra": "Stelle Vorteile und Nachteile balanciert gegenüber. Benenne, wenn eine Seite im Ausgangstext schwächer belegt ist.",
    Risiken: "Priorisiere Risiken, Unsicherheiten, Abhängigkeiten, Annahmen, blinde Flecken und mögliche negative Folgen.",
    Chancen: "Priorisiere Potenziale, Nutzen, positive Effekte, Hebel, Wachstumsfelder und Bedingungen für Realisierung.",
    "Offene Fragen": "Identifiziere ungeklärte Punkte, fehlende Informationen, notwendige Entscheidungen und sinnvolle Rückfragen.",
    "Aufgaben und To-dos": "Extrahiere konkrete Aufgaben mit Ziel, möglichem Verantwortungsbereich, Abhängigkeiten und nächstem Schritt, soweit im Text belegbar.",
    "Kritische Punkte": "Hebe problematische Aussagen, Widersprüche, Schwachstellen, Annahmen, Risiken und Punkte mit Entscheidungsbedarf hervor.",
    "Management Summary": "Formuliere entscheidungsorientiert für Führungskräfte: Kontext, Bedeutung, Kernaussage, Auswirkungen und nächste Entscheidung."
  };

  const formatMap = {
    Fließtext: [
      "Gib einen klaren, professionellen Fließtext aus.",
      "Nutze kurze Absätze, wenn es die Lesbarkeit verbessert.",
      "Keine unnötigen Überschriften, sofern die gewählte Länge kurz oder mittel ist."
    ],
    Stichpunkte: [
      "Nutze prägnante Stichpunkte mit paralleler Satzstruktur.",
      "Beginne jeden Stichpunkt mit der wichtigsten Information.",
      "Gruppiere bei detaillierter Länge unter knappen Zwischenüberschriften."
    ],
    Tabelle: [
      "Erstelle eine sauber lesbare Markdown-Tabelle.",
      "Wähle aussagekräftige Spalten passend zum Fokus, z. B. Thema, Aussage, Evidenz, Relevanz, Risiko, nächster Schritt.",
      "Halte Zellen kurz und vermeide lange Fließtexte innerhalb der Tabelle."
    ],
    "Executive Summary": [
      "Strukturiere als Executive Summary für Entscheider.",
      "Empfohlene Struktur: Ausgangslage, wichtigste Erkenntnis, Auswirkungen, Risiken/Abhängigkeiten, nächster Schritt.",
      "Formuliere knapp, souverän und ohne Fachjargon, sofern der Ausgangstext ihn nicht erfordert."
    ],
    Entscheidungsnotiz: [
      "Strukturiere als Entscheidungsnotiz.",
      "Empfohlene Struktur: Entscheidungspunkt, Kurzbewertung, Optionen, Empfehlung, Begründung, Risiken, offene Punkte.",
      "Kennzeichne klar, wenn aus dem Text keine belastbare Empfehlung ableitbar ist."
    ]
  };

  const languageStyleMap = {
    Deutsch: "Verwende professionelles, klares Business-Deutsch.",
    Englisch: "Use clear, professional business English.",
    Französisch: "Utilise un français professionnel, clair et précis.",
    Spanisch: "Utiliza un español profesional, claro y preciso.",
    Italienisch: "Usa un italiano professionale, chiaro e preciso."
  };

  const resolvedLength = lengthMap[length] || lengthMap.medium;
  const resolvedFocus = focusMap[focus] || focusMap.Allgemein;
  const resolvedFormatRules = formatMap[format] || formatMap.Fließtext;
  const resolvedLanguageStyle = languageStyleMap[language] || `Halte die Ausgabesprache strikt ein: ${language}.`;

  const qualityRules = [
    "Arbeite wie ein Senior Business Analyst: präzise, entscheidungsorientiert, nüchtern und gut strukturiert.",
    "Fasse ausschließlich den bereitgestellten Inhalt zusammen.",
    "Ergänze keine unbelegten Aussagen und erfinde keine Fakten.",
    "Trenne belegte Aussagen von Interpretation, Empfehlung oder Unsicherheit.",
    "Übernimm Zahlen, Fakten, Namen, Datumsangaben, Einschränkungen und Unsicherheiten korrekt.",
    "Mache Widersprüche, fehlende Angaben oder Unklarheiten kenntlich, wenn sie für das Verständnis oder Entscheidungen relevant sind.",
    "Verdichte konsequent: keine Wiederholungen, keine Füllsätze, keine allgemeinen KI-Floskeln.",
    "Wenn Informationen fehlen, benenne die Lücke knapp statt zu spekulieren."
  ];

  const finalReviewRules = [
    "Prüfe vor der finalen Ausgabe intern, ob Sprache, Länge, Fokus und Format eingehalten sind.",
    "Prüfe intern, ob alle Zahlen und Fakten aus dem Inhalt korrekt übernommen wurden.",
    "Prüfe intern, ob keine nicht belegten Aussagen hinzugefügt wurden.",
    "Gib nur die finale Zusammenfassung aus, keine Erläuterung deiner Prüfung."
  ];

  const systemPrompt = [
    ...qualityRules,
    resolvedLanguageStyle,
    `Zielsprache: ${language}.`,
    `Gewünschte Länge: ${resolvedLength}`,
    `Fokus: ${focus}. ${resolvedFocus}`,
    `Ausgabeformat: ${format}.`,
    "Formatregeln:",
    ...resolvedFormatRules.map((rule) => `- ${rule}`),
    "Interne Endprüfung:",
    ...finalReviewRules.map((rule) => `- ${rule}`)
  ].join("\n");

  const userPrompt = [
    "Analysiere den folgenden Inhalt und erstelle daraus eine hochwertige professionelle Zusammenfassung.",
    "",
    "Verbindliche Ausgabeparameter:",
    `- Sprache: ${language}`,
    `- Länge: ${resolvedLength}`,
    `- Fokus: ${focus} (${resolvedFocus})`,
    `- Ausgabeformat: ${format}`,
    "",
    "Formatregeln:",
    ...resolvedFormatRules.map((rule) => `- ${rule}`),
    "",
    "Qualitätsstandard:",
    "- Keine unbelegten Ergänzungen.",
    "- Fakten, Zahlen, Namen, Datumsangaben und Einschränkungen präzise übernehmen.",
    "- Relevanz vor Vollständigkeit: Wichtiges priorisieren, Nebensächliches verdichten.",
    "- Widersprüche, Unklarheiten und fehlende Angaben kenntlich machen, wenn relevant.",
    "- Keine Einleitung wie 'Hier ist die Zusammenfassung'. Direkt mit der Ausgabe beginnen.",
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
