import { GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { extractPdf } from "./core/pdf";
import { extractText } from "./core/textdoc";
import { analyze } from "./core/analyze";
import { SAMPLES } from "./core/samples";
import { renderResult } from "./ui/render";
import type { NoticeDocument } from "./core/types";
import "./style.css";

GlobalWorkerOptions.workerSrc = workerUrl;

const $ = <T extends HTMLElement>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`missing element ${sel}`);
  return el;
};

const statusLine = $<HTMLParagraphElement>("#status-line");
const sampleSelect = $<HTMLSelectElement>("#sample-select");
const sampleBlurb = $<HTMLParagraphElement>("#sample-blurb");
const dropzone = $<HTMLDivElement>("#dropzone");
const fileInput = $<HTMLInputElement>("#file-input");
const pasteArea = $<HTMLTextAreaElement>("#paste");

function setStatus(msg: string, isError = false) {
  statusLine.textContent = msg;
  statusLine.classList.toggle("error", isError);
}

async function loadDoc(doc: NoticeDocument) {
  const result = analyze(doc);
  renderResult(doc, result);
  setStatus("");
  $("#source-view").scrollTop = 0;
  $("#results").hidden = false;
  $("#results").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function loadSample(id: string) {
  const def = SAMPLES.find((s) => s.id === id);
  if (!def) return;
  setStatus(`Loading ${def.label}…`);
  try {
    const res = await fetch(def.file);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const doc = extractText(text, def.label);
    if (def.tag === "synthetic") doc.warnings.push("Synthetic demonstration document — not a real notice.");
    setStatus("");
    await loadDoc(doc);
  } catch (e) {
    setStatus(`Could not load that sample: ${(e as Error).message}`, true);
  }
}

async function loadFile(file: File) {
  setStatus(`Reading ${file.name}…`);
  const okType =
    /\.(pdf|txt|text)$/i.test(file.name) ||
    file.type === "application/pdf" ||
    file.type === "text/plain";
  if (!okType) {
    setStatus(
      `"${file.name}" is not a supported file type — Fineprint reads text PDFs and .txt files only.`,
      true
    );
    return;
  }
  try {
    let doc: NoticeDocument;
    if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
      const buf = new Uint8Array(await file.arrayBuffer());
      doc = await extractPdf(buf, file.name, {
        standardFontDataUrl: "pdfjs/standard_fonts/",
        cMapUrl: "pdfjs/cmaps/"
      });
    } else {
      doc = extractText(await file.text(), file.name);
    }
    await loadDoc(doc);
  } catch (e) {
    setStatus(
      `Could not read "${file.name}": ${(e as Error).message}. If it is a scanned image PDF, Fineprint cannot read it (no OCR).`,
      true
    );
  }
}

// ---- wiring ----
for (const s of SAMPLES) {
  const opt = document.createElement("option");
  opt.value = s.id;
  opt.textContent = s.label;
  sampleSelect.appendChild(opt);
}
sampleSelect.addEventListener("change", () => {
  const def = SAMPLES.find((s) => s.id === sampleSelect.value);
  sampleBlurb.textContent = def?.blurb ?? "";
  void loadSample(sampleSelect.value);
});

$("#try-demo").addEventListener("click", () => {
  sampleSelect.value = "official";
  sampleSelect.dispatchEvent(new Event("change"));
});

dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fileInput.click();
  }
});
fileInput.addEventListener("change", () => {
  const f = fileInput.files?.[0];
  if (f) void loadFile(f);
});
dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("over");
});
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("over"));
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("over");
  const f = e.dataTransfer?.files?.[0];
  if (f) void loadFile(f);
});

$("#analyze-paste").addEventListener("click", () => {
  const text = pasteArea.value;
  if (!text.trim()) {
    setStatus("Paste some letter text first.", true);
    return;
  }
  void loadDoc(extractText(text, "pasted text"));
});
