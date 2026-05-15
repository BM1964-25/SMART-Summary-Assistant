const MAMMOTH_CDN = "https://cdn.jsdelivr.net/npm/mammoth@1.9.1/mammoth.browser.min.js";

let mammothPromise;

export async function extractTextFromDocx(file) {
  const mammoth = await loadMammoth();
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value || "";
}

async function loadMammoth() {
  if (!mammothPromise) {
    mammothPromise = new Promise((resolve, reject) => {
      if (window.mammoth) {
        resolve(window.mammoth);
        return;
      }

      const script = document.createElement("script");
      script.src = MAMMOTH_CDN;
      script.async = true;
      script.onload = () => resolve(window.mammoth);
      script.onerror = () => reject(new Error("DOCX-Parser konnte nicht geladen werden. Bitte Internetverbindung prüfen oder DOCX als PDF/TXT exportieren."));
      document.head.appendChild(script);
    });
  }

  return mammothPromise;
}
