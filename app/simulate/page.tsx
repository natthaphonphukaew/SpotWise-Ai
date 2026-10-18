import type { Metadata } from "next";
import { SimulateView } from "@/components/simulate/SimulateView";
import candidates from "@/public/data/bangmod/candidates.json";
import type { Candidate } from "@/lib/data/bangmod";

export const metadata: Metadata = { title: "จำลองการเงิน — SpotWise" };

export default function SimulatePage() {
  return <SimulateView candidates={candidates as Candidate[]} />;
}
