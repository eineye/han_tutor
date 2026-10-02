import { useEffect, useRef, useState } from 'react';
import Mascot, { type Mood } from './Mascot';
import { useMascotSpeech } from './useMascotSpeech';
import type { PronItem } from '../types';
import { pronunciationScore, romanize, syllableDiff, visemesFor, type Viseme } from '../lib/hangul';
import { LANG_NAME, useI18n } from '../i18n';
import type { UIKey } from '../i18n/ui';
import { listenKorean, recognitionSupported, type Recognizer } from '../lib/speech';
import { MicRecorder, type Recording } from '../lib/recorder';
import { api } from '../api';
import { ScoreBadge } from './ui';

const isLetter = (c: string) => /[\p{L}\p{N}]/u.test(c);

interface AiFeedback {
  heard: string;
  score: number;
  feedback_en: string;
  tips: { syllable: string; issue_en: string; how_to_en: string }[];
  demo?: boolean;
}

interface Props {
  items: PronItem[];
  lessonId?: string;
  compact?: boolean;
  onAllDone?: () => void;
}

/**
 * Pronunciation coach with Bori:
 * 1. Bori says the target (mouth moves with each vowel, syllables light up)
 * 2. Student records → browser speech recognition gives an instant score + syllable diff
 * 3. Optional: "Ask AI coach" sends the recording to Gemini for detailed feedback
 */
