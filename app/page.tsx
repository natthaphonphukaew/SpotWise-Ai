import { ConceptStudio } from "@/components/profile/ConceptStudio";
import { SitePicker } from "@/components/sites/SitePicker";
import { Readout, TopBar } from "@/components/TopBar";
import candidates from "@/public/data/bangmod/candidates.json";
import manifest from "@/public/data/bangmod/manifest.json";
import { thaiShortDate, type Candidate, type Manifest } from "@/lib/data/bangmod";

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
      <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-12 sm:px-8 sm:py-16">
        <ConceptStudio
          hero={
            <div>
              <div className="label">รายงานสำรวจทำเล · No.001 · บางมด</div>
              <h1 className="mt-3 font-display text-4xl leading-[1.25] font-semibold sm:text-6xl">
                ทำเลไหนควรเปิดร้าน
                <br />
                <span className="font-normal text-ink-2">และทำไม</span>
              </h1>
              <p className="mt-5 max-w-[46ch] text-ink-2">
                เล่าคอนเซ็ปต์ร้านเป็นภาษาธรรมดา AI จะแตกเป็นโปรไฟล์ที่แก้ได้
                แล้วระบบนำไปวิเคราะห์กับข้อมูลแผนที่จริงของย่าน
              </p>
              {poi && (
                <p className="mt-8 font-mono text-xs text-ink-2">
                  ฐานข้อมูลย่านบางมด: {poi.count.toLocaleString("en-US")} สถานที่ · อัปเดต {thaiShortDate(poi.fetched)}
                </p>
              )}
            </div>
          }
        />
        <SitePicker candidates={candidates as Candidate[]} center={m.center} />
      </main>
    </>
  );
}
