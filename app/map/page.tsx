import type { Metadata } from "next";
import { MapExplorer } from "@/components/map/MapExplorer";
import manifest from "@/public/data/bangmod/manifest.json";
import candidates from "@/public/data/bangmod/candidates.json";
import type { Candidate, Manifest } from "@/lib/data/bangmod";

export const metadata: Metadata = { title: "แผนที่ย่านบางมด — SpotWise" };

export default function MapPage() {
  return <MapExplorer manifest={manifest as unknown as Manifest} candidates={candidates as Candidate[]} />;
}
