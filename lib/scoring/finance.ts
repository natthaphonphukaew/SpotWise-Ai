/**
 * Scenario simulator (SPEC §5 W1): 12-month cash flow where demand follows the KMUTT academic
 * calendar. Pure; every figure that is not user input is an assumption and labelled as such in the UI.
 */

export type PeriodKind = "term" | "break" | "special";
export type CalendarPeriod = { from: string; to: string; kind: PeriodKind; label: string; projected?: boolean };
export type AcademicCalendar = { source: string; url: string; fetched: string; note: string; periods: CalendarPeriod[] };

export type FinanceInputs = {
  /** customers per open day during term (from Loc-Score / Huff, or the user) */
  customersPerDay: number;
  avgTicketThb: number;
  /** cost of goods as a share of revenue */
  cogsShare: number;
  rentThb: number;
  staffThb: number;
  otherFixedThb: number;
  setupThb: number;
  openDaysPerMonth: number;
  /** demand relative to term time */
  breakFactor: number;
  specialFactor: number;
  /** first month of operation, "YYYY-MM" */
  startMonth: string;
};

export type MonthRow = {
  month: string; // YYYY-MM
  factor: number; // 0–1 demand vs term time
  breakDays: number; // days in the month outside teaching (break or special term)
  projected: boolean; // calendar for this month is extrapolated
  revenue: number;
  variable: number;
  fixed: number;
  net: number;
  cumulative: number; // includes setup cost
};

const DAY = 86_400_000;
const toDate = (s: string) => new Date(`${s}T00:00:00Z`);

/** Demand factor for one day: term = 1, break/special = the given factor; days outside the calendar count as term. */
export function dayFactor(day: Date, cal: AcademicCalendar, f: Pick<FinanceInputs, "breakFactor" | "specialFactor">) {
  // Beyond the published calendar, repeat last year's pattern (and mark it as projected).
  const last = cal.periods.reduce((m, x) => (toDate(x.to) > m ? toDate(x.to) : m), new Date(0));
  let d = day;
  let shifted = false;
  while (d > last) {
    d = new Date(Date.UTC(d.getUTCFullYear() - 1, d.getUTCMonth(), d.getUTCDate()));
    shifted = true;
  }
  const found = cal.periods.find((x) => d >= toDate(x.from) && d <= toDate(x.to));
  const period = found && shifted ? { ...found, projected: true } : found;
  if (!period || period.kind === "term") return { factor: 1, period };
  return { factor: period.kind === "break" ? f.breakFactor : f.specialFactor, period };
}

/** Average demand factor of a calendar month. */
export function monthFactor(month: string, cal: AcademicCalendar, f: Pick<FinanceInputs, "breakFactor" | "specialFactor">) {
  const [y, m] = month.split("-").map(Number);
  const first = Date.UTC(y, m - 1, 1);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let sum = 0;
  let breakDays = 0;
  let projected = false;
  for (let d = 0; d < days; d++) {
    const r = dayFactor(new Date(first + d * DAY), cal, f);
    sum += r.factor;
    if (r.period && r.period.kind !== "term") breakDays++;
    if (r.period?.projected) projected = true;
  }
  return { factor: sum / days, breakDays, projected };
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function simulate(inp: FinanceInputs, cal: AcademicCalendar, months = 12): MonthRow[] {
  const fixed = inp.rentThb + inp.staffThb + inp.otherFixedThb;
  let cumulative = -inp.setupThb;
  const rows: MonthRow[] = [];
  for (let i = 0; i < months; i++) {
    const month = addMonths(inp.startMonth, i);
    const mf = monthFactor(month, cal, inp);
    const revenue = inp.customersPerDay * mf.factor * inp.avgTicketThb * inp.openDaysPerMonth;
    const variable = revenue * inp.cogsShare;
    const net = revenue - variable - fixed;
    cumulative += net;
    rows.push({ month, factor: mf.factor, breakDays: mf.breakDays, projected: mf.projected, revenue, variable, fixed, net, cumulative });
  }
  return rows;
}

export type Summary = {
  avgNetMonth: number;
  worstMonth: MonthRow;
  /** months until cumulative cash (after setup) turns positive; null if not within the horizon */
  paybackMonths: number | null;
  /** cash buffer needed on top of setup to survive the weakest stretch */
  reserveThb: number;
  /** term-time customers/day needed to cover fixed costs */
  breakevenCustomers: number;
};

/** Summary over a 36-month horizon so payback beyond year one is still found. */
export function summarize(inp: FinanceInputs, cal: AcademicCalendar): Summary {
  const year = simulate(inp, cal, 12);
  const long = simulate(inp, cal, 36);
  const payback = long.findIndex((r) => r.cumulative >= 0);
  let running = 0;
  let lowest = 0;
  for (const r of year) {
    running += r.net;
    lowest = Math.min(lowest, running);
  }
  const unitMargin = inp.avgTicketThb * (1 - inp.cogsShare) * inp.openDaysPerMonth;
  return {
    avgNetMonth: year.reduce((s, r) => s + r.net, 0) / year.length,
    worstMonth: year.reduce((a, b) => (b.net < a.net ? b : a)),
    paybackMonths: payback >= 0 ? payback + 1 : null,
    reserveThb: lowest < 0 ? -lowest : 0,
    breakevenCustomers: unitMargin > 0 ? (inp.rentThb + inp.staffThb + inp.otherFixedThb) / unitMargin : Infinity,
  };
}

export const SCENARIOS = [
  { key: "low", label: "แย่", mult: 0.5 },
  { key: "base", label: "กลาง", mult: 1 },
  { key: "high", label: "ดี", mult: 1.5 },
] as const;

/** Assumptions the UI starts from; all editable and all labelled "สมมติฐาน". */
export const FINANCE_DEFAULTS = {
  cogsShare: 0.35, // drinks; food is usually higher
  staffThb: 12_000, // one part-time helper
  otherFixedThb: 4_000, // water, electricity, packaging delivery fees, etc.
  setupThb: 300_000,
  openDaysPerMonth: 26,
  breakFactor: 0.35,
  specialFactor: 0.6,
};
