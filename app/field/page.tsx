import type { Metadata } from "next";
import { FieldView } from "@/components/field/FieldView";
import candidates from "@/public/data/bangmod/candidates.json";
import type { Candidate } from "@/lib/data/bangmod";

export const metadata: Metadata = { title: "Field Mode — SpotWise" };

export default function FieldPage() {
  return <FieldView candidates={candidates as Candidate[]} />;
}
