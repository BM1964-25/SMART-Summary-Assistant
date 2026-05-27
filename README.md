# SMART Summary Assistant

SMART Summary Assistant ist eine browserbasierte Anwendung für KI-gestützte Zusammenfassungen. Nutzer übernehmen Text aus Dokumenten, Berichten, E-Mails und Fachinhalten und erstellen daraus präzise Zusammenfassungen nach Länge, Sprache, Zielgruppe, Fokus, Ton und Ausgabeformat.

## Nutzung

Die App läuft im Webbrowser und kann auf Windows, macOS und anderen modernen Systemen genutzt werden. Eine separate Desktop-Installation steht bei diesem Modell nicht im Vordergrund.

Für Testphase, Kauf und Lizenzprüfung ist ein persönlicher Nutzerzugriff vorgesehen. Der Login kann einfach per E-Mail/Magic Link erfolgen. Für KI-Funktionen kann ein eigener API-Key erforderlich sein.

## Daten und Speicherung

Fachliche Inhalte wie Eingaben, Zusammenfassungen, Profile und Verlauf können in diesem Browser gespeichert werden. Eine automatische Cloud-Synchronisierung der App-Inhalte ist in Version 1 nicht vorgesehen.

Über Export und Import können Daten gesichert oder auf ein anderes System übertragen werden. Andere Nutzer können nicht auf Inhalte zugreifen, die nur im Browser des jeweiligen Nutzers gespeichert sind.

## Dateiimport

Unterstützte Textimporte:

- TXT
- MD
- PDF mit kopierbarem Text
- DOCX
- RTF
- HTML
- CSV

Es wird Text übernommen, nicht das originale Seitenlayout. Markierbarer PDF-Text wird direkt im Browser ausgelesen. Wenn kein auslesbarer Text erkannt wird, kann die Zusammenfassung über die visuelle PDF-Analyse von Claude erstellt werden.

## PDF und visuelle Analyse

Die PDF-Verarbeitung erfolgt in dieser Reihenfolge:

1. PDF.js liest direkt vorhandenen PDF-Text im Browser aus.
2. Wenn kein verwertbarer Text vorhanden ist, merkt sich die App die PDF-Datei für die Zusammenfassung.
3. Beim Erstellen der Zusammenfassung wird die PDF über den lokalen Proxy als PDF-Dokument an Claude übergeben.
4. Claude analysiert das Dokument visuell und inhaltlich und erstellt daraus die Zusammenfassung.

Für gescannte PDFs sind damit keine zusätzlichen plattformspezifischen OCR-Werkzeuge erforderlich. Für die visuelle PDF-Analyse werden API-Key und Internetverbindung benötigt; das Dokument wird dafür an den KI-Anbieter übertragen.

## Zusammenfassungssteuerung

Die App unterstützt unterschiedliche Vorlagen, Längen, Sprachen, Zielgruppen, Fokusarten, Tonalitäten, Handlungsorientierungen und Ausgabeformate. Dadurch lassen sich unter anderem kompakte Fließtexte, strukturierte Stichpunkte, Executive Summaries, Entscheidungsnotizen und Tabellen erzeugen.

## Lizenzmodell

Vorgesehenes Lizenzmodell:

- Jahreslizenz mit 12 Monaten Laufzeit
- automatische Verlängerung um weitere 12 Monate
- Kündigungsfrist 1 Monat vor Ablauf
- sichere Online-Zahlung
- optionale 7-Tage-Testphase mit vollem Funktionsumfang
- pro Lizenz ein Nutzerzugriff
- mehrere Lizenzen derselben App können gekauft werden
- in Version 1: ein Checkout für eine App
- mehrere unterschiedliche Apps in einem gemeinsamen Checkout können später ergänzt werden

Demo-Lizenz für Tests:

```text
SMART-DEMO-2026-LOCAL
```

## Datenschutz und KI-Nutzung

Zusammenzufassende Inhalte werden für die KI-Funktion an den KI-Anbieter übermittelt. Laut Anthropic werden API-Eingaben und -Ausgaben nicht zum Training generativer Modelle verwendet, außer Nutzer übermitteln Inhalte ausdrücklich als Feedback oder stimmen einer Nutzung zur Modellverbesserung zu.

Sensible oder personenbezogene Daten sollten nur verarbeitet werden, wenn dies fachlich, vertraglich und rechtlich zulässig ist.

## Spätere Erweiterungen

- Erweiterte visuelle Analyse für gescannte Dokumente und Bilder
- Export als PDF oder DOCX
- Import und Export für Profile und Verlauf
- Erweiterte Team- und Mehrlizenz-Verwaltung
- Gemeinsamer Checkout für mehrere Apps
- Serverseitige Synchronisierung von App-Inhalten, falls später gewünscht
