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
 * @param {object} [opts.config] extra generationConfig fields (e.g. mediaResolution, maxOutputTokens)
 */
export async function callGemini({ apiKey, model, system, contents, schema, temperature = 0.7, config }) {
  const body = {
    contents,
    generationConfig: { temperature, ...config },
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
  const cand = data?.candidates?.[0];
  const text = cand?.content?.parts?.map((p) => p.text || '').join('') ?? '';
  const reason = cand?.finishReason || data?.promptFeedback?.blockReason || '';
  if (!text) {
    const err = new Error(`Gemini returned an empty response${reason ? ` (${reason})` : ' (possibly blocked by safety filters)'}.`);
    err.finishReason = reason;
    throw err;
  }
  if (!schema) return text;
  try {
    return JSON.parse(text);
  } catch {
    const err = new Error(reason === 'MAX_TOKENS' ? 'Gemini response was cut off (MAX_TOKENS).' : 'Gemini returned invalid JSON');
    err.finishReason = reason;
    throw err;
  }
}

const FILES_BASE = 'https://generativelanguage.googleapis.com';

/**
 * Upload a large media file with the Gemini File API (resumable upload) and wait until it is ready.
 * @param {{apiKey: string, bytes: Uint8Array, mimeType: string, name?: string, timeoutMs?: number}} opts
 * @returns {Promise<{uri: string, mimeType: string, name: string}>}
 */
export async function uploadGeminiFile({ apiKey, bytes, mimeType, name = 'media', timeoutMs = 300000 }) {
  const start = await fetch(`${FILES_BASE}/upload/v1beta/files`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(bytes.byteLength),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: name.slice(0, 120) } }),
  });
  const uploadUrl = start.headers.get('x-goog-upload-url');
  if (!start.ok || !uploadUrl) throw new Error(`Gemini file upload ${start.status}: ${(await start.text()).slice(0, 300)}`);
  const up = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' },
    body: bytes,
  });
  if (!up.ok) throw new Error(`Gemini file upload ${up.status}: ${(await up.text()).slice(0, 300)}`);
  let file = (await up.json())?.file;
  const until = Date.now() + timeoutMs;
  // Video files are processed for a while after the upload (state PROCESSING → ACTIVE)
  while (file && file.state === 'PROCESSING') {
    if (Date.now() > until) throw new Error('Gemini file processing timed out');
    await new Promise((r) => setTimeout(r, 3000));
    const res = await fetch(`${FILES_BASE}/v1beta/${file.name}`, { headers: { 'x-goog-api-key': apiKey } });
    if (!res.ok) throw new Error(`Gemini file status ${res.status}`);
    file = await res.json();
  }
  if (!file?.uri || file.state === 'FAILED') throw new Error('Gemini could not process the uploaded file');
  return { uri: file.uri, mimeType: file.mimeType || mimeType, name: file.name };
}

