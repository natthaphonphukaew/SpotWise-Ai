import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Readout, TopBar } from "@/components/TopBar";
import { GroundingCard } from "@/components/validation/GroundingCard";
import backtest from "@/public/data/bangmod/backtest.json";
import evalLabels from "@/public/data/bangmod/eval_labels.json";
import evalPoi from "@/public/data/bangmod/eval_poi.json";
import manifest from "@/public/data/bangmod/manifest.json";
import poiAi from "@/public/data/bangmod/poi_ai.json";
import tests from "@/public/data/bangmod/tests.json";
import { thaiShortDate } from "@/lib/data/bangmod";

export const metadata: Metadata = { title: "ผลการทดสอบ — SpotWise" };

const pct = (x: number | null | undefined) => (x == null ? "—" : `${Math.round(x * 1000) / 10}%`);
const n = (x: number) => x.toLocaleString("en-US");

type Bt = {
  branches: number;
  auc_vs_random_points: number;
  auc_vs_ordinary_shops: number;
  mean_score: { chains: number; random_points: number; ordinary_shops: number };
  n_random_points: number;
  n_ordinary_shops: number;
};

/** SPEC §9: how we know the AI and the scores are useful — every figure here comes from a script in the repo. */
export default function ValidationPage() {
  const poiDs = manifest.datasets.poi as {
    count: number;
    fetched: string;
    rejected: number;
    rejected_by_reason: Record<string, number>;
    by_verification: Record<string, number>;
  };
  const bt = backtest as unknown as {
    radius_m: number;
    method: string;
    caveats: string[];
    bubble_tea: Bt;
    coffee: Bt;
    created: string;
  };

  return (
    <>
      <TopBar right={<Readout k="TESTS" v={`${tests.passed}/${tests.total}`} />} />
      <main className="mx-auto w-full max-w-[1000px] flex-1 px-4 py-10 sm:px-8">
        <div className="label">ผลการทดสอบ · No.001 · บางมด</div>
        <h1 className="mt-2 font-display text-4xl leading-tight font-semibold">เรารู้ได้อย่างไรว่ามันใช้ได้</h1>
        <p className="mt-3 max-w-[70ch] text-ink-2">
          ทุกตัวเลขในหน้านี้มาจากสคริปต์ใน repo ที่รันซ้ำได้ ระบุวิธีวัดและข้อจำกัดไว้คู่กัน รวมถึงจุดที่ผลยังไม่ดี
        </p>

        <Block
          no="1"
          title="ข้อมูลสถานที่ถูกที่จริงไหม"
          how={`ตรวจพิกัดทุกจุดก่อนใช้ (data-pipeline/validate.py) · ข้อมูล ${thaiShortDate(poiDs.fetched)}`}
        >
          <Stats
            items={[
              ["สถานที่ที่ใช้", n(poiDs.count)],
              ["ตัดออก (ปักผิดย่าน)", n(poiDs.rejected)],
              ["คัดกรองด้วยมือ (CampusSpot)", n(poiDs.by_verification.curated ?? 0)],
              ["ยังไม่ยืนยัน", n(poiDs.by_verification.unverified ?? 0)],
            ]}
          />
          <p className="mt-3 text-sm text-ink-2">
            เหตุผลที่ตัด:{" "}
            {Object.entries(poiDs.rejected_by_reason)
              .map(([k, v]) => `${REASON[k] ?? k} ${v}`)
              .join(" · ")}{" "}
            · ตัวอย่างที่จับได้ เช่น ร.ร.ปทุมคงคา (เอกมัย), รพ.ศิริราช ที่ถูกปักหมุดในบางมด
          </p>
        </Block>

        <Block
          no="2"
          title="AI จัดหมวดสถานที่ดีกว่ากฎไหม"
          how={`AI จัดแล้ว ${n(poiAi.count)}/${n(poiAi.total)} จุดในรัศมี 1.5 กม. (${poiAi.model}) · npm run eval:poi / eval:labels`}
        >
          <table className="w-full text-[15px]">
            <thead>
              <tr className="border-b border-ink text-left">
                <th className="py-1.5 font-medium">ชุดวัด</th>
                <th className="py-1.5 text-right font-medium">กฎ</th>
                <th className="py-1.5 text-right font-medium">AI</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-rule">
                <td className="py-1.5">
                  เทียบหมวด CampusSpot (n={evalPoi.n}, ผ่อนปรนร้านของหวาน)
                  <span className="block text-xs text-ink-3">ชุดนี้คัดจากหมวดเดียวกับที่กฎอ่าน จึงเอนเข้าข้างกฎ</span>
                </td>
                <td className="py-1.5 text-right font-mono">{pct(evalPoi.rule_accuracy_lenient)}</td>
                <td className="py-1.5 text-right font-mono">{pct(evalPoi.ai_accuracy_lenient)}</td>
              </tr>
              <tr className="border-b border-rule">
                <td className="py-1.5">
                  label ด้วยมือ เฉพาะจุดที่กฎกับ AI เห็นต่าง
                  <span className="block text-xs text-ink-3">
                    กรอกแล้ว {evalLabels.labelled}/{evalLabels.sample} · docs/validation/label_sample.csv
                  </span>
                </td>
                <td className="py-1.5 text-right font-mono">{pct(evalLabels.rule_accuracy)}</td>
                <td className="py-1.5 text-right font-mono">{pct(evalLabels.ai_accuracy)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-sm text-ink-2">
            ยังสรุปไม่ได้จนกว่าจะ label ด้วยมือครบ สิ่งที่เห็นแล้วคือในจุดที่ AI จัดแล้ว AI พบร้านชาไข่มุก (คู่แข่งตรง){" "}
            {evalPoi.bubble_tea_found.ai} ร้าน เทียบกับกฎ {evalPoi.bubble_tea_found.rule} ร้าน เช่น แบรนด์ที่หมวดดิบเป็น
            &quot;ร้านกาแฟ&quot; หรือ &quot;ร้านอาหาร&quot;
          </p>
        </Block>

        <Block
          no="3"
          title="คะแนนขยับไปทางที่ควรไหม"
          how={`unit test แบบ monotonicity · รันล่าสุด ${tests.ran.slice(0, 10)} · npm run test:report`}
        >
          <p className="font-mono text-sm">
            ผ่าน <b className="text-ink">{tests.passed}</b>/{tests.total}
            {tests.failed > 0 && <span className="text-comp"> · ล้ม {tests.failed}</span>}
          </p>
          <ul className="mt-2 columns-1 gap-6 text-sm text-ink-2 md:columns-2">
            {tests.files
              .flatMap((f) => f.tests.filter((t) => /→|monoton|higher|lower|more|ขึ้น/i.test(t.title)))
              .map((t) => (
                <li key={t.suite + t.title} className="mb-1 break-inside-avoid">
                  <span className={t.status === "passed" ? "text-ink" : "text-comp"}>
                    {t.status === "passed" ? "✓" : "✗"}
                  </span>{" "}
                  {t.title}
                </li>
              ))}
          </ul>
        </Block>

        <Block no="4" title="คะแนนเลือกทำเลได้เหมือนมืออาชีพไหม (backtest แบรนด์เชน)" how={bt.method}>
          <table className="w-full text-[15px]">
            <thead>
              <tr className="border-b border-ink text-left">
                <th className="py-1.5 font-medium">แบรนด์</th>
                <th className="py-1.5 text-right font-medium">สาขา</th>
                <th className="py-1.5 text-right font-medium">AUC vs จุดสุ่ม</th>
                <th className="py-1.5 text-right font-medium">AUC vs ร้านทั่วไป</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["ชาไข่มุก", bt.bubble_tea],
                  ["กาแฟ", bt.coffee],
                ] as const
              ).map(([label, r]) => (
                <tr key={label} className="border-b border-rule">
                  <td className="py-1.5">{label}</td>
                  <td className="py-1.5 text-right font-mono">{r.branches}</td>
                  <td className="py-1.5 text-right font-mono">{r.auc_vs_random_points.toFixed(2)}</td>
                  <td className="py-1.5 text-right font-mono">{r.auc_vs_ordinary_shops.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-sm text-ink-2">
            อ่านผล: 0.5 = เดาสุ่ม · คะแนนแยก &quot;ทำเลค้าขาย&quot; ออกจากจุดทั่วไปได้ชัด (≈0.8)
            แต่แยกสาขาเชนออกจากร้านทั่วไปได้น้อย (0.53–0.61) แปลว่าตอนนี้คะแนนบอกได้ว่าย่านไหนน่าค้าขาย
            แต่ยังไม่ละเอียดพอจะบอกว่าจุดไหนในย่านดีกว่ากัน ซึ่งเป็นเหตุผลที่ต้องมีข้อมูลหน้างาน
          </p>
          <ul className="mt-2 list-disc pl-5 text-xs text-ink-3">
            {bt.caveats.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </Block>

        <Block
          no="5"
          title="AI แต่งข้อมูลขึ้นเองไหม (grounding)"
          how="ตรวจทุกประโยคในรายงาน: อ้างหลักฐานที่มีจริง และตัวเลขตรงกับที่อ้าง (lib/advisor/grounding.ts)"
        >
          <GroundingCard />
        </Block>

        <p className="mt-12 border-t border-ink pt-3 text-xs text-ink-3">
          สิ่งที่ยังต้องทำ: label ด้วยมือ 100 จุด · นับคนหน้าร้านจริงที่ทำเลสำรวจ · ถามร้านแถวนั้นเรื่องยอดขายช่วงปิดภาค
          ·{" "}
          <Link href="/" className="underline decoration-rule underline-offset-4 hover:decoration-ink">
            กลับหน้าแรก
          </Link>
        </p>
      </main>
    </>
  );
}

const REASON: Record<string, string> = {
  postcode_outside: "รหัสไปรษณีย์นอกย่าน",
  name_mentions_elsewhere: "ชื่อระบุที่อื่น",
  osm_name_elsewhere: "OSM รู้จักชื่อนี้ที่อื่น",
  locality_outside: "ที่อยู่นอกย่าน",
};

function Block({ no, title, how, children }: { no: string; title: string; how: string; children: ReactNode }) {
  return (
    <section className="mt-10 border-t border-ink pt-4">
      <div className="grid gap-x-6 gap-y-2 md:grid-cols-[48px_1fr]">
        <span className="font-mono text-sm text-ink-3">{no.padStart(2, "0")}</span>
        <div>
          <h2 className="font-display text-[24px] leading-snug font-semibold">{title}</h2>
          <p className="mt-1 text-xs text-ink-3">{how}</p>
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </section>
  );
}

function Stats({ items }: { items: [string, string][] }) {
  return (
    <dl className="grid grid-cols-2 border-y border-rule md:grid-cols-4">
      {items.map(([k, v]) => (
        <div key={k} className="border-r border-rule px-3 py-2 last:border-r-0">
          <dt className="label">{k}</dt>
          <dd className="mt-0.5 font-mono text-xl tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
