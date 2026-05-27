export const DEFAULT_MODEL = "claude-sonnet-4-20250514";

export function buildPrompts({
  text,
  length,
  language,
  focus,
  format,
  template = "Standard-Zusammenfassung",
  audience = "Allgemein",
  tone = "Neutral",
  actionMode = "Nur zusammenfassen"
}) {
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

  const templateMap = {
    "Standard-Zusammenfassung": [
      "Erstelle eine universell nutzbare Zusammenfassung ohne zusätzliche Spezialstruktur."
    ],
    "Meeting-Protokoll": [
      "Strukturiere als kompaktes Meeting-Protokoll.",
      "Bevorzuge die Abschnitte: Thema/Kontext, Beschlüsse, Aufgaben, offene Punkte, nächste Schritte.",
      "Nenne Verantwortliche, Termine oder Abhängigkeiten nur, wenn sie im Inhalt erkennbar sind."
    ],
    "Management Briefing": [
      "Strukturiere als Management Briefing für Führungskräfte.",
      "Bevorzuge die Abschnitte: Kernbotschaft, geschäftliche Relevanz, Auswirkungen, Risiken, empfohlene Entscheidung.",
      "Halte Formulierungen knapp, entscheidungsorientiert und belastbar."
    ],
    Risikoanalyse: [
      "Strukturiere als Risikoanalyse.",
      "Bevorzuge die Abschnitte: Hauptrisiken, Eintrittstreiber, Auswirkungen, Gegenmaßnahmen, offene Annahmen.",
      "Unterscheide klar zwischen belegtem Risiko und plausibler Unsicherheit."
    ],
    Projektstatus: [
      "Strukturiere als Projektstatus.",
      "Bevorzuge die Abschnitte: Status, Fortschritt, Blocker, Risiken, nächste Schritte.",
      "Kennzeichne unklare Ampel- oder Statusaussagen, wenn der Inhalt keine eindeutige Bewertung erlaubt."
    ],
    Entscheidungsvorlage: [
      "Strukturiere als Entscheidungsvorlage.",
      "Bevorzuge die Abschnitte: Entscheidungspunkt, Optionen, Bewertung, Empfehlung, Risiken, offene Punkte.",
      "Gib keine Empfehlung aus, wenn sie aus dem Inhalt nicht belastbar ableitbar ist."
    ],
    "To-do-Liste": [
      "Strukturiere als umsetzbare To-do-Liste.",
      "Bevorzuge kurze Aufgaben mit Ziel, Kontext, Priorität und nächstem Schritt.",
      "Nenne Verantwortliche oder Fristen nur, wenn sie im Inhalt enthalten sind."
    ]
  };

  const languageStyleMap = {
    Deutsch: "Verwende professionelles, klares Business-Deutsch.",
    Englisch: "Use clear, professional business English.",
    Französisch: "Utilise un français professionnel, clair et précis.",
    Spanisch: "Utiliza un español profesional, claro y preciso.",
    Italienisch: "Usa un italiano professionale, chiaro e preciso."
  };

  const audienceMap = {
    Allgemein: "Schreibe für eine fachlich gemischte Zielgruppe ohne unnötige Spezialbegriffe.",
    Management: "Schreibe für Entscheider: priorisiere Relevanz, Auswirkungen, Risiken und klare Entscheidungspunkte.",
    Fachteam: "Schreibe für ein Fachteam: nutze präzise Begriffe, fachliche Zusammenhänge und umsetzbare Details.",
    Kunde: "Schreibe kundenorientiert: klar, vertrauenswürdig, nutzenbezogen und ohne interne Annahmen offenzulegen.",
    Technisch: "Schreibe für technische Leser: benenne Systeme, Abhängigkeiten, Einschränkungen und technische Konsequenzen präzise.",
    Juristisch: "Schreibe mit juristischer Vorsicht: trenne Fakten, Risiken, Pflichten, offene Prüfungen und nicht belegte Bewertung strikt.",
    "Einfach verständlich": "Schreibe leicht verständlich: kurze Sätze, einfache Begriffe und erklärende Einordnung ohne Fachjargon."
  };

  const toneMap = {
    Neutral: "Nutze einen neutralen, sachlichen Ton.",
    Prägnant: "Formuliere besonders knapp, direkt und ohne Nebenformulierungen.",
    Formal: "Nutze einen formalen, geschäftlichen Stil mit klarer Struktur.",
    Beratend: "Formuliere beratend und lösungsorientiert, ohne unbelegte Empfehlungen zu erfinden.",
    Kritisch: "Prüfe kritisch: hebe Schwächen, Risiken, Widersprüche und fragliche Annahmen sichtbar hervor.",
    "Einfach erklärt": "Erkläre verständlich und ruhig, mit kurzen Sätzen und klarer Einordnung."
  };

  const actionModeMap = {
    "Nur zusammenfassen": "Fasse den Inhalt zusammen, ohne zusätzliche Empfehlungen oder nächste Schritte abzuleiten.",
    "Empfehlungen ergänzen": "Ergänze Empfehlungen nur, wenn sie eindeutig aus dem Inhalt ableitbar sind, und trenne sie von belegten Fakten.",
    "Nächste Schritte ableiten": "Leite konkrete nächste Schritte aus dem Inhalt ab und kennzeichne offene Voraussetzungen.",
    "Entscheidung vorbereiten": "Bereite eine Entscheidung vor: stelle Optionen, Kriterien, Risiken und offene Punkte entscheidungsorientiert dar.",
    "Offene Punkte markieren": "Markiere offene Punkte, fehlende Informationen, Widersprüche und notwendige Klärungen besonders deutlich."
  };

  const resolvedLength = lengthMap[length] || lengthMap.medium;
  const resolvedFocus = focusMap[focus] || focusMap.Allgemein;
  const resolvedFormatRules = formatMap[format] || formatMap.Fließtext;
  const resolvedTemplateRules = templateMap[template] || templateMap["Standard-Zusammenfassung"];
  const resolvedLanguageStyle = languageStyleMap[language] || `Halte die Ausgabesprache strikt ein: ${language}.`;
  const resolvedAudience = audienceMap[audience] || audienceMap.Allgemein;
  const resolvedTone = toneMap[tone] || toneMap.Neutral;
  const resolvedActionMode = actionModeMap[actionMode] || actionModeMap["Nur zusammenfassen"];

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
    `Vorlage: ${template}.`,
    `Zielgruppe: ${audience}. ${resolvedAudience}`,
    `Ton/Stil: ${tone}. ${resolvedTone}`,
    `Handlungsorientierung: ${actionMode}. ${resolvedActionMode}`,
    "Vorlagenregeln:",
    ...resolvedTemplateRules.map((rule) => `- ${rule}`),
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
    `- Vorlage: ${template}`,
    `- Zielgruppe: ${audience} (${resolvedAudience})`,
    `- Ton/Stil: ${tone} (${resolvedTone})`,
    `- Handlungsorientierung: ${actionMode} (${resolvedActionMode})`,
    `- Ausgabeformat: ${format}`,
    "",
    "Vorlagenregeln:",
    ...resolvedTemplateRules.map((rule) => `- ${rule}`),
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

export async function requestClaudeSummary({
  apiKey,
  proxyUrl,
  model,
  text,
  length,
  language,
  focus,
  format,
  template,
  audience,
  tone,
  actionMode
}) {
  const { systemPrompt, userPrompt } = buildPrompts({
    text,
    length,
    language,
    focus,
    format,
    template,
    audience,
    tone,
    actionMode
  });

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

export async function requestClaudePdfSummary({
  apiKey,
  proxyUrl,
  model,
  pdfBase64,
  fileName,
  length,
  language,
  focus,
  format,
  template,
  audience,
  tone,
  actionMode
}) {
  const { systemPrompt, userPrompt } = buildPrompts({
    text: [
      `PDF-Datei: ${fileName || "Dokument.pdf"}`,
      "Analysiere das angehängte PDF visuell und inhaltlich. Extrahiere relevante Texte, Tabellen, Formularinhalte und sichtbare Strukturelemente, soweit sie im Dokument erkennbar sind."
    ].join("\n"),
    length,
    language,
    focus,
    format,
    template,
    audience,
    tone,
    actionMode
  });

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
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdfBase64
              },
              cache_control: {
                type: "ephemeral"
              }
            },
            {
              type: "text",
              text: [
                userPrompt,
                "",
                "Wichtig: Wenn das PDF gescannt ist oder Tabellen/Formulare enthält, nutze deine visuelle Dokumentanalyse. Gib keine OCR-Rohfassung aus, sondern eine hochwertige Zusammenfassung gemäß den Ausgabeparametern."
              ].join("\n")
            }
          ]
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
    throw new Error("Claude hat keine lesbare PDF-Zusammenfassung zurückgegeben.");
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
