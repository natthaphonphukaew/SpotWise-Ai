import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CacheEntry } from "./types";

/**
 * File cache for LLM outputs, committed to the repo so the deployed demo can answer
 * without calling any API (CLAUDE.md rule 5). Writes are best-effort: on a read-only
 * filesystem (Vercel) they are skipped.
 */
export const cacheDir = () => process.env.LLM_CACHE_DIR || path.join(process.cwd(), "llm-cache");

export function cacheKey(parts: { task: string; version: number; model: string; system: string; prompt: string }): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 32);
}

const file = (task: string, key: string) => path.join(cacheDir(), task, `${key}.json`);

export async function readCache(task: string, key: string): Promise<CacheEntry | null> {
  try {
    return JSON.parse(await readFile(file(task, key), "utf8")) as CacheEntry;
  } catch {
    return null;
  }
}

export async function writeCache(task: string, key: string, entry: CacheEntry): Promise<boolean> {
  try {
    await mkdir(path.dirname(file(task, key)), { recursive: true });
    await writeFile(file(task, key), JSON.stringify(entry, null, 2) + "\n", "utf8");
    return true;
  } catch {
    return false;
  }
}

/** Inputs that have cached outputs for a task (used to suggest demo inputs on a cache miss). */
export async function listCachedInputs(task: string): Promise<unknown[]> {
  try {
    const names = (await readdir(path.join(cacheDir(), task))).filter((n) => n.endsWith(".json"));
    const entries = await Promise.all(names.map((n) => readCache(task, n.replace(/\.json$/, ""))));
    return entries.filter((e): e is CacheEntry => e !== null).map((e) => e.input);
  } catch {
    return [];
  }
}
