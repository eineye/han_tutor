// 미디어 자막·가사 추출기: 화면 공용 타입과 도우미
import { parseTime } from '../../server/subtitles.js';

export interface Segment {
  start: number;
  end: number;
  speaker: string;
  section: string;
  text: string;
  onscreen: string;
  /** 언어 코드 → 번역문 */
  tr: Record<string, string>;
}
export interface SummaryBlock {
  title?: string;
  summary: string;
  keyPoints: string[];
}
export interface TranscriptSource {
  kind: 'youtube' | 'url' | 'file' | 'subtitle' | 'blank';
  url?: string;
  name?: string;
  mime?: string;
  size?: number;
  range?: { start: number; end: number };
}
export interface Transcript {
  id: string;
  title: string;
  mode: 'video' | 'lyrics';
  language: string;
  summary: string;
  /** 기본 요약(summary·keyPoints)의 언어 */
  summaryLang?: string;
  keyPoints: string[];
  speakers: string[];
  /** 언어별 요약 (번역·다른 언어로 다시 만든 요약) */
  summaries: Record<string, SummaryBlock>;
  source: TranscriptSource;
  segments: Segment[];
  demo?: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface TranscriptRow extends Omit<Transcript, 'segments' | 'summaries' | 'keyPoints'> {
  segmentCount: number;
  duration: number;
}

/** 이번 브라우저 탭에서 연 미디어 파일 (저장하지 않음 — 자료 id → 재생 주소) */
const media = new Map<string, { url: string; video: boolean; name: string }>();
export const mediaCache = {
  get: (id: string) => media.get(id),
  set(id: string, file: Blob, name: string) {
    const old = media.get(id);
    if (old) URL.revokeObjectURL(old.url);
    media.set(id, { url: URL.createObjectURL(file), video: file.type.startsWith('video/'), name });
  },
};

/** 초 → "0:05.2" / "1:02:03.4" (편집 칸 표시용) */
export function fmtTime(sec: number): string {
  const s = Math.max(0, Number(sec) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = (s % 60).toFixed(1).padStart(4, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

/** "1:02.5", "62.5", "00:01:02,500" → 초 (잘못된 값이면 null) */
export function readTime(v: string): number | null {
  const t = parseTime(String(v).trim());
  return t == null || !isFinite(t) || t < 0 ? null : Math.round(t * 100) / 100;
}

export const emptySegment = (start = 0, end = start + 2): Segment => ({ start, end, speaker: '', section: '', text: '', onscreen: '', tr: {} });

export function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ''));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/** 저장할 파일 내려받기 */
export function saveFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 파일 이름에 쓸 수 없는 글자 정리 */
export const safeName = (s: string) => (s || 'transcript').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'transcript';
