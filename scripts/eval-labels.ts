/**
 * Score rule-based vs AI groups against the hand labels in docs/validation/label_sample.csv
 * (rows where `correct_group` is filled in). SPEC §9.2.
 *
 *   npm run eval:labels  →  public/data/bangmod/eval_labels.json
 */
import { readFileSync, writeFileSync } from "node:fs";

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) rows.push([...row, cell]);
  return rows.filter((r) => r.some((c) => c.trim()));
}

const [header, ...rows] = parseCsv(readFileSync("docs/validation/label_sample.csv", "utf8").replace(/^﻿/, "") /* BOM from Excel */);
const col = (name: string) => header.indexOf(name);
const labelled = rows.filter((r) => r[col("correct_group")]?.trim());
const correct = (k: "rule_group" | "ai_group") =>
  labelled.filter((r) => r[col(k)] === r[col("correct_group")].trim()).length;

const result = {
  created: new Date().toISOString(),
  sample: rows.length,
  labelled: labelled.length,
  rule_correct: correct("rule_group"),
  ai_correct: correct("ai_group"),
  rule_accuracy: labelled.length ? Number((correct("rule_group") / labelled.length).toFixed(3)) : null,
  ai_accuracy: labelled.length ? Number((correct("ai_group") / labelled.length).toFixed(3)) : null,
  note: "ตัวอย่างคือจุดที่กฎกับ AI ตัดสินไม่ตรงกัน จึงวัดว่าใครถูกเมื่อเห็นต่าง ไม่ใช่ความแม่นยำรวมของทั้งชุด",
};
writeFileSync("public/data/bangmod/eval_labels.json", JSON.stringify(result, null, 2) + "\n");
console.log(`labelled ${result.labelled}/${result.sample} · rule ${result.rule_correct} · AI ${result.ai_correct}`);
