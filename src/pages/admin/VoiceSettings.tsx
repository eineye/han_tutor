import { useEffect, useState } from 'react';
import { api } from '../../api';
import { listKoreanVoices, setTtsSettings, speak, stopSpeaking, type TtsSettings } from '../../lib/speech';
import { GEMINI_VOICES, VOICE_PRESETS } from '../../../server/ttsVoices.js';

const SAMPLE = '안녕하세요. 저는 보리예요. 같이 한국어를 공부해요!';
const GENDER = { male: '남성', female: '여성', unknown: '?' } as const;

/** 교사 설정: 학생 화면에서 보리가 읽어 주는 목소리의 음색(TTS 스타일) */
export default function VoiceSettings({ initial, ai, onSaved }: { initial: TtsSettings; ai: boolean; onSaved: (msg: string) => void }) {
  const [t, setT] = useState<TtsSettings>(initial);
  const [base, setBase] = useState<TtsSettings>(initial);
  const [voices, setVoices] = useState(listKoreanVoices);
  const [saving, setSaving] = useState(false);
  const [check, setCheck] = useState('');
  const dirty = JSON.stringify(t) !== JSON.stringify(base);

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const update = () => setVoices(listKoreanVoices());
    window.speechSynthesis.addEventListener?.('voiceschanged', update);
    update();
    return () => {
      window.speechSynthesis.removeEventListener?.('voiceschanged', update);
      stopSpeaking();
    };
  }, []);

  const preview = (style: TtsSettings) => speak(SAMPLE, { style, useRecording: false });

  /** Make AI voice for a short syllable and a sentence (like the Hangeul Lab) and report the result. */
  const runCheck = async () => {
    setCheck('시험 중…');
    const out: string[] = [];
    for (const text of ['아', '기역, 가.', '안녕하세요. 만나서 반가워요.']) {
      try {
        const r = await api<{ voice: string; cached: boolean }>('/tts', { body: { text, preset: t.preset, voice: t.geminiVoice || undefined } });
        out.push(`✓ 「${text}」 ${r.voice}${r.cached ? ' (저장된 소리)' : ''}`);
      } catch (e) {
        out.push(`✗ 「${text}」 ${(e as Error).message}`);
      }
    }
    setCheck(out.join('  ·  '));
  };
  const hasMale = voices.some((v) => v.gender === 'male');
  const gem = t.engine === 'gemini';

  const save = async () => {
    setSaving(true);
    try {
      const r = await api<{ tts: TtsSettings }>('/admin/settings', { method: 'PUT', body: { tts: t } });
      setT(r.tts);
      setBase(r.tts);
      setTtsSettings(r.tts);
      onSaved('음색을 저장했습니다 ✓ 학생 화면에 바로 적용됩니다.');
    } catch (e) {
      onSaved((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card form voice-settings">
      <h3>🔊 발음 음성 (TTS 음색)</h3>
      <p className="muted small">
        학생 화면에서 보리가 읽어 주는 목소리입니다 (레슨·한글 연구소·발음 코치·AI 대화 등). 「녹음 관리」에 녹음이 있는 문장은 녹음이 먼저 재생됩니다.
      </p>

      <div className="voice-engine">
        <label className={`voice-card ${gem ? 'is-active' : ''}`}>
          <input type="radio" name="voice-engine" checked={gem} onChange={() => setT({ ...t, engine: 'gemini' })} />
          <span className="voice-card__body">
            <b>🤖 AI 음성 (Gemini) — 권장</b>
            <small className="muted">사람처럼 자연스럽고 남녀·음색이 확실히 다릅니다. 모든 학생 기기에서 같은 목소리. 드라마 등장인물도 인물마다 다른 목소리로 읽습니다. 처음 읽는 문장은 1~3초 걸리고, 한 번 만든 소리는 저장되어 바로 재생됩니다.</small>
          </span>
        </label>
        <label className={`voice-card ${!gem ? 'is-active' : ''}`}>
          <input type="radio" name="voice-engine" checked={!gem} onChange={() => setT({ ...t, engine: 'browser' })} />
          <span className="voice-card__body">
            <b>💻 브라우저 음성 (무료)</b>
            <small className="muted">기기에 설치된 음성을 씁니다. 기기마다 다르고, 한국어 음성이 여성 1~2개뿐인 기기가 많아 음색 차이가 작습니다.</small>
          </span>
        </label>
      </div>
      {gem && !ai && (
        <div className="alert alert--warn">
          AI 음성을 쓰려면 Gemini API 키가 필요합니다 (위 「Gemini AI」 항목). 키가 없으면 브라우저 음성으로 읽습니다.
        </div>
      )}

      <div className="voice-grid">
        {VOICE_PRESETS.map((p) => (
          <label key={p.id} className={`voice-card ${t.preset === p.id ? 'is-active' : ''}`}>
            <input type="radio" name="voice-preset" checked={t.preset === p.id} onChange={() => setT({ ...t, preset: p.id })} />
            <span className="voice-card__body">
              <b>{p.label}</b>
              <small className="muted">
                {p.desc}
                {gem && ` · ${p.gemini.voice}`}
              </small>
            </span>
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={(e) => {
                e.preventDefault();
                preview({ ...t, preset: p.id, voiceName: '', geminiVoice: '' });
              }}
            >
              ▶ 듣기
            </button>
          </label>
        ))}
      </div>

      <div className="voice-tune">
        {!gem && (
          <label>
            높낮이 조절 <b>{t.pitchAdj > 0 ? '+' : ''}{t.pitchAdj.toFixed(2)}</b>
            <input type="range" min={-0.4} max={0.4} step={0.05} value={t.pitchAdj} onChange={(e) => setT({ ...t, pitchAdj: Number(e.target.value) })} />
          </label>
        )}
        <label>
          빠르기 조절 <b>×{t.rateAdj.toFixed(2)}</b>
          <input type="range" min={0.7} max={1.3} step={0.05} value={t.rateAdj} onChange={(e) => setT({ ...t, rateAdj: Number(e.target.value) })} />
        </label>
        {gem ? (
          <label>
            AI 목소리 직접 고르기 (선택)
            <select value={t.geminiVoice} onChange={(e) => setT({ ...t, geminiVoice: e.target.value })}>
              <option value="">음색에 맞춰 자동</option>
              <optgroup label="여성">
                {GEMINI_VOICES.filter((v) => v.gender === 'female').map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} · {v.desc}
                  </option>
                ))}
              </optgroup>
              <optgroup label="남성">
                {GEMINI_VOICES.filter((v) => v.gender === 'male').map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} · {v.desc}
                  </option>
                ))}
              </optgroup>
            </select>
            <small className="muted">고르면 음색의 말투(밝게·차분하게 등)는 유지하고 목소리만 바꿉니다.</small>
          </label>
        ) : (
          <label>
            특정 음성 고정 (선택)
            <select value={t.voiceName} onChange={(e) => setT({ ...t, voiceName: e.target.value })}>
              <option value="">자동 — 음색에 맞는 음성을 기기마다 고름 (권장)</option>
              {voices.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name} · {GENDER[v.gender]} · {v.local ? '기기' : '온라인'}
                </option>
              ))}
            </select>
            <small className="muted">고정한 음성이 없는 학생 기기에서는 자동으로 고릅니다.</small>
          </label>
        )}
        {gem && (
          <label>
            AI 음성 모델
            <input value={t.model} onChange={(e) => setT({ ...t, model: e.target.value.trim() })} list="tts-models" />
            <datalist id="tts-models">
              <option value="gemini-2.5-flash-preview-tts" />
              <option value="gemini-2.5-pro-preview-tts" />
            </datalist>
            <small className="muted">보통은 그대로 두세요. Google이 모델 이름을 바꾸면 여기서 고칩니다.</small>
          </label>
        )}
      </div>

      {!gem && (
        <p className="muted small">
          이 기기의 한국어 음성: {voices.length ? voices.map((v) => `${v.name}(${GENDER[v.gender]})`).join(', ') : '없음 — 기기 설정에서 한국어 음성을 설치하세요'}
          {!hasMale && voices.length > 0 && ' · 남성 음성이 없어서 남성 음색은 목소리를 낮춰서 흉내 냅니다 (부자연스러울 수 있음).'}
        </p>
      )}

      <div className="row">
        <button type="button" className="btn btn--ghost" onClick={() => preview(t)}>
          ▶ 현재 설정으로 듣기
        </button>
        <button type="button" className="btn" onClick={save} disabled={!dirty || saving}>
          💾 음색 저장
        </button>
        {gem && (
          <button type="button" className="btn btn--ghost" onClick={runCheck} disabled={!ai}>
            🔍 AI 음성 시험 (한글 연구소 소리)
          </button>
        )}
      </div>
      {check && <p className="small voice-check">{check}</p>}
    </section>
  );
}
