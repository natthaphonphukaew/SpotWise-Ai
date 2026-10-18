import type { SimulateInputs } from "@/lib/compare/store";
import type { BusinessProfile } from "@/lib/profile/schema";
import { addMonths, FINANCE_DEFAULTS, type FinanceInputs } from "@/lib/scoring/finance";
import type { SiteScore } from "@/lib/scoring/locscore";

/** First month after `now`, the default opening month. Call only on the client (uses the clock). */
export function nextMonth(now: Date = new Date()): string {
  return addMonths(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`, 1);
}

/** Simulator inputs for one site: user overrides first, then Loc-Score / profile, then defaults. */
export function financeInputs(
  score: SiteScore,
  sim: SimulateInputs,
  avgTicketThb: number,
  rentThb: number | null,
  profile: BusinessProfile | null,
  startMonth: string,
): FinanceInputs {
  return {
    customersPerDay: sim.customersPerDay ?? score.customers.mid,
    avgTicketThb,
    cogsShare: sim.cogsShare ?? FINANCE_DEFAULTS.cogsShare,
    rentThb: rentThb ?? 0,
    staffThb: sim.staffThb ?? FINANCE_DEFAULTS.staffThb,
    otherFixedThb: sim.otherFixedThb ?? FINANCE_DEFAULTS.otherFixedThb,
    setupThb: sim.setupThb ?? profile?.budget_thb ?? FINANCE_DEFAULTS.setupThb,
    openDaysPerMonth: FINANCE_DEFAULTS.openDaysPerMonth,
    breakFactor: sim.breakFactor ?? FINANCE_DEFAULTS.breakFactor,
    specialFactor: sim.specialFactor ?? FINANCE_DEFAULTS.specialFactor,
    startMonth: sim.startMonth ?? startMonth,
  };
}
