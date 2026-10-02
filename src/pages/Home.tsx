import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import Mascot from '../components/Mascot';
import { useMascotSpeech } from '../components/useMascotSpeech';
import { ErrorBox, Loading, ProgressBar, fmtDate } from '../components/ui';
import { subtitle, useI18n } from '../i18n';
import type { UIKey } from '../i18n/ui';
import type { Assignment, Lesson, Progress, Unit } from '../types';

type LessonSummary = Pick<Lesson, 'id' | 'unitId' | 'order' | 'kind' | 'title' | 'objectives'> & { progress: Progress | null };

const PHRASES: { ko: string; key: UIKey }[] = [
  { ko: '오늘도 화이팅!', key: 'home.phrase1' },
  { ko: '천천히 해도 괜찮아요.', key: 'home.phrase2' },
  { ko: '같이 공부해요!', key: 'home.phrase3' },
  { ko: '한국어 재미있어요!', key: 'home.phrase4' },
];

export default function Home() {
  const { student } = useAuth();
  const { t, tc, lang } = useI18n();
  const [data, setData] = useState<{ units: Unit[]; lessons: LessonSummary[] } | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [error, setError] = useState<unknown>(null);
  const mascot = useMascotSpeech();
  const [phrase] = useState(() => PHRASES[Math.floor(Math.random() * PHRASES.length)]);

  useEffect(() => {
    api('/curriculum').then(setData).catch(setError);
    api('/my/summary')
      .then((s) => setAssignments(s.assignments))
      .catch(() => {});
  }, []);

  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;

  const next = data.lessons.find((l) => !l.progress?.completedAt) || data.lessons[data.lessons.length - 1];
  const done = data.lessons.filter((l) => l.progress?.completedAt).length;
  const lessonTitle = (id: string | null) => data.lessons.find((l) => l.id === id)?.title;
  const openAssignments = assignments.filter((a) => !a.done);
  const phraseMeaning = t(phrase.key);

  return (
    <div className="home">
      <section className="hero card">
        <button className="hero__mascot" onClick={() => mascot.say(`${student?.name} 씨, 안녕하세요! ${phrase.ko}`)} aria-label={t('home.talkToBori')}>
          <Mascot viseme={mascot.viseme} talking={mascot.speaking} mood="happy" size={150} />
        </button>
        <div>
          <p className="muted">안녕하세요, {student?.name}!</p>
          <h1 lang="ko">{phrase.ko}</h1>
          {phraseMeaning !== phrase.ko && <p className="muted">{phraseMeaning}</p>}
          <div className="hero__stats">
            <div>
              <b>{done}</b>
              <small>{t('home.lessonsDone')}</small>
            </div>
            <div>
              <b>⭐ {student?.xp ?? 0}</b>
              <small>XP</small>
            </div>
            <div>
              <b>🔥 {student?.streak ?? 0}</b>
              <small>{t('home.streak')}</small>
            </div>
          </div>
          <ProgressBar value={done} max={data.lessons.length} />
        </div>
      </section>

      {next && (
        <Link to={`/lesson/${next.id}`} className="card continue">
          <div>
            <small className="muted">{next.progress ? t('home.continue') : t('home.start')} →</small>
            <h2 lang="ko">{next.title.ko}</h2>
            <p>{subtitle({ ko: next.title.ko, en: tc(next.title.en) }, lang)}</p>
          </div>
          <span className="continue__arrow">▶</span>
        </Link>
      )}

      {openAssignments.length > 0 && (
        <section className="card">
          <h3>📌 {t('home.homework')}</h3>
          <ul className="list">
            {openAssignments.map((a) => (
              <li key={a.id}>
                <Link to={a.lessonId ? `/lesson/${a.lessonId}` : `/drama/${a.videoId}`}>
                  <b>{a.title || (lessonTitle(a.lessonId) ? `${lessonTitle(a.lessonId)!.ko}` : t('home.dramaScene'))}</b>
                </Link>
                {a.due && <span className="badge">{t('home.due', { date: fmtDate(a.due) })}</span>}
                {a.note && <div className="muted small">{a.note}</div>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="quick-grid">
        <Link className="quick quick--hangeul" to="/hangeul">
          <span>🔤</span>
          <b>{t('home.q.hangeul')}</b>
          <small>{t('home.q.hangeulSub')}</small>
        </Link>
        <Link className="quick quick--speak" to="/speak">
          <span>🎤</span>
          <b>{t('home.q.speak')}</b>
          <small>{t('home.q.speakSub')}</small>
        </Link>
        <Link className="quick quick--talk" to="/talk">
          <span>💬</span>
          <b>{t('home.q.talk')}</b>
          <small>{t('home.q.talkSub')}</small>
        </Link>
        <Link className="quick quick--drama" to="/drama">
          <span>🎬</span>
          <b>{t('home.q.drama')}</b>
          <small>{t('home.q.dramaSub')}</small>
        </Link>
      </section>
    </div>
  );
}
