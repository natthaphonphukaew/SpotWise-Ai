import { describe, expect, it } from "vitest";
import type { EvidenceRef } from "./evidence";
import { checkStatement, groundingRate, numbersIn } from "./grounding";

const ev: EvidenceRef[] = [
  { id: "B2", site: "B", label: "Loc-Score รวม", value: 69, unit: "/100", kind: "score", source: "" },
  { id: "B5", site: "B", label: "คู่แข่งตรงในระยะเดิน 10 นาที", value: 17, unit: "ร้าน", kind: "open", source: "" },
  {
    id: "B9",
    site: "B",
    label: "ลูกค้าคาดการณ์ต่อวัน (ต่ำ–สูง)",
    value: "27–80",
    unit: "คน/วัน",
    kind: "estimated",
    source: "",
  },
  {
    id: "B12",
    site: "B",
    label: "เดือนที่แย่ที่สุด",
    value: -9185,
    unit: "บาท (2027-07)",
    kind: "estimated",
    source: "",
  },
];
const byId = new Map(ev.map((e) => [e.id, e]));

describe("numbersIn", () => {
  it("reads Thai-formatted numbers", () => {
    expect(numbersIn("ขาดทุน 9,185 บาท และ 3.9 คน/นาที ช่วง 27–80 คน")).toEqual([9185, 3.9, 27, 80]);
  });
});

describe("checkStatement", () => {
  it("accepts a statement whose numbers come from what it cites", () => {
    expect(checkStatement({ text: "ทำเล B ได้ 69 คะแนน มีคู่แข่งตรง 17 ร้าน", cites: ["B2", "B5"] }, byId).ok).toBe(
      true,
    );
  });

  it("accepts ranges and rounded figures from the cited evidence", () => {
    expect(checkStatement({ text: "ลูกค้าราว 27–80 คนต่อวัน", cites: ["B9"] }, byId).ok).toBe(true);
    expect(checkStatement({ text: "เดือน ก.ค. ขาดทุนราว 9,200 บาท", cites: ["B12"] }, byId).ok).toBe(true);
  });

  it("rejects numbers that are not in the cited evidence", () => {
    const r = checkStatement({ text: "มีคู่แข่ง 25 ร้าน", cites: ["B5"] }, byId);
    expect(r.ok).toBe(false);
    expect(r.problems[0]).toContain("25");
  });

  it("rejects missing and made-up citations", () => {
    expect(checkStatement({ text: "ทำเลนี้ดี", cites: [] }, byId).ok).toBe(false);
    expect(checkStatement({ text: "ทำเลนี้ดี", cites: ["Z9"] }, byId).problems.join()).toContain("Z9");
  });

  it("allows small counts without citing them", () => {
    expect(checkStatement({ text: "เปรียบเทียบ 3 ทำเล ในระยะเดิน 10 นาที", cites: ["B2"] }, byId).ok).toBe(true);
  });
});

describe("groundingRate", () => {
  it("is the share of grounded statements", () => {
    const r = groundingRate(
      [
        { text: "69 คะแนน", cites: ["B2"] },
        { text: "คู่แข่ง 99 ร้าน", cites: ["B5"] },
      ],
      ev,
    );
    expect(r.rate).toBe(0.5);
  });
});
