import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import PronunciationPractice from '../components/PronunciationPractice';
import { Loading } from '../components/ui';
import { localizeLesson, subtitle, useI18n } from '../i18n';
import type { UIKey } from '../i18n/ui';
import type { Lesson, PronItem } from '../types';
import { getVoiceMode, setVoiceMode, voiceKinds, type VoiceMode } from '../lib/speech';

type Item = { text: string; roman: string; tip: UIKey };
const FREE_SETS: { key: string; title: UIKey; items: Item[] }[] = [
  {
    key: 'tricky-vowels',
    title: 'speak.set.vowels',
    items: [
      { text: '어', roman: 'eo', tip: 'speak.tip.notRound' },
      { text: '오', roman: 'o', tip: 'speak.tip.round' },
      { text: '거기', roman: 'geogi', tip: 'speak.tip.there' },
      { text: '고기', roman: 'gogi', tip: 'speak.tip.meat' },
      { text: '으', roman: 'eu', tip: 'speak.tip.flat' },
      { text: '우', roman: 'u', tip: 'speak.tip.forward' },
    ],
  },
  {
    key: 'three-families',
    title: 'speak.set.families',
    items: [
      { text: '불', roman: 'bul', tip: 'speak.tip.fire' },
      { text: '풀', roman: 'pul', tip: 'speak.tip.grass' },
      { text: '뿔', roman: 'ppul', tip: 'speak.tip.horn' },
      { text: '달', roman: 'dal', tip: 'speak.tip.moon' },
      { text: '탈', roman: 'tal', tip: 'speak.tip.mask' },
      { text: '딸', roman: 'ttal', tip: 'speak.tip.daughter' },
    ],
  },
  {
    key: 'kdrama',
    title: 'speak.set.kdrama',
    items: [
      { text: '대박!', roman: 'daebak!', tip: 'speak.tip.daebak' },
      { text: '진짜요?', roman: 'jinjjayo?', tip: 'speak.tip.really' },
      { text: '괜찮아요', roman: 'gwaenchanayo', tip: 'speak.tip.okay' },
      { text: '보고 싶어요', roman: 'bogo sipeoyo', tip: 'speak.tip.miss' },
      { text: '화이팅!', roman: 'hwaiting!', tip: 'speak.tip.fighting' },
      { text: '잠깐만요', roman: 'jamkkanmanyo', tip: 'speak.tip.wait' },
    ],
  },
];

export default function SpeakPage() {
  const { t, tc, lang } = useI18n();
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  const [setKey, setSetKey] = useState('tricky-vowels');
  const [custom, setCustom] = useState('');
  const [customItems, setCustomItems] = useState<PronItem[] | null>(null);
  const [voiceMode, setMode] = useState<VoiceMode>(getVoiceMode);
  const [kinds, setKinds] = useState(voiceKinds);

  useEffect(() => {
    // the voice list loads asynchronously in most browsers
    if (!('speechSynthesis' in window)) return;
    const update = () => setKinds(voiceKinds());
    window.speechSynthesis.addEventListener?.('voiceschanged', update);
    update();
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', update);
  }, []);

  useEffect(() => {
    // load pronunciation items from all lessons
    api('/curriculum')
      .then(async (c) => {
        const full = await Promise.all(c.lessons.map((l: { id: string }) => api(`/lessons/${l.id}`).then((r) => r.lesson as Lesson)));
        setLessons(full.filter((l) => l.pronunciation?.items?.length));
      })
      .catch(() => setLessons([]));
  }, []);

  const sets = useMemo(
    () => [
      ...FREE_SETS.map((s) => ({ key: s.key, title: t(s.title), items: s.items.map((i): PronItem => ({ text: i.text, roman: i.roman, tip_en: t(i.tip) })) })),
      ...(lessons || []).map((raw) => {
        const l = localizeLesson(raw, tc);
        const sub = subtitle(l.title, lang);
        return { key: l.id, title: sub ? `${l.title.ko} (${sub})` : l.title.ko, items: l.pronunciation!.items, lessonId: l.id };
      }),
    ],
    [lessons, t, tc, lang],
  );
  const current = customItems ? { key: 'custom', title: t('speak.mySentence'), items: customItems } : sets.find((s) => s.key === setKey) || sets[0];

  return (
    <div className="speak">
      <h1>
        {t('speak.title')}
        {lang !== 'ko' && ' 발음 코치'}
      </h1>
      <p className="muted">{t('speak.intro')}</p>
      <div className="speak__controls card">
        <label>
          {t('speak.set')}
          <select
            value={customItems ? 'custom' : setKey}
            onChange={(e) => {
              setCustomItems(null);
              setSetKey(e.target.value);
            }}
          >
            {sets.map((s) => (
              <option key={s.key} value={s.key}>
                {s.title}
              </option>
            ))}
            {customItems && <option value="custom">{t('speak.mySentence')}</option>}
          </select>
        </label>
        {kinds.local && kinds.online && (
          <label>
            {t('speak.voice')}
            <select
              value={voiceMode}
              onChange={(e) => {
                const m = e.target.value as VoiceMode;
                setVoiceMode(m);
                setMode(m);
              }}
            >
              <option value="fast">{t('speak.voice.fast')}</option>
              <option value="quality">{t('speak.voice.quality')}</option>
            </select>
          </label>
        )}
        <form
          className="speak__custom"
          onSubmit={(e) => {
            e.preventDefault();
            if (custom.trim()) setCustomItems([{ text: custom.trim(), roman: '', tip_en: '' }]);
          }}
        >
          <label>
            {t('speak.typeAny')}
            <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="예: 만나서 반가워요" lang="ko" />
          </label>
          <button className="btn">{t('speak.practice')}</button>
        </form>
      </div>
      {lessons === null && <Loading text={t('speak.loadingSets')} />}
      <div className="card">
        <PronunciationPractice key={current.key + (customItems?.[0]?.text || '')} items={current.items} lessonId={'lessonId' in current ? (current as { lessonId?: string }).lessonId : undefined} visual="lips" />
      </div>
    </div>
  );
}
