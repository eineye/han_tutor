import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import Mascot from '../components/Mascot';
import { useMascotSpeech } from '../components/useMascotSpeech';
import { Toggle } from '../components/ui';
import { listenKorean, recognitionSupported, type Recognizer } from '../lib/speech';
import type { ChatReply, ChatScenario, Lesson } from '../types';
import { LANG_NAME, subtitle, useI18n } from '../i18n';

interface Msg {
  role: 'user' | 'assistant';
  text: string;
  reply?: ChatReply;
}

const FREE: ChatScenario & { key: string; title: string } = {
  key: 'free',
  title: 'free',
  scenario: 'Free, friendly conversation about the student’s daily life, school, hobbies, K-pop and K-dramas.',
  goal_en: 'Talk about anything you like in simple Korean.',
  starter_ko: '안녕하세요! 저는 보리예요. 오늘 기분이 어때요?',
  vocab: [],
};

export default function TalkPage() {
  const { t, tc, lang } = useI18n();
  const [params] = useSearchParams();
  const [scenarios, setScenarios] = useState<(ChatScenario & { key: string; title: string; titleEn?: string })[]>([FREE]);
  const [key, setKey] = useState(params.get('lesson') || 'free');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showRoman, setShowRoman] = useState(true);
  const [showEn, setShowEn] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [listening, setListening] = useState(false);
  const recRef = useRef<Recognizer | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const mascot = useMascotSpeech();

  useEffect(() => {
    api('/curriculum')
      .then(async (c) => {
        const withChat = await Promise.all(c.lessons.map((l: { id: string }) => api(`/lessons/${l.id}`).then((r) => r.lesson as Lesson)));
        setScenarios([FREE, ...withChat.filter((l) => l.chat).map((l) => ({ ...l.chat!, key: l.id, title: l.title.ko, titleEn: l.title.en }))]);
      })
      .catch(() => {});
  }, []);

  const scenario = scenarios.find((s) => s.key === key) || FREE;
  // What the student reads (the AI still receives the English scenario)
  const showTitle = (s: (typeof scenarios)[number]) => {
    if (s.key === 'free') return lang === 'ko' ? '자유 대화' : `${t('talk.free')} · 자유 대화`;
    const sub = s.titleEn ? subtitle({ ko: s.title, en: tc(s.titleEn) }, lang) : '';
    return sub ? `${s.title} · ${sub}` : s.title;
  };
  const showScenario = scenario.key === 'free' ? t('talk.freeScenario') : tc(scenario.scenario);
  const showGoal = scenario.key === 'free' ? t('talk.freeGoal') : tc(scenario.goal_en);

  // Reset conversation when scenario changes
  useEffect(() => {
    const starter: Msg = { role: 'assistant', text: scenario.starter_ko, reply: { ko: scenario.starter_ko, roman: '', en: '' } };
    setMsgs([starter]);
    setError('');
  }, [scenario.key, scenario.starter_ko]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [msgs, busy]);

  const send = async (text: string) => {
    const msg = text.trim();
    if (!msg || busy) return;
    const next: Msg[] = [...msgs, { role: 'user', text: msg }];
    setMsgs(next);
    setInput('');
    setBusy(true);
    setError('');
    try {
      const reply = await api<ChatReply>('/ai/chat', {
        body: {
          scenarioKey: scenario.key,
          scenario: scenario.scenario,
          vocab: scenario.vocab,
          lang: LANG_NAME[lang],
          messages: next.map((m) => ({ role: m.role, text: m.text })),
        },
      });
      setMsgs([...next, { role: 'assistant', text: reply.ko, reply }]);
      if (autoSpeak) mascot.say(reply.ko);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const mic = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    mascot.stop();
    setListening(true);
    recRef.current = listenKorean({
      onInterim: setInput,
      onResult: (best) => {
        setListening(false);
        if (best) setInput(best);
      },
      onError: () => setListening(false),
    });
  };

  const last = [...msgs].reverse().find((m) => m.role === 'assistant')?.reply;

  return (
    <div className="talk">
      <div className="talk__side card">
        <Mascot viseme={mascot.viseme} talking={mascot.speaking} mood={busy ? 'think' : listening ? 'listen' : 'happy'} size={170} />
        <label>
          {t('talk.scenario')}
          <select value={key} onChange={(e) => setKey(e.target.value)}>
            {scenarios.map((s) => (
              <option key={s.key} value={s.key}>
                {showTitle(s)}
              </option>
            ))}
          </select>
        </label>
        <p className="small">{showScenario}</p>
        <p className="small muted">🎯 {showGoal}</p>
        {scenario.vocab.length > 0 && (
          <div className="chips">
            {scenario.vocab.map((v) => (
              <button key={v} className="chip" onClick={() => setInput((i) => (i ? i + ' ' : '') + v)} lang="ko">
                {v}
              </button>
            ))}
          </div>
        )}
        <div className="talk__toggles">
          <Toggle checked={autoSpeak} onChange={setAutoSpeak} label={t('talk.autoSpeak')} />
          <Toggle checked={showRoman} onChange={setShowRoman} label={t('common.romanization')} />
          <Toggle checked={showEn} onChange={setShowEn} label={t('common.translation')} />
        </div>
        <button className="btn btn--ghost btn--small" onClick={() => setMsgs((m) => m.slice(0, 1))}>
          ↻ {t('talk.restart')}
        </button>
      </div>

      <div className="talk__chat card">
        <div className="chat">
          {msgs.map((m, i) => (
            <div key={i} className={`msg msg--${m.role}`}>
              {m.role === 'assistant' && <span className="msg__avatar">🐯</span>}
              <div className="msg__bubble">
                <div lang="ko" className="msg__ko">
                  {m.text}
                </div>
                {m.role === 'assistant' && m.reply && (
                  <>
                    {showRoman && m.reply.roman && <div className="roman">{m.reply.roman}</div>}
                    {m.reply.en && (showEn ? <div className="en">{m.reply.en}</div> : <details className="en"><summary>{t('common.translation')}</summary>{m.reply.en}</details>)}
                    <button className="btn-icon msg__speak" onClick={() => mascot.say(m.text)} aria-label={t('common.listen')}>
                      🔊
                    </button>
                    {m.reply.correction && (
                      <div className="correction">
                        <div className="small muted">✏️ {t('talk.better')}</div>
                        <div>
                          <s lang="ko">{m.reply.correction.original}</s> → <b lang="ko">{m.reply.correction.corrected}</b>
                        </div>
                        <div className="small">{m.reply.correction.explanation_en}</div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="msg msg--assistant">
              <span className="msg__avatar">🐯</span>
              <div className="msg__bubble typing">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {last?.demo && <div className="alert alert--info small">{t('talk.demo')}</div>}
        {error && <div className="alert alert--error">{error}</div>}

        {(last?.suggestions_ko?.length || last?.hint_en) && (
          <div className="suggest">
            {last?.hint_en && <span className="small muted">💡 {last.hint_en}</span>}
            <div className="chips">
              {last?.suggestions_ko?.map((s) => (
                <button key={s} className="chip" onClick={() => setInput(s)} lang="ko">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <form className="composer" onSubmit={onSubmit}>
          {recognitionSupported() && (
            <button type="button" className={`btn btn--rec btn--round ${listening ? 'is-recording' : ''}`} onClick={mic} aria-label={t('pron.speak')}>
              {listening ? '⏹' : '🎤'}
            </button>
          )}
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={lang === 'ko' ? '한국어로 말해 보세요…' : `한국어로 말해 보세요… (${t('talk.placeholder')})`} lang="ko" maxLength={300} />
          <button className="btn" disabled={busy || !input.trim()}>
            {t('talk.send')}
          </button>
        </form>
      </div>
    </div>
  );
}
