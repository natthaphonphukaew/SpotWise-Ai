import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { addMonths, monthFactor, simulate, summarize, type AcademicCalendar, type FinanceInputs } from "./finance";

const cal = JSON.parse(readFileSync("public/data/bangmod/academic_calendar.json", "utf8")) as AcademicCalendar;

const base: FinanceInputs = {
  customersPerDay: 80, avgTicketThb: 50, cogsShare: 0.35, rentThb: 12000, staffThb: 12000, otherFixedThb: 4000,
  setupThb: 300000, openDaysPerMonth: 26, breakFactor: 0.35, specialFactor: 0.6, startMonth: "2026-11",
};
const f = (p: Partial<FinanceInputs>) => ({ ...base, ...p });

describe("academic calendar", () => {
  it("full term months have factor 1, the Dec–Jan break pulls them down", () => {
    expect(monthFactor("2026-09", cal, base).factor).toBe(1);
    expect(monthFactor("2026-12", cal, base).factor).toBeLessThan(1);
    expect(monthFactor("2027-01", cal, base).factor).toBeLessThan(1);
    expect(monthFactor("2027-07", cal, base).breakDays).toBe(31);
  });

  it("marks months that rely on the projected next-year calendar", () => {
    expect(monthFactor("2027-09", cal, base).projected).toBe(true);
    expect(monthFactor("2026-09", cal, base).projected).toBe(false);
  });

  it("repeats last year's pattern beyond the published calendar", () => {
    const dec27 = monthFactor("2027-12", cal, base);
    expect(dec27.factor).toBeLessThan(1);
    expect(dec27.projected).toBe(true);
    expect(monthFactor("2028-07", cal, base).breakDays).toBe(31);
  });

  it("adds months across years", () => {
    expect(addMonths("2026-11", 2)).toBe("2027-01");
    expect(addMonths("2026-12", 12)).toBe("2027-12");
  });
});

describe("cash flow monotonicity", () => {
  it("more customers → more net every month", () => {
    const lo = simulate(f({ customersPerDay: 40 }), cal);
    const hi = simulate(f({ customersPerDay: 120 }), cal);
    hi.forEach((r, i) => expect(r.net).toBeGreaterThan(lo[i].net));
  });

  it("higher rent → lower net and no faster payback", () => {
    const cheap = summarize(f({ rentThb: 8000 }), cal);
    const dear = summarize(f({ rentThb: 25000 }), cal);
    expect(dear.avgNetMonth).toBeLessThan(cheap.avgNetMonth);
    expect(dear.paybackMonths ?? Infinity).toBeGreaterThanOrEqual(cheap.paybackMonths ?? Infinity);
    expect(dear.breakevenCustomers).toBeGreaterThan(cheap.breakevenCustomers);
  });

  it("a deeper term-break slump → weaker break months and a bigger reserve", () => {
    const mild = summarize(f({ breakFactor: 0.8, specialFactor: 0.9 }), cal);
    const harsh = summarize(f({ breakFactor: 0.2, specialFactor: 0.3 }), cal);
    expect(harsh.worstMonth.net).toBeLessThan(mild.worstMonth.net);
    expect(harsh.reserveThb).toBeGreaterThanOrEqual(mild.reserveThb);
  });

  it("higher cost of goods → lower net", () => {
    expect(summarize(f({ cogsShare: 0.5 }), cal).avgNetMonth).toBeLessThan(summarize(f({ cogsShare: 0.3 }), cal).avgNetMonth);
  });

  it("cumulative cash starts from minus the setup cost", () => {
    const [first] = simulate(base, cal);
    expect(first.cumulative).toBeCloseTo(-base.setupThb + first.net, 6);
  });

  it("no payback when the shop never covers its costs", () => {
    expect(summarize(f({ customersPerDay: 1 }), cal).paybackMonths).toBeNull();
  });
});
