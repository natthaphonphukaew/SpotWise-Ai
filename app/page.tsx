import { Readout, TopBar } from "@/components/TopBar";
import { ButtonLink } from "@/components/ui/Button";
import manifest from "@/public/data/bangmod/manifest.json";
import { thaiShortDate, type Manifest } from "@/lib/data/bangmod";

const m = manifest as unknown as Manifest;

export default function Cover() {
  const poi = m.datasets.poi;
  return (
    <>
      <TopBar
        right={
          <>
            <Readout k="AREA" v="BANGMOD" />
            <Readout k="LAT" v={m.center[1].toFixed(4)} className="hidden sm:inline" />
            <Readout k="LON" v={m.center[0].toFixed(4)} className="hidden sm:inline" />
          </>
        }
      />
      <main className="mx-auto grid w-full max-w-[1180px] flex-1 items-end gap-12 px-4 py-12 sm:px-8 sm:py-20 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="label">รายงานสำรวจทำเล · No.001 · บางมด</div>
          <h1 className="mt-3 font-display text-4xl leading-[1.25] font-semibold sm:text-6xl">
            ทำเลไหนควรเปิดร้าน
            <br />
            <span className="font-normal text-ink-2">และทำไม</span>
          </h1>
          <p className="mt-5 max-w-[46ch] text-ink-2">
            ทุกตัวเลขบอกที่มา ค่าไหนประมาณจะบอกว่าประมาณ และถ้าข้อมูลยังไม่พอ ระบบจะบอกว่าต้องไปเก็บอะไรเพิ่ม
          </p>
          {poi && (
            <p className="mt-8 font-mono text-xs text-ink-2">
              ฐานข้อมูลย่านบางมด: {poi.count.toLocaleString("en-US")} สถานที่ · อัปเดต {thaiShortDate(poi.fetched)}
            </p>
          )}
        </div>

        <div className="rounded-sm border border-ink bg-sheet p-4">
          <label htmlFor="concept" className="label">
            คอนเซ็ปต์ร้าน
          </label>
          <textarea
            id="concept"
            name="concept"
            rows={3}
            defaultValue="ร้านชาไข่มุก ราคา 40–60 บาท เน้นนักศึกษา มจธ. งบเปิดร้าน 300,000"
            className="mt-1 w-full resize-none bg-transparent text-lg leading-relaxed outline-none"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="font-mono text-[11px] text-ink-3">AI PROFILER · สัปดาห์ที่ 2</span>
            <ButtonLink href="/map">ดูแผนที่ย่าน</ButtonLink>
          </div>
        </div>
      </main>
    </>
  );
}
