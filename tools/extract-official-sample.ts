/**
 * Extracts text (with [x]/[ ] checkbox markers) from the official public
 * H1830-R sample PDF using the same pipeline the app uses, and writes it to
 * public/samples/h1830r-official-sample.txt with provenance in the header.
 *
 * Usage: tsx tools/extract-official-sample.ts [path-to-pdf]
 * Without a path it downloads the PDF from the official fhb.hhs.texas.gov URL.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { extractPdf } from "../src/core/pdf";

const OFFICIAL_URL =
  "https://fhb.hhs.texas.gov/sites/default/files/documents/laws-regulations/forms/H1830-R/H1830-R.pdf";
const OUT = "public/samples/h1830r-official-sample.txt";

async function main() {
  const argPath = process.argv[2];
  let data: Uint8Array;
  if (argPath) {
    data = new Uint8Array(readFileSync(argPath));
  } else {
    const res = await fetch(OFFICIAL_URL);
    if (!res.ok) throw new Error(`download failed: ${res.status}`);
    data = new Uint8Array(await res.arrayBuffer());
  }
  const doc = await extractPdf(data, "H1830-R.pdf");
  const header = [
    "SOURCE: Texas Health and Human Services Commission, Form H1830-R 'Texas Works Renewal Notice' (December 2018).",
    "Official public sample retrieved from " + OFFICIAL_URL,
    "Text extracted locally by Fineprint (pdf.js); [x]/[ ] markers transcribed from the document's own checkbox marks.",
    "This is a SAMPLE form — its due-date field is blank. Shown for document-comprehension demonstration only.",
    ""
  ].join("\n");
  const body = doc.pages
    .map((p) => p.lines.map((l) => l.text).join("\n"))
    .join("\n\n--- page break ---\n\n");
  mkdirSync("public/samples", { recursive: true });
  writeFileSync(OUT, header + body + "\n");
  console.log(`wrote ${OUT} (${doc.pages.length} pages)`);
  if (doc.warnings.length) console.log("warnings:", doc.warnings);
}

main();
