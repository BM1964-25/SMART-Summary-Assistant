# SMART Summary Assistant

SMART Summary Assistant ist eine lokale Browseranwendung für KI-gestützte Zusammenfassungen. Nutzer können Texte aus Artikeln, E-Mails, Berichten, PDFs oder anderen Dokumenten einfügen und daraus strukturierte Zusammenfassungen mit wählbarer Länge, Sprache, Fokus und Ausgabeform erstellen.

## Lokale Nutzung

Empfohlen ist der mitgelieferte lokale Proxy, weil direkte Browser-Aufrufe an Anthropic in der Regel durch CORS blockiert werden und API-Keys nicht direkt an Drittanbieter-Endpunkte aus einer statischen Seite gesendet werden sollten.

```bash
node localProxyServer.js
```

Danach im Browser öffnen:

```text
http://127.0.0.1:8172
```

Die App benötigt keine zentrale Projektdatenbank.

## Anthropic API-Key

Der API-Key wird im Einstellungsbereich der App eingegeben. Optional kann er lokal im Browser per `localStorage` gespeichert werden. Der Key steht nicht im Quellcode.

Der Standard-Proxy-Endpunkt lautet:

```text
/api/anthropic/messages
```

Die Anthropic-Kommunikation ist in `anthropicClient.js` gekapselt. Der lokale Proxy befindet sich in `localProxyServer.js`.

## Datenschutz und API-Nutzung

Zusammenzufassende Inhalte werden zur Verarbeitung an Anthropic übermittelt. Sensible Daten sollten nur bewusst und gemäß internen Datenschutz- und Compliance-Vorgaben verarbeitet werden.

Der API-Key wird nur an den lokalen Proxy gesendet. Der Proxy leitet die Anfrage an Anthropic weiter.

## PDF-Upload

`pdfExtractor.js` nutzt PDF.js über ein CDN, um kopierbaren Text aus PDF-Dateien zu extrahieren. Für vollständig offlinefähige Nutzung kann PDF.js später lokal in das Projekt gelegt und der Importpfad angepasst werden.

## Mögliche spätere Erweiterungen

- Lokale PDF.js-Dateien statt CDN.
- Token- und Kostenschätzung vor der Anfrage.
- Unterstützung weiterer KI-Anbieter.
- Batch-Verarbeitung mehrerer Dokumente.
- Lokale Verlaufsliste ohne zentrale Datenbank.
- Export als PDF oder DOCX.
- Erweiterter Proxy mit Rate-Limits und serverseitiger Protokollierung.
