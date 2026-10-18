import type { Metadata } from "next";
import { AdvisorView } from "@/components/advisor/AdvisorView";
import candidates from "@/public/data/bangmod/candidates.json";
import type { Candidate } from "@/lib/data/bangmod";

export const metadata: Metadata = { title: "รายงานที่ปรึกษา — SpotWise" };

export default function AdvisorPage() {
  return <AdvisorView candidates={candidates as Candidate[]} />;
}
