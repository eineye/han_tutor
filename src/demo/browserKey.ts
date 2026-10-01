// Optional Gemini key stored in the tester's own browser (demo build only). No side effects on import.
const GEMINI_KEY = 'hantutor.demo.geminiKey';

export function getBrowserGeminiKey(): string {
  try {
    return localStorage.getItem(GEMINI_KEY) || '';
  } catch {
    return '';
  }
}
export function setBrowserGeminiKey(key: string) {
  try {
    if (key.trim()) localStorage.setItem(GEMINI_KEY, key.trim());
    else localStorage.removeItem(GEMINI_KEY);
  } catch {
    /* storage unavailable */
  }
}
