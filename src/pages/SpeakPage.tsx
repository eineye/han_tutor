import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import PronunciationPractice from '../components/PronunciationPractice';
import { Loading } from '../components/ui';
import type { Lesson, PronItem } from '../types';

const FREE_SETS: { key: string; title: string; items: PronItem[] }[] = [
  {
    key: 'tricky-vowels',
    title: 'Tricky vowels ㅓ/ㅗ, ㅡ/ㅜ',
    items: [
      { text: '어', roman: 'eo', tip_en: 'Not round!' },
      { text: '오', roman: 'o', tip_en: 'Round lips.' },
      { text: '거기', roman: 'geogi', tip_en: '“there”' },
      { text: '고기', roman: 'gogi', tip_en: '“meat”' },
      { text: '으', roman: 'eu', tip_en: 'Flat lips.' },
      { text: '우', roman: 'u', tip_en: 'Lips forward.' },
    ],
  },
  {
    key: 'three-families',
    title: 'Plain · Aspirated · Tense',
    items: [
      { text: '불', roman: 'bul', tip_en: 'fire — relaxed' },
      { text: '풀', roman: 'pul', tip_en: 'grass — lots of air' },
      { text: '뿔', roman: 'ppul', tip_en: 'horn — tight, no air' },
      { text: '달', roman: 'dal', tip_en: 'moon' },
      { text: '탈', roman: 'tal', tip_en: 'mask' },
      { text: '딸', roman: 'ttal', tip_en: 'daughter' },
    ],
  },
  {
    key: 'kdrama',
    title: 'K-drama favorites',
    items: [
      { text: '대박!', roman: 'daebak!', tip_en: 'Awesome! / No way!' },
      { text: '진짜요?', roman: 'jinjjayo?', tip_en: 'Really?' },
      { text: '괜찮아요', roman: 'gwaenchanayo', tip_en: 'It’s okay. ㅎ is silent: [괜차나요]' },
      { text: '보고 싶어요', roman: 'bogo sipeoyo', tip_en: 'I miss you.' },
      { text: '화이팅!', roman: 'hwaiting!', tip_en: 'You can do it!' },
      { text: '잠깐만요', roman: 'jamkkanmanyo', tip_en: 'Wait a moment.' },
    ],
  },
];

export default function SpeakPage() {
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  const [setKey, setSetKey] = useState('tricky-vowels');
  const [custom, setCustom] = useState('');
  const [customItems, setCustomItems] = useState<PronItem[] | null>(null);

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
      ...FREE_SETS,
      ...(lessons || []).map((l) => ({ key: l.id, title: `${l.title.ko} (${l.title.en})`, items: l.pronunciation!.items, lessonId: l.id })),
    ],
    [lessons],
  );
  const current = customItems ? { key: 'custom', title: 'My sentence', items: customItems } : sets.find((s) => s.key === setKey) || sets[0];

  return (
    <div className="speak">
      <h1>Pronunciation Coach 발음 코치</h1>
      <p className="muted">Listen to Bori, watch the mouth shape, then speak. Syllables turn green when I hear them correctly!</p>
      <div className="speak__controls card">
        <label>
          Practice set
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
            {customItems && <option value="custom">My sentence</option>}
          </select>
        </label>
        <form
          className="speak__custom"
          onSubmit={(e) => {
            e.preventDefault();
            if (custom.trim()) setCustomItems([{ text: custom.trim(), roman: '', tip_en: '' }]);
          }}
        >
          <label>
            …or type any Korean sentence
            <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="예: 만나서 반가워요" lang="ko" />
          </label>
          <button className="btn">Practice</button>
        </form>
      </div>
      {lessons === null && <Loading text="Loading lesson sets…" />}
      <div className="card">
        <PronunciationPractice key={current.key + (customItems?.[0]?.text || '')} items={current.items} lessonId={'lessonId' in current ? (current as { lessonId?: string }).lessonId : undefined} />
      </div>
    </div>
  );
}
