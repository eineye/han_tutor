import { useEffect, useState } from 'react';
import { api } from '../../api';
import { listKoreanVoices, setTtsSettings, speak, stopSpeaking, type TtsSettings } from '../../lib/speech';
import { VOICE_PRESETS } from '../../../server/ttsVoices.js';

const SAMPLE = '안녕하세요. 저는 보리예요. 같이 한국어를 공부해요!';
const GENDER = { male: '남성', female: '여성', unknown: '?' } as const;

/** 교사 설정: 학생 화면에서 보리가 읽어 주는 목소리의 음색(TTS 스타일) */
export default function VoiceSettings({ initial, onSaved }: { initial: TtsSettings; onSaved: (msg: string) => void }) {
  const [t, setT] = useState<TtsSettings>(initial);
  const [base, setBase] = useState<TtsSettings>(initial);
  const [voices, setVoices] = useState(listKoreanVoices);
  const [saving, setSaving] = useState(false);
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
  const hasMale = voices.some((v) => v.gender === 'male');

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
        학생 화면에서 보리가 읽어 주는 목소리입니다 (레슨·한글 연구소·발음 코치·AI 대화 등). 드라마 등장인물은 각자 설정한 목소리를 그대로 쓰고, 「녹음 관리」에 녹음이 있는 문장은 녹음이 먼저 재생됩니다.
      </p>

      <div className="voice-grid">
        {VOICE_PRESETS.map((p) => (
          <label key={p.id} className={`voice-card ${t.preset === p.id ? 'is-active' : ''}`}>
            <input type="radio" name="voice-preset" checked={t.preset === p.id} onChange={() => setT({ ...t, preset: p.id })} />
            <span className="voice-card__body">
              <b>{p.label}</b>
              <small className="muted">{p.desc}</small>
            </span>
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={(e) => {
                e.preventDefault();
                preview({ ...t, preset: p.id, voiceName: '' });
              }}
            >
              ▶ 듣기
            </button>
          </label>
        ))}
      </div>

      <div className="voice-tune">
        <label>
          높낮이 조절 <b>{t.pitchAdj > 0 ? '+' : ''}{t.pitchAdj.toFixed(2)}</b>
          <input type="range" min={-0.4} max={0.4} step={0.05} value={t.pitchAdj} onChange={(e) => setT({ ...t, pitchAdj: Number(e.target.value) })} />
        </label>
        <label>
          빠르기 조절 <b>×{t.rateAdj.toFixed(2)}</b>
          <input type="range" min={0.7} max={1.3} step={0.05} value={t.rateAdj} onChange={(e) => setT({ ...t, rateAdj: Number(e.target.value) })} />
        </label>
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
      </div>

      <p className="muted small">
        이 기기의 한국어 음성: {voices.length ? voices.map((v) => `${v.name}(${GENDER[v.gender]})`).join(', ') : '없음 — 기기 설정에서 한국어 음성을 설치하세요'}
        {!hasMale && voices.length > 0 && ' · 남성 음성이 없어서 남성 음색은 목소리를 낮춰서 흉내 냅니다.'}
      </p>

      <div className="row">
        <button type="button" className="btn btn--ghost" onClick={() => preview(t)}>
          ▶ 현재 설정으로 듣기
        </button>
        <button type="button" className="btn" onClick={save} disabled={!dirty || saving}>
          💾 음색 저장
        </button>
      </div>
    </section>
  );
}
