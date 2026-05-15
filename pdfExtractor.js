const PDFJS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";

let pdfjsPromise;

export async function extractTextFromPdf(file) {
  if (!file || file.type !== "application/pdf") {
    throw new Error("Bitte eine gültige PDF-Datei auswählen.");
  }

  const pdfjs = await loadPdfJs();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => item.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (pageText) {
      pages.push(pageText);
    }
  }

  return pages.join("\n\n");
}

async function loadPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import(PDFJS_CDN).then((module) => {
      module.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      return module;
    });
  }

  try {
    return await pdfjsPromise;
  } catch (error) {
    pdfjsPromise = null;
    throw new Error("PDF.js konnte nicht geladen werden. Prüfe die Internetverbindung oder füge PDF.js lokal hinzu.");
  }
}
