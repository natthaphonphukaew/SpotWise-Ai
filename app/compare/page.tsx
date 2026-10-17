import type { Metadata } from "next";
import { CompareView } from "@/components/compare/CompareView";
import candidates from "@/public/data/bangmod/candidates.json";
import manifest from "@/public/data/bangmod/manifest.json";
import type { Candidate, Manifest } from "@/lib/data/bangmod";

export const metadata: Metadata = { title: "เปรียบเทียบทำเล — SpotWise" };

export default function ComparePage() {
  return <CompareView manifest={manifest as unknown as Manifest} candidates={candidates as Candidate[]} />;
}
