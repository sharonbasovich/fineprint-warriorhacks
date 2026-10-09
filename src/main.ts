import { GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { extractPdf } from "./core/pdf";
import { extractText } from "./core/textdoc";
import { analyze } from "./core/analyze";
import { SAMPLES } from "./core/samples";
import { clearSourceSelection, preferredScrollBehavior, renderResult } from "./ui/render";
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

let latestRequest = 0;
type InputState = "idle" | "loading" | "current" | "error";

function setStatus(msg: string, state: InputState = "idle") {
  statusLine.textContent = msg;
  statusLine.classList.toggle("error", state === "error");
  $("#results").dataset.state = state;
  $("#results").setAttribute("aria-busy", String(state === "loading"));
}

function beginRequest(message: string, sampleId = ""): number {
  const request = ++latestRequest;
  sampleSelect.value = sampleId;
  sampleBlurb.textContent = SAMPLES.find((s) => s.id === sampleId)?.blurb ?? "";
  clearSourceSelection();
  $("#results").hidden = true;
  for (const id of ["doc-title", "doc-sub", "program-chips", "warnings", "source-view", "checklist"]) {
    $(`#${id}`).replaceChildren();
  }
  setStatus(message, "loading");
  return request;
}

function failRequest(request: number, message: string): void {
  if (request === latestRequest) setStatus(message, "error");
}

function loadDoc(doc: NoticeDocument, request: number): void {
  // Only the latest input attempt owns the visible result and status.
  if (request !== latestRequest) return;
  const result = analyze(doc);
  renderResult(doc, result);
  setStatus(`Showing results for ${doc.sourceName}.`, "current");
  $("#results").hidden = false;
  $("#source-view").scrollTop = 0;
  $("#results").scrollIntoView({ behavior: preferredScrollBehavior(), block: "start" });
}

async function loadSample(id: string) {
  const def = SAMPLES.find((s) => s.id === id);
  if (!def) return;
  const request = beginRequest(`Loading ${def.label}…`, id);
  try {
    const res = await fetch(def.file);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const doc = extractText(text, def.label);
    if (def.tag === "synthetic") doc.warnings.push("Synthetic demonstration document — not a real notice.");
    loadDoc(doc, request);
  } catch (e) {
    failRequest(request, `Could not load that sample: ${(e as Error).message}`);
  }
}

async function loadFile(file: File) {
  const request = beginRequest(`Reading ${file.name}…`);
  const okType =
    /\.(pdf|txt|text)$/i.test(file.name) ||
    file.type === "application/pdf" ||
    file.type === "text/plain";
  if (!okType) {
    failRequest(request,
      `"${file.name}" is not a supported file type — Fineprint reads text PDFs and .txt files only.`
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
    loadDoc(doc, request);
  } catch (e) {
    failRequest(request,
      `Could not read "${file.name}": ${(e as Error).message}. If it is a scanned image PDF, Fineprint cannot read it (no OCR).`
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
  const request = beginRequest("Reading pasted text.");
  const text = pasteArea.value;
  if (!text.trim()) {
    failRequest(request, "Paste some letter text first.");
    return;
  }
  try {
    loadDoc(extractText(text, "pasted text"), request);
  } catch (e) {
    failRequest(request, `Could not read pasted text: ${(e as Error).message}`);
  }
});
