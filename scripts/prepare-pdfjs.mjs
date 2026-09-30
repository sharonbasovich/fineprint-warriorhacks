// copy pdf.js assets needed at runtime (standard fonts + cmaps) into public/pdfjs
import { cpSync, mkdirSync } from "node:fs";
for (const d of ["standard_fonts", "cmaps"]) {
  mkdirSync(`public/pdfjs/${d}`, { recursive: true });
  cpSync(`node_modules/pdfjs-dist/${d}`, `public/pdfjs/${d}`, { recursive: true });
}
console.log("pdf.js assets copied");
