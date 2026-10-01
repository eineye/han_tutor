// Thin wrapper over the Gemini REST API (generateContent).
// The API key never leaves the server. When GEMINI_API_KEY is missing, callers
// receive `null` and fall back to demo responses so the app stays usable.
import { callGemini } from './geminiClient.js';

export const hasKey = () => Boolean(process.env.GEMINI_API_KEY) && process.env.GEMINI_API_KEY !== 'none';

/** Server-side Gemini call using GEMINI_API_KEY; returns null in demo mode. */
export async function generate(opts) {
  if (!hasKey()) return null;
  return callGemini({ ...opts, apiKey: process.env.GEMINI_API_KEY });
}

export * from './prompts.js';
