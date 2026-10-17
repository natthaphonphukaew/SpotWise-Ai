import type { z } from "zod";

/** One structured LLM job. `version` must be bumped whenever the prompt or schema changes. */
export type LlmTask<T> = {
  name: string;
  version: number;
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  temperature?: number;
  /** Human-readable input stored next to the cached output (lets demo mode list what it has). */
  input: unknown;
  /** Deterministic clean-up applied after validation (e.g. normalise weights). */
  postprocess?: (data: T) => T;
};

export type LlmMode = "live" | "cache";

export type LlmMeta = {
  task: string;
  model: string;
  provider: string;
  mode: LlmMode;
  cached: boolean;
  key: string;
  createdAt: string;
};

export type LlmResult<T> = { data: T; meta: LlmMeta };

export type CacheEntry = {
  task: string;
  version: number;
  model: string;
  provider: string;
  input: unknown;
  output: unknown;
  createdAt: string;
};

/** Demo / cache-only mode and nothing cached for this exact input. */
export class LlmCacheMiss extends Error {
  constructor(public task: string) {
    super(`No cached result for task "${task}" and live calls are disabled`);
  }
}

export class LlmOutputError extends Error {}
