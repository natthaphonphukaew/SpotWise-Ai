"use client";

import { useState, type ReactNode } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { thaiShortDate } from "@/lib/data/bangmod";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { saveProfile, useStoredProfile, type StoredProfile } from "@/lib/profile/store";

const DEFAULT_CONCEPT = "ร้านชาไข่มุก ราคา 40–60 บาท เน้นนักศึกษา มจธ. งบเปิดร้าน 300,000";

type ApiError = { error: string; examples?: string[]; mode?: string };

/** Cover layout: hero (server-rendered) beside the concept box; the profile card spans full width below. */
export function ConceptStudio({ hero }: { hero: ReactNode }) {
  const stored = useStoredProfile();
  const [draft, setDraft] = useState<string | null>(null);
  const concept = draft ?? stored?.concept ?? DEFAULT_CONCEPT;
  const setConcept = setDraft;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function analyse(text = concept) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ concept: text }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json as ApiError);
        return;
      }
      saveProfile({
        concept: text,
        profile: json.profile,
        meta: json.meta,
        edited: false,
      });
    } catch {
      setError({ error: "ติดต่อเซิร์ฟเวอร์ไม่ได้" });
    } finally {
      setBusy(false);
    }
  }

  const update = (next: StoredProfile) => saveProfile(next);

  return (
    <>
      <div className="grid items-end gap-12 lg:grid-cols-[1fr_1fr]">
        {hero}
        <div className="rounded-sm border border-ink bg-sheet p-4 lg:mb-1">
          <label htmlFor="concept" className="label">
            คอนเซ็ปต์ร้าน
          </label>
          <textarea
            id="concept"
            rows={3}
            maxLength={400}
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            className="mt-1 w-full resize-none bg-transparent text-lg leading-relaxed outline-none"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="font-mono text-[11px] text-ink-3">{concept.length}/400</span>
            <Button onClick={() => analyse()} disabled={busy || concept.trim().length < 5} aria-busy={busy}>
              {busy ? "กำลังตีความ…" : "ให้ AI ตีความ"}
            </Button>
          </div>
          {error && (
            <div className="mt-3 border-t border-rule pt-3 text-sm" role="alert">
              <p className="text-ink">{error.error}</p>
              {error.examples && error.examples.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-ink-3">ข้อความที่มีผลบันทึกไว้แล้ว:</p>
                  <ul className="mt-1 space-y-1">
                    {error.examples.map((ex) => (
                      <li key={ex}>
                        <button
                          className="text-left underline decoration-rule underline-offset-4 hover:decoration-ink"
                          onClick={() => {
                            setConcept(ex);
                            analyse(ex);
                          }}
                        >
                          {ex}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {error.mode === "cache" && (
                <p className="mt-2 text-xs text-ink-3">
                  ระบบยังไม่ได้ต่อ Gemini (ไม่มี GEMINI_API_KEY) จึงตอบได้เฉพาะข้อความที่เคยวิเคราะห์ไว้
                </p>
              )}
            </div>
          )}
        </div>
      </div>
      {stored && (
        <div className="mt-12 space-y-4">
          <ProfileCard value={stored} onChange={update} />
          <div className="flex flex-wrap items-center gap-3">
            <ButtonLink href="/map">ดูทำเลบนแผนที่</ButtonLink>
            <Button variant="ghost" onClick={() => saveProfile(null)}>
              ล้างโปรไฟล์
            </Button>
            <span className="font-mono text-[11px] text-ink-3">
              บันทึกในเบราว์เซอร์นี้ · {thaiShortDate(stored.meta.createdAt.slice(0, 10))}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