export default function PronunciationPractice({ items, lessonId, compact, onAllDone }: Props) {
  const { t, lang } = useI18n();
  const [idx, setIdx] = useState(0);
  const item = items[idx];
  const mascot = useMascotSpeech();
  const [recording, setRecording] = useState(false);
  const [interim, setInterim] = useState('');
  const [result, setResult] = useState<{ heard: string; score: number } | null>(null);
  const [audio, setAudio] = useState<Recording | null>(null);
  const [ai, setAi] = useState<AiFeedback | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState('');
  const [mood, setMood] = useState<Mood>('neutral');
  const [guide, setGuide] = useState<Viseme | null>(null);
  const recRef = useRef<Recognizer | null>(null);
  const micRef = useRef<MicRecorder | null>(null);
  const [scores, setScores] = useState<Record<number, number>>({});

  useEffect(() => {
    setResult(null);
    setAi(null);
    setAudio(null);
    setInterim('');
    setError('');
    setMood('neutral');
    setGuide(null);
  }, [idx]);

  useEffect(
    () => () => {
      recRef.current?.abort();
      micRef.current?.cancel();
    },
    [],
  );

  if (!item) return <p className="muted">No pronunciation items.</p>;

  const target = item.text.replace(/\([^)]*\)/g, '').trim();
  const canRecognize = recognitionSupported();
  const canRecord = MicRecorder.supported();

  const listen = (rate = 0.85) => {
    setMood('neutral');
    mascot.say(target, { rate });
  };

  const finish = async (heard: string) => {
    setRecording(false);
    const rec = await micRef.current?.stop();
    micRef.current = null;
    if (rec) setAudio(rec);
    if (!canRecognize) {
      // Without browser recognition, rely on the AI coach
      if (rec) askAi(rec);
      return;
    }
    const score = heard ? pronunciationScore(target, heard) : 0;
    setResult({ heard, score });
    setScores((s) => ({ ...s, [idx]: Math.max(s[idx] ?? 0, score) }));
    setMood(score >= 85 ? 'cheer' : score >= 60 ? 'happy' : 'oops');
    api('/pronunciation', { body: { lessonId, target, heard, score, source: 'browser' } }).catch(() => {});
  };

  const startRecording = async () => {
    setError('');
    setResult(null);
    setAi(null);
    setAudio(null);
    setInterim('');
    mascot.stop();
    try {
      if (canRecord) {
        micRef.current = new MicRecorder();
        await micRef.current.start();
      }
    } catch {
      setError(t('pron.micNeeded'));
      return;
    }
    setRecording(true);
    setMood('listen');
    if (canRecognize) {
      let finished = false;
      recRef.current = listenKorean({
        onInterim: setInterim,
        onResult: (best) => {
          if (finished) return;
          finished = true;
          finish(best);
        },
        onError: (e) => {
          if (e === 'not-allowed') setError(t('pron.micNeeded'));
          else if (e === 'no-speech') setError(t('pron.noSpeech'));
        },
      });
    }
  };

  const stopRecording = () => {
    if (recRef.current) recRef.current.stop();
    else finish('');
  };

  const askAi = async (rec: Recording | null = audio) => {
    if (!rec) return;
    setAiLoading(true);
    setError('');
    try {
      const r = await api<AiFeedback>('/ai/pronunciation', {
        body: { target, roman: item.roman, audioBase64: rec.base64, mimeType: rec.mimeType, lang: LANG_NAME[lang] },
      });
      setAi(r);
      if (!r.demo) {
        api('/pronunciation', { body: { lessonId, target, heard: r.heard, score: r.score, source: 'ai' } }).catch(() => {});
        if (!canRecognize) {
          setScores((s) => ({ ...s, [idx]: Math.max(s[idx] ?? 0, r.score) }));
          setMood(r.score >= 85 ? 'cheer' : r.score >= 60 ? 'happy' : 'oops');
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAiLoading(false);
    }
  };

  const chars = [...target];
  const diff = result ? syllableDiff(target, result.heard) : null;
  const viseme = guide ?? mascot.viseme;
  const bubble = recording
    ? t('pron.listening')
    : result
      ? result.score >= 85
        ? t('pron.perfect')
        : result.score >= 60
          ? t('pron.almost')
          : t('pron.tryAgain')
      : guide
        ? t(`viseme.${guide}` as UIKey)
        : item.tip_en || t('pron.hint');

  return (
    <div className={`pron ${compact ? 'pron--compact' : ''}`}>
      <div className="pron__stage">
        <div className="speech-bubble">{bubble}</div>
        <Mascot viseme={viseme} mood={mascot.speaking || guide ? 'neutral' : mood} talking={mascot.speaking} size={compact ? 130 : 180} />
      </div>

      <div className="pron__panel">
        {items.length > 1 && (
          <div className="pron__nav">
            <button className="btn-icon" disabled={idx === 0} onClick={() => setIdx(idx - 1)} aria-label={t('common.prev')}>
              ◀
            </button>
            <span>
              {idx + 1} / {items.length}
            </span>
            <button className="btn-icon" disabled={idx === items.length - 1} onClick={() => setIdx(idx + 1)} aria-label={t('common.next')}>
              ▶
            </button>
          </div>
        )}

        <div className="pron__target" lang="ko">
          {chars.map((c, i) => {
            const punct = !isLetter(c);
            const d = diff && !punct ? diff[chars.slice(0, i).filter(isLetter).length] : null;
            return (
              <span
                key={i}
                className={[
                  'syl',
                  mascot.charIndex === i ? 'syl--active' : '',
                  !punct && d ? (d.ok ? 'syl--ok' : 'syl--miss') : '',
                ].join(' ')}
                onClick={() => !punct && mascot.say(c, { rate: 0.7 })}
                title={punct ? '' : t('pron.clickSyllable')}
              >
                {c}
              </span>
            );
          })}
        </div>
        <div className="pron__roman">{item.roman || romanize(target)}</div>
        {item.tip_en && <div className="pron__tip">💡 {item.tip_en}</div>}

        <div className="mouth-guide" aria-label={t('pron.hoverMouth')}>
          {chars
            .filter(isLetter)
            .map((c, i) => {
              const v = visemesFor(c).find((x) => x !== 'M') || 'EU';
              return (
                <button key={i} className={`mouth-chip ${guide === v ? 'is-on' : ''}`} onMouseEnter={() => setGuide(v)} onMouseLeave={() => setGuide(null)} onFocus={() => setGuide(v)} onBlur={() => setGuide(null)} onClick={() => setGuide(guide === v ? null : v)}>
                  <b>{c}</b>
                  <small>{v === 'EO' ? 'ㅓ' : v === 'EU' ? 'ㅡ' : v === 'A' ? 'ㅏ' : v === 'O' ? 'ㅗ' : v === 'U' ? 'ㅜ' : v === 'I' ? 'ㅣ' : 'ㅔ'}</small>
                </button>
              );
            })}
          <span className="muted small">← {t('pron.hoverMouth')}</span>
        </div>

        <div className="pron__controls">
          <button className="btn btn--round" onClick={() => listen(0.85)} disabled={recording}>
            🔊 {t('common.listen')}
          </button>
          <button className="btn btn--ghost btn--round" onClick={() => listen(0.5)} disabled={recording}>
            🐢 {t('common.slow')}
          </button>
          {!recording ? (
            <button className="btn btn--rec btn--round" onClick={startRecording} disabled={!canRecognize && !canRecord}>
              🎤 {t('pron.speak')}
            </button>
          ) : (
            <button className="btn btn--rec is-recording btn--round" onClick={stopRecording}>
              ⏹ {t('common.stop')}
            </button>
          )}
        </div>
        {!canRecognize && (
          <p className="muted small">
            {t('pron.noRecognition')}
          </p>
        )}
        {recording && interim && <p className="pron__interim">“{interim}”</p>}
        {error && <div className="alert alert--warn">{error}</div>}

        {result && (
          <div className="pron__result">
            <div className="pron__score">
              <ScoreBadge score={result.score} />
              <div>
                <div className="small muted">{t('pron.iHeard')}</div>
                <div className="ko-mid">{result.heard || t('pron.nothing')}</div>
              </div>
            </div>
          </div>
        )}

        {audio && (
          <div className="pron__ai">
            <audio controls src={audio.url} />
            <button className="btn btn--ghost" onClick={() => askAi()} disabled={aiLoading}>
              {aiLoading ? t('pron.aiLoading') : `🤖 ${t('pron.askAi')}`}
            </button>
          </div>
        )}

        {ai && (
          <div className="ai-feedback">
            <div className="ai-feedback__head">
              <ScoreBadge score={ai.score} /> <span>{t('pron.aiHeard')}: <b lang="ko">{ai.heard}</b></span>
              {ai.demo && <span className="badge">demo</span>}
            </div>
            <p>{ai.feedback_en}</p>
            {ai.tips?.length > 0 && (
              <ul>
                {ai.tips.map((tip, i) => (
                  <li key={i}>
                    <b lang="ko">{tip.syllable}</b> — {tip.issue_en}. <i>{tip.how_to_en}</i>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {items.length > 1 && (
          <div className="pron__dots">
            {items.map((_, i) => (
              <button key={i} className={`dot ${i === idx ? 'is-current' : ''} ${scores[i] != null ? (scores[i] >= 85 ? 'is-good' : 'is-tried') : ''}`} onClick={() => setIdx(i)} aria-label={`${i + 1}`} />
            ))}
            {onAllDone && Object.keys(scores).length >= Math.min(items.length, 3) && (
              <button className="btn btn--small" onClick={onAllDone}>
                {t('common.done')} ✓
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
