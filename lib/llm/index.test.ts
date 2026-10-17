import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { LlmCacheMiss, LlmOutputError, llmConfig, runTask, type LlmConfig, type LlmTask } from "./index";

const schema = z.object({ answer: z.number() });
const task = (prompt = "q"): LlmTask<{ answer: number }> => ({
  name: "test-task", version: 1, system: "sys", prompt, schema, input: { prompt },
});

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "llm-cache-"));
  process.env.LLM_CACHE_DIR = dir;
});
afterEach(async () => {
  delete process.env.LLM_CACHE_DIR;
  await rm(dir, { recursive: true, force: true });
});

const live = (generate: LlmConfig["generate"]): LlmConfig => ({ mode: "live", provider: "fake", model: "m1", generate });

describe("llmConfig", () => {
  it("uses demo (cache) mode without an API key", () => {
    expect(llmConfig({}).mode).toBe("cache");
    expect(llmConfig({ GEMINI_API_KEY: "k", LLM_MODE: "cache" }).mode).toBe("cache");
    expect(llmConfig({ GEMINI_API_KEY: "k" }).mode).toBe("live");
  });
});

describe("runTask", () => {
  it("calls the provider once, then serves the same input from cache", async () => {
    const generate = vi.fn().mockResolvedValue('{"answer": 42}');
    const first = await runTask(task(), live(generate));
    const second = await runTask(task(), live(generate));
    expect(first.data.answer).toBe(42);
    expect(first.meta.cached).toBe(false);
    expect(second.meta.cached).toBe(true);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("demo mode never calls the provider and reports a cache miss", async () => {
    const generate = vi.fn();
    await expect(runTask(task("new"), { ...live(generate), mode: "cache" })).rejects.toBeInstanceOf(LlmCacheMiss);
    expect(generate).not.toHaveBeenCalled();
  });

  it("demo mode answers from entries written in live mode", async () => {
    await runTask(task(), live(vi.fn().mockResolvedValue('{"answer": 7}')));
    const res = await runTask(task(), { ...live(vi.fn()), mode: "cache" });
    expect(res.data.answer).toBe(7);
  });

  it("retries once on invalid output, then gives up", async () => {
    const fixed = vi.fn().mockResolvedValueOnce('{"answer": "no"}').mockResolvedValueOnce('{"answer": 1}');
    expect((await runTask(task("a"), live(fixed))).data.answer).toBe(1);

    const broken = vi.fn().mockResolvedValue("not json");
    await expect(runTask(task("b"), live(broken))).rejects.toBeInstanceOf(LlmOutputError);
    expect(broken).toHaveBeenCalledTimes(2);
  });

  it("keys the cache by model, so another model is not served stale output", async () => {
    const generate = vi.fn().mockResolvedValue('{"answer": 3}');
    await runTask(task(), live(generate));
    await runTask(task(), { ...live(generate), model: "m2" });
    expect(generate).toHaveBeenCalledTimes(2);
  });
});
