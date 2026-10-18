/**
 * Turns vitest's JSON output into a small public report for the /validation page
 * (test names and results only — no local paths).
 *
 *   npm run test:report
 */
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

type VitestJson = {
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  startTime: number;
  testResults: {
    name: string;
    assertionResults: { fullName: string; status: string; ancestorTitles: string[]; title: string }[];
  }[];
};

const RAW = ".vitest-report.json";
const r = JSON.parse(readFileSync(RAW, "utf8")) as VitestJson;
const files = r.testResults.map((f) => ({
  file: path.relative(process.cwd(), f.name).replace(/\\/g, "/"),
  tests: f.assertionResults.map((a) => ({ suite: a.ancestorTitles.join(" › "), title: a.title, status: a.status })),
}));

writeFileSync(
  "public/data/bangmod/tests.json",
  JSON.stringify(
    {
      ran: new Date(r.startTime).toISOString(),
      total: r.numTotalTests,
      passed: r.numPassedTests,
      failed: r.numFailedTests,
      files,
    },
    null,
    2,
  ) + "\n",
);
rmSync(RAW);
console.log(`tests.json: ${r.numPassedTests}/${r.numTotalTests} passed`);
