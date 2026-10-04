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
    label: "Official sample: Texas H1830-R renewal notice (2018)",
    file: "samples/h1830r-official-sample.txt",
    tag: "official",
    blurb:
      "The official December 2018 sample form published by Texas HHSC, marked SAMPLE. Its due-date field is blank — watch Fineprint refuse to invent one."
  },
  {
    id: "synthetic-dated",
    label: "Synthetic: dated renewal (SNAP checked)",
    file: "samples/synthetic-garden-state.txt",
    tag: "synthetic",
    blurb: "Invented notice with a stated due date, a benefit-end date, and conditional documents."
  },
  {
    id: "synthetic-conflict",
    label: "Synthetic: two different due dates",
    file: "samples/synthetic-conflicting-dates.txt",
    tag: "synthetic",
    blurb: "Invented notice with two different due dates. Fineprint shows the detected timing passages and reminds you to check the full letter."
  },
  {
    id: "synthetic-blank",
    label: "Synthetic: no deadline printed",
    file: "samples/synthetic-no-deadline.txt",
    tag: "synthetic",
    blurb: "Invented notice with no due date and no checked program — tests honest abstention."
  }
];
