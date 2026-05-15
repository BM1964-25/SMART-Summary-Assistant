# SMART Summary Assistant

SMART Summary Assistant ist eine lokale Browseranwendung für KI-gestützte Zusammenfassungen. Nutzer übernehmen Text aus Dokumenten, Berichten, E-Mails und Fachinhalten und erstellen daraus präzise Zusammenfassungen nach Länge, Sprache, Fokus und Ausgabeformat.

## Lokale Nutzung

Für KI-Anfragen wird der mitgelieferte lokale Proxy empfohlen. Direkte Browser-Aufrufe an Anthropic werden häufig durch CORS blockiert; außerdem sollte der API-Key nicht direkt aus einer statischen Seite an Drittanbieter-Endpunkte gesendet werden.

```bash
npm start
```

Danach im Browser öffnen:

```text
http://127.0.0.1:8172
```

Die UI kann zwar direkt per `index.html` oder GitHub Pages geöffnet werden, Anthropic-Anfragen funktionieren dort aber nur mit einem erreichbaren Backend-Proxy.

## Unterstützte Plattformen

Die App läuft im Browser auf macOS und Windows. Empfohlen sind aktuelle Versionen von Chrome, Edge oder Safari. Für lokale KI-Anfragen muss Node.js verfügbar sein, damit `localProxyServer.js` gestartet werden kann.

## Dateiimport

Unterstützte Textimporte:

- TXT
- MD
- PDF mit kopierbarem Text
- DOCX
- RTF
- HTML
- CSV

Es wird nur Text übernommen, nicht das Original-Layout. Gescannte PDFs, Bilder und Screenshots benötigen OCR und sind in dieser Version nicht vorgesehen.

## Anthropic API-Key

Der API-Key wird in der App eingegeben. Optional kann er lokal im Browser per `localStorage` gespeichert werden. Der Key steht nicht im Quellcode.

Der lokale Proxy leitet Anfragen an Anthropic weiter:

```text
/api/anthropic/messages
```

Die Anthropic-Kommunikation ist in `anthropicClient.js` gekapselt.

## Datenschutz und API-Nutzung

Zusammenzufassende Inhalte werden zur Verarbeitung an Anthropic übermittelt. Laut Anthropic werden API-Eingaben und -Ausgaben nicht zum Training generativer Modelle verwendet, außer Nutzer übermitteln Inhalte ausdrücklich als Feedback oder stimmen einer Nutzung zur Modellverbesserung zu.

Sensible oder personenbezogene Daten sollten nur verarbeitet werden, wenn dies fachlich, vertraglich und rechtlich zulässig ist.

## Lizenzierung und Verkauf über Stripe

Die App enthält eine Lizenzschlüssel-UI und ein gekapseltes `licenseClient.js`.

Vorgesehener Produktionsablauf:

1. Nutzer kauft über Stripe Checkout.
2. Stripe Webhook ruft ein kleines Lizenz-Backend auf.
3. Das Backend erzeugt einen Lizenzschlüssel.
4. Der Nutzer erhält den Lizenzschlüssel per E-Mail oder Kundenportal.
5. Der Nutzer gibt den Lizenzschlüssel in SMART Summary Assistant ein.
6. Die App prüft den Schlüssel über eine Lizenz-API.

Wichtig: Stripe-Secret-Keys und Lizenzsignierung dürfen niemals in den Browser. Für Produktion braucht es eine kleine serverseitige Lizenz-API, z. B.:

```text
POST /api/license/verify
```

Lokaler Demo-Schlüssel:

```text
SMART-DEMO-2026-LOCAL
```

## GitHub Pages

GitHub Pages kann die statische UI hosten. GitHub Pages kann jedoch keinen Node-Proxy ausführen. Für produktive Web-Nutzung muss der Anthropic-Proxy separat deployed werden.

## Mögliche spätere Erweiterungen

- OCR für gescannte PDFs und Bilder.
- Vollständig lokales PDF.js und Mammoth statt CDN.
- Signierte Offline-Lizenzschlüssel.
- Stripe Customer Portal.
- Lizenz-Backend mit Webhooks, Sperrlisten und Aktivierungslimits.
- Rendern von Markdown-Ergebnissen als formatierte Ausgabe.
- Export als PDF oder DOCX.
