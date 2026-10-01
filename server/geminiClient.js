// Gemini REST call (generateContent). Pure fetch, no Node APIs: shared by the server and the browser demo.
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * @param {object} opts
 * @param {string} opts.apiKey
 * @param {string} opts.model
 * @param {string} [opts.system]
 * @param {Array<{role:'user'|'model', parts:any[]}>} opts.contents
 * @param {object} [opts.schema] JSON schema for structured output
 * @param {number} [opts.temperature]
 */
export async function callGemini({ apiKey, model, system, contents, schema, temperature = 0.7 }) {
  const body = {
    contents,
    generationConfig: { temperature },
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  if (schema) {
    body.generationConfig.responseMimeType = 'application/json';
    body.generationConfig.responseSchema = schema;
  }
  const res = await fetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API ${res.status}: ${text.slice(0, 500)}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') ?? '';
  if (!text) throw new Error('Gemini returned an empty response (possibly blocked by safety filters).');
  if (!schema) return text;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Gemini returned invalid JSON');
  }
}

