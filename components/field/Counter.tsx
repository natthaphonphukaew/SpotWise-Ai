"use client";

import { useEffect, useRef, useState } from "react";
import { saveFieldData, getFieldData } from "@/lib/field/store";
import { SLOT_LABEL, slotOf, type FootfallSession } from "@/lib/field/types";

const TARGET_SECONDS = 600; // 10-minute count, the standard session (SPEC §5 W2)
const MIN_SECONDS = 120;

const mmss = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Big one-thumb footfall counter. Each finished count (≥ 2 min) is saved as a session for the site. */
export function Counter({ site }: { site: string }) {
  const [count, setCount] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [flash, setFlash] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Refs so the timer callback (which auto-stops at 10 min) sees the latest values.
  const countRef = useRef(0);
  const startRef = useRef<number | null>(null);

  const running = startedAt != null;

  function stop() {
    const began = startRef.current;
    if (began == null) return;
    const seconds = Math.min(TARGET_SECONDS, (Date.now() - began) / 1000);
    const n = countRef.current;
    startRef.current = null;
    setStartedAt(null);
    setElapsed(seconds);
    if (seconds < MIN_SECONDS) {
      setMessage(`นับได้ ${mmss(seconds)} สั้นเกินไป (ต้องอย่างน้อย 2 นาที) ไม่ได้บันทึก`);
      return;
    }
    const session: FootfallSession = {
      id: `${site}-${began}`,
      site,
      startedAt: new Date(began).toISOString(),
      seconds: Math.round(seconds),
      count: n,
      slot: slotOf(new Date(began)),
    };
    const fd = getFieldData();
    saveFieldData({ ...fd, sessions: [...fd.sessions, session] });
    setMessage(`บันทึกแล้ว: ${n} คน ใน ${mmss(seconds)} (${(n / (seconds / 60)).toFixed(1)} คน/นาที)`);
  }

  // Ticks the clock; auto-stops at 10 minutes so every session is comparable.
  useEffect(() => {
    if (startedAt == null) return;
    const id = window.setInterval(() => {
      const e = (Date.now() - startedAt) / 1000;
      if (e >= TARGET_SECONDS) stop();
      else setElapsed(e);
    }, 250);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stop() reads refs only
  }, [startedAt]);

  function start() {
    const now = Date.now();
    countRef.current = 0;
    startRef.current = now;
    setCount(0);
    setElapsed(0);
    setMessage(null);
    setStartedAt(now);
  }

  function tap() {
    if (!running) return;
    countRef.current += 1;
    setCount(countRef.current);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 90);
    try {
      navigator.vibrate?.(12);
    } catch {
      // vibration not available
    }
  }

  const rate = elapsed > 5 ? count / (elapsed / 60) : null;

  return (
    <div className="flex min-h-[70dvh] flex-col">
      <div className="flex items-end justify-between border-b border-ink px-4 py-3">
        <div>
          <div className="label">คนเดินผ่านหน้าร้าน</div>
          <div className="font-mono text-[88px] leading-none font-semibold tracking-tighter tabular-nums">
            {String(count).padStart(3, "0")}
          </div>
        </div>
        <div className="text-right font-mono text-sm tabular-nums">
          <div>
            {mmss(elapsed)} / {mmss(TARGET_SECONDS)}
          </div>
          <div className="text-ink-2">{rate != null ? `≈ ${rate.toFixed(1)} คน/นาที` : "—"}</div>
          <div className="text-xs text-ink-3">
            {startedAt != null ? SLOT_LABEL[slotOf(new Date(startedAt))] : "ช่วงเวลาบันทึกตอนเริ่มนับ"}
          </div>
        </div>
      </div>

      <button
        onClick={tap}
        disabled={!running}
        aria-label="นับคนเดินผ่านเพิ่ม 1"
        className={`m-3 flex flex-1 touch-manipulation flex-col items-center justify-center gap-1 rounded-md text-xl font-medium select-none ${
          running ? (flash ? "bg-black text-paper" : "bg-ink text-paper active:scale-[0.98]") : "bg-paper-2 text-ink-3"
        }`}
      >
        {running ? "แตะเมื่อมีคนเดินผ่าน" : "กดเริ่มนับก่อน"}
        <span className="font-mono text-[11px] tracking-widest opacity-60">TAP +1</span>
      </button>

      <div className="grid grid-cols-2 border-t border-ink">
        {running ? (
          <>
            <button
              onClick={() => {
                countRef.current = Math.max(0, countRef.current - 1);
                setCount(countRef.current);
              }}
              className="border-r border-ink py-3 text-sm"
            >
              ลบ 1
            </button>
            <button onClick={stop} className="py-3 text-sm font-medium">
              หยุดและบันทึก
            </button>
          </>
        ) : (
          <button onClick={start} className="col-span-2 bg-accent py-3 text-sm font-medium text-ink">
            เริ่มนับ 10 นาที
          </button>
        )}
      </div>
      {message && (
        <p className="px-4 py-2 text-sm" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
