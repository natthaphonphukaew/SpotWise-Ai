import { GoogleGenAI } from "@google/genai";

export const GEMINI_DEFAULT_MODEL = "gemini-3.8-flash";

export type GenerateArgs = {
  model: string;
  system: string;
  prompt: string;
  jsonSchema: Record<string, unknown>;
  temperature?: number;
  images?: { mimeType: string; data: string }[]; // base64
};

/** Gemini free tier via @google/genai, JSON output constrained by a JSON Schema. Returns raw text. */
export async function geminiGenerate({ model, system, prompt, jsonSchema, temperature = 0.2, images = [] }: GenerateArgs): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const res = await ai.models.generateContent({
    model,
    contents: images.length ? [...images.map((i) => ({ inlineData: i })), { text: prompt }] : prompt,
    config: {
      systemInstruction: system,
      responseMimeType: "application/json",
      responseJsonSchema: jsonSchema,
      temperature,
    },
  });
  const text = res.text;
  if (!text) throw new Error("Gemini returned an empty response");
  return text;
}
