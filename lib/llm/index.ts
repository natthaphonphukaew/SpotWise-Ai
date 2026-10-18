import { z } from "zod";
import { cacheKey, readCache, writeCache } from "./cache";
import { GEMINI_DEFAULT_MODEL, geminiGenerate, type GenerateArgs } from "./providers/gemini";
import { LlmCacheMiss, LlmOutputError, type LlmMode, type LlmResult, type LlmTask } from "./types";

export { LlmCacheMiss, LlmOutputError } from "./types";
export type { LlmMeta, LlmResult, LlmTask } from "./types";

export type LlmConfig = {
  mode: LlmMode;
  provider: string;
  model: string;
  generate: (args: GenerateArgs) => Promise<string>;
};

/**
 * Single entry point for every LLM call (CLAUDE.md rule 6).
 * - LLM_MODE=cache (or no GEMINI_API_KEY) → demo mode: answers only from llm-cache/, never calls an API.
 * - otherwise → live: cache first, then Gemini; every new output is validated and written to the cache.
 */
export function llmConfig(env: Record<string, string | undefined> = process.env): LlmConfig {
  const live = env.LLM_MODE !== "cache" && Boolean(env.GEMINI_API_KEY);
  return {
    mode: live ? "live" : "cache",
    provider: "gemini",
    model: env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL,
    generate: geminiGenerate,
  };
}

/** zod → JSON Schema for the provider (draft keys the API does not need are dropped). */
export function toProviderSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { target: "draft-2020-12" }) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

export async function runTask<T>(task: LlmTask<T>, cfg: LlmConfig = llmConfig()): Promise<LlmResult<T>> {
  const key = cacheKey({ task: task.name, version: task.version, model: cfg.model, system: task.system, prompt: task.prompt });
  const finish = (output: unknown) => {
    const data = task.schema.parse(output);
    return task.postprocess ? task.postprocess(data) : data;
  };

  const hit = await readCache(task.name, key);
  if (hit) {
    return {
      data: finish(hit.output),
      meta: { task: task.name, model: hit.model, provider: hit.provider, mode: cfg.mode, cached: true, key, createdAt: hit.createdAt },
    };
  }
  if (cfg.mode === "cache") throw new LlmCacheMiss(task.name);

  const jsonSchema = toProviderSchema(task.schema);
  let prompt = task.prompt;
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await cfg.generate({
      model: cfg.model, system: task.system, prompt, jsonSchema, temperature: task.temperature, images: task.images,
    });
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      lastError = "response was not valid JSON";
      prompt = `${task.prompt}\n\n(รอบก่อนตอบไม่ใช่ JSON ที่ถูกต้อง ตอบเป็น JSON ตาม schema เท่านั้น)`;
      continue;
    }
    const check = task.schema.safeParse(parsed);
    if (!check.success) {
      lastError = z.prettifyError(check.error);
      prompt = `${task.prompt}\n\n(รอบก่อนไม่ผ่าน schema: ${lastError} แก้ให้ถูกต้อง)`;
      continue;
    }
    const createdAt = new Date().toISOString();
    await writeCache(task.name, key, {
      task: task.name, version: task.version, model: cfg.model, provider: cfg.provider, input: task.input, output: check.data, createdAt,
    });
    return {
      data: task.postprocess ? task.postprocess(check.data) : check.data,
      meta: { task: task.name, model: cfg.model, provider: cfg.provider, mode: cfg.mode, cached: false, key, createdAt },
    };
  }
  throw new LlmOutputError(`${task.name}: model output failed validation twice (${lastError})`);
}
