export interface SampleDef {
  id: string;
  label: string;
  file: string;
  tag: "official" | "synthetic";
  blurb: string;
}

export const SAMPLES: SampleDef[] = [
  {
    id: "official",
    label: "Real public sample: Texas H1830-R renewal notice",
    file: "samples/h1830r-official-sample.txt",
    tag: "official",
    blurb:
      "The real December 2018 sample form from Texas HHSC. Its due-date field is blank — watch Fineprint refuse to invent one."
  },
  {
    id: "synthetic-dated",
    label: "Synthetic: dated renewal (SNAP checked)",
    file: "samples/synthetic-garden-state.txt",
    tag: "synthetic",
    blurb: "Invented notice with a real due date, a benefit-end date, and conditional documents."
  },
  {
    id: "synthetic-conflict",
    label: "Synthetic: two different due dates",
    file: "samples/synthetic-conflicting-dates.txt",
    tag: "synthetic",
    blurb: "Invented notice whose due-date wording contains two different dates — Fineprint flags the conflict instead of picking one."
  },
  {
    id: "synthetic-blank",
    label: "Synthetic: no deadline printed",
    file: "samples/synthetic-no-deadline.txt",
    tag: "synthetic",
    blurb: "Invented notice with no due date and no checked program — tests honest abstention."
  }
];
